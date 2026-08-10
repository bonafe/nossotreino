import { TreinosStorage } from "../storage.js";

const nomeInputEl = document.getElementById("nomeInput");
const criarBtnEl = document.getElementById("criarBtn");
const mensagemEl = document.getElementById("mensagem");

function mostrarMensagem(texto) {
  mensagemEl.hidden = false;
  mensagemEl.className = "mensagem erro";
  mensagemEl.textContent = texto;
}

criarBtnEl.addEventListener("click", async () => {
  const nome = nomeInputEl.value.trim();

  if (!nome) {
    mostrarMensagem("Preencha o nome do aluno.");
    return;
  }

  const id = TreinosStorage.criarAluno(nome);
  await TreinosStorage.aguardarEscritas();
  window.location.href = `planos.html?aluno=${encodeURIComponent(id)}`;
});
