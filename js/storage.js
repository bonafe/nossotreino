import { gerarIdUnico } from "./identificadores.js";

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
    apoioDispensadoPermanentemente: "apoio.dispensadoPermanentemente.v1"
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

  // --- Gestão de planos (planos.html) ---

  static listarPlanos() {
    return lerBruto("planos.v1", []);
  }

  static obterPlanoAtivoId() {
    return obterPlanoAtivoIdBruto();
  }

  static ativarPlano(id) {
    salvarBruto("planoAtivoId.v1", id);
  }

  static criarPlano({ professor, aluno, inicio, fim }) {
    const planos = TreinosStorage.listarPlanos();
    const id = gerarIdUnico(aluno || professor || "plano", new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    planos.push({ id, professor, aluno, criadoEm: agora, atualizadoEm: agora });
    salvarBruto("planos.v1", planos);

    TreinosStorage.ativarPlano(id);
    TreinosStorage.definirDadosTreinos({
      schema: "plano-de-treino",
      schemaVersion: "1.3",
      biblioteca: { arquivo: "biblioteca-exercicios/biblioteca-exercicios.json" },
      metadata: { professor, aluno, planejamento: { inicio, fim }, objetivos: [] },
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

  static duplicarPlano(id) {
    const planos = TreinosStorage.listarPlanos();
    const origem = planos.find((p) => p.id === id);
    const dadosOriginais = TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
    if (!origem || !dadosOriginais) return null;

    const novoId = gerarIdUnico(`${origem.professor || "plano"}-copia`, new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    planos.push({ id: novoId, professor: origem.professor, aluno: "", criadoEm: agora, atualizadoEm: agora });
    salvarBruto("planos.v1", planos);

    const novosDados = structuredClone(dadosOriginais);
    novosDados.metadata = { ...novosDados.metadata, aluno: "" };
    TreinosStorage.salvarJSONDoPlano(novoId, "dados.v1", novosDados);

    return novoId;
  }

  static atualizarMetadataPlano(id, { professor, aluno, inicio, fim }) {
    const planos = TreinosStorage.listarPlanos();
    const entrada = planos.find((p) => p.id === id);
    if (!entrada) return;
    entrada.professor = professor;
    entrada.aluno = aluno;
    entrada.atualizadoEm = new Date().toISOString();
    salvarBruto("planos.v1", planos);

    const dados = TreinosStorage.lerJSONDoPlano(id, "dados.v1", null);
    if (dados) {
      dados.metadata = {
        ...dados.metadata,
        professor,
        aluno,
        planejamento: { ...(dados.metadata && dados.metadata.planejamento), inicio, fim }
      };
      TreinosStorage.salvarJSONDoPlano(id, "dados.v1", dados);
    }
  }

  static importarPlano(dadosPlano) {
    const planos = TreinosStorage.listarPlanos();
    const aluno = (dadosPlano.metadata && dadosPlano.metadata.aluno) || "";
    const professor = (dadosPlano.metadata && dadosPlano.metadata.professor) || "";
    const id = gerarIdUnico(aluno || professor || "plano", new Set(planos.map((p) => p.id)), "plano");
    const agora = new Date().toISOString();
    planos.push({ id, professor, aluno, criadoEm: agora, atualizadoEm: agora });
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

  // --- Backup completo (todos os planos) ---

  static montarBackup() {
    const planos = TreinosStorage.listarPlanos();
    const dadosPorPlano = {};
    planos.forEach((plano) => {
      dadosPorPlano[plano.id] = montarExportacaoCompletaDoPlano(plano.id);
    });

    return {
      tipo: "backup-treinos",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      planoAtivoId: obterPlanoAtivoIdBruto(),
      planos,
      dadosPorPlano
    };
  }

  static restaurarBackup(backup) {
    salvarBruto("planos.v1", backup.planos || []);
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
