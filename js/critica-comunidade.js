// A biblioteca é gerada com apoio de IA e às vezes alucina — o retorno de
// quem usa é o mecanismo de correção (ver docs/critica-comunidade-especificacao.md
// e o princípio "Melhora com a comunidade" em index.html). Este módulo liga
// o botão de crítica que aparece em todo item da biblioteca (exercício de
// musculação, alongamento — mesmo `dominio` usado por
// caminhoImagemExercicio/ligarImagemExercicio em imagem-exercicio.js,
// extensível a outros no futuro sem mudar este arquivo) ao WhatsApp.

// TODO: número real do WhatsApp Business do Nosso Treino ainda não foi
// configurado — trocar antes de publicar. Formato E.164 sem "+"/espaços
// nem traços (exigido por wa.me), ex.: "5511999999999".
export const NUMERO_WHATSAPP_CRITICA = "5500000000000"; // TODO: configurar

const DOMINIO_LABEL = { musculacao: "exercício", alongamento: "alongamento" };
const CATEGORIA_LABEL = { erro: "Erro", sugestao: "Sugestão", outro: "Outro" };

// Formato da tag de referência — contrato entre este módulo e o backend
// (src/python/whatsapp/referencia.py): `[ref:<dominio>:<id>:<categoria>]`.
// Fica ao final da mensagem, isolada do texto livre que a pessoa escrever
// acima, pra um regex simples conseguir extrair de qual item da biblioteca
// se trata mesmo que o resto da mensagem mude. Ver
// docs/critica-comunidade-especificacao.md para o formato completo.
export function construirMensagemCritica({ dominio, id, nome, categoria }) {
  return [
    "Feedback sobre a biblioteca do Nosso Treino",
    "",
    `Item: ${nome} (${DOMINIO_LABEL[dominio] || dominio})`,
    `Categoria: ${CATEGORIA_LABEL[categoria] || categoria}`,
    "",
    "Descreva aqui o que você notou ou sugere:",
    "",
    "",
    `[ref:${dominio}:${id}:${categoria}]`
  ].join("\n");
}

export function abrirCriticaWhatsApp(item) {
  const mensagem = construirMensagemCritica(item);
  const url = `https://wa.me/${NUMERO_WHATSAPP_CRITICA}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank", "noopener");
}

// Modal de escolha de categoria — mesmo padrão de #confirmOverlay já usado
// em sistema.html/alunos.html/planos.html (overlay + confirm-card), com 3
// categorias em vez de confirmar/cancelar. Fecha ao clicar no backdrop
// (mesmo padrão de #imagemOverlay/#videoOverlay nesta mesma página, não é
// uma confirmação de ação destrutiva com botão padrão).
export function criarCriticaModal() {
  const overlayEl = document.getElementById("criticaOverlay");
  const textoEl = document.getElementById("criticaTexto");
  const fecharEl = document.getElementById("criticaFechar");
  const botoes = {
    erro: document.getElementById("criticaErro"),
    sugestao: document.getElementById("criticaSugestao"),
    outro: document.getElementById("criticaOutro")
  };

  let itemAtual = null;

  function fechar() {
    overlayEl.hidden = true;
    itemAtual = null;
  }

  Object.entries(botoes).forEach(([categoria, botaoEl]) => {
    botaoEl.addEventListener("click", () => {
      if (itemAtual) abrirCriticaWhatsApp({ ...itemAtual, categoria });
      fechar();
    });
  });
  fecharEl.addEventListener("click", fechar);
  overlayEl.addEventListener("click", (evento) => {
    if (evento.target === overlayEl) fechar();
  });

  return {
    abrir(item) {
      itemAtual = item;
      textoEl.textContent = `O que você quer relatar sobre "${item.nome}"?`;
      overlayEl.hidden = false;
    }
  };
}

// Liga um botão de crítica (badge sobre imagem ou botão na lista) a um
// item específico — `.onclick` em vez de `addEventListener` porque em
// treino_execucao.html/treino_alongamento.html o mesmo botão é reaproveitado
// conforme o exercício/alongamento muda (mesmo padrão de ligarBotaoVideo em
// video-player-modal.js).
export function ligarBotaoCritica(botaoEl, criticaModal, item) {
  botaoEl.onclick = (evento) => {
    evento.stopPropagation();
    criticaModal.abrir(item);
  };
}
