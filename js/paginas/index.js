import "../storage.js";
import { OPCOES_PIX } from "../dados-apoio.js";

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
  copiaManualInputEl.select();
}

function mostrarCopiado() {
  const textoOriginal = copiarBtnEl.textContent;
  copiarBtnEl.textContent = "Copiado!";
  setTimeout(() => {
    copiarBtnEl.textContent = textoOriginal;
  }, 2000);
}

function copiarPayload() {
  if (!payloadAtual) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payloadAtual).then(mostrarCopiado, mostrarCopiaManual);
  } else {
    // Sem Clipboard API (contexto inseguro, navegador antigo etc.) — nunca
    // falha silenciosamente, cai pro campo de texto selecionável.
    mostrarCopiaManual();
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
