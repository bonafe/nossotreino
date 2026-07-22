import { TreinosStorage } from "../storage.js";
import { GraficoBarrasHistorico } from "../grafico-barras.js";

const LABEL_MOMENTO = {
  "antes-musculacao": "Antes da musculação",
  "apos-musculacao": "Após a musculação"
};

class TreinoAlongamentoMenuController {
  #listaEl = document.getElementById("lista");

  iniciar() {
    this.#iniciarGraficoHistorico();
    this.#carregarTreinos();
  }

  #iniciarGraficoHistorico() {
    const historico = TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoAlongamento, []);
    const grafico = new GraficoBarrasHistorico({
      seletor: "#graficoAlongamento",
      historico,
      campoData: "concluidoEm"
    });
    grafico.inicializar(document.getElementById("graficoSecao"), document.getElementById("graficoVazio"));
  }

  #cartaoTreino(treinoAlongamento) {
    const a = document.createElement("a");
    a.className = "treino";
    a.href = `treino_alongamento.html?treino=${encodeURIComponent(treinoAlongamento.id)}`;

    const quantidade = treinoAlongamento.alongamentos.length;
    const campos = [
      { titulo: "Alongamentos", valor: quantidade },
      LABEL_MOMENTO[treinoAlongamento.momento] && { titulo: "Momento", valor: LABEL_MOMENTO[treinoAlongamento.momento] }
    ].filter(Boolean);

    a.innerHTML = `
      <h2>${treinoAlongamento.nome}</h2>
      <div class="campos">
        ${campos.map((c) => `<div class="campo"><strong>${c.titulo}</strong><span>${c.valor}</span></div>`).join("")}
      </div>
    `;
    return a;
  }

  async #carregarTreinos() {
    let dados;
    try {
      dados = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      this.#listaEl.innerHTML =
        '<div class="estado">Nenhum plano de treino carregado ainda neste navegador. <a href="planos.html">Escolha ou crie um plano</a> pra começar.</div>';
      return;
    }

    const treinosAlongamento = dados.treinosAlongamento || [];

    this.#listaEl.innerHTML = "";
    if (!treinosAlongamento.length) {
      this.#listaEl.innerHTML = '<div class="estado">Nenhum treino de alongamento cadastrado ainda.</div>';
      return;
    }
    treinosAlongamento.forEach((treinoAlongamento) => this.#listaEl.appendChild(this.#cartaoTreino(treinoAlongamento)));
  }
}

new TreinoAlongamentoMenuController().iniciar();
