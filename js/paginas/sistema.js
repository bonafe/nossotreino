import { TreinosStorage } from "../storage.js";

if (!TreinosStorage.lerJSON("dadosTreinos.v1", null)) {
  document.getElementById("avisoDados").hidden = false;
}

const TEXTOS_CONFIRMACAO = {
  "reset-musculacao":
    "Isso vai apagar todo o histórico de séries e sessões de musculação, além do progresso de treinos em andamento. Não dá pra desfazer. Continuar?",
  "reset-bicicleta":
    "Isso vai apagar todo o histórico de sessões de bicicleta. Não dá pra desfazer. Continuar?"
};

class ConfiguracoesController {
  #configBtn = document.getElementById("configBtn");
  #configMenu = document.getElementById("configMenu");
  #confirmOverlay = document.getElementById("confirmOverlay");
  #confirmTexto = document.getElementById("confirmTexto");
  #confirmOk = document.getElementById("confirmOk");
  #confirmCancelar = document.getElementById("confirmCancelar");
  #toastEl = document.getElementById("toast");
  #acaoConfirmada = null;
  #toastTimeout = null;

  iniciar() {
    this.#configBtn.addEventListener("click", () => this.#alternarMenu());
    document.addEventListener("click", (evento) => this.#aoClicarFora(evento));

    this.#configMenu.querySelectorAll(".config-menu-item").forEach((botao) => {
      botao.addEventListener("click", () => this.#aoEscolherAcao(botao.dataset.acao));
    });

    this.#confirmCancelar.addEventListener("click", () => this.#fecharConfirmacao());
    this.#confirmOk.addEventListener("click", () => this.#executarAcaoConfirmada());
  }

  #alternarMenu() {
    const vaiAbrir = this.#configMenu.hidden;
    this.#configMenu.hidden = !vaiAbrir;
    this.#configBtn.setAttribute("aria-expanded", String(vaiAbrir));
  }

  #fecharMenu() {
    this.#configMenu.hidden = true;
    this.#configBtn.setAttribute("aria-expanded", "false");
  }

  #aoClicarFora(evento) {
    if (this.#configMenu.hidden) return;
    if (evento.target === this.#configBtn || this.#configMenu.contains(evento.target)) return;
    this.#fecharMenu();
  }

  #aoEscolherAcao(acao) {
    this.#fecharMenu();
    this.#acaoConfirmada = acao;
    this.#confirmTexto.textContent = TEXTOS_CONFIRMACAO[acao];
    this.#confirmOverlay.hidden = false;
  }

  #fecharConfirmacao() {
    this.#confirmOverlay.hidden = true;
    this.#acaoConfirmada = null;
  }

  #executarAcaoConfirmada() {
    if (this.#acaoConfirmada === "reset-musculacao") {
      TreinosStorage.resetarMusculacao();
      this.#mostrarToast("Dados de musculação resetados.");
    } else if (this.#acaoConfirmada === "reset-bicicleta") {
      TreinosStorage.resetarBicicleta();
      this.#mostrarToast("Dados de bicicleta resetados.");
    }
    this.#fecharConfirmacao();
  }

  #mostrarToast(texto) {
    this.#toastEl.textContent = texto;
    this.#toastEl.hidden = false;
    clearTimeout(this.#toastTimeout);
    this.#toastTimeout = setTimeout(() => {
      this.#toastEl.hidden = true;
    }, 2600);
  }
}

new ConfiguracoesController().iniciar();
