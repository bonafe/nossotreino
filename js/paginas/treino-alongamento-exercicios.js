import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { PrescricaoFormatadores } from "../prescricao-formatadores.js";
import { criarVideoPlayerModal, ligarBotaoVideo } from "../video-player-modal.js";
import { criarImagemModal, ligarImagemExercicio } from "../imagem-exercicio.js";

// Mirror de treino-exercicios.js, mas pro schema mais simples do
// alongamento (sem aquecimento/superset/circuito/alternativas/cardio —
// fora de escopo, seção 8 de docs/treino-alongamento-especificacao.md).
class TreinoAlongamentoExerciciosController {
  #videoModal = criarVideoPlayerModal();
  #imagemModal = criarImagemModal();
  #origemTreinoId = null;

  #itemCard({ alongamentoId, prescricao, bibliotecaExercicios, treinoAlongamentoId }) {
    const alongamento = bibliotecaExercicios.bibliotecas.alongamentos[alongamentoId];
    const grupos = alongamento
      ? PrescricaoFormatadores.gruposMusculares(alongamento.gruposMusculares, bibliotecaExercicios.gruposMusculares)
      : [];
    const nome = alongamento ? alongamento.nome : alongamentoId;
    const execucaoUrl =
      `treino_alongamento.html?treino=${encodeURIComponent(treinoAlongamentoId)}` +
      `&alongamento=${encodeURIComponent(alongamentoId)}` +
      (this.#origemTreinoId ? `&origem=${encodeURIComponent(this.#origemTreinoId)}` : "");
    const progressoUrl = `treino_alongamento_progresso.html?alongamento=${encodeURIComponent(alongamentoId)}&treino=${encodeURIComponent(treinoAlongamentoId)}`;

    const div = document.createElement("div");
    div.className = "item";
    div.tabIndex = 0;
    div.setAttribute("role", "link");
    div.innerHTML = `
      <div class="item-linha">
        <div class="item-conteudo">
          <div class="item-cabecalho">
            <span class="item-nome">${nome}</span>
          </div>
          ${grupos.length ? `<div class="item-grupos">${grupos.map((g) => `<span>${g}</span>`).join("")}</div>` : ""}
          <div class="item-detalhes">
            <span><strong>${prescricao.series}</strong> séries</span>
            <span>${PrescricaoFormatadores.metrica(prescricao.metrica)}</span>
          </div>
          <div class="item-acoes">
            <button type="button" class="ver-video" hidden></button>
            <a class="ver-progresso" href="${progressoUrl}">Ver progresso →</a>
          </div>
        </div>
        <img class="item-imagem" alt="" hidden />
      </div>
    `;

    div.addEventListener("click", () => {
      window.location.href = execucaoUrl;
    });
    div.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        window.location.href = execucaoUrl;
      }
    });

    ligarBotaoVideo(div.querySelector(".ver-video"), alongamento && alongamento.midia, this.#videoModal);

    const imagemEl = div.querySelector(".item-imagem");
    ligarImagemExercicio(imagemEl, alongamentoId, nome, () => true, "alongamento");
    imagemEl.addEventListener("click", (evento) => {
      evento.stopPropagation();
      this.#imagemModal.abrir(imagemEl.src, nome);
    });

    div.querySelector(".ver-progresso").addEventListener("click", (evento) => {
      evento.stopPropagation();
    });

    return div;
  }

  #montarAlongamentos(treinoAlongamento, bibliotecaExercicios) {
    const blocosEl = document.getElementById("blocos");
    const vazioEl = document.getElementById("vazio");

    if (!treinoAlongamento.alongamentos.length) {
      vazioEl.hidden = false;
      return;
    }

    const itensEl = document.createElement("div");
    itensEl.className = "itens";

    [...treinoAlongamento.alongamentos]
      .sort((a, b) => a.ordem - b.ordem)
      .forEach((item) => {
        itensEl.appendChild(
          this.#itemCard({
            alongamentoId: item.alongamentoId,
            prescricao: item.prescricao,
            bibliotecaExercicios,
            treinoAlongamentoId: treinoAlongamento.id
          })
        );
      });

    blocosEl.appendChild(itensEl);
  }

  #mostrarErro(mensagem) {
    document.getElementById("carregando").hidden = true;
    const erroEl = document.getElementById("erro");
    erroEl.hidden = false;
    erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_alongamento_menu.html">menu de alongamento</a>.`;
    document.getElementById("titulo").textContent = "Treino de Alongamento";
  }

  #iniciarComDados(treinoAlongamento, bibliotecaExercicios) {
    document.getElementById("carregando").hidden = true;

    document.title = `${treinoAlongamento.nome} — Treino de Alongamento`;
    document.getElementById("titulo").textContent = treinoAlongamento.nome;

    this.#montarAlongamentos(treinoAlongamento, bibliotecaExercicios);

    if (treinoAlongamento.alongamentos.length) {
      const iniciarEl = document.getElementById("iniciarTreino");
      iniciarEl.hidden = false;
      iniciarEl.href =
        `treino_alongamento.html?treino=${encodeURIComponent(treinoAlongamento.id)}` +
        (this.#origemTreinoId ? `&origem=${encodeURIComponent(this.#origemTreinoId)}` : "");

      const progressoSalvo = TreinosStorage.lerJSON(TreinosStorage.chaves.execucaoAlongamento(treinoAlongamento.id), null);
      const emAndamento = progressoSalvo && progressoSalvo.alongamentoId && progressoSalvo.serieAtual >= 1;
      iniciarEl.textContent = emAndamento ? "Continuar treino →" : "Iniciar treino →";
    }
  }

  async iniciar() {
    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("treino");
    this.#origemTreinoId = params.get("origem");

    document.getElementById("voltarLink").href = this.#origemTreinoId
      ? `treino_exercicios.html?treino=${encodeURIComponent(this.#origemTreinoId)}`
      : "treino_alongamento_menu.html";

    if (!treinoId) {
      this.#mostrarErro("Nenhum treino selecionado.");
      return;
    }

    let dados;
    try {
      dados = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      this.#mostrarErro(
        'Nenhum plano de treino carregado ainda neste navegador. <a href="alunos.html">Escolha ou crie um aluno</a> pra começar.'
      );
      return;
    }

    const treinoAlongamento = (dados.treinosAlongamento || []).find((t) => t.id === treinoId);
    if (!treinoAlongamento) {
      this.#mostrarErro("Este treino não foi encontrado.");
      return;
    }

    let bibliotecaExercicios;
    try {
      bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    this.#iniciarComDados(treinoAlongamento, bibliotecaExercicios);
  }
}

new TreinoAlongamentoExerciciosController().iniciar();
