// Mantém a tela ligada durante um treino em andamento (Screen Wake Lock API),
// mesmo padrão que YouTube/apps de vídeo usam. Sem suporte (Firefox, contexto
// não seguro) ou qualquer falha (aba em background, bateria baixa) apenas não
// faz nada — o treino continua funcionando normalmente sem o wake lock.
export class TelaAtiva {
  #lock = null;
  #desejada = false;

  constructor() {
    document.addEventListener("visibilitychange", () => {
      // O navegador libera o wake lock sozinho quando a aba fica em
      // background — ao voltar a ficar visível, pede de novo se ainda for
      // desejado (ex: aluno trocou de app no meio do descanso).
      if (this.#desejada && document.visibilityState === "visible") this.#solicitar();
    });
  }

  async ativar() {
    this.#desejada = true;
    await this.#solicitar();
  }

  async #solicitar() {
    if (!("wakeLock" in navigator) || this.#lock) return;
    try {
      this.#lock = await navigator.wakeLock.request("screen");
      this.#lock.addEventListener("release", () => {
        this.#lock = null;
      });
    } catch {
      this.#lock = null;
    }
  }

  async liberar() {
    this.#desejada = false;
    if (this.#lock) {
      await this.#lock.release();
      this.#lock = null;
    }
  }
}
