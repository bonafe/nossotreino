import { VideosTorrent } from "./videos-torrent.js";

// Player embutido reutilizado por treino_musculacao_exercicios.html e
// treino_execucao.html — cada página tem o mesmo bloco de markup
// (#videoOverlay/#videoPlayer/#videoFechar, ver seção 10 de
// docs/torrent-videos-especificacao.md), só o comportamento é compartilhado.
export function criarVideoPlayerModal() {
  const overlayEl = document.getElementById("videoOverlay");
  const playerEl = document.getElementById("videoPlayer");
  const fecharEl = document.getElementById("videoFechar");

  function fechar() {
    playerEl.pause();
    playerEl.removeAttribute("src");
    playerEl.load();
    overlayEl.hidden = true;
  }

  fecharEl.addEventListener("click", fechar);
  overlayEl.addEventListener("click", (evento) => {
    if (evento.target === overlayEl) fechar();
  });

  return {
    abrir(blobUrl) {
      playerEl.src = blobUrl;
      overlayEl.hidden = false;
      playerEl.play().catch(() => {});
    }
  };
}

/**
 * Liga um botão "Ver vídeo" à fonte disponível em `fonte` (um exercício ou
 * o aquecimento padrão): `videoMagnet` tem prioridade (baixa por torrent e
 * abre no player embutido); `videoUrl` — o link externo antigo — continua
 * funcionando pros vídeos ainda não migrados pra torrent (não é fallback de
 * swarm frio, é coexistência durante a migração gradual do acervo).
 *
 * `deveAtualizar`, se informado, é checado antes de cada atualização
 * assíncrona — necessário quando o mesmo botão é reaproveitado por
 * exercícios diferentes ao longo do tempo (treino_execucao.html), pra uma
 * atualização de um vídeo antigo não sobrescrever o botão depois que o
 * usuário já navegou pra outro exercício.
 */
export function ligarBotaoVideo(botaoEl, fonte, videoModal, deveAtualizar = () => true) {
  if (fonte && fonte.videoMagnet) {
    botaoEl.hidden = false;
    botaoEl.disabled = true;
    botaoEl.textContent = "Vídeo…";

    let blobUrlAtual = null;
    VideosTorrent.garantirVideo(fonte.videoMagnet, (estado) => {
      if (!deveAtualizar()) return;
      if (estado.estado === "baixando") {
        botaoEl.disabled = true;
        botaoEl.textContent = estado.semPeers
          ? "Baixando vídeo… procurando outros aparelhos"
          : `Baixando vídeo… ${Math.round(estado.progresso * 100)}%`;
      } else if (estado.estado === "pronto") {
        blobUrlAtual = estado.blobUrl;
        botaoEl.disabled = false;
        botaoEl.textContent = "Ver vídeo →";
      } else {
        botaoEl.disabled = true;
        botaoEl.textContent = "Vídeo indisponível";
      }
    });

    botaoEl.onclick = (evento) => {
      evento.stopPropagation();
      if (blobUrlAtual) videoModal.abrir(blobUrlAtual);
    };
    return;
  }

  if (fonte && fonte.videoUrl) {
    botaoEl.hidden = false;
    botaoEl.disabled = false;
    botaoEl.textContent = "Ver vídeo →";
    botaoEl.onclick = (evento) => {
      evento.stopPropagation();
      window.open(fonte.videoUrl, "_blank", "noopener");
    };
    return;
  }

  botaoEl.hidden = true;
}
