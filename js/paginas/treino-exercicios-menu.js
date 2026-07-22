import { TreinosStorage } from "../storage.js";
import { LABEL_TIPO } from "../constantes.js";
import { GraficoBarrasHistorico } from "../grafico-barras.js";

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado"
];

class TreinoExerciciosMenuController {
  #listaEl = document.getElementById("lista");

  iniciar() {
    this.#iniciarBotaoContinuar();
    this.#iniciarGraficoHistorico();
    this.#carregarTreinos();
  }

  #iniciarGraficoHistorico() {
    const historico = TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoMusculacao, []);
    const grafico = new GraficoBarrasHistorico({
      seletor: "#graficoExercicios",
      historico,
      campoData: "concluidoEm"
    });
    grafico.inicializar(document.getElementById("graficoSecao"), document.getElementById("graficoVazio"));
  }

  async #iniciarBotaoContinuar() {
    const emAndamento = TreinosStorage.listarChavesComPrefixo("execucao.musculacao.")
      .map((chave) => ({
        treinoId: chave.replace(/^execucao\.musculacao\./, "").replace(/\.v2$/, ""),
        progresso: TreinosStorage.lerJSON(chave, null)
      }))
      .filter(({ progresso }) => progresso && progresso.exercicioId && progresso.serieAtual >= 1)
      .sort((a, b) => new Date(b.progresso.iniciadoEm) - new Date(a.progresso.iniciadoEm));

    if (!emAndamento.length) return;

    const { treinoId } = emAndamento[0];
    const btnEl = document.getElementById("continuarBtn");
    const nomeEl = document.getElementById("continuarNome");

    btnEl.href = `treino_execucao.html?treino=${encodeURIComponent(treinoId)}`;
    btnEl.hidden = false;
    nomeEl.textContent = treinoId;

    try {
      const dados = await TreinosStorage.carregarDadosTreinos();
      const treino = dados.treinos.find((t) => t.id === treinoId);
      if (treino) nomeEl.textContent = treino.nome;
    } catch (erro) {
      // Sem dados carregados — mantém o treinoId como rótulo.
    }
  }

  #contarExercicios(treino) {
    return treino.exercicios.length;
  }

  #diaDeHoje() {
    return DIAS_SEMANA[new Date().getDay()];
  }

  #treinoDeHoje(dados) {
    const hoje = this.#diaDeHoje();
    const entrada = dados.distribuicaoSemanal.find((d) => d.dia === hoje);
    return entrada ? entrada.treinoId : null;
  }

  #cartaoTreino(treino, idTreinoHoje) {
    const a = document.createElement("a");
    const ehHoje = treino.id === idTreinoHoje;
    a.className = ehHoje ? "treino hoje" : "treino";
    a.href = `treino_exercicios.html?treino=${encodeURIComponent(treino.id)}`;

    const qtdExercicios = this.#contarExercicios(treino);
    const resumo = qtdExercicios === 0
      ? "Nenhum exercício cadastrado"
      : `${qtdExercicios} exercício${qtdExercicios === 1 ? "" : "s"}`;

    a.innerHTML = `
      <div class="cabecalho">
        <h2>${treino.nome}</h2>
        <span class="tag ${ehHoje ? "hoje" : ""}">${ehHoje ? "Hoje · " : ""}${LABEL_TIPO[treino.tipo] || treino.tipo}</span>
      </div>
      <div class="resumo">${resumo}</div>
    `;
    return a;
  }

  async #carregarTreinos() {
    try {
      const dados = await TreinosStorage.carregarDadosTreinos();
      const idTreinoHoje = this.#treinoDeHoje(dados);

      this.#listaEl.innerHTML = "";
      dados.treinos.forEach((treino) => this.#listaEl.appendChild(this.#cartaoTreino(treino, idTreinoHoje)));
    } catch (erro) {
      this.#listaEl.innerHTML =
        '<div class="estado">Nenhum plano de treino carregado ainda neste navegador. <a href="planos.html">Escolha ou crie um plano</a> pra começar.</div>';
    }
  }
}

new TreinoExerciciosMenuController().iniciar();
