import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { PrescricaoFormatadores } from "../prescricao-formatadores.js";
import { LABEL_CATEGORIA_EXERCICIO } from "../constantes.js";
import { normalizar, gerarIdUnico } from "../identificadores.js";
import { criarDetalhesModal } from "../detalhes-modal.js";
import { criarVideoPlayerModal } from "../video-player-modal.js";

const LABEL_METRICA = {
  repeticoes: "Repetições",
  tempo: "Tempo"
};

class TreinoNovoController {
  #dados = null;
  #bibliotecaExercicios = null;
  #exercicios = [];
  #editandoIndex = null;
  #exercicioEscolhidoId = null;
  #videoModal = criarVideoPlayerModal();
  #detalhesModal = criarDetalhesModal(this.#videoModal);

  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #formEl = document.getElementById("formTreino");
  #nomeInputEl = document.getElementById("nomeInput");
  #tipoInputEl = document.getElementById("tipoInput");
  #exercicioListaEl = document.getElementById("exercicioLista");
  #exercicioVazioEl = document.getElementById("exercicioVazio");
  #adicionarExercicioBtnEl = document.getElementById("adicionarExercicioBtn");
  #salvarBtnEl = document.getElementById("salvarBtn");
  #mensagemEl = document.getElementById("mensagem");

  #pickerOverlayEl = document.getElementById("pickerOverlay");
  #pickerTituloEl = document.getElementById("pickerTitulo");
  #pickerInfoBtnEl = document.getElementById("pickerInfoBtn");
  #pickerVoltarBtnEl = document.getElementById("pickerVoltarBtn");
  #pickerFecharBtnEl = document.getElementById("pickerFecharBtn");
  #pickerBuscaEl = document.getElementById("pickerBusca");
  #pickerBuscaInputEl = document.getElementById("pickerBuscaInput");
  #pickerLimparBtnEl = document.getElementById("pickerLimparBtn");
  #pickerResultadosEl = document.getElementById("pickerResultados");

  #filtroGrupoBtnEl = document.getElementById("filtroGrupoBtn");
  #filtroGrupoOpcoesEl = document.getElementById("filtroGrupoOpcoes");
  #filtroEquipamentoBtnEl = document.getElementById("filtroEquipamentoBtn");
  #filtroEquipamentoOpcoesEl = document.getElementById("filtroEquipamentoOpcoes");
  #filtroCategoriaBtnEl = document.getElementById("filtroCategoriaBtn");
  #filtroCategoriaOpcoesEl = document.getElementById("filtroCategoriaOpcoes");

  #pickerPrescricaoEl = document.getElementById("pickerPrescricao");
  #prescricaoSeriesInputEl = document.getElementById("prescricaoSeriesInput");
  #prescricaoMetricaTipoInputEl = document.getElementById("prescricaoMetricaTipoInput");
  #prescricaoModoInputEl = document.getElementById("prescricaoModoInput");
  #prescricaoFaixaCamposEl = document.getElementById("prescricaoFaixaCampos");
  #prescricaoMinInputEl = document.getElementById("prescricaoMinInput");
  #prescricaoMaxInputEl = document.getElementById("prescricaoMaxInput");
  #prescricaoFixoCampoEl = document.getElementById("prescricaoFixoCampo");
  #prescricaoValorInputEl = document.getElementById("prescricaoValorInput");
  #prescricaoDescansoInputEl = document.getElementById("prescricaoDescansoInput");
  #prescricaoIsometriaInputEl = document.getElementById("prescricaoIsometriaInput");
  #prescricaoIsometriaCamposEl = document.getElementById("prescricaoIsometriaCampos");
  #isometriaDuracaoInputEl = document.getElementById("isometriaDuracaoInput");
  #isometriaUltimasSeriesInputEl = document.getElementById("isometriaUltimasSeriesInput");
  #isometriaPosicaoInputEl = document.getElementById("isometriaPosicaoInput");
  #isometriaMomentoInputEl = document.getElementById("isometriaMomentoInput");
  #prescricaoAgrupamentoTipoInputEl = document.getElementById("prescricaoAgrupamentoTipoInput");
  #prescricaoAgrupamentoNumeroInputEl = document.getElementById("prescricaoAgrupamentoNumeroInput");
  #prescricaoConfirmarBtnEl = document.getElementById("prescricaoConfirmarBtn");

  iniciar() {
    this.#adicionarExercicioBtnEl.addEventListener("click", () => this.#abrirPickerBusca());
    this.#pickerFecharBtnEl.addEventListener("click", () => this.#fecharPicker());
    this.#pickerVoltarBtnEl.addEventListener("click", () => this.#abrirPickerBusca());
    this.#salvarBtnEl.addEventListener("click", () => this.#salvarTreino());
    this.#pickerInfoBtnEl.addEventListener("click", () => {
      const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[this.#exercicioEscolhidoId];
      if (exercicio) this.#detalhesModal.abrir(exercicio, this.#bibliotecaExercicios);
    });

    this.#pickerBuscaInputEl.addEventListener("input", () => this.#filtrarResultados());
    this.#pickerLimparBtnEl.addEventListener("click", () => this.#limparFiltros());

    this.#filtroGrupoBtnEl.addEventListener("click", () => {
      this.#filtroGrupoOpcoesEl.hidden = !this.#filtroGrupoOpcoesEl.hidden;
    });
    this.#filtroEquipamentoBtnEl.addEventListener("click", () => {
      this.#filtroEquipamentoOpcoesEl.hidden = !this.#filtroEquipamentoOpcoesEl.hidden;
    });
    this.#filtroCategoriaBtnEl.addEventListener("click", () => {
      this.#filtroCategoriaOpcoesEl.hidden = !this.#filtroCategoriaOpcoesEl.hidden;
    });

    this.#prescricaoModoInputEl.addEventListener("change", () => this.#atualizarVisibilidadeModo());
    this.#prescricaoIsometriaInputEl.addEventListener("change", () => this.#atualizarVisibilidadeIsometria());
    this.#prescricaoAgrupamentoTipoInputEl.addEventListener("change", () => this.#atualizarVisibilidadeAgrupamento());
    this.#prescricaoConfirmarBtnEl.addEventListener("click", () => this.#confirmarPrescricao());

    this.#carregarDados();
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_exercicios_menu.html">menu de treinos</a>.`;
  }

  async #carregarDados() {
    try {
      this.#dados = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      this.#mostrarErro(
        'Nenhum plano de treino carregado ainda neste navegador. <a href="planos.html">Escolha ou crie um plano</a> pra começar.'
      );
      return;
    }

    try {
      this.#bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    this.#popularFiltros();
    this.#carregandoEl.hidden = true;
    this.#formEl.hidden = false;
  }

  #popularFiltros() {
    const grupos = Object.entries(this.#bibliotecaExercicios.gruposMusculares)
      .map(([id, g]) => ({ id, nome: g.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    this.#construirFiltroCheckbox(this.#filtroGrupoOpcoesEl, grupos, this.#filtroGrupoBtnEl, "Grupo muscular");

    const equipamentos = Object.entries(this.#bibliotecaExercicios.equipamentos)
      .map(([id, e]) => ({ id, nome: e.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    this.#construirFiltroCheckbox(this.#filtroEquipamentoOpcoesEl, equipamentos, this.#filtroEquipamentoBtnEl, "Equipamento");

    const categorias = [
      ...new Set(Object.values(this.#bibliotecaExercicios.bibliotecas.exercicios).map((e) => e.classificacao.categoria))
    ]
      .sort((a, b) => (LABEL_CATEGORIA_EXERCICIO[a] || a).localeCompare(LABEL_CATEGORIA_EXERCICIO[b] || b, "pt-BR"))
      .map((categoria) => ({ id: categoria, nome: LABEL_CATEGORIA_EXERCICIO[categoria] || categoria }));
    this.#construirFiltroCheckbox(this.#filtroCategoriaOpcoesEl, categorias, this.#filtroCategoriaBtnEl, "Categoria");
  }

  // Checkbox em vez de <select multiple>: no toque/mobile, um <select multiple>
  // exige ctrl/cmd+clique pra selecionar mais de um item — inviável sem
  // teclado. Checkbox permite tocar em quantas opções quiser.
  #construirFiltroCheckbox(containerEl, opcoes, botaoEl, rotuloBase) {
    containerEl.innerHTML = "";
    opcoes.forEach(({ id, nome }) => {
      const label = document.createElement("label");
      label.className = "filtro-opcao";
      label.innerHTML = `<input type="checkbox" value="${id}" /><span>${nome}</span>`;
      label.querySelector("input").addEventListener("change", () => {
        this.#atualizarRotuloFiltro(botaoEl, rotuloBase, containerEl);
        this.#filtrarResultados();
      });
      containerEl.appendChild(label);
    });
    this.#atualizarRotuloFiltro(botaoEl, rotuloBase, containerEl);
  }

  #atualizarRotuloFiltro(botaoEl, rotuloBase, containerEl) {
    const total = containerEl.querySelectorAll("input:checked").length;
    botaoEl.textContent = total ? `${rotuloBase} (${total})` : rotuloBase;
  }

  #valoresSelecionados(containerEl) {
    return Array.from(containerEl.querySelectorAll("input:checked")).map((input) => input.value);
  }

  #limparFiltros() {
    this.#pickerBuscaInputEl.value = "";
    [
      [this.#filtroGrupoOpcoesEl, this.#filtroGrupoBtnEl, "Grupo muscular"],
      [this.#filtroEquipamentoOpcoesEl, this.#filtroEquipamentoBtnEl, "Equipamento"],
      [this.#filtroCategoriaOpcoesEl, this.#filtroCategoriaBtnEl, "Categoria"]
    ].forEach(([containerEl, botaoEl, rotuloBase]) => {
      containerEl.querySelectorAll("input:checked").forEach((input) => {
        input.checked = false;
      });
      this.#atualizarRotuloFiltro(botaoEl, rotuloBase, containerEl);
    });
    this.#filtrarResultados();
  }

  #abrirPickerBusca() {
    this.#editandoIndex = null;
    this.#pickerTituloEl.textContent = "Adicionar exercício";
    this.#pickerInfoBtnEl.hidden = true;
    this.#pickerVoltarBtnEl.hidden = true;
    this.#pickerBuscaEl.hidden = false;
    this.#pickerPrescricaoEl.hidden = true;
    this.#pickerBuscaInputEl.value = "";
    this.#pickerOverlayEl.hidden = false;
    this.#filtrarResultados();
    this.#pickerBuscaInputEl.focus();
  }

  #fecharPicker() {
    this.#pickerOverlayEl.hidden = true;
    this.#editandoIndex = null;
    this.#exercicioEscolhidoId = null;
  }

  #filtrarResultados() {
    const busca = normalizar(this.#pickerBuscaInputEl.value.trim());
    const gruposSelecionados = this.#valoresSelecionados(this.#filtroGrupoOpcoesEl);
    const equipamentosSelecionados = this.#valoresSelecionados(this.#filtroEquipamentoOpcoesEl);
    const categoriasSelecionadas = this.#valoresSelecionados(this.#filtroCategoriaOpcoesEl);

    const exercicios = this.#bibliotecaExercicios.bibliotecas.exercicios;
    const resultados = Object.values(exercicios).filter((exercicio) => {
      if (categoriasSelecionadas.length && !categoriasSelecionadas.includes(exercicio.classificacao.categoria)) {
        return false;
      }

      if (gruposSelecionados.length) {
        const grupos = [
          ...exercicio.gruposMusculares.principais,
          ...exercicio.gruposMusculares.sinergistas,
          ...exercicio.gruposMusculares.estabilizadores
        ];
        if (!gruposSelecionados.some((g) => grupos.includes(g))) return false;
      }

      if (equipamentosSelecionados.length) {
        const equipamentos = [
          ...exercicio.equipamentos.obrigatorios.map((e) => e.equipamentoId),
          ...exercicio.equipamentos.opcionais.map((e) => e.equipamentoId)
        ];
        if (!equipamentosSelecionados.some((e) => equipamentos.includes(e))) return false;
      }

      if (busca) {
        const textos = [exercicio.nome, ...(exercicio.aliases || []), ...(exercicio.tags || [])].map(normalizar);
        if (!textos.some((texto) => texto.includes(busca))) return false;
      }

      return true;
    });

    resultados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    this.#renderResultados(resultados);
  }

  #renderResultados(resultados) {
    this.#pickerResultadosEl.innerHTML = "";

    if (!resultados.length) {
      this.#pickerResultadosEl.innerHTML = '<div class="picker-vazio">Nenhum exercício encontrado com esses filtros.</div>';
      return;
    }

    resultados.forEach((exercicio) => {
      const grupos = PrescricaoFormatadores.gruposMusculares(
        exercicio.gruposMusculares,
        this.#bibliotecaExercicios.gruposMusculares
      );

      const item = document.createElement("div");
      item.className = "picker-resultado-item";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.innerHTML = `
        <div class="picker-resultado-cabecalho">
          <div class="picker-resultado-nome">${exercicio.nome}</div>
          <button type="button" class="info-btn" aria-label="Ver detalhes">ⓘ</button>
        </div>
        ${grupos.length ? `<div class="picker-resultado-grupos">${grupos.map((g) => `<span>${g}</span>`).join("")}</div>` : ""}
      `;
      item.addEventListener("click", () => this.#selecionarExercicio(exercicio.id));
      item.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          this.#selecionarExercicio(exercicio.id);
        }
      });
      item.querySelector(".info-btn").addEventListener("click", (evento) => {
        evento.stopPropagation();
        this.#detalhesModal.abrir(exercicio, this.#bibliotecaExercicios);
      });
      this.#pickerResultadosEl.appendChild(item);
    });
  }

  #selecionarExercicio(exercicioId) {
    const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[exercicioId];
    this.#exercicioEscolhidoId = exercicioId;

    this.#pickerTituloEl.textContent = exercicio.nome;
    this.#pickerInfoBtnEl.hidden = false;
    this.#pickerVoltarBtnEl.hidden = false;
    this.#pickerBuscaEl.hidden = true;
    this.#pickerPrescricaoEl.hidden = false;
    this.#prescricaoConfirmarBtnEl.textContent = "Adicionar";

    this.#prescricaoMetricaTipoInputEl.innerHTML = "";
    exercicio.metricas.permitidas.forEach((tipo) => {
      this.#prescricaoMetricaTipoInputEl.appendChild(new Option(LABEL_METRICA[tipo] || tipo, tipo));
    });
    this.#prescricaoMetricaTipoInputEl.value = exercicio.metricas.padrao;

    this.#prescricaoSeriesInputEl.value = "3";
    this.#prescricaoModoInputEl.value = "faixa";
    this.#prescricaoMinInputEl.value = "";
    this.#prescricaoMaxInputEl.value = "";
    this.#prescricaoValorInputEl.value = "";
    this.#prescricaoDescansoInputEl.value = "";
    this.#prescricaoIsometriaInputEl.checked = false;
    this.#isometriaDuracaoInputEl.value = "20";
    this.#isometriaUltimasSeriesInputEl.value = "2";
    this.#isometriaPosicaoInputEl.value = "";
    this.#isometriaMomentoInputEl.value = "final-da-serie";
    this.#prescricaoAgrupamentoTipoInputEl.value = "";
    this.#prescricaoAgrupamentoNumeroInputEl.value = "1";

    this.#atualizarVisibilidadeModo();
    this.#atualizarVisibilidadeIsometria();
    this.#atualizarVisibilidadeAgrupamento();
  }

  #atualizarVisibilidadeModo() {
    const modo = this.#prescricaoModoInputEl.value;
    this.#prescricaoFaixaCamposEl.hidden = modo !== "faixa";
    this.#prescricaoFixoCampoEl.hidden = modo !== "fixo";
  }

  #atualizarVisibilidadeIsometria() {
    this.#prescricaoIsometriaCamposEl.hidden = !this.#prescricaoIsometriaInputEl.checked;
  }

  #atualizarVisibilidadeAgrupamento() {
    this.#prescricaoAgrupamentoNumeroInputEl.hidden = !this.#prescricaoAgrupamentoTipoInputEl.value;
  }

  #lerPrescricaoDoFormulario() {
    const tipo = this.#prescricaoMetricaTipoInputEl.value;
    const modo = this.#prescricaoModoInputEl.value;
    const unidade = tipo === "tempo" ? "segundos" : "repetições";

    const metrica = { tipo, modo, unidade };
    if (modo === "faixa") {
      metrica.min = Number(this.#prescricaoMinInputEl.value) || 0;
      metrica.max = Number(this.#prescricaoMaxInputEl.value) || 0;
    } else if (modo === "fixo") {
      metrica.valor = Number(this.#prescricaoValorInputEl.value) || 0;
    }

    const tecnicas = [];
    if (this.#prescricaoIsometriaInputEl.checked) {
      tecnicas.push({
        tipo: "isometria",
        duracaoSegundos: Number(this.#isometriaDuracaoInputEl.value) || 0,
        posicao: this.#isometriaPosicaoInputEl.value.trim() || null,
        momento: this.#isometriaMomentoInputEl.value,
        aplicacao: { ultimasSeries: Number(this.#isometriaUltimasSeriesInputEl.value) || 1 }
      });
    }

    const descansoRaw = this.#prescricaoDescansoInputEl.value;

    return {
      series: Number(this.#prescricaoSeriesInputEl.value) || 1,
      metrica,
      carga: null,
      descansoSegundos: descansoRaw === "" ? null : Number(descansoRaw),
      tecnicas,
      intensidade: null
    };
  }

  #confirmarPrescricao() {
    const prescricao = this.#lerPrescricaoDoFormulario();
    const agrupamentoTipo = this.#prescricaoAgrupamentoTipoInputEl.value;
    const agrupamentoNumero = Number(this.#prescricaoAgrupamentoNumeroInputEl.value) || 1;

    const item = {
      exercicioId: this.#exercicioEscolhidoId,
      ordem: 0,
      superset: agrupamentoTipo === "superset" ? agrupamentoNumero : null,
      circuito: agrupamentoTipo === "circuito" ? agrupamentoNumero : null,
      prescricao,
      alternativas: [],
      observacao: null
    };

    if (this.#editandoIndex !== null) {
      item.ordem = this.#exercicios[this.#editandoIndex].ordem;
      this.#exercicios[this.#editandoIndex] = item;
      this.#fecharPicker();
    } else {
      this.#exercicios.push(item);
      this.#renumerarOrdem();
      this.#abrirPickerBusca();
    }

    this.#renderListaExercicios();
  }

  #renumerarOrdem() {
    this.#exercicios.forEach((item, index) => {
      item.ordem = (index + 1) * 10;
    });
  }

  #renderListaExercicios() {
    this.#exercicioListaEl.innerHTML = "";
    this.#exercicioVazioEl.hidden = this.#exercicios.length > 0;

    this.#exercicios.forEach((item, index) => {
      const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[item.exercicioId];
      const nome = exercicio ? exercicio.nome : item.exercicioId;
      const resumo = `${item.prescricao.series} séries · ${PrescricaoFormatadores.metrica(item.prescricao.metrica)}`;
      const marcador =
        item.superset != null
          ? `Superset ${item.superset}`
          : item.circuito != null
            ? `Circuito ${item.circuito}`
            : null;

      const div = document.createElement("div");
      div.className = "exercicio-item";
      div.innerHTML = `
        <div class="exercicio-item-info">
          <div class="exercicio-item-nome-linha">
            <div class="exercicio-item-nome">${nome}</div>
            ${exercicio ? '<button type="button" class="info-btn" aria-label="Ver detalhes">ⓘ</button>' : ""}
          </div>
          <div class="exercicio-item-resumo">${resumo}</div>
          ${marcador ? `<span class="exercicio-item-marcador">${marcador}</span>` : ""}
        </div>
        <div class="exercicio-item-acoes">
          <button type="button" data-acao="subir" ${index === 0 ? "disabled" : ""} aria-label="Mover para cima">▲</button>
          <button type="button" data-acao="descer" ${index === this.#exercicios.length - 1 ? "disabled" : ""} aria-label="Mover para baixo">▼</button>
          <button type="button" data-acao="editar" aria-label="Editar">✎</button>
          <button type="button" data-acao="remover" aria-label="Remover">✕</button>
        </div>
      `;

      div.querySelector('[data-acao="subir"]').addEventListener("click", () => this.#moverExercicio(index, -1));
      div.querySelector('[data-acao="descer"]').addEventListener("click", () => this.#moverExercicio(index, 1));
      div.querySelector('[data-acao="editar"]').addEventListener("click", () => this.#editarExercicio(index));
      div.querySelector('[data-acao="remover"]').addEventListener("click", () => this.#removerExercicio(index));
      if (exercicio) {
        div.querySelector(".info-btn").addEventListener("click", () => this.#detalhesModal.abrir(exercicio, this.#bibliotecaExercicios));
      }

      this.#exercicioListaEl.appendChild(div);
    });
  }

  #moverExercicio(index, direcao) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= this.#exercicios.length) return;
    [this.#exercicios[index], this.#exercicios[novoIndex]] = [this.#exercicios[novoIndex], this.#exercicios[index]];
    this.#renumerarOrdem();
    this.#renderListaExercicios();
  }

  #removerExercicio(index) {
    this.#exercicios.splice(index, 1);
    this.#renumerarOrdem();
    this.#renderListaExercicios();
  }

  #editarExercicio(index) {
    const item = this.#exercicios[index];
    const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[item.exercicioId];

    this.#editandoIndex = index;
    this.#exercicioEscolhidoId = item.exercicioId;

    this.#pickerTituloEl.textContent = exercicio ? exercicio.nome : item.exercicioId;
    this.#pickerInfoBtnEl.hidden = !exercicio;
    this.#pickerVoltarBtnEl.hidden = true;
    this.#pickerBuscaEl.hidden = true;
    this.#pickerPrescricaoEl.hidden = false;
    this.#prescricaoConfirmarBtnEl.textContent = "Salvar";
    this.#pickerOverlayEl.hidden = false;

    this.#prescricaoMetricaTipoInputEl.innerHTML = "";
    (exercicio ? exercicio.metricas.permitidas : [item.prescricao.metrica.tipo]).forEach((tipo) => {
      this.#prescricaoMetricaTipoInputEl.appendChild(new Option(LABEL_METRICA[tipo] || tipo, tipo));
    });
    this.#prescricaoMetricaTipoInputEl.value = item.prescricao.metrica.tipo;

    this.#prescricaoSeriesInputEl.value = item.prescricao.series;
    this.#prescricaoModoInputEl.value = item.prescricao.metrica.modo;
    this.#prescricaoMinInputEl.value = item.prescricao.metrica.min ?? "";
    this.#prescricaoMaxInputEl.value = item.prescricao.metrica.max ?? "";
    this.#prescricaoValorInputEl.value = item.prescricao.metrica.valor ?? "";
    this.#prescricaoDescansoInputEl.value = item.prescricao.descansoSegundos ?? "";

    const isometria = item.prescricao.tecnicas.find((t) => t.tipo === "isometria");
    this.#prescricaoIsometriaInputEl.checked = Boolean(isometria);
    this.#isometriaDuracaoInputEl.value = isometria ? isometria.duracaoSegundos : "20";
    this.#isometriaUltimasSeriesInputEl.value = isometria ? isometria.aplicacao.ultimasSeries : "2";
    this.#isometriaPosicaoInputEl.value = isometria && isometria.posicao ? isometria.posicao : "";
    this.#isometriaMomentoInputEl.value = isometria ? isometria.momento : "final-da-serie";

    this.#prescricaoAgrupamentoTipoInputEl.value = item.superset != null ? "superset" : item.circuito != null ? "circuito" : "";
    this.#prescricaoAgrupamentoNumeroInputEl.value = item.superset ?? item.circuito ?? 1;

    this.#atualizarVisibilidadeModo();
    this.#atualizarVisibilidadeIsometria();
    this.#atualizarVisibilidadeAgrupamento();
  }

  #mostrarMensagem(texto) {
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.className = "mensagem erro";
    this.#mensagemEl.textContent = texto;
  }

  #salvarTreino() {
    const nome = this.#nomeInputEl.value.trim();
    if (!nome) {
      this.#mostrarMensagem("Dê um nome ao treino antes de salvar.");
      this.#nomeInputEl.focus();
      return;
    }

    const idsExistentes = new Set(this.#dados.treinos.map((t) => t.id));
    const id = gerarIdUnico(nome, idsExistentes);
    const temCircuito = this.#exercicios.some((item) => item.circuito != null);

    const treino = {
      id,
      nome,
      tipo: this.#tipoInputEl.value,
      aquecimento: null,
      exercicios: this.#exercicios,
      // Referências a treinos de cardio/alongamento complementares (ver
      // seção 12.3 de docs/especificacao-biblioteca-exercicios.md) — anexar
      // um existente continua manual, editando o array aqui depois de
      // salvo (fora de escopo desta tela).
      cardio: [],
      alongamento: [],
      status: this.#exercicios.length ? "ativo" : "rascunho",
      versao: 1
    };

    if (temCircuito) {
      treino.configuracaoCircuito = {
        ativo: true,
        modoExecucao: "uma-serie-de-cada-exercicio-em-sequencia"
      };
    }

    this.#dados.treinos.push(treino);
    TreinosStorage.definirDadosTreinos(this.#dados);

    window.location.href = `treino_exercicios.html?treino=${encodeURIComponent(id)}`;
  }
}

new TreinoNovoController().iniciar();
