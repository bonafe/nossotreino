import { gerarIdUnico } from "./identificadores.js";
import { Formatadores, DIAS_SEMANA } from "./formatadores.js";
import { BancoIndexedDB } from "./armazenamento-indexeddb.js";
import "./versao.js";
import "./consentimento-analytics.js";

// Mapa entre a chave relativa "histórica" (a mesma usada por toda página
// desde a época do localStorage) e o `tipo` físico dentro da loja única
// `historico` do IndexedDB (ver esquema em armazenamento-indexeddb.js).
const CHAVES_HISTORICO = {
  "historico.sessaoBicicleta.v1": "sessaoBicicleta",
  "historico.serieMusculacao.v1": "serieMusculacao",
  "historico.sessaoMusculacao.v1": "sessaoMusculacao",
  "historico.sessaoAlongamento.v1": "sessaoAlongamento",
  "historico.serieAlongamento.v1": "serieAlongamento",
  "historico.sessaoLivre.v1": "sessaoLivre"
};

function analisarChaveExecucao(chaveRelativa) {
  let combinacao = chaveRelativa.match(/^execucao\.musculacao\.(.+)\.v2$/);
  if (combinacao) return { tipo: "musculacao", treinoId: combinacao[1] };

  combinacao = chaveRelativa.match(/^execucao\.alongamento\.(.+)\.v1$/);
  if (combinacao) return { tipo: "alongamento", treinoId: combinacao[1] };

  // Sessão de atividade livre "uma vez" com início/fim cronometrados
  // (ver atividade-livre-novo.js) — só uma pode estar em andamento por
  // plano ao mesmo tempo, então o treinoId é uma constante fixa em vez de
  // um id de treino de verdade.
  if (chaveRelativa === "execucao.atividadeLivre.v1") return { tipo: "atividadeLivre", treinoId: "unica" };

  return null;
}

const PREFIXOS_CHAVE_EXECUCAO = {
  musculacao: (treinoId) => `execucao.musculacao.${treinoId}.v2`,
  alongamento: (treinoId) => `execucao.alongamento.${treinoId}.v1`,
  atividadeLivre: () => "execucao.atividadeLivre.v1"
};

// Espelho em memória do banco, montado uma vez por carregamento de página
// (ver hidratar()). Leituras são síncronas sobre este objeto; escritas
// mutam aqui na hora e são enfileiradas pra gravação real no IndexedDB em
// segundo plano (enfileirarEscrita) — ver seção 3.4 de
// docs/armazenamento-local-especificacao.md.
const instantaneo = {
  alunos: [],
  planos: [],
  planoDados: new Map(), // planoId -> dados (composição completa do plano)
  historico: new Map(), // `${planoId}|${tipo}` -> array de entradas
  execucoes: new Map(), // `${planoId}|${tipo}|${treinoId}` -> progresso
  preferencias: new Map(), // chave -> valor (planoAtivoId, apoio.*, avisoIaAceito.v1)
  bibliotecaPersonalizada: new Map(), // `${dominio}|${id}` -> registro (ver seção "Biblioteca personalizada" abaixo)
  tiposAtividade: [] // árvore local de tipos de atividade (ver seção "Tipos de atividade" abaixo)
};

let filaDeEscrita = Promise.resolve();

// Encadeia as gravações numa fila única: preserva a ordem entre operações
// (ex.: ativarPlano antes de definirDadosTreinos) e dá um ponto único de
// espera (aguardarEscritas) pros poucos lugares que navegam logo depois de
// gravar. Falha de gravação nunca propaga — mesma filosofia do
// try/catch silencioso de sempre, só que assíncrona agora.
function enfileirarEscrita(operacao) {
  filaDeEscrita = filaDeEscrita.then(operacao).catch((erro) => {
    console.warn("storage.js: gravação em segundo plano falhou", erro);
  });
}

function obterPlanoAtivoId() {
  return instantaneo.preferencias.has("planoAtivoId") ? instantaneo.preferencias.get("planoAtivoId") : null;
}

function lerJSONDoPlano(planoId, chaveRelativa, padrao) {
  if (!planoId) return padrao;

  if (chaveRelativa === "dados.v1") {
    return instantaneo.planoDados.has(planoId) ? instantaneo.planoDados.get(planoId) : padrao;
  }

  const tipoHistorico = CHAVES_HISTORICO[chaveRelativa];
  if (tipoHistorico) {
    const chaveMapa = `${planoId}|${tipoHistorico}`;
    return instantaneo.historico.has(chaveMapa) ? instantaneo.historico.get(chaveMapa) : padrao;
  }

  const execucao = analisarChaveExecucao(chaveRelativa);
  if (execucao) {
    const chaveMapa = `${planoId}|${execucao.tipo}|${execucao.treinoId}`;
    return instantaneo.execucoes.has(chaveMapa) ? instantaneo.execucoes.get(chaveMapa) : padrao;
  }

  return padrao;
}

async function substituirHistoricoNoBanco(planoId, tipo, entradas) {
  await BancoIndexedDB.removerPorIndice("historico", "porPlanoETipo", IDBKeyRange.only([planoId, tipo]));
  await BancoIndexedDB.gravarVarios(
    "historico",
    entradas.map((entrada) => ({ planoId, tipo, ...entrada }))
  );
}

function salvarJSONDoPlano(planoId, chaveRelativa, valor) {
  if (!planoId) return;

  if (chaveRelativa === "dados.v1") {
    instantaneo.planoDados.set(planoId, valor);
    enfileirarEscrita(() => BancoIndexedDB.gravar("planoDados", { planoId, dados: valor }));
    return;
  }

  const tipoHistorico = CHAVES_HISTORICO[chaveRelativa];
  if (tipoHistorico) {
    instantaneo.historico.set(`${planoId}|${tipoHistorico}`, valor);
    enfileirarEscrita(() => substituirHistoricoNoBanco(planoId, tipoHistorico, valor));
    return;
  }

  const execucao = analisarChaveExecucao(chaveRelativa);
  if (execucao) {
    instantaneo.execucoes.set(`${planoId}|${execucao.tipo}|${execucao.treinoId}`, valor);
    enfileirarEscrita(() =>
      BancoIndexedDB.gravar("execucoes", { planoId, tipo: execucao.tipo, treinoId: execucao.treinoId, progresso: valor })
    );
  }
}

function removerChaveDoPlano(planoId, chaveRelativa) {
  if (!planoId) return;

  if (chaveRelativa === "dados.v1") {
    instantaneo.planoDados.delete(planoId);
    enfileirarEscrita(() => BancoIndexedDB.remover("planoDados", planoId));
    return;
  }

  const tipoHistorico = CHAVES_HISTORICO[chaveRelativa];
  if (tipoHistorico) {
    instantaneo.historico.delete(`${planoId}|${tipoHistorico}`);
    enfileirarEscrita(() => BancoIndexedDB.removerPorIndice("historico", "porPlanoETipo", IDBKeyRange.only([planoId, tipoHistorico])));
    return;
  }

  const execucao = analisarChaveExecucao(chaveRelativa);
  if (execucao) {
    instantaneo.execucoes.delete(`${planoId}|${execucao.tipo}|${execucao.treinoId}`);
    enfileirarEscrita(() => BancoIndexedDB.remover("execucoes", [planoId, execucao.tipo, execucao.treinoId]));
  }
}

// Chaves relativas de execução em andamento presentes em memória pra um
// plano, filtradas por prefixo — equivalente ao antigo "varrer localStorage
// por prefixo", só que sobre o instantâneo.
function listarChavesDoPlano(planoId, prefixo) {
  const chaves = [];
  instantaneo.execucoes.forEach((valor, chaveMapa) => {
    const [pid, tipo, treinoId] = chaveMapa.split("|");
    if (pid !== planoId) return;
    const montarChave = PREFIXOS_CHAVE_EXECUCAO[tipo];
    if (!montarChave) return;
    const chaveRelativa = montarChave(treinoId);
    if (chaveRelativa.startsWith(prefixo)) chaves.push(chaveRelativa);
  });
  return chaves;
}

function lerJSON(chave, padrao) {
  return lerJSONDoPlano(obterPlanoAtivoId(), chave, padrao);
}

function salvarJSON(chave, valor) {
  salvarJSONDoPlano(obterPlanoAtivoId(), chave, valor);
}

function removerChave(chave) {
  removerChaveDoPlano(obterPlanoAtivoId(), chave);
}

function listarChavesComPrefixo(prefixo) {
  const planoId = obterPlanoAtivoId();
  return planoId ? listarChavesDoPlano(planoId, prefixo) : [];
}

function lerJSONGlobal(chave, padrao) {
  return instantaneo.preferencias.has(chave) ? instantaneo.preferencias.get(chave) : padrao;
}

function salvarJSONGlobal(chave, valor) {
  instantaneo.preferencias.set(chave, valor);
  enfileirarEscrita(() => BancoIndexedDB.gravar("preferencias", { chave, valor }));
}

function montarExportacaoCompletaDoPlano(id) {
  const execucoesEmAndamento = {};
  listarChavesDoPlano(id, "execucao.musculacao.").forEach((chave) => {
    execucoesEmAndamento[chave] = lerJSONDoPlano(id, chave, null);
  });
  listarChavesDoPlano(id, "execucao.alongamento.").forEach((chave) => {
    execucoesEmAndamento[chave] = lerJSONDoPlano(id, chave, null);
  });
  listarChavesDoPlano(id, "execucao.atividadeLivre.").forEach((chave) => {
    execucoesEmAndamento[chave] = lerJSONDoPlano(id, chave, null);
  });

  return {
    dadosTreinos: lerJSONDoPlano(id, "dados.v1", null),
    historicoSessaoBicicleta: lerJSONDoPlano(id, "historico.sessaoBicicleta.v1", []),
    historicoSerieMusculacao: lerJSONDoPlano(id, "historico.serieMusculacao.v1", []),
    historicoSessaoMusculacao: lerJSONDoPlano(id, "historico.sessaoMusculacao.v1", []),
    historicoSessaoAlongamento: lerJSONDoPlano(id, "historico.sessaoAlongamento.v1", []),
    historicoSerieAlongamento: lerJSONDoPlano(id, "historico.serieAlongamento.v1", []),
    historicoSessaoLivre: lerJSONDoPlano(id, "historico.sessaoLivre.v1", []),
    execucoesEmAndamento
  };
}

function restaurarExportacaoCompletaDoPlano(id, exportacao) {
  salvarJSONDoPlano(id, "dados.v1", exportacao.dadosTreinos || null);
  salvarJSONDoPlano(id, "historico.sessaoBicicleta.v1", exportacao.historicoSessaoBicicleta || []);
  salvarJSONDoPlano(id, "historico.serieMusculacao.v1", exportacao.historicoSerieMusculacao || []);
  salvarJSONDoPlano(id, "historico.sessaoMusculacao.v1", exportacao.historicoSessaoMusculacao || []);
  salvarJSONDoPlano(id, "historico.sessaoAlongamento.v1", exportacao.historicoSessaoAlongamento || []);
  salvarJSONDoPlano(id, "historico.serieAlongamento.v1", exportacao.historicoSerieAlongamento || []);
  salvarJSONDoPlano(id, "historico.sessaoLivre.v1", exportacao.historicoSessaoLivre || []);
  Object.entries(exportacao.execucoesEmAndamento || {}).forEach(([chave, valor]) => {
    salvarJSONDoPlano(id, chave, valor);
  });
}

// Cria um Aluno pra cada nome distinto encontrado em `planos` que ainda
// não tenha `alunoId` (formato anterior a existir a entidade Aluno —
// `plano.aluno` era texto livre), preenchendo `alunoId` em cada plano e
// removendo o texto livre. Muta `planos` in place. Usada por
// migrarBackupDe1Para2 (abaixo) — exemplo canônico do padrão "preguiçosa,
// idempotente, silenciosa" que toda migração nova deve seguir (ver seção 2
// de docs/armazenamento-local-especificacao.md).
function migrarAlunosApartirDePlanos(planos) {
  const alunos = [];
  const nomeParaId = new Map();

  planos.forEach((plano) => {
    if (plano.alunoId) return;

    const nome = (plano.aluno || "").trim();
    const chaveNome = nome.toLowerCase();
    let alunoId = nomeParaId.get(chaveNome);
    if (!alunoId) {
      alunoId = gerarIdUnico(nome || "aluno", new Set(alunos.map((a) => a.id)), "aluno");
      const agora = plano.criadoEm || new Date().toISOString();
      alunos.push({ id: alunoId, nome, criadoEm: agora, atualizadoEm: agora });
      nomeParaId.set(chaveNome, alunoId);
    }

    plano.alunoId = alunoId;
    delete plano.aluno;
  });

  return alunos;
}

// --- Migração de formato: plano (schemaVersion) ---
//
// Cada mudança de schemaVersion do documento do plano precisa de uma
// função aqui, migrando de UMA versão pra a seguinte (nunca pulando
// versões) — nunca editar uma migração já publicada, só acrescentar a
// próxima quando o formato mudar de novo. Ver seção 2 de
// docs/armazenamento-local-especificacao.md.
const SCHEMA_VERSION_PLANO_ATUAL = "1.4";

// Formato 1.3: sem `atividadesRecorrentes` (agenda/atividade recorrente
// ainda não existia) — plano antigo simplesmente não tinha nenhuma regra
// recorrente pra trazer, então migra pra `[]`.
function migrarPlanoDe13Para14(dados) {
  return { ...dados, schemaVersion: "1.4", atividadesRecorrentes: dados.atividadesRecorrentes || [] };
}

const MIGRACOES_PLANO = {
  // "1.2": migrarPlanoDe12Para13 — formato 1.2 (cardio/alongamento
  // embutidos em treino.cardio[]/treino.alongamento[], sem id/nome
  // próprios) não tem nenhuma instância real conhecida sobrevivendo hoje;
  // se aparecer um arquivo nesse formato, escreva a função a partir desse
  // exemplar real (ver docs/especificacao-biblioteca-exercicios.md §16
  // pro shape antigo de referência) em vez de reconstruir de memória.
  "1.3": migrarPlanoDe13Para14
};

// Aplica a cadeia de migrações até chegar em SCHEMA_VERSION_PLANO_ATUAL.
// Se a versão não tiver migração cadastrada (desconhecida, ou mais nova
// que a atual), devolve o documento como veio — nunca modifica sem saber
// como.
function migrarPlanoParaVersaoAtual(dados) {
  if (!dados) return dados;
  let atual = dados;
  let seguranca = 0;
  while (atual.schemaVersion !== SCHEMA_VERSION_PLANO_ATUAL && seguranca < 20) {
    const migracao = MIGRACOES_PLANO[atual.schemaVersion];
    if (!migracao) return atual;
    atual = migracao(atual);
    seguranca += 1;
  }
  return atual;
}

// --- Migração de formato: envelope de backup (versao) ---

const VERSAO_BACKUP_ATUAL = 5;

const MIGRACOES_BACKUP = {
  1: migrarBackupDe1Para2,
  2: migrarBackupDe2Para3,
  3: migrarBackupDe3Para4,
  4: migrarBackupDe4Para5
};

// Formato 1: sem `alunos` (entidade Aluno ainda não existia) — deriva a
// partir de `planos[].aluno` (texto livre), mesma lógica de
// migrarAlunosApartirDePlanos.
function migrarBackupDe1Para2(backup) {
  const planos = backup.planos || [];
  const alunos = backup.alunos || migrarAlunosApartirDePlanos(planos);
  return { ...backup, versao: 2, alunos, planos };
}

// Formato 2: sem `bibliotecaPersonalizada` (loja ainda não existia) —
// backup antigo simplesmente não tinha nenhum exercício/alongamento
// personalizado pra trazer.
function migrarBackupDe2Para3(backup) {
  return { ...backup, versao: 3, bibliotecaPersonalizada: backup.bibliotecaPersonalizada || [] };
}

// Formato 3: sem `tiposAtividade` (árvore de atividade livre ainda não
// existia) — semeia com as mesmas duas raízes de
// criarLojaDeTiposAtividade (armazenamento-indexeddb.js), nunca `[]`,
// pra restaurar um backup antigo não deixar a árvore vazia.
function migrarBackupDe3Para4(backup) {
  if (backup.tiposAtividade) return { ...backup, versao: 4 };
  const agora = new Date().toISOString();
  return {
    ...backup,
    versao: 4,
    tiposAtividade: [
      { id: "musculacao", nome: "Musculação", tipoAtividadePaiId: null, criadoEm: agora },
      { id: "alongamento", nome: "Alongamento", tipoAtividadePaiId: null, criadoEm: agora }
    ]
  };
}

// Formato 4: `tiposAtividade` ainda no formato de pai único
// (`tipoAtividadePaiId`) — converte cada nó pra `categoriaIds` (array
// multi-categoria), mesma função usada na migração preguiçosa do dado
// local (ver hidratar() e migrarTipoAtividadeParaCategoriaIds).
function migrarBackupDe4Para5(backup) {
  return { ...backup, versao: 5, tiposAtividade: migrarTiposAtividadeParaCategoriaIds(backup.tiposAtividade || []) };
}

function migrarBackupParaVersaoAtual(backupOriginal) {
  let atual = { ...backupOriginal, versao: backupOriginal.versao || 1 };
  let seguranca = 0;
  while (atual.versao !== VERSAO_BACKUP_ATUAL && seguranca < 20) {
    const migracao = MIGRACOES_BACKUP[atual.versao];
    if (!migracao) return atual;
    atual = migracao(atual);
    seguranca += 1;
  }
  return atual;
}

// Migração de formato: tiposAtividade — `tipoAtividadePaiId` (pai único,
// string ou null) → `categoriaIds` (array de 0+ ids, mesma coleção
// self-referencial — ver seção 2 de docs/atividade-livre-especificacao.md).
// Idempotente por referência: um registro que já tenha `categoriaIds`
// (array, mesmo vazio) volta inalterado (mesma referência, não uma cópia)
// — usado pelos chamadores pra saber quais registros precisam ser
// regravados. Nunca lança: `tipoAtividadePaiId` ausente/undefined também
// vira `[]`, não só `null` explícito.
function migrarTipoAtividadeParaCategoriaIds(tipo) {
  if (Array.isArray(tipo.categoriaIds)) return tipo;
  const { tipoAtividadePaiId, ...resto } = tipo;
  return { ...resto, categoriaIds: tipoAtividadePaiId ? [tipoAtividadePaiId] : [] };
}

function migrarTiposAtividadeParaCategoriaIds(lista) {
  return lista.map(migrarTipoAtividadeParaCategoriaIds);
}

// Preenche o instantâneo a partir do IndexedDB, uma vez por carregamento de
// página — ver `export const pronto` no fim do arquivo. Se o banco estiver
// indisponível (Safari em file://, storage desabilitado etc.), segue com o
// instantâneo vazio: leituras devolvem o padrão, escritas ficam só em
// memória pela duração da página, nada quebra.
async function hidratar() {
  const banco = await BancoIndexedDB.abrir();
  if (!banco) return;

  const [
    alunos,
    planos,
    planoDadosRegistros,
    historicoRegistros,
    execucoesRegistros,
    preferenciasRegistros,
    bibliotecaPersonalizadaRegistros,
    tiposAtividadeRegistros
  ] = await Promise.all([
    BancoIndexedDB.lerTodos("alunos"),
    BancoIndexedDB.lerTodos("planos"),
    BancoIndexedDB.lerTodos("planoDados"),
    BancoIndexedDB.lerTodos("historico"),
    BancoIndexedDB.lerTodos("execucoes"),
    BancoIndexedDB.lerTodos("preferencias"),
    BancoIndexedDB.lerTodos("bibliotecaPersonalizada"),
    BancoIndexedDB.lerTodos("tiposAtividade")
  ]);

  instantaneo.alunos = alunos;
  instantaneo.planos = planos;

  planoDadosRegistros.forEach((registro) => instantaneo.planoDados.set(registro.planoId, registro.dados));

  historicoRegistros.forEach((registro) => {
    const { id, planoId, tipo, ...entrada } = registro;
    const chaveMapa = `${planoId}|${tipo}`;
    if (!instantaneo.historico.has(chaveMapa)) instantaneo.historico.set(chaveMapa, []);
    instantaneo.historico.get(chaveMapa).push(entrada);
  });

  execucoesRegistros.forEach((registro) => {
    instantaneo.execucoes.set(`${registro.planoId}|${registro.tipo}|${registro.treinoId}`, registro.progresso);
  });

  preferenciasRegistros.forEach((registro) => instantaneo.preferencias.set(registro.chave, registro.valor));

  bibliotecaPersonalizadaRegistros.forEach((registro) => {
    instantaneo.bibliotecaPersonalizada.set(`${registro.dominio}|${registro.id}`, registro);
  });

  const tiposAtividadeMigrados = migrarTiposAtividadeParaCategoriaIds(tiposAtividadeRegistros);
  instantaneo.tiposAtividade = tiposAtividadeMigrados;
  // Preguiçosa: só regrava em segundo plano os registros que de fato
  // mudaram de shape (comparação por referência) — próximos boots não
  // regravam nada. Silenciosa/segura-na-falha: enfileirarEscrita já
  // engole erro de gravação, a leitura em memória desta sessão já está
  // correta independente do resultado da escrita.
  tiposAtividadeMigrados.forEach((tipo, indice) => {
    if (tipo !== tiposAtividadeRegistros[indice]) {
      enfileirarEscrita(() => BancoIndexedDB.gravar("tiposAtividade", tipo));
    }
  });
}

export class TreinosStorage {
  static chaves = {
    dadosTreinos: "dados.v1",
    historicoSessaoBicicleta: "historico.sessaoBicicleta.v1",
    historicoSerieMusculacao: "historico.serieMusculacao.v1",
    historicoSessaoMusculacao: "historico.sessaoMusculacao.v1",
    historicoSessaoAlongamento: "historico.sessaoAlongamento.v1",
    historicoSerieAlongamento: "historico.serieAlongamento.v1",
    historicoSessaoLivre: "historico.sessaoLivre.v1",
    execucaoMusculacao: (treinoId) => `execucao.musculacao.${treinoId}.v2`,
    execucaoAlongamento: (treinoId) => `execucao.alongamento.${treinoId}.v1`,
    execucaoAtividadeLivre: "execucao.atividadeLivre.v1",
    apoioUltimaExibicaoContador: "apoio.ultimaExibicaoContador.v1",
    apoioUltimaExibicaoData: "apoio.ultimaExibicaoData.v1",
    apoioDispensadoPermanentemente: "apoio.dispensadoPermanentemente.v1",
    avisoIaAceito: "avisoIaAceito.v1"
  };

  // Escopadas ao plano ativo — usadas por toda página de treino.
  static lerJSON(chave, padrao) {
    return lerJSON(chave, padrao);
  }

  static salvarJSON(chave, valor) {
    salvarJSON(chave, valor);
  }

  static removerChave(chave) {
    removerChave(chave);
  }

  static listarChavesComPrefixo(prefixo) {
    return listarChavesComPrefixo(prefixo);
  }

  static adicionarAoHistorico(chave, entrada) {
    const planoId = obterPlanoAtivoId();
    const tipoHistorico = CHAVES_HISTORICO[chave];
    if (!planoId || !tipoHistorico) return lerJSON(chave, []);

    const chaveMapa = `${planoId}|${tipoHistorico}`;
    const lista = instantaneo.historico.get(chaveMapa) || [];
    lista.push(entrada);
    instantaneo.historico.set(chaveMapa, lista);
    enfileirarEscrita(() => BancoIndexedDB.gravar("historico", { planoId, tipo: tipoHistorico, ...entrada }));
    return lista;
  }

  // Globais — não dependem de qual plano está ativo (preferência de
  // imagem, contadores do banner de apoio).
  static lerJSONGlobal(chave, padrao) {
    return lerJSONGlobal(chave, padrao);
  }

  static salvarJSONGlobal(chave, valor) {
    salvarJSONGlobal(chave, valor);
  }

  // Espera a fila de gravações em segundo plano esvaziar — usada só nos
  // pontos que navegam pra outra página logo depois de gravar (IndexedDB é
  // assíncrono; sem isso a navegação poderia acontecer antes da escrita
  // terminar).
  static async aguardarEscritas() {
    await filaDeEscrita;
  }

  static definirDadosTreinos(dados) {
    salvarJSON("dados.v1", dados);
    TreinosStorage.#tocarAtualizadoEmDoAtivo();
  }

  static async carregarDadosTreinos() {
    const cache = lerJSON("dados.v1", null);
    if (cache) return cache;
    throw new Error("Nenhum dado de treino carregado ainda.");
  }

  static #tocarAtualizadoEmDoAtivo() {
    const id = obterPlanoAtivoId();
    if (!id) return;
    const entrada = instantaneo.planos.find((p) => p.id === id);
    if (entrada) {
      entrada.atualizadoEm = new Date().toISOString();
      enfileirarEscrita(() => BancoIndexedDB.gravar("planos", entrada));
    }
  }

  static resetarMusculacao() {
    removerChave(TreinosStorage.chaves.historicoSerieMusculacao);
    removerChave(TreinosStorage.chaves.historicoSessaoMusculacao);
    listarChavesComPrefixo("execucao.musculacao.").forEach((chave) => removerChave(chave));
  }

  static resetarBicicleta() {
    removerChave(TreinosStorage.chaves.historicoSessaoBicicleta);
  }

  static resetarAlongamento() {
    removerChave(TreinosStorage.chaves.historicoSessaoAlongamento);
    removerChave(TreinosStorage.chaves.historicoSerieAlongamento);
    listarChavesComPrefixo("execucao.alongamento.").forEach((chave) => removerChave(chave));
  }

  static resetarAtividadeLivre() {
    removerChave(TreinosStorage.chaves.historicoSessaoLivre);
    removerChave(TreinosStorage.chaves.execucaoAtividadeLivre);
    const dados = lerJSON("dados.v1", null);
    if (dados && dados.atividadesRecorrentes && dados.atividadesRecorrentes.length) {
      dados.atividadesRecorrentes = [];
      TreinosStorage.definirDadosTreinos(dados);
    }
  }

  // --- Gestão de alunos (alunos.html) ---

  static listarAlunos() {
    return instantaneo.alunos;
  }

  static criarAluno(nome) {
    const alunos = TreinosStorage.listarAlunos();
    const id = gerarIdUnico(nome, new Set(alunos.map((a) => a.id)), "aluno");
    const agora = new Date().toISOString();
    const aluno = { id, nome, criadoEm: agora, atualizadoEm: agora };
    alunos.push(aluno);
    enfileirarEscrita(() => BancoIndexedDB.gravar("alunos", aluno));
    return id;
  }

  static atualizarAluno(id, nome) {
    const alunos = TreinosStorage.listarAlunos();
    const entrada = alunos.find((a) => a.id === id);
    if (!entrada) return;
    entrada.nome = nome;
    entrada.atualizadoEm = new Date().toISOString();
    enfileirarEscrita(() => BancoIndexedDB.gravar("alunos", entrada));
  }

  // Cascata: apaga também todos os planos daquele aluno (composição,
  // histórico, progresso em andamento — reusa `excluirPlano` pra cada um).
  static excluirAluno(id) {
    TreinosStorage.listarPlanosDoAluno(id).forEach((plano) => TreinosStorage.excluirPlano(plano.id));
    instantaneo.alunos = TreinosStorage.listarAlunos().filter((a) => a.id !== id);
    enfileirarEscrita(() => BancoIndexedDB.remover("alunos", id));
  }

  static listarPlanosDoAluno(alunoId) {
    return TreinosStorage.listarPlanos().filter((p) => p.alunoId === alunoId);
  }

  // Resolve {alunoId, nome} a partir de um plano — usado por sistema.js
  // (montar o link de volta) e pelas telas de gráfico/estatística
  // (agregar por aluno).
  static obterAlunoDoPlano(planoId) {
    const plano = TreinosStorage.listarPlanos().find((p) => p.id === planoId);
    if (!plano) return null;
    const aluno = TreinosStorage.listarAlunos().find((a) => a.id === plano.alunoId);
    return { alunoId: plano.alunoId, nome: aluno ? aluno.nome : "" };
  }

  // Soma o histórico (mesma chave relativa de sempre) de todos os planos
  // do aluno — não só o ativo no momento.
  static lerHistoricoAgregadoDoAluno(alunoId, chave) {
    return TreinosStorage.listarPlanosDoAluno(alunoId).flatMap((plano) =>
      TreinosStorage.lerJSONDoPlano(plano.id, chave, [])
    );
  }

  // Atalho usado pelas telas de gráfico/estatística: resolve o aluno do
  // plano ativo agora e já devolve o histórico agregado dele.
  static lerHistoricoAgregadoDoPlanoAtivo(chave) {
    const planoAtivoId = obterPlanoAtivoId();
    const aluno = planoAtivoId && TreinosStorage.obterAlunoDoPlano(planoAtivoId);
    if (!aluno) return lerJSON(chave, []);
    return TreinosStorage.lerHistoricoAgregadoDoAluno(aluno.alunoId, chave);
  }

  // --- Gestão de planos (planos.html) ---

  static listarPlanos() {
    return instantaneo.planos;
  }

  static obterPlanoAtivoId() {
    return obterPlanoAtivoId();
  }

  static ativarPlano(id) {
    instantaneo.preferencias.set("planoAtivoId", id);
    enfileirarEscrita(() => BancoIndexedDB.gravar("preferencias", { chave: "planoAtivoId", valor: id }));
  }

  static criarPlano({ alunoId, professor, inicio, fim, nome }) {
    const planos = TreinosStorage.listarPlanos();
    const id = gerarIdUnico(alunoId || professor || "plano", new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    const plano = { id, alunoId, professor, nome: nome || "", criadoEm: agora, atualizadoEm: agora };
    planos.push(plano);
    enfileirarEscrita(() => BancoIndexedDB.gravar("planos", plano));

    TreinosStorage.ativarPlano(id);
    TreinosStorage.definirDadosTreinos({
      schema: "plano-de-treino",
      schemaVersion: SCHEMA_VERSION_PLANO_ATUAL,
      biblioteca: { arquivo: "biblioteca-exercicios/biblioteca-exercicios.json" },
      metadata: {
        professor,
        aluno: (TreinosStorage.listarAlunos().find((a) => a.id === alunoId) || {}).nome || "",
        planejamento: { inicio, fim },
        objetivos: []
      },
      distribuicaoSemanal: [
        "domingo",
        "segunda-feira",
        "terca-feira",
        "quarta-feira",
        "quinta-feira",
        "sexta-feira",
        "sabado"
      ].map((dia) => ({ dia, treinoId: null })),
      orientacoesGerais: null,
      treinos: [],
      treinosCardio: [],
      treinosAlongamento: [],
      atividadesRecorrentes: []
    });
    return id;
  }

  static excluirPlano(id) {
    instantaneo.planos = TreinosStorage.listarPlanos().filter((p) => p.id !== id);
    enfileirarEscrita(() => BancoIndexedDB.remover("planos", id));

    removerChaveDoPlano(id, "dados.v1");
    Object.keys(CHAVES_HISTORICO).forEach((chaveRelativa) => removerChaveDoPlano(id, chaveRelativa));
    listarChavesDoPlano(id, "execucao.").forEach((chaveRelativa) => removerChaveDoPlano(id, chaveRelativa));

    if (obterPlanoAtivoId() === id) {
      TreinosStorage.ativarPlano(null);
    }
  }

  // Cópia zerada (sem histórico/progresso) pro aluno de destino indicado —
  // dentro do mesmo aluno (atalho pra começar um ciclo novo) ou pra um
  // aluno diferente.
  static duplicarPlano(id, alunoIdDestino) {
    const planos = TreinosStorage.listarPlanos();
    const origem = planos.find((p) => p.id === id);
    const dadosOriginais = TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
    if (!origem || !dadosOriginais) return null;

    const novoId = gerarIdUnico(`${alunoIdDestino}-ciclo`, new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    const novoPlano = {
      id: novoId,
      alunoId: alunoIdDestino,
      professor: origem.professor,
      nome: origem.nome || "",
      criadoEm: agora,
      atualizadoEm: agora
    };
    planos.push(novoPlano);
    enfileirarEscrita(() => BancoIndexedDB.gravar("planos", novoPlano));

    const alunoDestino = TreinosStorage.listarAlunos().find((a) => a.id === alunoIdDestino);
    const novosDados = structuredClone(dadosOriginais);
    novosDados.metadata = { ...novosDados.metadata, aluno: alunoDestino ? alunoDestino.nome : "" };
    TreinosStorage.salvarJSONDoPlano(novoId, "dados.v1", novosDados);

    return novoId;
  }

  static atualizarMetadataPlano(id, { professor, inicio, fim, nome }) {
    const planos = TreinosStorage.listarPlanos();
    const entrada = planos.find((p) => p.id === id);
    if (!entrada) return;
    entrada.professor = professor;
    if (nome !== undefined) entrada.nome = nome;
    entrada.atualizadoEm = new Date().toISOString();
    enfileirarEscrita(() => BancoIndexedDB.gravar("planos", entrada));

    const dados = TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
    if (dados) {
      dados.metadata = {
        ...dados.metadata,
        professor,
        planejamento: { ...(dados.metadata && dados.metadata.planejamento), inicio, fim }
      };
      TreinosStorage.salvarJSONDoPlano(id, "dados.v1", dados);
    }
  }

  // Rótulo de exibição de um plano — usado tanto no card de planos.html
  // quanto no título de sistema.html.
  static tituloDoPlano(id) {
    const plano = TreinosStorage.listarPlanos().find((p) => p.id === id);
    if (!plano) return "Meus Treinos";

    const dados = TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
    const planejamento = dados && dados.metadata && dados.metadata.planejamento;
    return (
      plano.nome ||
      (planejamento && (planejamento.inicio || planejamento.fim)
        ? `Ciclo ${planejamento.inicio || "?"} – ${planejamento.fim || "?"}`
        : `Plano criado em ${Formatadores.dataHora(plano.criadoEm)}`)
    );
  }

  // Plano avulso recebido de fora — alunoId decidido por quem chama
  // (tela de confirmação de importação). Migra pra SCHEMA_VERSION_PLANO_ATUAL
  // antes de gravar: é o único jeito de um documento em formato antigo
  // entrar no sistema (o outro é restaurarBackup, abaixo). Aceita tanto um
  // plano "cru" (arquivos exportados antes desta mudança, ou por quem
  // ainda não atualizou) quanto o pacote de `montarExportacaoAvulsaDoPlano`
  // (`{plano, bibliotecaPersonalizada}`) — nesse caso, cada personalizado
  // só é gravado se o par `[dominio, id]` ainda não existir localmente,
  // pra nunca sobrescrever uma edição já feita no aparelho de quem importa
  // (ver seção 26 de docs/especificacao-biblioteca-exercicios.md).
  static importarPlano(dadosOriginais, alunoId) {
    const ehPacoteAvulso = Boolean(dadosOriginais && dadosOriginais.plano && Array.isArray(dadosOriginais.bibliotecaPersonalizada));
    const dadosPlano = migrarPlanoParaVersaoAtual(ehPacoteAvulso ? dadosOriginais.plano : dadosOriginais);
    const planos = TreinosStorage.listarPlanos();
    const id = gerarIdUnico(alunoId, new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    const plano = {
      id,
      alunoId,
      professor: (dadosPlano.metadata && dadosPlano.metadata.professor) || "",
      criadoEm: agora,
      atualizadoEm: agora
    };
    planos.push(plano);
    enfileirarEscrita(() => BancoIndexedDB.gravar("planos", plano));
    TreinosStorage.salvarJSONDoPlano(id, "dados.v1", dadosPlano);

    if (ehPacoteAvulso) {
      dadosOriginais.bibliotecaPersonalizada.forEach((registro) => {
        if (!instantaneo.bibliotecaPersonalizada.has(`${registro.dominio}|${registro.id}`)) {
          TreinosStorage.salvarExercicioPersonalizado(registro);
        }
      });
    }

    return id;
  }

  static lerJSONDoPlano(id, chave, padrao) {
    return lerJSONDoPlano(id, chave, padrao);
  }

  static salvarJSONDoPlano(id, chave, valor) {
    salvarJSONDoPlano(id, chave, valor);
  }

  static lerDadosDoPlano(id) {
    return TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
  }

  // "Baixar" avulso de um plano (planos.js) — inclui só os personalizados
  // que o próprio plano referencia, pra quem recebe o arquivo conseguir
  // ver os mesmos exercícios/alongamentos sem precisar de um backup
  // completo. Ver seção 26 de docs/especificacao-biblioteca-exercicios.md.
  static montarExportacaoAvulsaDoPlano(id) {
    const dadosPlano = TreinosStorage.lerDadosDoPlano(id) || {};
    const referenciados = new Set();
    (dadosPlano.treinos || []).forEach((treino) => {
      (treino.exercicios || []).forEach((item) => {
        if (item.exercicioId) referenciados.add(`musculacao|${item.exercicioId}`);
        (item.alternativas || []).forEach((alt) => {
          if (alt.exercicioId) referenciados.add(`musculacao|${alt.exercicioId}`);
        });
      });
    });
    (dadosPlano.treinosAlongamento || []).forEach((treino) => {
      (treino.alongamentos || []).forEach((item) => {
        if (item.alongamentoId) referenciados.add(`alongamento|${item.alongamentoId}`);
      });
    });

    const bibliotecaPersonalizada = TreinosStorage.listarBibliotecaPersonalizada().filter((registro) =>
      referenciados.has(`${registro.dominio}|${registro.id}`)
    );

    return { plano: dadosPlano, bibliotecaPersonalizada };
  }

  static montarExportacaoCompletaDoPlano(id) {
    return montarExportacaoCompletaDoPlano(id);
  }

  // --- Biblioteca personalizada (exercícios novos ou edições locais de
  // exercícios oficiais — ver docs/especificacao-biblioteca-exercicios.md).
  // Escopo global (não por aluno/plano), igual preferencias/meta. O merge
  // com a biblioteca oficial acontece em js/biblioteca-exercicios.js, não
  // aqui — esta classe só guarda/lista os registros brutos.

  static listarBibliotecaPersonalizada() {
    return [...instantaneo.bibliotecaPersonalizada.values()];
  }

  static salvarExercicioPersonalizado(registro) {
    const chaveMapa = `${registro.dominio}|${registro.id}`;
    const existente = instantaneo.bibliotecaPersonalizada.get(chaveMapa);
    const agora = new Date().toISOString();
    const completo = { ...registro, criadoEm: (existente && existente.criadoEm) || agora, atualizadoEm: agora };
    instantaneo.bibliotecaPersonalizada.set(chaveMapa, completo);
    enfileirarEscrita(() => BancoIndexedDB.gravar("bibliotecaPersonalizada", completo));
  }

  static removerExercicioPersonalizado(dominio, id) {
    instantaneo.bibliotecaPersonalizada.delete(`${dominio}|${id}`);
    enfileirarEscrita(() => BancoIndexedDB.remover("bibliotecaPersonalizada", [dominio, id]));
  }

  // Re-hidrata só esta loja a partir do IndexedDB — usada quando outra aba
  // pode ter criado/editado/excluído um personalizado (ex.: "criar
  // exercício novo" abre em aba própria, ver exercicio-novo.js) e esta
  // aba precisa enxergar a mudança sem recarregar a página inteira (o que
  // perderia um treino em construção). Ver invalidarCacheBiblioteca em
  // biblioteca-exercicios.js, chamada junto.
  static async recarregarBibliotecaPersonalizada() {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return;
    const registros = await BancoIndexedDB.lerTodos("bibliotecaPersonalizada");
    instantaneo.bibliotecaPersonalizada = new Map(registros.map((registro) => [`${registro.dominio}|${registro.id}`, registro]));
  }

  // --- Tipos de atividade (coleção local pra "atividade livre" — ver
  // docs/atividade-livre-especificacao.md). Escopo global (não por
  // aluno/plano), igual bibliotecaPersonalizada, mas com keyPath simples
  // ("id"), então guardado como array, não Map. Independente de DOMINIOS
  // (js/dominios-biblioteca.js) — mesmo que as duas raízes semeadas
  // (musculacao/alongamento) coincidam de id por familiaridade de UX.
  //
  // Cada item carrega `categoriaIds` (0+ ids, apontando pra outros itens
  // desta mesma coleção) em vez de um pai único — um item pode pertencer a
  // mais de uma categoria ao mesmo tempo (ex.: Judô é ao mesmo tempo
  // "Artes marciais japonesas" e "Grappling"). `categoriaIds: []` marca
  // raiz. Como categorias também podem ter múltiplas categorias-pai, é um
  // grafo (não uma árvore estrita) — toda travessia abaixo é defensiva
  // contra ciclo por construção, corta o ramo em vez de travar.

  static listarTiposAtividade() {
    return instantaneo.tiposAtividade;
  }

  // Substitui listarFilhosDeTipoAtividade(paiId). categoriaId nulo lista
  // as raízes (categoriaIds vazio).
  static listarPorCategoria(categoriaId) {
    const alvo = categoriaId || null;
    return TreinosStorage.listarTiposAtividade().filter((t) =>
      alvo ? (t.categoriaIds || []).includes(alvo) : (t.categoriaIds || []).length === 0
    );
  }

  static obterTipoAtividade(id) {
    return TreinosStorage.listarTiposAtividade().find((t) => t.id === id) || null;
  }

  static #LIMITE_CAMINHOS_TIPO_ATIVIDADE = 50; // trava contra explosão combinatória em grafos degenerados

  // Substitui caminhoTipoAtividade(id) — devolve TODOS os caminhos
  // raiz→item possíveis (cada um [raiz, ..., item]), ordenados do mais
  // curto pro mais longo (quem só quer UM caminho canônico usa [0]).
  // Usado no picker de lançamento e na tela de criação de tipo pra
  // diferenciar tipos de nomes parecidos em ramos diferentes.
  //
  // Defensivo contra ciclo: `visitados` é por RAMO da busca (um Set novo
  // por chamada recursiva, não compartilhado entre irmãos) — permite o
  // mesmo nó aparecer em dois caminhos diferentes (correto: é uma
  // categoria compartilhada), só corta quando o PRÓPRIO ramo repete um nó
  // (ciclo de verdade). Nunca trava, nunca devolve [] pra um item
  // existente: se todo caminho colidir com um ciclo, cai no fallback
  // [[item]].
  static caminhosTipoAtividade(id) {
    const item = TreinosStorage.obterTipoAtividade(id);
    if (!item) return [];

    const caminhos = [];
    const subir = (no, resto, visitados) => {
      if (caminhos.length >= TreinosStorage.#LIMITE_CAMINHOS_TIPO_ATIVIDADE) return;
      if (visitados.has(no.id)) return; // ciclo neste ramo — corta, não trava
      const proximosVisitados = new Set(visitados).add(no.id);
      const categorias = (no.categoriaIds || [])
        .map((cid) => TreinosStorage.obterTipoAtividade(cid))
        .filter(Boolean);

      if (!categorias.length) {
        caminhos.push([no, ...resto]);
        return;
      }
      categorias.forEach((pai) => subir(pai, [no, ...resto], proximosVisitados));
    };

    subir(item, [], new Set());
    caminhos.sort((a, b) => a.length - b.length);
    return caminhos.length ? caminhos : [[item]];
  }

  // Substitui criarTipoAtividade(nome, paiId). Sem checagem de ciclo aqui
  // — desnecessária: um nó novo só pode referenciar categoriaIds já
  // existentes (o próprio id dele ainda não existe pra ninguém apontar de
  // volta), então nunca fecha um ciclo na criação.
  static criarTipoAtividade(nome, categoriaIds = []) {
    const tipos = TreinosStorage.listarTiposAtividade();
    const id = gerarIdUnico(nome, new Set(tipos.map((t) => t.id)), "tipo-atividade");
    const categoriasValidas = [...new Set(categoriaIds || [])].filter((cid) => TreinosStorage.obterTipoAtividade(cid));
    const tipo = { id, nome, categoriaIds: categoriasValidas, criadoEm: new Date().toISOString() };
    tipos.push(tipo);
    enfileirarEscrita(() => BancoIndexedDB.gravar("tiposAtividade", tipo));
    return id;
  }

  // Substitui alterarPaiTipoAtividade(id, novoPaiId) — usada por
  // atividade_livre_tipo_novo.html em modo de edição (?editar=<id>),
  // alcançado a partir do "✏️ Categorias" de biblioteca.html. Recebe a
  // lista NOVA completa de categorias (não um diff, mesmo padrão
  // "substitui tudo" do resto do projeto). Filtra (não rejeita tudo)
  // candidatas que fechariam ciclo — uma candidata é inválida se `id`
  // aparecer em QUALQUER caminho ancestral dela (reusa
  // caminhosTipoAtividade, já defensivo contra ciclo residual) — cobre
  // tanto "mover" quanto duas edições separadas que se referenciariam
  // mutuamente (a segunda edição, que fecharia o ciclo, é a que perde a
  // categoria problemática; a tela já filtra isso do picker antes, então
  // esse filtro aqui é defesa em profundidade).
  static alterarCategoriasTipoAtividade(id, categoriaIds) {
    const tipo = TreinosStorage.obterTipoAtividade(id);
    if (!tipo) return;

    const candidatas = [...new Set(categoriaIds || [])].filter(
      (cid) => cid && cid !== id && TreinosStorage.obterTipoAtividade(cid)
    );
    const semCiclo = candidatas.filter(
      (cid) => !TreinosStorage.caminhosTipoAtividade(cid).some((caminho) => caminho.some((t) => t.id === id))
    );

    tipo.categoriaIds = semCiclo;
    enfileirarEscrita(() => BancoIndexedDB.gravar("tiposAtividade", tipo));
  }

  // Re-hidrata só esta loja — "criar tipo novo" abre em aba própria
  // (atividade-livre-tipo-novo.js), mesmo padrão de
  // recarregarBibliotecaPersonalizada. Passa pela mesma migração
  // preguiçosa de hidratar().
  static async recarregarTiposAtividade() {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return;
    const registros = await BancoIndexedDB.lerTodos("tiposAtividade");
    const migrados = migrarTiposAtividadeParaCategoriaIds(registros);
    instantaneo.tiposAtividade = migrados;
    migrados.forEach((tipo, indice) => {
      if (tipo !== registros[indice]) {
        enfileirarEscrita(() => BancoIndexedDB.gravar("tiposAtividade", tipo));
      }
    });
  }

  // --- Agenda (atividadesRecorrentes, dentro do plano ativo) ---
  //
  // Diferente de tiposAtividade (loja própria, device-local), regras
  // recorrentes vivem dentro do mesmo documento opaco `dados.v1` do plano
  // ativo (`atividadesRecorrentes`, ao lado de treinos/treinosCardio/
  // treinosAlongamento) — duplicam junto quando a pessoa cria um novo
  // ciclo, e isolam por aluno automaticamente. Ver
  // docs/agenda-especificacao.md.

  static listarAtividadesRecorrentes() {
    const dados = lerJSON("dados.v1", null);
    return (dados && dados.atividadesRecorrentes) || [];
  }

  // `horarios`: array de { dia, hora } — um horário por dia da semana
  // marcado, não um só compartilhado (só a duração é obrigatoriamente
  // igual pra todos os dias da mesma regra).
  static criarAtividadeRecorrente({ tipoAtividadeId, horarios, duracaoSegundos, observacao }) {
    const dados = lerJSON("dados.v1", null);
    if (!dados) return null;
    dados.atividadesRecorrentes = dados.atividadesRecorrentes || [];

    const tipo = TreinosStorage.obterTipoAtividade(tipoAtividadeId);
    const id = gerarIdUnico(
      tipo ? tipo.nome : "atividade",
      new Set(dados.atividadesRecorrentes.map((r) => r.id)),
      "recorrente"
    );
    const regra = {
      id,
      tipoAtividadeId,
      tipoAtividadeNome: tipo ? tipo.nome : "",
      horarios,
      duracaoSegundos,
      observacao: observacao || null,
      criadoEm: new Date().toISOString(),
      confirmacoes: []
    };
    dados.atividadesRecorrentes.push(regra);
    TreinosStorage.definirDadosTreinos(dados);
    return id;
  }

  // Nunca apaga histórico já gravado (filosofia append-only) — só para de
  // gerar novas pendências futuras na Agenda.
  static excluirAtividadeRecorrente(id) {
    const dados = lerJSON("dados.v1", null);
    if (!dados) return;
    dados.atividadesRecorrentes = (dados.atividadesRecorrentes || []).filter((r) => r.id !== id);
    TreinosStorage.definirDadosTreinos(dados);
  }

  // Marca uma ocorrência (regraId + data local "AAAA-MM-DD") como "feito"
  // ou "faltou". Idempotente: substitui qualquer confirmação anterior pra
  // essa mesma data, permitindo corrigir um toque errado. "Feito" também
  // grava uma entrada normal em historico.sessaoLivre — reaproveita 100%
  // do código de leitura/gráfico já existente; "faltou" só fica registrado
  // aqui, não teria sentido no histórico (duração zero). Uma vez "feito"
  // não há caminho de fase 1 pra desfazer, já que o projeto não tem
  // exclusão de item de histórico ainda.
  static confirmarAtividadeRecorrente(regraId, data, status, duracaoSegundosOverride) {
    const dados = lerJSON("dados.v1", null);
    if (!dados) return;
    const regra = (dados.atividadesRecorrentes || []).find((r) => r.id === regraId);
    if (!regra) return;

    regra.confirmacoes = (regra.confirmacoes || []).filter((c) => c.data !== data);
    const duracao = duracaoSegundosOverride || regra.duracaoSegundos;
    regra.confirmacoes.push(status === "feito" ? { data, status, duracaoSegundos: duracao } : { data, status });
    TreinosStorage.definirDadosTreinos(dados);

    if (status === "feito") {
      // Construtor local (ano, mês, dia) em vez de parsear "AAAA-MM-DD"
      // como ISO — parsear como ISO leria a data como UTC meia-noite, que
      // vira o dia anterior em fusos negativos (ex.: Brasil) e resolveria
      // o dia da semana errado.
      const [ano, mes, dia] = data.split("-").map(Number);
      const diaSemana = DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
      const horario = regra.horarios.find((h) => h.dia === diaSemana);
      const dataHora = new Date(`${data}T${horario ? horario.hora : "00:00"}`).toISOString();
      TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoLivre, {
        tipoAtividadeId: regra.tipoAtividadeId,
        tipoAtividadeNome: regra.tipoAtividadeNome,
        dataHora,
        duracaoSegundos: duracao,
        observacao: regra.observacao
      });
    }
  }

  // --- Backup completo (todos os alunos e planos) ---

  static montarBackup() {
    const planos = TreinosStorage.listarPlanos();
    const dadosPorPlano = {};
    planos.forEach((plano) => {
      dadosPorPlano[plano.id] = montarExportacaoCompletaDoPlano(plano.id);
    });

    return {
      tipo: "backup-treinos",
      versao: VERSAO_BACKUP_ATUAL,
      exportadoEm: new Date().toISOString(),
      planoAtivoId: obterPlanoAtivoId(),
      alunos: TreinosStorage.listarAlunos(),
      planos,
      dadosPorPlano,
      bibliotecaPersonalizada: TreinosStorage.listarBibliotecaPersonalizada(),
      tiposAtividade: TreinosStorage.listarTiposAtividade()
    };
  }

  static restaurarBackup(backupOriginal) {
    const backup = migrarBackupParaVersaoAtual(backupOriginal);
    const planos = backup.planos || [];
    // Defensivo além da cadeia de migração acima: cobre um arquivo
    // adulterado à mão que declare `versao` atual sem de fato ter `alunos`.
    const alunos = backup.alunos || migrarAlunosApartirDePlanos(planos);

    instantaneo.alunos = alunos;
    instantaneo.planos = planos;
    // Substitui o índice inteiro (mesma semântica de sempre: um backup
    // restaurado sobrescreve tudo) — por isso limpa a loja antes de
    // regravar, diferente de uma gravação incremental.
    enfileirarEscrita(async () => {
      await BancoIndexedDB.limparLoja("alunos");
      await BancoIndexedDB.gravarVarios("alunos", alunos);
    });
    enfileirarEscrita(async () => {
      await BancoIndexedDB.limparLoja("planos");
      await BancoIndexedDB.gravarVarios("planos", planos);
    });

    const bibliotecaPersonalizada = backup.bibliotecaPersonalizada || [];
    instantaneo.bibliotecaPersonalizada = new Map(bibliotecaPersonalizada.map((registro) => [`${registro.dominio}|${registro.id}`, registro]));
    enfileirarEscrita(async () => {
      await BancoIndexedDB.limparLoja("bibliotecaPersonalizada");
      await BancoIndexedDB.gravarVarios("bibliotecaPersonalizada", bibliotecaPersonalizada);
    });

    const tiposAtividade = backup.tiposAtividade || [];
    instantaneo.tiposAtividade = tiposAtividade;
    enfileirarEscrita(async () => {
      await BancoIndexedDB.limparLoja("tiposAtividade");
      await BancoIndexedDB.gravarVarios("tiposAtividade", tiposAtividade);
    });

    TreinosStorage.ativarPlano(backup.planoAtivoId || null);

    Object.entries(backup.dadosPorPlano || {}).forEach(([id, exportacao]) => {
      exportacao.dadosTreinos = migrarPlanoParaVersaoAtual(exportacao.dadosTreinos);
      restaurarExportacaoCompletaDoPlano(id, exportacao);
    });
  }
}

// Registra o service worker (sw.js) que guarda o app shell em cache pra
// funcionar offline depois do primeiro acesso — ver
// docs/pwa-offline-especificacao.md. Chamado antes do `await` abaixo, pra
// não deixar o cache offline do app shell depender da hidratação do banco.
function registrarServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Sem HTTPS/localhost, ou navegador sem suporte — o site continua
        // funcionando, só sem o cache offline do app shell.
      });
    });
  }
}
registrarServiceWorker();

// Top-level await: como storage.js é importado por toda página, nenhum
// controller começa a rodar antes do IndexedDB estar lido — resolve de
// graça a corrida entre "página lê dado" e "hidratação ainda não
// terminou". Ver seção 5 de docs/armazenamento-local-especificacao.md.
export const pronto = hidratar();
await pronto;
