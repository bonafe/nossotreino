import { gerarIdUnico } from "./identificadores.js";
import { Formatadores } from "./formatadores.js";

const PREFIXO = "treinos.";

function lerBruto(chave, padrao) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch (erro) {
    return padrao;
  }
}

function salvarBruto(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch (erro) {
    // localStorage indisponível (modo privado, quota cheia etc.) — ignora silenciosamente
  }
}

function removerBruto(chave) {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch (erro) {
    // idem — ignora silenciosamente
  }
}

function obterPlanoAtivoIdBruto() {
  return lerBruto("planoAtivoId.v1", null);
}

function chaveDoPlano(id, chave) {
  return `plano.${id}.${chave}`;
}

// Toda leitura/escrita "normal" (lerJSON/salvarJSON/removerChave/
// listarChavesComPrefixo) é implicitamente escopada ao plano ativo no
// momento — nenhuma das páginas de treino (treino-execucao.js,
// treino-novo.js, treino-bicicleta*.js, treino-alongamento*.js etc.)
// precisa saber que existe mais de um plano guardado no navegador; elas
// continuam lendo/escrevendo as mesmas chaves relativas de sempre
// (`dados.v1`, `historico.*`, `execucao.*`), só que agora fisicamente
// armazenadas sob `plano.<id>.*`. Isso também elimina qualquer colisão
// entre dois planos que tenham, por coincidência, um treino com o mesmo
// id (`execucao.musculacao.<treinoId>.v2`) — o id do plano já faz parte
// da chave física.
function lerJSON(chave, padrao) {
  const id = obterPlanoAtivoIdBruto();
  return id ? lerBruto(chaveDoPlano(id, chave), padrao) : padrao;
}

function salvarJSON(chave, valor) {
  const id = obterPlanoAtivoIdBruto();
  if (id) salvarBruto(chaveDoPlano(id, chave), valor);
}

function removerChave(chave) {
  const id = obterPlanoAtivoIdBruto();
  if (id) removerBruto(chaveDoPlano(id, chave));
}

function listarChavesComPrefixo(prefixo) {
  const id = obterPlanoAtivoIdBruto();
  if (!id) return [];
  return listarChavesDoPlano(id, prefixo);
}

function listarChavesDoPlano(id, prefixo) {
  const base = `${PREFIXO}${chaveDoPlano(id, "")}`;
  const chaves = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chaveCompleta = localStorage.key(i);
    if (chaveCompleta && chaveCompleta.startsWith(base + prefixo)) {
      chaves.push(chaveCompleta.slice(base.length));
    }
  }
  return chaves;
}

function montarExportacaoCompletaDoPlano(id) {
  const execucoesEmAndamento = {};
  listarChavesDoPlano(id, "execucao.musculacao.").forEach((chave) => {
    execucoesEmAndamento[chave] = lerBruto(chaveDoPlano(id, chave), null);
  });
  listarChavesDoPlano(id, "execucao.alongamento.").forEach((chave) => {
    execucoesEmAndamento[chave] = lerBruto(chaveDoPlano(id, chave), null);
  });

  return {
    dadosTreinos: lerBruto(chaveDoPlano(id, "dados.v1"), null),
    historicoSessaoBicicleta: lerBruto(chaveDoPlano(id, "historico.sessaoBicicleta.v1"), []),
    historicoSerieMusculacao: lerBruto(chaveDoPlano(id, "historico.serieMusculacao.v1"), []),
    historicoSessaoMusculacao: lerBruto(chaveDoPlano(id, "historico.sessaoMusculacao.v1"), []),
    historicoSessaoAlongamento: lerBruto(chaveDoPlano(id, "historico.sessaoAlongamento.v1"), []),
    execucoesEmAndamento
  };
}

function restaurarExportacaoCompletaDoPlano(id, exportacao) {
  salvarBruto(chaveDoPlano(id, "dados.v1"), exportacao.dadosTreinos || null);
  salvarBruto(chaveDoPlano(id, "historico.sessaoBicicleta.v1"), exportacao.historicoSessaoBicicleta || []);
  salvarBruto(chaveDoPlano(id, "historico.serieMusculacao.v1"), exportacao.historicoSerieMusculacao || []);
  salvarBruto(chaveDoPlano(id, "historico.sessaoMusculacao.v1"), exportacao.historicoSessaoMusculacao || []);
  salvarBruto(chaveDoPlano(id, "historico.sessaoAlongamento.v1"), exportacao.historicoSessaoAlongamento || []);
  Object.entries(exportacao.execucoesEmAndamento || {}).forEach(([chave, valor]) => {
    salvarBruto(chaveDoPlano(id, chave), valor);
  });
}

// Cria um Aluno pra cada nome distinto encontrado em `planos` que ainda
// não tenha `alunoId` (formato anterior a existir a entidade Aluno —
// `plano.aluno` era texto livre), preenchendo `alunoId` em cada plano e
// removendo o texto livre. Muta `planos` in place. Usada tanto na
// migração automática (garantirAlunosMigrados) quanto ao restaurar um
// backup salvo antes desta mudança (sem `alunos` no JSON).
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

function garantirAlunosMigrados() {
  if (lerBruto("alunos.v1", null)) return;
  const planos = lerBruto("planos.v1", []);
  const alunos = migrarAlunosApartirDePlanos(planos);
  salvarBruto("alunos.v1", alunos);
  salvarBruto("planos.v1", planos);
}

export class TreinosStorage {
  static chaves = {
    dadosTreinos: "dados.v1",
    historicoSessaoBicicleta: "historico.sessaoBicicleta.v1",
    historicoSerieMusculacao: "historico.serieMusculacao.v1",
    historicoSessaoMusculacao: "historico.sessaoMusculacao.v1",
    historicoSessaoAlongamento: "historico.sessaoAlongamento.v1",
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
    const lista = lerJSON(chave, []);
    lista.push(entrada);
    salvarJSON(chave, lista);
    return lista;
  }

  // Globais — não dependem de qual plano está ativo (preferência de
  // imagem, contadores do banner de apoio).
  static lerJSONGlobal(chave, padrao) {
    return lerBruto(chave, padrao);
  }

  static salvarJSONGlobal(chave, valor) {
    salvarBruto(chave, valor);
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
    const id = obterPlanoAtivoIdBruto();
    if (!id) return;
    const planos = TreinosStorage.listarPlanos();
    const entrada = planos.find((p) => p.id === id);
    if (entrada) {
      entrada.atualizadoEm = new Date().toISOString();
      salvarBruto("planos.v1", planos);
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
    listarChavesComPrefixo("execucao.alongamento.").forEach((chave) => removerChave(chave));
  }

  // --- Gestão de alunos (alunos.html) ---

  static listarAlunos() {
    garantirAlunosMigrados();
    return lerBruto("alunos.v1", []);
  }

  static criarAluno(nome) {
    const alunos = TreinosStorage.listarAlunos();
    const id = gerarIdUnico(nome, new Set(alunos.map((a) => a.id)), "aluno");
    const agora = new Date().toISOString();
    alunos.push({ id, nome, criadoEm: agora, atualizadoEm: agora });
    salvarBruto("alunos.v1", alunos);
    return id;
  }

  static atualizarAluno(id, nome) {
    const alunos = TreinosStorage.listarAlunos();
    const entrada = alunos.find((a) => a.id === id);
    if (!entrada) return;
    entrada.nome = nome;
    entrada.atualizadoEm = new Date().toISOString();
    salvarBruto("alunos.v1", alunos);
  }

  // Cascata: apaga também todos os planos daquele aluno (composição,
  // histórico, progresso em andamento) — não deixa plano órfão.
  static excluirAluno(id) {
    TreinosStorage.listarPlanosDoAluno(id).forEach((plano) => TreinosStorage.excluirPlano(plano.id));
    const alunos = TreinosStorage.listarAlunos().filter((a) => a.id !== id);
    salvarBruto("alunos.v1", alunos);
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
  // do aluno — não só o ativo no momento. Base do "acompanhamento em
  // vários treinos": um exercício ou um tipo de sessão continua a mesma
  // linha do tempo mesmo depois de o professor criar um plano novo pro
  // próximo ciclo.
  static lerHistoricoAgregadoDoAluno(alunoId, chave) {
    return TreinosStorage.listarPlanosDoAluno(alunoId).flatMap((plano) =>
      TreinosStorage.lerJSONDoPlano(plano.id, chave, [])
    );
  }

  // Atalho usado pelas telas de gráfico/estatística: resolve o aluno do
  // plano ativo agora e já devolve o histórico agregado dele. Cai pro
  // histórico só do plano ativo se, por algum motivo, não der pra
  // resolver o aluno (não deveria acontecer — essas telas já exigem um
  // plano ativo carregado antes de chegar aqui).
  static lerHistoricoAgregadoDoPlanoAtivo(chave) {
    const planoAtivoId = obterPlanoAtivoIdBruto();
    const aluno = planoAtivoId && TreinosStorage.obterAlunoDoPlano(planoAtivoId);
    if (!aluno) return lerJSON(chave, []);
    return TreinosStorage.lerHistoricoAgregadoDoAluno(aluno.alunoId, chave);
  }

  // --- Gestão de planos (planos.html) ---

  static listarPlanos() {
    garantirAlunosMigrados();
    return lerBruto("planos.v1", []);
  }

  static obterPlanoAtivoId() {
    return obterPlanoAtivoIdBruto();
  }

  static ativarPlano(id) {
    salvarBruto("planoAtivoId.v1", id);
  }

  static criarPlano({ alunoId, professor, inicio, fim, nome }) {
    const planos = TreinosStorage.listarPlanos();
    const id = gerarIdUnico(alunoId || professor || "plano", new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    planos.push({ id, alunoId, professor, nome: nome || "", criadoEm: agora, atualizadoEm: agora });
    salvarBruto("planos.v1", planos);

    const aluno = TreinosStorage.listarAlunos().find((a) => a.id === alunoId);
    TreinosStorage.ativarPlano(id);
    TreinosStorage.definirDadosTreinos({
      schema: "plano-de-treino",
      schemaVersion: "1.3",
      biblioteca: { arquivo: "biblioteca-exercicios/biblioteca-exercicios.json" },
      metadata: { professor, aluno: aluno ? aluno.nome : "", planejamento: { inicio, fim }, objetivos: [] },
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
    const planos = TreinosStorage.listarPlanos().filter((p) => p.id !== id);
    salvarBruto("planos.v1", planos);
    listarChavesDoPlano(id, "").forEach((chave) => removerBruto(chaveDoPlano(id, chave)));
    if (obterPlanoAtivoIdBruto() === id) {
      salvarBruto("planoAtivoId.v1", null);
    }
  }

  // Cópia zerada (sem histórico/progresso) pro aluno de destino indicado
  // — dentro do mesmo aluno (atalho pra começar um ciclo novo) ou pra um
  // aluno diferente (mesmo caminho, só muda `alunoIdDestino`): já que os
  // dois alunos estão no mesmo navegador, não precisa passar por
  // baixar/importar arquivo pra isso.
  static duplicarPlano(id, alunoIdDestino) {
    const planos = TreinosStorage.listarPlanos();
    const origem = planos.find((p) => p.id === id);
    const dadosOriginais = TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
    if (!origem || !dadosOriginais) return null;

    const novoId = gerarIdUnico(`${alunoIdDestino}-ciclo`, new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    planos.push({
      id: novoId,
      alunoId: alunoIdDestino,
      professor: origem.professor,
      nome: origem.nome || "",
      criadoEm: agora,
      atualizadoEm: agora
    });
    salvarBruto("planos.v1", planos);

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
    salvarBruto("planos.v1", planos);

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
  // quanto no título de sistema.html, pra ficar consistente nos dois
  // lugares.
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

  // Plano avulso recebido de fora (colado/escolhido em alunos.html) — o
  // aluno de destino é decidido por quem chama (tela de confirmação de
  // importação, seção 3.1 de armazenamento-local-especificacao.md), não
  // adivinhado a partir de `dadosPlano.metadata.aluno`: o mesmo arquivo
  // pode ser reaproveitado como template pra um aluno diferente do que
  // está gravado no JSON (ex.: baixar o plano de um aluno e importar pra
  // outro).
  static importarPlano(dadosPlano, alunoId) {
    const planos = TreinosStorage.listarPlanos();
    const id = gerarIdUnico(alunoId, new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    planos.push({
      id,
      alunoId,
      professor: (dadosPlano.metadata && dadosPlano.metadata.professor) || "",
      criadoEm: agora,
      atualizadoEm: agora
    });
    salvarBruto("planos.v1", planos);
    TreinosStorage.salvarJSONDoPlano(id, "dados.v1", dadosPlano);
    return id;
  }

  static lerJSONDoPlano(id, chave, padrao) {
    return lerBruto(chaveDoPlano(id, chave), padrao);
  }

  static salvarJSONDoPlano(id, chave, valor) {
    salvarBruto(chaveDoPlano(id, chave), valor);
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
      versao: 2,
      exportadoEm: new Date().toISOString(),
      planoAtivoId: obterPlanoAtivoIdBruto(),
      alunos: TreinosStorage.listarAlunos(),
      planos,
      dadosPorPlano
    };
  }

  static restaurarBackup(backup) {
    const planos = backup.planos || [];
    const alunos = backup.alunos || migrarAlunosApartirDePlanos(planos);
    salvarBruto("alunos.v1", alunos);
    salvarBruto("planos.v1", planos);
    salvarBruto("planoAtivoId.v1", backup.planoAtivoId || null);
    Object.entries(backup.dadosPorPlano || {}).forEach(([id, exportacao]) => {
      restaurarExportacaoCompletaDoPlano(id, exportacao);
    });
  }
}

// Registra o service worker (sw.js) que guarda o app shell em cache pra
// funcionar offline depois do primeiro acesso — ver docs/pwa-offline-especificacao.md.
// storage.js é importado por todo módulo de página, então isso cobre o site
// inteiro sem precisar repetir a chamada em cada .html.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Sem HTTPS/localhost, ou navegador sem suporte — o site continua
      // funcionando, só sem o cache offline do app shell.
    });
  });
}
