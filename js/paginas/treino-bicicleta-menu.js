import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { Formatadores } from "../formatadores.js";
import { GraficoBarrasHistorico } from "../grafico-barras.js";

// bibliotecas.cardio.modalidades pode crescer pra outras modalidades no
// futuro (esteira, remo...); esta página é o motor específico de
// bicicleta, então filtra pelo nome/aliases da modalidade — mesmo
// espírito do antigo filtro por texto livre `cardio.exercicio === "Bicicleta"`.
function ehModalidadeBicicleta(modalidade) {
  const textos = [modalidade.nome, ...(modalidade.aliases || [])];
  return textos.some((texto) => texto && texto.toLowerCase().includes("bicicleta"));
}

class TreinoBicicletaMenuController {
  #listaEl = document.getElementById("lista");

  iniciar() {
    this.#iniciarGraficoHistorico();
    this.#carregarTreinos();
  }

  #iniciarGraficoHistorico() {
    const historico = TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoBicicleta, []);
    const grafico = new GraficoBarrasHistorico({
      seletor: "#graficoBicicleta",
      historico,
      campoData: "dataHora"
    });
    grafico.inicializar(document.getElementById("graficoSecao"), document.getElementById("graficoVazio"));
  }

  #cartaoTreino(treinoCardio, nomeModalidade) {
    const a = document.createElement("a");
    a.className = "treino";
    a.href = `treino_bicicleta.html?treino=${encodeURIComponent(treinoCardio.id)}`;

    const cfg = treinoCardio.treino;
    const campos = [
      { titulo: "Tipo", valor: cfg.tipo === "intervalado" ? "Intervalado" : "Contínuo" },
      cfg.series != null && { titulo: "Séries", valor: cfg.series },
      cfg.estimulo && { titulo: "Tempo de estímulo", valor: Formatadores.tempoCurto(cfg.estimulo.duracaoSegundos) },
      cfg.estimulo &&
        cfg.estimulo.intensidade && {
          titulo: "Intensidade do estímulo",
          valor: Formatadores.labelIntensidade(cfg.estimulo.intensidade.valor)
        },
      cfg.recuperacao && { titulo: "Recuperação", valor: Formatadores.tempoCurto(cfg.recuperacao.duracaoSegundos) },
      cfg.recuperacao &&
        cfg.recuperacao.intensidade && {
          titulo: "Intensidade da recuperação",
          valor: Formatadores.labelIntensidade(cfg.recuperacao.intensidade.valor)
        }
    ].filter(Boolean);

    a.innerHTML = `
      <h2>${treinoCardio.nome} — ${nomeModalidade}</h2>
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
        '<div class="estado">Nenhum plano de treino carregado ainda neste navegador. <a href="importar_dados.html">Carregue o arquivo do seu plano</a> pra começar.</div>';
      return;
    }

    let bibliotecaExercicios;
    try {
      bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#listaEl.innerHTML =
        '<div class="estado">Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.</div>';
      return;
    }

    const cartoes = [];
    (dados.treinosCardio || []).forEach((treinoCardio) => {
      const modalidade = bibliotecaExercicios.bibliotecas.cardio.modalidades[treinoCardio.modalidadeId];
      if (!modalidade || !ehModalidadeBicicleta(modalidade)) return;
      cartoes.push(this.#cartaoTreino(treinoCardio, modalidade.nome));
    });

    this.#listaEl.innerHTML = "";
    if (!cartoes.length) {
      this.#listaEl.innerHTML = '<div class="estado">Nenhum treino de bicicleta cadastrado ainda.</div>';
      return;
    }
    cartoes.forEach((cartao) => this.#listaEl.appendChild(cartao));
  }
}

new TreinoBicicletaMenuController().iniciar();
