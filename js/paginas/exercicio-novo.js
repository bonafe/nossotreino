import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca, carregarBibliotecaOficial } from "../biblioteca-exercicios.js";
import { gerarIdUnico } from "../identificadores.js";
import { obterDominio, obterEm, definirEm } from "../dominios-biblioteca.js";

// Tela genérica de criar/editar item de biblioteca personalizada — o
// formulário é montado a partir de `DOMINIOS[dominio].campos`
// (js/dominios-biblioteca.js), não hardcoded pra musculação/alongamento.
// Um domínio novo (dança, luta, yoga) não exige tocar neste arquivo, só
// registrar a declaração de campos lá.
//
// Query string: `?dominio=<id>` (default "musculacao"), `?id=<id>` presente
// = modo edição (mesmo padrão de `?treino=<id>` em treino-musculacao-novo.js),
// `?voltar=<url>` = pra onde voltar depois de salvar/excluir (default:
// tela de criação do próprio domínio).

function ajudaDoCampo(campo) {
  if (campo.opcional && campo.ajuda) return ` <span class="opcional">— opcional, ${campo.ajuda}</span>`;
  if (campo.opcional) return ' <span class="opcional">— opcional</span>';
  if (campo.ajuda) return ` <span class="opcional">— ${campo.ajuda}</span>`;
  return "";
}

function listaDeLinhas(texto) {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
}

function listaDeVirgulas(texto) {
  return texto
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

class ExercicioNovoController {
  #dominioId = "musculacao";
  #dominio = null;
  #idEditando = null;
  #voltarPara = "treino_musculacao_novo.html";
  #bibliotecaExercicios = null;
  #bibliotecaOficial = null;
  #registroPersonalizadoExistente = null;

  #voltarIconEl = document.getElementById("voltarIcon");
  #tituloEl = document.getElementById("titulo");
  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #formEl = document.getElementById("formExercicio");
  #camposDinamicosEl = document.getElementById("camposDinamicos");
  #salvarBtnEl = document.getElementById("salvarBtn");
  #excluirBtnEl = document.getElementById("excluirBtn");
  #mensagemEl = document.getElementById("mensagem");
  #confirmOverlayEl = document.getElementById("confirmOverlay");
  #confirmTextoEl = document.getElementById("confirmTexto");
  #confirmOkEl = document.getElementById("confirmOk");
  #confirmCancelarEl = document.getElementById("confirmCancelar");

  iniciar() {
    const params = new URLSearchParams(window.location.search);
    this.#dominioId = params.get("dominio") || "musculacao";
    this.#dominio = obterDominio(this.#dominioId);
    this.#idEditando = params.get("id") || null;
    this.#voltarPara =
      params.get("voltar") || (this.#dominioId === "alongamento" ? "treino_alongamento_novo.html" : "treino_musculacao_novo.html");
    this.#voltarIconEl.href = this.#voltarPara;

    this.#tituloEl.textContent = `${this.#idEditando ? "Editar" : "Novo"} ${this.#dominio.rotulo.toLowerCase()}`;

    this.#salvarBtnEl.addEventListener("click", () => this.#salvarExercicio());
    this.#excluirBtnEl.addEventListener("click", () => this.#abrirConfirmacaoExclusao());
    this.#confirmCancelarEl.addEventListener("click", () => this.#fecharConfirmacao());
    this.#confirmOkEl.addEventListener("click", () => this.#confirmarExclusao());

    this.#carregarDados();
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_musculacao_menu.html">menu de treinos</a>.`;
  }

  async #carregarDados() {
    try {
      this.#bibliotecaExercicios = await carregarBiblioteca();
      this.#bibliotecaOficial = await carregarBibliotecaOficial();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    if (this.#idEditando) {
      this.#registroPersonalizadoExistente = TreinosStorage.listarBibliotecaPersonalizada().find(
        (registro) => registro.dominio === this.#dominioId && registro.id === this.#idEditando
      );
      this.#excluirBtnEl.hidden = !this.#registroPersonalizadoExistente;
    }

    this.#renderizarCampos();

    this.#carregandoEl.hidden = true;
    this.#formEl.hidden = false;
  }

  #colecao(biblioteca) {
    return obterEm(biblioteca.bibliotecas, this.#dominio.colecaoPath) || {};
  }

  #resolverOpcoes(campo) {
    if (campo.opcoesEstaticas) return campo.opcoesEstaticas;
    const catalogo = this.#bibliotecaExercicios[campo.opcoesDe] || {};
    return Object.entries(catalogo)
      .map(([id, item]) => [id, item.nome])
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }

  #renderizarCampos() {
    const entradaAtual = this.#idEditando ? this.#colecao(this.#bibliotecaExercicios)[this.#idEditando] : null;

    this.#camposDinamicosEl.innerHTML = "";
    let secaoAbertaEl = null;
    let secaoAbertaNome = null;

    this.#dominio.campos.forEach((campo) => {
      let destinoEl = this.#camposDinamicosEl;
      if (campo.secao) {
        if (campo.secao !== secaoAbertaNome) {
          secaoAbertaEl = document.createElement("section");
          secaoAbertaEl.className = "secao";
          secaoAbertaEl.innerHTML = `<h2>${campo.secao}</h2>`;
          secaoAbertaNome = campo.secao;
          this.#camposDinamicosEl.appendChild(secaoAbertaEl);
        }
        destinoEl = secaoAbertaEl;
      } else {
        secaoAbertaEl = null;
        secaoAbertaNome = null;
      }

      destinoEl.appendChild(this.#criarCampoEl(campo, entradaAtual));
    });
  }

  #criarCampoEl(campo, entradaAtual) {
    const valorAtual = entradaAtual ? obterEm(entradaAtual, campo.chave.split(".")) : undefined;
    const divEl = document.createElement("div");
    divEl.className = "campo";
    const idCampo = `campo-${campo.chave.replace(/\./g, "-")}`;

    if (campo.tipo === "grupo-checkbox") {
      const opcoes = this.#resolverOpcoes(campo);
      const valoresSelecionados = new Set(
        (Array.isArray(valorAtual) ? valorAtual : []).map((v) => (campo.envolverComo ? v[campo.envolverComo] : v))
      );
      divEl.innerHTML = `
        <label>${campo.rotulo}${ajudaDoCampo(campo)}</label>
        <div class="filtro-opcoes" data-chave="${campo.chave}">
          ${opcoes
            .map(
              ([valor, rotulo]) =>
                `<label class="filtro-opcao"><input type="checkbox" value="${valor}" ${valoresSelecionados.has(valor) ? "checked" : ""} /><span>${rotulo}</span></label>`
            )
            .join("")}
        </div>`;
      return divEl;
    }

    if (campo.tipo === "select") {
      const opcoes = this.#resolverOpcoes(campo);
      const valorInicial = valorAtual != null ? valorAtual : campo.valorPadrao != null ? campo.valorPadrao : "";
      divEl.innerHTML = `
        <label for="${idCampo}">${campo.rotulo}${ajudaDoCampo(campo)}</label>
        <select id="${idCampo}" data-chave="${campo.chave}">
          ${opcoes.map(([valor, rotulo]) => `<option value="${valor}" ${valor === valorInicial ? "selected" : ""}>${rotulo}</option>`).join("")}
        </select>`;
      return divEl;
    }

    if (campo.tipo === "lista-linhas") {
      const texto = Array.isArray(valorAtual) ? valorAtual.join("\n") : "";
      divEl.innerHTML = `
        <label for="${idCampo}">${campo.rotulo}${ajudaDoCampo(campo)}</label>
        <textarea id="${idCampo}" data-chave="${campo.chave}" rows="3"></textarea>`;
      divEl.querySelector("textarea").value = texto;
      return divEl;
    }

    // "texto" e "lista-virgula" — ambos um <input type="text">, só difere
    // na hora de ler o valor (ver #lerValorDoCampo).
    const texto = Array.isArray(valorAtual) ? valorAtual.join(", ") : valorAtual != null ? valorAtual : "";
    divEl.innerHTML = `
      <label for="${idCampo}">${campo.rotulo}${ajudaDoCampo(campo)}</label>
      <input type="text" id="${idCampo}" data-chave="${campo.chave}" autocomplete="off" />`;
    divEl.querySelector("input").value = texto;
    return divEl;
  }

  #lerValorDoCampo(campo) {
    const seletor = `[data-chave="${campo.chave}"]`;

    if (campo.tipo === "grupo-checkbox") {
      const valores = Array.from(this.#camposDinamicosEl.querySelectorAll(`${seletor} input:checked`)).map((input) => input.value);
      return campo.envolverComo ? valores.map((valor) => ({ [campo.envolverComo]: valor })) : valores;
    }

    const elemento = this.#camposDinamicosEl.querySelector(seletor);
    if (campo.tipo === "select") return elemento.value || (campo.opcional ? null : elemento.value);
    if (campo.tipo === "lista-linhas") return listaDeLinhas(elemento.value);
    if (campo.tipo === "lista-virgula") return listaDeVirgulas(elemento.value);
    const texto = elemento.value.trim();
    return campo.opcional && !texto ? null : texto;
  }

  #mostrarMensagem(texto) {
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.className = "mensagem erro";
    this.#mensagemEl.textContent = texto;
  }

  async #salvarExercicio() {
    const entrada = this.#dominio.entradaBase();
    this.#dominio.campos.forEach((campo) => {
      definirEm(entrada, campo.chave.split("."), this.#lerValorDoCampo(campo));
    });

    if (!entrada.nome || !entrada.nome.trim()) {
      this.#mostrarMensagem(`Dê um nome ao ${this.#dominio.rotulo.toLowerCase()} antes de salvar.`);
      return;
    }

    // Metrica padrão sempre precisa estar entre as permitidas — mesma regra
    // pra qualquer domínio que use metricas.padrao/permitidas.
    if (entrada.metricas && !entrada.metricas.permitidas.includes(entrada.metricas.padrao)) {
      entrada.metricas.permitidas.push(entrada.metricas.padrao);
    }

    const colecaoOficial = this.#colecao(this.#bibliotecaOficial);
    let id = this.#idEditando;
    if (!id) {
      const colecaoAtual = this.#colecao(this.#bibliotecaExercicios);
      id = gerarIdUnico(entrada.nome, new Set(Object.keys(colecaoAtual)), this.#dominioId === "alongamento" ? "alongamento" : "exercicio");
    }
    entrada.id = id;

    const itemOficial = colecaoOficial[id];
    const origem = itemOficial ? "edicao" : "novo";
    const baseadoEmVersao = itemOficial ? itemOficial.versao : null;

    TreinosStorage.salvarExercicioPersonalizado({ dominio: this.#dominioId, id, origem, baseadoEmVersao, entrada });

    await TreinosStorage.aguardarEscritas();
    window.location.href = this.#voltarPara;
  }

  #abrirConfirmacaoExclusao() {
    this.#confirmTextoEl.textContent = `Excluir este ${this.#dominio.rotulo.toLowerCase()} personalizado? Isso não pode ser desfeito.`;
    this.#confirmOverlayEl.hidden = false;
  }

  #fecharConfirmacao() {
    this.#confirmOverlayEl.hidden = true;
  }

  async #confirmarExclusao() {
    TreinosStorage.removerExercicioPersonalizado(this.#dominioId, this.#idEditando);
    await TreinosStorage.aguardarEscritas();
    window.location.href = this.#voltarPara;
  }
}

new ExercicioNovoController().iniciar();
