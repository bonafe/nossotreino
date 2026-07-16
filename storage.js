const TreinosStorage = (() => {
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

  function adicionarAoHistorico(chave, entrada) {
    const lista = lerJSON(chave, []);
    lista.push(entrada);
    salvarJSON(chave, lista);
    return lista;
  }

  function definirDadosTreinos(dados) {
    salvarJSON("dadosTreinos.v1", dados);
    salvarJSON("dadosTreinosCarregadoEm.v1", new Date().toISOString());
  }

  async function carregarDadosTreinos() {
    const cache = lerJSON("dadosTreinos.v1", null);
    if (cache) return cache;
    throw new Error("Nenhum dado de treino carregado ainda.");
  }

  function listarChavesComPrefixo(prefixo) {
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const chaveCompleta = localStorage.key(i);
      if (chaveCompleta && chaveCompleta.startsWith(PREFIXO + prefixo)) {
        chaves.push(chaveCompleta.slice(PREFIXO.length));
      }
    }
    return chaves;
  }

  function montarBackup() {
    const execucoesEmAndamento = {};
    listarChavesComPrefixo("execucao.musculacao.").forEach((chave) => {
      execucoesEmAndamento[chave] = lerJSON(chave, null);
    });

    return {
      tipo: "backup-treinos",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      dadosTreinos: lerJSON("dadosTreinos.v1", null),
      historicoSessaoBicicleta: lerJSON("historico.sessaoBicicleta.v1", []),
      historicoSerieMusculacao: lerJSON("historico.serieMusculacao.v1", []),
      historicoSessaoMusculacao: lerJSON("historico.sessaoMusculacao.v1", []),
      execucoesEmAndamento
    };
  }

  function restaurarBackup(backup) {
    if (backup.dadosTreinos) definirDadosTreinos(backup.dadosTreinos);
    salvarJSON("historico.sessaoBicicleta.v1", backup.historicoSessaoBicicleta || []);
    salvarJSON("historico.serieMusculacao.v1", backup.historicoSerieMusculacao || []);
    salvarJSON("historico.sessaoMusculacao.v1", backup.historicoSessaoMusculacao || []);
    Object.entries(backup.execucoesEmAndamento || {}).forEach(([chave, valor]) => {
      salvarJSON(chave, valor);
    });
  }

  return {
    lerJSON,
    salvarJSON,
    removerChave,
    adicionarAoHistorico,
    carregarDadosTreinos,
    definirDadosTreinos,
    listarChavesComPrefixo,
    montarBackup,
    restaurarBackup,
    chaves: {
      historicoSessaoBicicleta: "historico.sessaoBicicleta.v1",
      historicoSerieMusculacao: "historico.serieMusculacao.v1",
      historicoSessaoMusculacao: "historico.sessaoMusculacao.v1",
      execucaoMusculacao: (treinoId) => `execucao.musculacao.${treinoId}.v1`
    }
  };
})();
