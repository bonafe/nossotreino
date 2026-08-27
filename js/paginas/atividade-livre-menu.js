import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { GraficoBarrasHistorico } from "../grafico-barras.js";

class AtividadeLivreMenuController {
  #listaEl = document.getElementById("lista");

  iniciar() {
    this.#iniciarGraficoHistorico();
    this.#renderizarLista();
  }

  #historico() {
    return TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(TreinosStorage.chaves.historicoSessaoLivre);
  }

  #iniciarGraficoHistorico() {
    const grafico = new GraficoBarrasHistorico({
      seletor: "#graficoAtividadeLivre",
      historico: this.#historico(),
      campoData: "dataHora"
    });
    grafico.inicializar(document.getElementById("graficoSecao"), document.getElementById("graficoVazio"));
  }

  #cartaoLancamento(entrada) {
    const breadcrumb = TreinosStorage.caminhoTipoAtividade(entrada.tipoAtividadeId)
      .map((t) => t.nome)
      .join(" › ");

    const div = document.createElement("div");
    div.className = "lancamento";
    div.innerHTML = `
      <div class="lancamento-cabecalho">
        <span class="lancamento-tipo">${breadcrumb || entrada.tipoAtividadeNome}</span>
        <span class="lancamento-duracao">${Formatadores.duracaoExtensa(entrada.duracaoSegundos)}</span>
      </div>
      <div class="lancamento-data">${Formatadores.dataHora(entrada.dataHora)}</div>
      ${entrada.observacao ? `<div class="lancamento-observacao">${entrada.observacao}</div>` : ""}
    `;
    return div;
  }

  #renderizarLista() {
    const entradas = [...this.#historico()].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

    this.#listaEl.innerHTML = "";
    if (!entradas.length) {
      this.#listaEl.innerHTML = '<div class="estado">Nenhuma atividade registrada ainda.</div>';
      return;
    }
    entradas.forEach((entrada) => this.#listaEl.appendChild(this.#cartaoLancamento(entrada)));
  }
}

new AtividadeLivreMenuController().iniciar();
