import { TreinosStorage } from "../storage.js";

const erroEl = document.getElementById("erro");
const formEl = document.getElementById("formPlano");
const tituloEl = document.getElementById("titulo");
const voltarLinkEl = document.getElementById("voltarLink");
const nomeInputEl = document.getElementById("nomeInput");
const professorInputEl = document.getElementById("professorInput");
const inicioInputEl = document.getElementById("inicioInput");
const fimInputEl = document.getElementById("fimInput");
const criarBtnEl = document.getElementById("criarBtn");
const mensagemEl = document.getElementById("mensagem");

function mostrarMensagem(texto) {
  mensagemEl.hidden = false;
  mensagemEl.className = "mensagem erro";
  mensagemEl.textContent = texto;
}

function mostrarErro(mensagem) {
  formEl.hidden = true;
  erroEl.hidden = false;
  erroEl.innerHTML = `${mensagem} Volte pra <a href="alunos.html">Alunos</a>.`;
}

const alunoId = new URLSearchParams(window.location.search).get("aluno");
const aluno = alunoId && TreinosStorage.listarAlunos().find((a) => a.id === alunoId);

if (!aluno) {
  mostrarErro("Nenhum aluno selecionado.");
} else {
  document.title = `Novo plano — ${aluno.nome}`;
  tituloEl.textContent = `Novo plano para ${aluno.nome}`;
  voltarLinkEl.href = `planos.html?aluno=${encodeURIComponent(alunoId)}`;

  criarBtnEl.addEventListener("click", () => {
    const nome = nomeInputEl.value.trim();
    const professor = professorInputEl.value.trim();
    const inicio = inicioInputEl.value;
    const fim = fimInputEl.value;

    TreinosStorage.criarPlano({ alunoId, professor, inicio, fim, nome });
    window.location.href = "sistema.html";
  });
}
