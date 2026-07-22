import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { PrescricaoFormatadores } from "../prescricao-formatadores.js";
import { Formatadores } from "../formatadores.js";
import { LABEL_TIPO } from "../constantes.js";
import { criarVideoPlayerModal, ligarBotaoVideo } from "../video-player-modal.js";
import { criarImagemModal, ligarBotaoImagem } from "../imagem-exercicio.js";

const MOMENTO_LABEL = {
  "final-da-serie": "ao final da série",
  "inicio-da-serie": "no início da série"
};

function humanizarEnum(valor) {
  return valor.replace(/-/g, " ");
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarPosicaoIsometria(posicao) {
  const combinacao = /^(\d+)-por-cento-da-amplitude$/.exec(posicao);
  return combinacao ? `${combinacao[1]}% da amplitude` : humanizarEnum(posicao);
}

class TreinoExerciciosController {
  #videoModal = criarVideoPlayerModal();
  #imagemModal = criarImagemModal();

  #montarGuia(orientacoesGerais) {
    if (!orientacoesGerais) return "";

    const cadencia = orientacoesGerais.cadenciaPadrao;
    const descanso = orientacoesGerais.descansoPadrao;
    const isometria = orientacoesGerais.isometria;

    const itens = [
      { titulo: "Ajuste de carga", texto: orientacoesGerais.ajusteCarga && orientacoesGerais.ajusteCarga.regra },
      { titulo: "Cadência", texto: cadencia && `Concêntrica ${cadencia.concentrica}, excêntrica ${cadencia.excentrica}.` },
      {
        titulo: "Pausa entre séries",
        texto: descanso && `${descanso.minSegundos} a ${descanso.maxSegundos} segundos.`
      },
      { titulo: "Superset", texto: orientacoesGerais.superset && orientacoesGerais.superset.regra },
      {
        titulo: "Isometria",
        texto: isometria &&
          `Segurar ${isometria.duracaoSegundos}s a ${formatarPosicaoIsometria(isometria.posicao)}, ` +
          `${MOMENTO_LABEL[isometria.momento] || humanizarEnum(isometria.momento)}` +
          (isometria.aplicacao && isometria.aplicacao.ultimasSeries
            ? `, nas últimas ${isometria.aplicacao.ultimasSeries} séries.`
            : ".")
      },
      { titulo: "Circuito", texto: orientacoesGerais.circuito && orientacoesGerais.circuito.regra }
    ];

    return itens
      .filter((item) => item.texto)
      .map((item) => `<li><strong>${item.titulo}:</strong> ${item.texto}</li>`)
      .join("");
  }

  #montarAquecimento(treino) {
    const secaoEl = document.getElementById("aquecimento");
    const protocolos = treino.aquecimento && treino.aquecimento.protocolos;
    if (!protocolos || !protocolos.length) return;

    secaoEl.hidden = false;
    const containerEl = document.getElementById("aquecimentoProtocolos");
    containerEl.innerHTML = "";

    protocolos.forEach((protocolo) => {
      const partes = [];
      if (protocolo.series) partes.push(`${protocolo.series} série${protocolo.series === 1 ? "" : "s"}`);
      if (protocolo.dosagem) {
        partes.push(`de ${protocolo.dosagem.valor} ${humanizarEnum(protocolo.dosagem.unidade)}`);
      } else if (protocolo.metrica) {
        partes.push(`de ${PrescricaoFormatadores.metrica(protocolo.metrica)}`);
      }
      if (protocolo.alvo) partes.push(`— ${humanizarEnum(protocolo.alvo)}`);

      const textoEl = document.createElement("p");
      textoEl.innerHTML =
        `<strong>${capitalizar(humanizarEnum(protocolo.tipo))}:</strong> ${partes.join(" ")}.` +
        (protocolo.observacao ? ` ${protocolo.observacao}` : "");
      containerEl.appendChild(textoEl);

      if (protocolo.videoUrl) {
        const botaoEl = document.createElement("button");
        botaoEl.type = "button";
        botaoEl.className = "ver-video";
        botaoEl.hidden = true;
        containerEl.appendChild(botaoEl);
        ligarBotaoVideo(botaoEl, { videoUrl: protocolo.videoUrl }, this.#videoModal);
      }
    });
  }

  #notaIsometria(tecnicas) {
    const tecnica = tecnicas.find((t) => t.tipo === "isometria");
    if (!tecnica) return "";

    const partes = [`Isometria de ${tecnica.duracaoSegundos}s`];
    if (tecnica.posicao) partes.push(`a ${formatarPosicaoIsometria(tecnica.posicao)}`);
    if (tecnica.momento) partes.push(MOMENTO_LABEL[tecnica.momento] || humanizarEnum(tecnica.momento));
    if (tecnica.aplicacao && tecnica.aplicacao.ultimasSeries) {
      partes.push(`nas últimas ${tecnica.aplicacao.ultimasSeries} séries`);
    }
    return `${partes.join(", ")}.`;
  }

  #itemCard({ exercicioId, prescricao, ehAlternativa, slotExercicioId, bibliotecaExercicios, treinoId }) {
    const exercicio = bibliotecaExercicios.bibliotecas.exercicios[exercicioId];
    const isometria = PrescricaoFormatadores.ehIsometria(prescricao.tecnicas);
    const classes = ["item"];
    if (isometria) classes.push("isometria");
    if (ehAlternativa) classes.push("substituto");

    const grupos = exercicio
      ? PrescricaoFormatadores.gruposMusculares(exercicio.gruposMusculares, bibliotecaExercicios.gruposMusculares)
      : [];
    const nome = exercicio ? exercicio.nome : exercicioId;
    const execucaoUrl =
      `treino_execucao.html?treino=${encodeURIComponent(treinoId)}` +
      `&exercicio=${encodeURIComponent(slotExercicioId)}&opcao=${encodeURIComponent(exercicioId)}`;
    const progressoUrl = `treino_exercicio_progresso.html?exercicio=${encodeURIComponent(exercicioId)}&treino=${encodeURIComponent(treinoId)}`;

    const div = document.createElement("div");
    div.className = classes.join(" ");
    div.tabIndex = 0;
    div.setAttribute("role", "link");
    div.innerHTML = `
      <div class="item-cabecalho">
        <span class="item-nome">${nome}</span>
        ${ehAlternativa ? '<span class="item-substituto-label">Substituto</span>' : ""}
      </div>
      ${grupos.length ? `<div class="item-grupos">${grupos.map((g) => `<span>${g}</span>`).join("")}</div>` : ""}
      <div class="item-detalhes">
        <span><strong>${prescricao.series}</strong> séries</span>
        <span>${PrescricaoFormatadores.metrica(prescricao.metrica)}</span>
      </div>
      ${isometria ? `<div class="item-isometria-nota">${this.#notaIsometria(prescricao.tecnicas)}</div>` : ""}
      <div class="item-acoes">
        <button type="button" class="ver-video" hidden></button>
        <button type="button" class="ver-imagem" hidden></button>
        <a class="ver-progresso" href="${progressoUrl}">Ver progresso →</a>
      </div>
    `;

    div.addEventListener("click", () => {
      window.location.href = execucaoUrl;
    });
    div.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        window.location.href = execucaoUrl;
      }
    });

    ligarBotaoVideo(div.querySelector(".ver-video"), exercicio && exercicio.midia, this.#videoModal);
    ligarBotaoImagem(div.querySelector(".ver-imagem"), exercicioId, nome, this.#imagemModal);

    div.querySelector(".ver-progresso").addEventListener("click", (evento) => {
      evento.stopPropagation();
    });

    return div;
  }

  // Os exercícios ficam em lista plana; supersets/circuitos são só
  // marcadores numéricos (`superset`/`circuito`) em cada item — itens
  // consecutivos com o mesmo marcador viram um grupo visual, mesma
  // aparência de "bloco" de antes, só que calculado aqui em vez de vir
  // pronto no JSON.
  #agruparPorMarcador(exercicios) {
    const ordenados = [...exercicios].sort((a, b) => a.ordem - b.ordem);
    const grupos = [];

    ordenados.forEach((item) => {
      const marcador =
        item.superset != null
          ? { tipo: "superset", numero: item.superset }
          : item.circuito != null
            ? { tipo: "circuito", numero: item.circuito }
            : null;

      const anterior = grupos[grupos.length - 1];
      const mesmoGrupo =
        anterior &&
        ((marcador === null && anterior.marcador === null) ||
          (marcador &&
            anterior.marcador &&
            anterior.marcador.tipo === marcador.tipo &&
            anterior.marcador.numero === marcador.numero));

      if (mesmoGrupo) {
        anterior.itens.push(item);
      } else {
        grupos.push({ marcador, itens: [item] });
      }
    });

    return grupos.map((grupo) => ({
      rotulo: grupo.marcador
        ? grupo.marcador.tipo === "superset"
          ? `Superset ${grupo.marcador.numero} — fazer em sequência`
          : `Circuito ${grupo.marcador.numero} — uma série de cada por volta`
        : null,
      itens: grupo.itens
    }));
  }

  #montarExercicios(treino, bibliotecaExercicios) {
    const blocosEl = document.getElementById("blocos");
    const vazioEl = document.getElementById("vazio");

    if (!treino.exercicios.length) {
      vazioEl.hidden = false;
      return;
    }

    this.#agruparPorMarcador(treino.exercicios).forEach((grupo) => {
      const blocoEl = document.createElement("div");
      blocoEl.className = "bloco";
      if (grupo.rotulo) {
        blocoEl.innerHTML = `<h3 class="bloco-titulo">${grupo.rotulo}</h3>`;
      }

      const itensEl = document.createElement("div");
      itensEl.className = "itens";
      grupo.itens.forEach((item) => {
        itensEl.appendChild(
          this.#itemCard({
            exercicioId: item.exercicioId,
            prescricao: item.prescricao,
            ehAlternativa: false,
            slotExercicioId: item.exercicioId,
            bibliotecaExercicios,
            treinoId: treino.id
          })
        );

        (item.alternativas || []).forEach((alt) => {
          itensEl.appendChild(
            this.#itemCard({
              exercicioId: alt.exercicioId,
              prescricao: alt.prescricao || item.prescricao,
              ehAlternativa: true,
              slotExercicioId: item.exercicioId,
              bibliotecaExercicios,
              treinoId: treino.id
            })
          );
        });
      });

      blocoEl.appendChild(itensEl);
      blocosEl.appendChild(blocoEl);
    });
  }

  // `treino.cardio[]` é lista de referências ({treinoCardioId, momento}),
  // não mais a prescrição embutida — resolve cada uma contra
  // `dados.treinosCardio` (seção 12.3 de especificacao-biblioteca-exercicios.md).
  #montarCardio(cardioReferencias, dados, bibliotecaExercicios, treinoId) {
    if (!cardioReferencias || !cardioReferencias.length) return;

    document.getElementById("cardio").hidden = false;
    const listaEl = document.getElementById("cardioLista");
    listaEl.innerHTML = "";

    cardioReferencias.forEach((referencia) => {
      const treinoCardio = (dados.treinosCardio || []).find((t) => t.id === referencia.treinoCardioId);
      if (!treinoCardio) return;

      const modalidade = bibliotecaExercicios.bibliotecas.cardio.modalidades[treinoCardio.modalidadeId];
      const nomeModalidade = modalidade ? modalidade.nome : treinoCardio.modalidadeId;
      const cfg = treinoCardio.treino;

      const campos = [
        { titulo: "Tipo", valor: cfg.tipo === "intervalado" ? "Intervalado" : "Contínuo" },
        cfg.series != null && { titulo: "Séries", valor: cfg.series },
        cfg.estimulo && { titulo: "Tempo de estímulo", valor: Formatadores.tempoCurto(cfg.estimulo.duracaoSegundos) },
        cfg.estimulo &&
          cfg.estimulo.intensidade && {
            titulo: "Intensidade do estímulo",
            valor: Formatadores.labelIntensidade(cfg.estimulo.intensidade.valor)
          },
        cfg.recuperacao && { titulo: "Recuperação", valor: Formatadores.tempoCurto(cfg.recuperacao.duracaoSegundos) },
        cfg.recuperacao &&
          cfg.recuperacao.intensidade && {
            titulo: "Intensidade da recuperação",
            valor: Formatadores.labelIntensidade(cfg.recuperacao.intensidade.valor)
          }
      ].filter(Boolean);

      const divEl = document.createElement("div");
      divEl.className = "cardio-entrada";
      divEl.innerHTML = `
        <h3>${treinoCardio.nome} — ${nomeModalidade}</h3>
        <div class="campos">
          ${campos.map((c) => `<div class="campo"><strong>${c.titulo}</strong><span>${c.valor}</span></div>`).join("")}
        </div>
        <a class="iniciar" href="treino_bicicleta.html?treino=${encodeURIComponent(treinoCardio.id)}&origem=${encodeURIComponent(treinoId)}" style="margin-top: 14px;">Fazer bicicleta →</a>
      `;
      listaEl.appendChild(divEl);
    });
  }

  // Mesmo princípio de #montarCardio, pra `treino.alongamento[]` contra
  // `dados.treinosAlongamento`.
  #montarAlongamentoComplementar(alongamentoReferencias, dados, treinoId) {
    if (!alongamentoReferencias || !alongamentoReferencias.length) return;

    document.getElementById("alongamento").hidden = false;
    const listaEl = document.getElementById("alongamentoLista");
    listaEl.innerHTML = "";

    alongamentoReferencias.forEach((referencia) => {
      const treinoAlongamento = (dados.treinosAlongamento || []).find((t) => t.id === referencia.treinoAlongamentoId);
      if (!treinoAlongamento) return;

      const quantidade = treinoAlongamento.alongamentos.length;
      const divEl = document.createElement("div");
      divEl.className = "cardio-entrada";
      divEl.innerHTML = `
        <h3>${treinoAlongamento.nome}</h3>
        <div class="campos">
          <div class="campo"><strong>Alongamentos</strong><span>${quantidade}</span></div>
        </div>
        <a class="iniciar" href="treino_alongamento.html?treino=${encodeURIComponent(treinoAlongamento.id)}&origem=${encodeURIComponent(treinoId)}" style="margin-top: 14px;">Fazer alongamento →</a>
      `;
      listaEl.appendChild(divEl);
    });
  }

  #mostrarErro(mensagem) {
    document.getElementById("carregando").hidden = true;
    const erroEl = document.getElementById("erro");
    erroEl.hidden = false;
    erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_exercicios_menu.html">menu de treinos</a>.`;
    document.getElementById("titulo").textContent = "Treino de Exercícios";
  }

  #iniciarComDados(dados, bibliotecaExercicios, treinoId) {
    const treino = dados.treinos.find((t) => t.id === treinoId);
    if (!treino) {
      this.#mostrarErro("Este treino não foi encontrado.");
      return;
    }

    document.getElementById("carregando").hidden = true;

    document.title = `${treino.nome} — Treino de Exercícios`;
    document.getElementById("titulo").textContent = treino.nome;

    const tipoTagEl = document.getElementById("tipoTag");
    tipoTagEl.hidden = false;
    tipoTagEl.textContent = LABEL_TIPO[treino.tipo] || treino.tipo;

    const guiaHtml = this.#montarGuia(dados.orientacoesGerais);
    if (guiaHtml) {
      document.getElementById("guiaDetails").hidden = false;
      document.getElementById("guiaLista").innerHTML = guiaHtml;
    }

    this.#montarAquecimento(treino);
    this.#montarExercicios(treino, bibliotecaExercicios);
    this.#montarCardio(treino.cardio, dados, bibliotecaExercicios, treino.id);
    this.#montarAlongamentoComplementar(treino.alongamento, dados, treino.id);

    if (treino.exercicios.length) {
      const iniciarEl = document.getElementById("iniciarTreino");
      iniciarEl.hidden = false;
      iniciarEl.href = `treino_execucao.html?treino=${encodeURIComponent(treino.id)}`;

      const progressoSalvo = TreinosStorage.lerJSON(TreinosStorage.chaves.execucaoMusculacao(treino.id), null);
      const emAndamento = progressoSalvo && progressoSalvo.exercicioId && progressoSalvo.serieAtual >= 1;
      iniciarEl.textContent = emAndamento ? "Continuar treino →" : "Iniciar treino →";
    }
  }

  async iniciar() {
    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("treino");

    if (!treinoId) {
      this.#mostrarErro("Nenhum treino selecionado.");
      return;
    }

    let dados;
    try {
      dados = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      this.#mostrarErro(
        'Nenhum plano de treino carregado ainda neste navegador. <a href="planos.html">Escolha ou crie um plano</a> pra começar.'
      );
      return;
    }

    let bibliotecaExercicios;
    try {
      bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    this.#iniciarComDados(dados, bibliotecaExercicios, treinoId);
  }
}

new TreinoExerciciosController().iniciar();
