// As imagens são geradas fora do site (src/python/gerar_imagens_treino.py)
// e salvas com nome previsível — não há campo na biblioteca apontando pra
// elas, então o caminho é sempre montado por convenção a partir do id
// (exercicioId ou alongamentoId). Cada categoria tem sua própria subpasta
// dentro de `imagens/` (`musculacao/`, `alongamento/` — mesmo domínio
// usado por `bibliotecas.exercicios`/`bibliotecas.alongamentos`), já que
// os dois catálogos podem ter ids repetidos entre si. Nem todo item tem
// imagem gerada ainda, então quem usa isso precisa tratar o caso de a
// imagem não existir (ver `ligarBotaoImagem`/`ligarImagemExercicio`).
export function caminhoImagemExercicio(id, dominio = "musculacao") {
  return `biblioteca-exercicios/imagens/${dominio}/${id}.png`;
}

// Modal simples (mesmo padrão de #videoOverlay/criarVideoPlayerModal em
// video-player-modal.js) pra abrir a imagem em tamanho maior a partir do
// botão "Ver imagem" de um card de exercício.
export function criarImagemModal() {
  const overlayEl = document.getElementById("imagemOverlay");
  const imgEl = document.getElementById("imagemModalImg");
  const fecharEl = document.getElementById("imagemFechar");

  function fechar() {
    overlayEl.hidden = true;
  }

  fecharEl.addEventListener("click", fechar);
  overlayEl.addEventListener("click", (evento) => {
    if (evento.target === overlayEl) fechar();
  });

  return {
    abrir(src, alt) {
      imgEl.src = src;
      imgEl.alt = alt || "";
      overlayEl.hidden = false;
    }
  };
}

/**
 * Dispara o carregamento de todas as imagens de um treino (item principal
 * + alternativas) de uma vez, assim que o treino é aberto — evita
 * depender só do carregamento incidental de cada `<img>`/botão conforme a
 * tela avança (o gargalo que motivou isto: em treino_execucao.html só a
 * imagem do exercício atual carregava, deixando as seguintes pra buscar
 * na hora, o que falha se a rede cair no meio do treino). Ao contrário do
 * pré-carregamento de vídeo (biblioteca inteira, ver
 * docs/torrent-videos-especificacao.md seção 8), aqui é só os exercícios
 * deste treino — a pasta de imagens já passa de 40 MB, cachear tudo de
 * uma vez seria desperdício. O cache em si é o do service worker (`sw.js`,
 * rede-primeiro-com-reserva-em-cache), então basta disparar o request.
 */
export function prefetchImagensDoTreino(ids, dominio = "musculacao") {
  [...new Set(ids)].forEach((id) => {
    new Image().src = caminhoImagemExercicio(id, dominio);
  });
}

/**
 * Liga um botão "Ver imagem" a um exercício: só aparece quando a imagem
 * existe de fato (não há como saber isso a partir da biblioteca, então
 * tenta carregar e reage ao sucesso/falha).
 */
export function ligarBotaoImagem(botaoEl, exercicioId, nomeExercicio, imagemModal, dominio = "musculacao") {
  botaoEl.hidden = true;
  if (!exercicioId) return;

  const src = caminhoImagemExercicio(exercicioId, dominio);
  const probe = new Image();
  probe.onload = () => {
    botaoEl.hidden = false;
    botaoEl.disabled = false;
    botaoEl.textContent = "Ver imagem →";
    botaoEl.onclick = (evento) => {
      evento.stopPropagation();
      imagemModal.abrir(src, nomeExercicio);
    };
  };
  probe.src = src;
}

/**
 * Liga um <img> visível diretamente na tela (sem botão/modal) ao exercício
 * atual — usado em treino_execucao.html, onde a imagem fica sempre à
 * mostra. `deveAtualizar`, se informado, evita que o carregamento de uma
 * imagem antiga sobrescreva a tela depois que o aluno já avançou pra outro
 * exercício (mesmo problema resolvido em `ligarBotaoVideo`).
 */
export function ligarImagemExercicio(imgEl, exercicioId, nomeExercicio, deveAtualizar = () => true, dominio = "musculacao") {
  imgEl.hidden = true;
  if (!exercicioId) return;

  const src = caminhoImagemExercicio(exercicioId, dominio);
  const probe = new Image();
  probe.onload = () => {
    if (!deveAtualizar()) return;
    imgEl.src = src;
    imgEl.alt = nomeExercicio || "";
    imgEl.hidden = false;
  };
  probe.src = src;
}
