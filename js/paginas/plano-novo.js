import { TreinosStorage } from "../storage.js";

const professorInputEl = document.getElementById("professorInput");
const alunoInputEl = document.getElementById("alunoInput");
const inicioInputEl = document.getElementById("inicioInput");
const fimInputEl = document.getElementById("fimInput");
const criarBtnEl = document.getElementById("criarBtn");
const mensagemEl = document.getElementById("mensagem");

function mostrarMensagem(texto) {
  mensagemEl.hidden = false;
  mensagemEl.className = "mensagem erro";
  mensagemEl.textContent = texto;
}

criarBtnEl.addEventListener("click", () => {
  const professor = professorInputEl.value.trim();
  const aluno = alunoInputEl.value.trim();
  const inicio = inicioInputEl.value;
  const fim = fimInputEl.value;

  if (!aluno) {
    mostrarMensagem("Preencha ao menos o nome do aluno antes de criar o plano.");
    return;
  }

  TreinosStorage.criarPlano({ professor, aluno, inicio, fim });
  window.location.href = "sistema.html";
});
