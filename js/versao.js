// Versão visível pro humano, independente do CACHE_NOME do service worker
// (esse é sobre cache-busting, não sobre "confirmar que um deploy chegou")
// — bump manual quando valer a pena poder olhar o rodapé (ex.: no celular,
// depois de publicar) e confirmar que a versão nova já carregou.
export const VERSAO_APP = "2026.08.10";

function exibirNoRodape() {
  // `body` é `display: flex` (ver css/base.css) com `<main>` como único
  // filho visível — anexar direto em `body` vira um segundo item flex e
  // espreme o layout. Tem que entrar dentro de `<main>`, igual ao resto do
  // conteúdo de cada página.
  const main = document.querySelector("main");
  if (!main) return;

  const rodape = document.createElement("p");
  rodape.className = "rodape-versao";
  rodape.textContent = `v${VERSAO_APP}`;
  main.appendChild(rodape);
}

exibirNoRodape();
