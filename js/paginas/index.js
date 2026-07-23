import { TreinosStorage } from "../storage.js";
import { OPCOES_PIX } from "../dados-apoio.js";

// Pula a navegação por alunos/planos pra quem já tem um plano ativo —
// "Entrar" leva direto pro sistema.html, que já tem botão de voltar pra
// planos.html se a pessoa quiser trocar de plano/aluno.
if (TreinosStorage.obterPlanoAtivoId()) {
  document.getElementById("entrarLink").href = "sistema.html";
}

// Painel de apoio (docs/apoio-especificacao.md): só exibe as strings "Pix
// copia e cola" já prontas (nunca constrói/calcula payload aqui). Sem
// nenhuma opção com `payload` preenchido, mostra o aviso de "em breve" em
// vez de uma tela quebrada.
const valoresEl = document.getElementById("pixValores");
const qrEl = document.getElementById("pixQr");
const copiarBtnEl = document.getElementById("pixCopiarBtn");
const copiaManualInputEl = document.getElementById("pixCopiaManualInput");
const indisponivelEl = document.getElementById("pixIndisponivel");

const opcoesDisponiveis = OPCOES_PIX.filter((opcao) => opcao.payload);

let qrcode = null;
let payloadAtual = null;

function rotuloValor(opcao) {
  return opcao.valor == null ? "Valor livre" : `R$ ${opcao.valor}`;
}

function selecionarOpcao(opcao) {
  payloadAtual = opcao.payload;
  copiaManualInputEl.hidden = true;

  valoresEl.querySelectorAll(".pix-valor-btn").forEach((botao) => {
    botao.classList.toggle("ativo", botao.dataset.payload === opcao.payload);
  });

  if (qrcode) {
    qrcode.clear();
    qrcode.makeCode(payloadAtual);
  } else {
    qrcode = new QRCode(qrEl, {
      text: payloadAtual,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff"
    });
  }
}

function mostrarCopiaManual() {
  copiaManualInputEl.hidden = false;
  copiaManualInputEl.value = payloadAtual;
  copiaManualInputEl.focus();
  copiaManualInputEl.select();
  copiaManualInputEl.setSelectionRange(0, payloadAtual.length);
}

function mostrarCopiado() {
  const textoOriginal = copiarBtnEl.textContent;
  copiarBtnEl.textContent = "Copiado!";
  setTimeout(() => {
    copiarBtnEl.textContent = textoOriginal;
  }, 2000);
}

// Fallback pra `navigator.clipboard.writeText` — necessário no Safari/iOS,
// que em vários contextos rejeita a Clipboard API mesmo dentro de um clique
// (diferente de Chrome desktop/Android, onde a Clipboard API já resolve
// direto). `execCommand("copy")` é antigo mas ainda suportado em todo
// lugar; `setSelectionRange` além de `.select()` é necessário
// especificamente no iOS, que ignora `.select()` sozinho em textarea.
function copiarViaExecCommand(texto) {
  const areaTemp = document.createElement("textarea");
  areaTemp.value = texto;
  areaTemp.setAttribute("readonly", "");
  areaTemp.style.position = "fixed";
  areaTemp.style.top = "0";
  areaTemp.style.left = "-9999px";
  document.body.appendChild(areaTemp);
  areaTemp.focus();
  areaTemp.select();
  areaTemp.setSelectionRange(0, texto.length);

  let sucesso = false;
  try {
    sucesso = document.execCommand("copy");
  } catch (erro) {
    sucesso = false;
  }

  document.body.removeChild(areaTemp);
  return sucesso;
}

function copiarPayload() {
  if (!payloadAtual) return;

  function tentarExecCommand() {
    if (copiarViaExecCommand(payloadAtual)) {
      mostrarCopiado();
    } else {
      // Nem Clipboard API nem execCommand funcionaram — nunca falha
      // silenciosamente, cai pro campo de texto selecionável.
      mostrarCopiaManual();
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payloadAtual).then(mostrarCopiado, tentarExecCommand);
  } else {
    tentarExecCommand();
  }
}

if (!opcoesDisponiveis.length) {
  indisponivelEl.hidden = false;
} else {
  opcoesDisponiveis.forEach((opcao, index) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "pix-valor-btn";
    botao.textContent = rotuloValor(opcao);
    botao.dataset.payload = opcao.payload;
    botao.addEventListener("click", () => selecionarOpcao(opcao));
    valoresEl.appendChild(botao);

    if (index === 0) selecionarOpcao(opcao);
  });

  valoresEl.hidden = opcoesDisponiveis.length <= 1;
  qrEl.hidden = false;
  copiarBtnEl.hidden = false;
  copiarBtnEl.addEventListener("click", copiarPayload);
}
