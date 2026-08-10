import { gerarIdUnico } from "./identificadores.js";
import { Formatadores } from "./formatadores.js";
import { BancoIndexedDB } from "./armazenamento-indexeddb.js";
import "./versao.js";

// Mapa entre a chave relativa "histórica" (a mesma usada por toda página
// desde a época do localStorage) e o `tipo` físico dentro da loja única
// `historico` do IndexedDB (ver esquema em armazenamento-indexeddb.js).
const CHAVES_HISTORICO = {
  "historico.sessaoBicicleta.v1": "sessaoBicicleta",
  "historico.serieMusculacao.v1": "serieMusculacao",
  "historico.sessaoMusculacao.v1": "sessaoMusculacao",
  "historico.sessaoAlongamento.v1": "sessaoAlongamento",
  "historico.serieAlongamento.v1": "serieAlongamento"
};

function analisarChaveExecucao(chaveRelativa) {
  let combinacao = chaveRelativa.match(/^execucao\.musculacao\.(.+)\.v2$/);
  if (combinacao) return { tipo: "musculacao", treinoId: combinacao[1] };

  combinacao = chaveRelativa.match(/^execucao\.alongamento\.(.+)\.v1$/);
  if (combinacao) return { tipo: "alongamento", treinoId: combinacao[1] };

  return null;
}

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
  preferencias: new Map() // chave -> valor (planoAtivoId, apoio.*, avisoIaAceito.v1)
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
    const chaveRelativa = tipo === "musculacao" ? `execucao.musculacao.${treinoId}.v2` : `execucao.alongamento.${treinoId}.v1`;
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

  return {
    dadosTreinos: lerJSONDoPlano(id, "dados.v1", null),
    historicoSessaoBicicleta: lerJSONDoPlano(id, "historico.sessaoBicicleta.v1", []),
    historicoSerieMusculacao: lerJSONDoPlano(id, "historico.serieMusculacao.v1", []),
    historicoSessaoMusculacao: lerJSONDoPlano(id, "historico.sessaoMusculacao.v1", []),
    historicoSessaoAlongamento: lerJSONDoPlano(id, "historico.sessaoAlongamento.v1", []),
    historicoSerieAlongamento: lerJSONDoPlano(id, "historico.serieAlongamento.v1", []),
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
const SCHEMA_VERSION_PLANO_ATUAL = "1.3";

const MIGRACOES_PLANO = {
  // "1.2": migrarPlanoDe12Para13 — formato 1.2 (cardio/alongamento
  // embutidos em treino.cardio[]/treino.alongamento[], sem id/nome
  // próprios) não tem nenhuma instância real conhecida sobrevivendo hoje;
  // se aparecer um arquivo nesse formato, escreva a função a partir desse
  // exemplar real (ver docs/especificacao-biblioteca-exercicios.md §16
  // pro shape antigo de referência) em vez de reconstruir de memória.
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

const VERSAO_BACKUP_ATUAL = 2;

const MIGRACOES_BACKUP = {
  1: migrarBackupDe1Para2
};

// Formato 1: sem `alunos` (entidade Aluno ainda não existia) — deriva a
// partir de `planos[].aluno` (texto livre), mesma lógica de
// migrarAlunosApartirDePlanos.
function migrarBackupDe1Para2(backup) {
  const planos = backup.planos || [];
  const alunos = backup.alunos || migrarAlunosApartirDePlanos(planos);
  return { ...backup, versao: 2, alunos, planos };
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

// Preenche o instantâneo a partir do IndexedDB, uma vez por carregamento de
// página — ver `export const pronto` no fim do arquivo. Se o banco estiver
// indisponível (Safari em file://, storage desabilitado etc.), segue com o
// instantâneo vazio: leituras devolvem o padrão, escritas ficam só em
// memória pela duração da página, nada quebra.
async function hidratar() {
  const banco = await BancoIndexedDB.abrir();
  if (!banco) return;

  const [alunos, planos, planoDadosRegistros, historicoRegistros, execucoesRegistros, preferenciasRegistros] = await Promise.all([
    BancoIndexedDB.lerTodos("alunos"),
    BancoIndexedDB.lerTodos("planos"),
    BancoIndexedDB.lerTodos("planoDados"),
    BancoIndexedDB.lerTodos("historico"),
    BancoIndexedDB.lerTodos("execucoes"),
    BancoIndexedDB.lerTodos("preferencias")
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
}

export class TreinosStorage {
  static chaves = {
    dadosTreinos: "dados.v1",
    historicoSessaoBicicleta: "historico.sessaoBicicleta.v1",
    historicoSerieMusculacao: "historico.serieMusculacao.v1",
    historicoSessaoMusculacao: "historico.sessaoMusculacao.v1",
    historicoSessaoAlongamento: "historico.sessaoAlongamento.v1",
    historicoSerieAlongamento: "historico.serieAlongamento.v1",
    execucaoMusculacao: (treinoId) => `execucao.musculacao.${treinoId}.v2`,
    execucaoAlongamento: (treinoId) => `execucao.alongamento.${treinoId}.v1`,
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
      treinosAlongamento: []
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
  // entrar no sistema (o outro é restaurarBackup, abaixo).
  static importarPlano(dadosPlanoOriginal, alunoId) {
    const dadosPlano = migrarPlanoParaVersaoAtual(dadosPlanoOriginal);
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

  static montarExportacaoCompletaDoPlano(id) {
    return montarExportacaoCompletaDoPlano(id);
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
      dadosPorPlano
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
