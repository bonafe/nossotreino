import { caminhoImagemExercicio } from "./imagem-exercicio.js";
import { ligarBotaoVideo } from "./video-player-modal.js";
import { ligarBotaoCritica } from "./critica-comunidade.js";

// Exercícios (bibliotecas.exercicios) e alongamentos (bibliotecas.alongamentos)
// têm o mesmo formato pros campos usados aqui (nome, descricao,
// gruposMusculares, equipamentos, execucao, restricoes, midia — ver
// docs/especificacao-biblioteca-exercicios.md e
// docs/estrutura-biblioteca-alongamentos.md), então um único renderizador
// serve pros dois catálogos.

function resolverNomes(ids, catalogo) {
  return (ids || []).map((id) => (catalogo[id] && catalogo[id].nome) || id);
}

function montarSecaoGrupos(gruposDoItem, gruposMuscularesBiblioteca) {
  if (!gruposDoItem) return "";
  // `sinergistas` (exercícios) e `secundarios` (alongamentos) são o mesmo
  // conceito com nome de campo diferente entre os dois catálogos — mesma
  // situação já tratada em PrescricaoFormatadores.gruposMusculares.
  const secundarios = gruposDoItem.sinergistas || gruposDoItem.secundarios || [];
  const secoes = [
    { titulo: "Principais", ids: gruposDoItem.principais },
    { titulo: "Secundários", ids: secundarios },
    { titulo: "Estabilizadores", ids: gruposDoItem.estabilizadores }
  ];
  return secoes
    .filter((s) => s.ids && s.ids.length)
    .map((s) => `<p><strong>${s.titulo}:</strong> ${resolverNomes(s.ids, gruposMuscularesBiblioteca).join(", ")}</p>`)
    .join("");
}

function montarSecaoEquipamentos(equipamentos, equipamentosBiblioteca) {
  if (!equipamentos) return "";
  const nomeDe = (e) => {
    const id = typeof e === "string" ? e : e.equipamentoId;
    return (equipamentosBiblioteca[id] && equipamentosBiblioteca[id].nome) || id;
  };
  const partes = [];
  if (equipamentos.obrigatorios && equipamentos.obrigatorios.length) {
    partes.push(`<p><strong>Equipamento:</strong> ${equipamentos.obrigatorios.map(nomeDe).join(", ")}</p>`);
  }
  if (equipamentos.opcionais && equipamentos.opcionais.length) {
    partes.push(`<p><strong>Opcional:</strong> ${equipamentos.opcionais.map(nomeDe).join(", ")}</p>`);
  }
  return partes.join("");
}

function montarLista(titulo, itens) {
  if (!itens || !itens.length) return "";
  return `<p><strong>${titulo}:</strong></p><ul>${itens.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

function montarSecaoExecucao(execucao) {
  if (!execucao) return "";
  return [
    montarLista("Execução", execucao.instrucoes),
    execucao.respiracao ? `<p><strong>Respiração:</strong> ${execucao.respiracao}</p>` : "",
    montarLista("Erros comuns", execucao.errosComuns),
    montarLista("Cuidados", execucao.cuidados)
  ]
    .filter(Boolean)
    .join("");
}

function montarSecaoRestricoes(restricoes) {
  if (!restricoes || !restricoes.length) return "";
  return montarLista(
    "Atenção",
    restricoes.map((r) => r.orientacao || r.condicaoId)
  );
}

/**
 * `videoModal` é a instância de `criarVideoPlayerModal()` (video-player-modal.js)
 * já criada pela página hospedeira — reaproveitada aqui pro botão "Ver
 * vídeo" em vez de cada página precisar tratar isso por conta própria.
 * `criticaModal`, mesma ideia, pra `criarCriticaModal()`
 * (critica-comunidade.js) — como este modal é o único ponto de "ver
 * detalhes" comum a treino_musculacao_novo.html/treino_alongamento_novo.html (onde
 * não existe card de item com imagem própria) e às telas de execução, é
 * aqui que o botão de crítica precisa existir pra cobrir as quatro
 * páginas de uma vez.
 */
export function criarDetalhesModal(videoModal, criticaModal) {
  const overlayEl = document.getElementById("detalhesOverlay");
  const nomeEl = document.getElementById("detalhesNome");
  const conteudoEl = document.getElementById("detalhesConteudo");
  const fecharEl = document.getElementById("detalhesFechar");
  const videoBtnEl = document.getElementById("detalhesVideoBtn");
  const criticaBtnEl = document.getElementById("detalhesCriticaBtn");
  const editarBtnEl = document.getElementById("detalhesEditarBtn");
  const imagemEl = document.getElementById("detalhesImagem");

  function fechar() {
    overlayEl.hidden = true;
  }

  fecharEl.addEventListener("click", fechar);
  overlayEl.addEventListener("click", (evento) => {
    if (evento.target === overlayEl) fechar();
  });

  let imagemToken = 0;

  return {
    /**
     * `item` é uma entrada de `bibliotecas.exercicios` ou
     * `bibliotecas.alongamentos`; `bibliotecaExercicios` é o documento
     * inteiro da biblioteca (pra resolver nomes de grupo
     * muscular/equipamento); `dominio` decide a subpasta de imagem
     * (`"musculacao"` default ou `"alongamento"`, ver
     * `js/imagem-exercicio.js#caminhoImagemExercicio`).
     */
    abrir(item, bibliotecaExercicios, dominio = "musculacao") {
      nomeEl.textContent = item.nome;

      const partes = [
        item.descricao ? `<p>${item.descricao}</p>` : "",
        montarSecaoGrupos(item.gruposMusculares, bibliotecaExercicios.gruposMusculares),
        montarSecaoEquipamentos(item.equipamentos, bibliotecaExercicios.equipamentos),
        montarSecaoExecucao(item.execucao),
        montarSecaoRestricoes(item.restricoes)
      ].filter(Boolean);

      conteudoEl.innerHTML = partes.length
        ? partes.join("")
        : '<p class="detalhes-vazio">Nenhum detalhe cadastrado ainda.</p>';

      ligarBotaoVideo(videoBtnEl, item.midia, videoModal);
      ligarBotaoCritica(criticaBtnEl, criticaModal, { dominio, id: item.id, nome: item.nome });
      // Nova aba — mesmo motivo de abrirCriticaWhatsApp usar window.open em
      // vez de navegar a própria aba: evita perder o que a pessoa já
      // montou na tela de origem (ex.: treino em construção em
      // treino_musculacao_novo.html) ao editar um item da biblioteca.
      const urlAtual = window.location.pathname.split("/").pop() + window.location.search;
      editarBtnEl.href = `exercicio_novo.html?dominio=${encodeURIComponent(dominio)}&id=${encodeURIComponent(item.id)}&voltar=${encodeURIComponent(urlAtual)}`;

      // Foto sempre por último — mesmo padrão de "tentar carregar e tratar
      // ausência" de ligarImagemExercicio (nem todo item tem imagem gerada).
      imagemEl.hidden = true;
      imagemToken += 1;
      const tokenAtual = imagemToken;
      const src = caminhoImagemExercicio(item.id, dominio);
      const probe = new Image();
      probe.onload = () => {
        if (tokenAtual !== imagemToken) return;
        imagemEl.src = src;
        imagemEl.alt = item.nome || "";
        imagemEl.hidden = false;
      };
      probe.src = src;

      overlayEl.hidden = false;
    }
  };
}
