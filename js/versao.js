// Versão visível pro humano, independente do CACHE_NOME do service worker
// (esse é sobre cache-busting, não sobre "confirmar que um deploy chegou")
// — bump manual quando valer a pena poder olhar o rodapé (ex.: no celular,
// depois de publicar) e confirmar que a versão nova já carregou.
export const VERSAO_APP = "2026.08.10";

function exibirNoRodape() {
  const rodape = document.createElement("p");
  rodape.className = "rodape-versao";
  rodape.textContent = `v${VERSAO_APP}`;
  document.body.appendChild(rodape);
}

exibirNoRodape();
