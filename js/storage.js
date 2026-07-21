const PREFIXO = "treinos.";

function lerJSON(chave, padrao) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch (erro) {
    return padrao;
  }
}

function salvarJSON(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch (erro) {
    // localStorage indisponível (modo privado, quota cheia etc.) — ignora silenciosamente
  }
}

function removerChave(chave) {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch (erro) {
    // idem — ignora silenciosamente
  }
}

export class TreinosStorage {
  static chaves = {
    historicoSessaoBicicleta: "historico.sessaoBicicleta.v1",
    historicoSerieMusculacao: "historico.serieMusculacao.v1",
    historicoSessaoMusculacao: "historico.sessaoMusculacao.v1",
    historicoSessaoAlongamento: "historico.sessaoAlongamento.v1",
    execucaoMusculacao: (treinoId) => `execucao.musculacao.${treinoId}.v2`,
    execucaoAlongamento: (treinoId) => `execucao.alongamento.${treinoId}.v1`,
    generoImagem: "preferencias.generoImagem.v1",
    apoioUltimaExibicaoContador: "apoio.ultimaExibicaoContador.v1",
    apoioUltimaExibicaoData: "apoio.ultimaExibicaoData.v1",
    apoioDispensadoPermanentemente: "apoio.dispensadoPermanentemente.v1"
  };

  static lerJSON(chave, padrao) {
    return lerJSON(chave, padrao);
  }

  static salvarJSON(chave, valor) {
    salvarJSON(chave, valor);
  }

  static removerChave(chave) {
    removerChave(chave);
  }

  static adicionarAoHistorico(chave, entrada) {
    const lista = lerJSON(chave, []);
    lista.push(entrada);
    salvarJSON(chave, lista);
    return lista;
  }

  static definirDadosTreinos(dados) {
    salvarJSON("dadosTreinos.v2", dados);
    salvarJSON("dadosTreinosCarregadoEm.v1", new Date().toISOString());
  }

  static async carregarDadosTreinos() {
    const cache = lerJSON("dadosTreinos.v2", null);
    if (cache) return cache;
    throw new Error("Nenhum dado de treino carregado ainda.");
  }

  static listarChavesComPrefixo(prefixo) {
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const chaveCompleta = localStorage.key(i);
      if (chaveCompleta && chaveCompleta.startsWith(PREFIXO + prefixo)) {
        chaves.push(chaveCompleta.slice(PREFIXO.length));
      }
    }
    return chaves;
  }

  static montarBackup() {
    const execucoesEmAndamento = {};
    TreinosStorage.listarChavesComPrefixo("execucao.musculacao.").forEach((chave) => {
      execucoesEmAndamento[chave] = lerJSON(chave, null);
    });
    TreinosStorage.listarChavesComPrefixo("execucao.alongamento.").forEach((chave) => {
      execucoesEmAndamento[chave] = lerJSON(chave, null);
    });

    return {
      tipo: "backup-treinos",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      dadosTreinos: lerJSON("dadosTreinos.v2", null),
      historicoSessaoBicicleta: lerJSON("historico.sessaoBicicleta.v1", []),
      historicoSerieMusculacao: lerJSON("historico.serieMusculacao.v1", []),
      historicoSessaoMusculacao: lerJSON("historico.sessaoMusculacao.v1", []),
      historicoSessaoAlongamento: lerJSON("historico.sessaoAlongamento.v1", []),
      execucoesEmAndamento
    };
  }

  static resetarMusculacao() {
    removerChave(TreinosStorage.chaves.historicoSerieMusculacao);
    removerChave(TreinosStorage.chaves.historicoSessaoMusculacao);
    TreinosStorage.listarChavesComPrefixo("execucao.musculacao.").forEach((chave) => removerChave(chave));
  }

  static resetarBicicleta() {
    removerChave(TreinosStorage.chaves.historicoSessaoBicicleta);
  }

  static resetarAlongamento() {
    removerChave(TreinosStorage.chaves.historicoSessaoAlongamento);
    TreinosStorage.listarChavesComPrefixo("execucao.alongamento.").forEach((chave) => removerChave(chave));
  }

  static restaurarBackup(backup) {
    if (backup.dadosTreinos) TreinosStorage.definirDadosTreinos(backup.dadosTreinos);
    salvarJSON("historico.sessaoBicicleta.v1", backup.historicoSessaoBicicleta || []);
    salvarJSON("historico.serieMusculacao.v1", backup.historicoSerieMusculacao || []);
    salvarJSON("historico.sessaoMusculacao.v1", backup.historicoSessaoMusculacao || []);
    salvarJSON("historico.sessaoAlongamento.v1", backup.historicoSessaoAlongamento || []);
    Object.entries(backup.execucoesEmAndamento || {}).forEach(([chave, valor]) => {
      salvarJSON(chave, valor);
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
