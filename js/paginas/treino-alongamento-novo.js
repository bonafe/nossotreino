import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { PrescricaoFormatadores } from "../prescricao-formatadores.js";
import { LABEL_TIPO_ALONGAMENTO } from "../constantes.js";
import { normalizar, gerarIdUnico } from "../identificadores.js";
import { criarDetalhesModal } from "../detalhes-modal.js";
import { criarVideoPlayerModal } from "../video-player-modal.js";

const LABEL_METRICA = {
  repeticoes: "Repetições",
  tempo: "Tempo"
};

// Mesmo padrão de treino-novo.js (picker com busca/filtro + formulário de
// prescrição), trocando a fonte pra bibliotecas.alongamentos e sem
// isometria/agrupamento (não se aplicam a alongamento).
class TreinoAlongamentoNovoController {
  #dados = null;
  #bibliotecaExercicios = null;
  #alongamentos = [];
  #editandoIndex = null;
  #alongamentoEscolhidoId = null;
  #videoModal = criarVideoPlayerModal();
  #detalhesModal = criarDetalhesModal(this.#videoModal);

  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #formEl = document.getElementById("formTreino");
  #nomeInputEl = document.getElementById("nomeInput");
  #momentoInputEl = document.getElementById("momentoInput");
  #alongamentoListaEl = document.getElementById("alongamentoLista");
  #alongamentoVazioEl = document.getElementById("alongamentoVazio");
  #adicionarAlongamentoBtnEl = document.getElementById("adicionarAlongamentoBtn");
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
  #filtroTipoBtnEl = document.getElementById("filtroTipoBtn");
  #filtroTipoOpcoesEl = document.getElementById("filtroTipoOpcoes");

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
  #prescricaoConfirmarBtnEl = document.getElementById("prescricaoConfirmarBtn");

  iniciar() {
    this.#adicionarAlongamentoBtnEl.addEventListener("click", () => this.#abrirPickerBusca());
    this.#pickerFecharBtnEl.addEventListener("click", () => this.#fecharPicker());
    this.#pickerVoltarBtnEl.addEventListener("click", () => this.#abrirPickerBusca());
    this.#salvarBtnEl.addEventListener("click", () => this.#salvarTreino());
    this.#pickerInfoBtnEl.addEventListener("click", () => {
      const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[this.#alongamentoEscolhidoId];
      if (alongamento) this.#detalhesModal.abrir(alongamento, this.#bibliotecaExercicios, "alongamento");
    });

    this.#pickerBuscaInputEl.addEventListener("input", () => this.#filtrarResultados());
    this.#pickerLimparBtnEl.addEventListener("click", () => this.#limparFiltros());

    this.#filtroGrupoBtnEl.addEventListener("click", () => {
      this.#filtroGrupoOpcoesEl.hidden = !this.#filtroGrupoOpcoesEl.hidden;
    });
    this.#filtroTipoBtnEl.addEventListener("click", () => {
      this.#filtroTipoOpcoesEl.hidden = !this.#filtroTipoOpcoesEl.hidden;
    });

    this.#prescricaoModoInputEl.addEventListener("change", () => this.#atualizarVisibilidadeModo());
    this.#prescricaoConfirmarBtnEl.addEventListener("click", () => this.#confirmarPrescricao());

    this.#carregarDados();
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_alongamento_menu.html">menu de alongamento</a>.`;
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

    const tipos = [...new Set(Object.values(this.#bibliotecaExercicios.bibliotecas.alongamentos).map((a) => a.classificacao.tipo))]
      .sort((a, b) => (LABEL_TIPO_ALONGAMENTO[a] || a).localeCompare(LABEL_TIPO_ALONGAMENTO[b] || b, "pt-BR"))
      .map((tipo) => ({ id: tipo, nome: LABEL_TIPO_ALONGAMENTO[tipo] || tipo }));
    this.#construirFiltroCheckbox(this.#filtroTipoOpcoesEl, tipos, this.#filtroTipoBtnEl, "Tipo");
  }

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
      [this.#filtroTipoOpcoesEl, this.#filtroTipoBtnEl, "Tipo"]
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
    this.#pickerTituloEl.textContent = "Adicionar alongamento";
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
    this.#alongamentoEscolhidoId = null;
  }

  #filtrarResultados() {
    const busca = normalizar(this.#pickerBuscaInputEl.value.trim());
    const gruposSelecionados = this.#valoresSelecionados(this.#filtroGrupoOpcoesEl);
    const tiposSelecionados = this.#valoresSelecionados(this.#filtroTipoOpcoesEl);

    const alongamentos = this.#bibliotecaExercicios.bibliotecas.alongamentos;
    const resultados = Object.values(alongamentos).filter((alongamento) => {
      if (tiposSelecionados.length && !tiposSelecionados.includes(alongamento.classificacao.tipo)) return false;

      if (gruposSelecionados.length) {
        const grupos = [
          ...alongamento.gruposMusculares.principais,
          ...alongamento.gruposMusculares.secundarios,
          ...alongamento.gruposMusculares.estabilizadores
        ];
        if (!gruposSelecionados.some((g) => grupos.includes(g))) return false;
      }

      if (busca) {
        const textos = [alongamento.nome, ...(alongamento.aliases || []), ...(alongamento.tags || [])].map(normalizar);
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
      this.#pickerResultadosEl.innerHTML = '<div class="picker-vazio">Nenhum alongamento encontrado com esses filtros.</div>';
      return;
    }

    resultados.forEach((alongamento) => {
      const grupos = PrescricaoFormatadores.gruposMusculares(
        alongamento.gruposMusculares,
        this.#bibliotecaExercicios.gruposMusculares
      );

      const item = document.createElement("div");
      item.className = "picker-resultado-item";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.innerHTML = `
        <div class="picker-resultado-cabecalho">
          <div class="picker-resultado-nome">${alongamento.nome}</div>
          <button type="button" class="info-btn" aria-label="Ver detalhes">ⓘ</button>
        </div>
        ${grupos.length ? `<div class="picker-resultado-grupos">${grupos.map((g) => `<span>${g}</span>`).join("")}</div>` : ""}
      `;
      item.addEventListener("click", () => this.#selecionarAlongamento(alongamento.id));
      item.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          this.#selecionarAlongamento(alongamento.id);
        }
      });
      item.querySelector(".info-btn").addEventListener("click", (evento) => {
        evento.stopPropagation();
        this.#detalhesModal.abrir(alongamento, this.#bibliotecaExercicios, "alongamento");
      });
      this.#pickerResultadosEl.appendChild(item);
    });
  }

  #selecionarAlongamento(alongamentoId) {
    const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[alongamentoId];
    this.#alongamentoEscolhidoId = alongamentoId;

    this.#pickerTituloEl.textContent = alongamento.nome;
    this.#pickerInfoBtnEl.hidden = false;
    this.#pickerVoltarBtnEl.hidden = false;
    this.#pickerBuscaEl.hidden = true;
    this.#pickerPrescricaoEl.hidden = false;
    this.#prescricaoConfirmarBtnEl.textContent = "Adicionar";

    this.#prescricaoMetricaTipoInputEl.innerHTML = "";
    alongamento.metricas.permitidas.forEach((tipo) => {
      this.#prescricaoMetricaTipoInputEl.appendChild(new Option(LABEL_METRICA[tipo] || tipo, tipo));
    });
    this.#prescricaoMetricaTipoInputEl.value = alongamento.metricas.padrao;

    this.#prescricaoSeriesInputEl.value = "2";
    this.#prescricaoModoInputEl.value = "fixo";
    this.#prescricaoMinInputEl.value = "";
    this.#prescricaoMaxInputEl.value = "";
    this.#prescricaoValorInputEl.value = "30";
    this.#prescricaoDescansoInputEl.value = "";

    this.#atualizarVisibilidadeModo();
  }

  #atualizarVisibilidadeModo() {
    const modo = this.#prescricaoModoInputEl.value;
    this.#prescricaoFaixaCamposEl.hidden = modo !== "faixa";
    this.#prescricaoFixoCampoEl.hidden = modo !== "fixo";
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

    const descansoRaw = this.#prescricaoDescansoInputEl.value;

    return {
      series: Number(this.#prescricaoSeriesInputEl.value) || 1,
      metrica,
      descansoSegundos: descansoRaw === "" ? null : Number(descansoRaw)
    };
  }

  #confirmarPrescricao() {
    const prescricao = this.#lerPrescricaoDoFormulario();

    const item = {
      alongamentoId: this.#alongamentoEscolhidoId,
      ordem: 0,
      prescricao,
      observacao: null
    };

    if (this.#editandoIndex !== null) {
      item.ordem = this.#alongamentos[this.#editandoIndex].ordem;
      this.#alongamentos[this.#editandoIndex] = item;
      this.#fecharPicker();
    } else {
      this.#alongamentos.push(item);
      this.#renumerarOrdem();
      this.#abrirPickerBusca();
    }

    this.#renderListaAlongamentos();
  }

  #renumerarOrdem() {
    this.#alongamentos.forEach((item, index) => {
      item.ordem = (index + 1) * 10;
    });
  }

  #renderListaAlongamentos() {
    this.#alongamentoListaEl.innerHTML = "";
    this.#alongamentoVazioEl.hidden = this.#alongamentos.length > 0;

    this.#alongamentos.forEach((item, index) => {
      const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[item.alongamentoId];
      const nome = alongamento ? alongamento.nome : item.alongamentoId;
      const resumo = `${item.prescricao.series} séries · ${PrescricaoFormatadores.metrica(item.prescricao.metrica)}`;

      const div = document.createElement("div");
      div.className = "exercicio-item";
      div.innerHTML = `
        <div class="exercicio-item-info">
          <div class="exercicio-item-nome-linha">
            <div class="exercicio-item-nome">${nome}</div>
            ${alongamento ? '<button type="button" class="info-btn" aria-label="Ver detalhes">ⓘ</button>' : ""}
          </div>
          <div class="exercicio-item-resumo">${resumo}</div>
        </div>
        <div class="exercicio-item-acoes">
          <button type="button" data-acao="subir" ${index === 0 ? "disabled" : ""} aria-label="Mover para cima">▲</button>
          <button type="button" data-acao="descer" ${index === this.#alongamentos.length - 1 ? "disabled" : ""} aria-label="Mover para baixo">▼</button>
          <button type="button" data-acao="editar" aria-label="Editar">✎</button>
          <button type="button" data-acao="remover" aria-label="Remover">✕</button>
        </div>
      `;

      div.querySelector('[data-acao="subir"]').addEventListener("click", () => this.#moverAlongamento(index, -1));
      div.querySelector('[data-acao="descer"]').addEventListener("click", () => this.#moverAlongamento(index, 1));
      div.querySelector('[data-acao="editar"]').addEventListener("click", () => this.#editarAlongamento(index));
      div.querySelector('[data-acao="remover"]').addEventListener("click", () => this.#removerAlongamento(index));
      if (alongamento) {
        div.querySelector(".info-btn").addEventListener("click", () => this.#detalhesModal.abrir(alongamento, this.#bibliotecaExercicios, "alongamento"));
      }

      this.#alongamentoListaEl.appendChild(div);
    });
  }

  #moverAlongamento(index, direcao) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= this.#alongamentos.length) return;
    [this.#alongamentos[index], this.#alongamentos[novoIndex]] = [this.#alongamentos[novoIndex], this.#alongamentos[index]];
    this.#renumerarOrdem();
    this.#renderListaAlongamentos();
  }

  #removerAlongamento(index) {
    this.#alongamentos.splice(index, 1);
    this.#renumerarOrdem();
    this.#renderListaAlongamentos();
  }

  #editarAlongamento(index) {
    const item = this.#alongamentos[index];
    const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[item.alongamentoId];

    this.#editandoIndex = index;
    this.#alongamentoEscolhidoId = item.alongamentoId;

    this.#pickerTituloEl.textContent = alongamento ? alongamento.nome : item.alongamentoId;
    this.#pickerInfoBtnEl.hidden = !alongamento;
    this.#pickerVoltarBtnEl.hidden = true;
    this.#pickerBuscaEl.hidden = true;
    this.#pickerPrescricaoEl.hidden = false;
    this.#prescricaoConfirmarBtnEl.textContent = "Salvar";
    this.#pickerOverlayEl.hidden = false;

    this.#prescricaoMetricaTipoInputEl.innerHTML = "";
    (alongamento ? alongamento.metricas.permitidas : [item.prescricao.metrica.tipo]).forEach((tipo) => {
      this.#prescricaoMetricaTipoInputEl.appendChild(new Option(LABEL_METRICA[tipo] || tipo, tipo));
    });
    this.#prescricaoMetricaTipoInputEl.value = item.prescricao.metrica.tipo;

    this.#prescricaoSeriesInputEl.value = item.prescricao.series;
    this.#prescricaoModoInputEl.value = item.prescricao.metrica.modo;
    this.#prescricaoMinInputEl.value = item.prescricao.metrica.min ?? "";
    this.#prescricaoMaxInputEl.value = item.prescricao.metrica.max ?? "";
    this.#prescricaoValorInputEl.value = item.prescricao.metrica.valor ?? "";
    this.#prescricaoDescansoInputEl.value = item.prescricao.descansoSegundos ?? "";

    this.#atualizarVisibilidadeModo();
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

    this.#dados.treinosAlongamento = this.#dados.treinosAlongamento || [];
    const idsExistentes = new Set(this.#dados.treinosAlongamento.map((t) => t.id));
    const id = gerarIdUnico(nome, idsExistentes, "treino-alongamento");

    const treinoAlongamento = {
      id,
      nome,
      momento: this.#momentoInputEl.value || null,
      alongamentos: this.#alongamentos,
      status: this.#alongamentos.length ? "ativo" : "rascunho",
      versao: 1
    };

    this.#dados.treinosAlongamento.push(treinoAlongamento);
    TreinosStorage.definirDadosTreinos(this.#dados);

    window.location.href = "treino_alongamento_menu.html";
  }
}

new TreinoAlongamentoNovoController().iniciar();
