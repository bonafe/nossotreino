import { TreinosStorage } from "../storage.js";
import { normalizar } from "../identificadores.js";

const ROTULO_RAIZ = "— Nenhum (tipo raiz) —";

class AtividadeLivreTipoNovoController {
  #paiEscolhidoId = null;
  #voltarPara = "atividade_livre_novo.html";
  #idEditando = null; // ?editar=<id> — muda de "criar tipo novo" pra "mudar domínio pai" de um tipo existente

  #tituloEl = document.getElementById("titulo");
  #nomeInputEl = document.getElementById("nomeInput");
  #paiEscolhaBtnEl = document.getElementById("paiEscolhaBtn");
  #criarBtnEl = document.getElementById("criarBtn");
  #mensagemEl = document.getElementById("mensagem");
  #voltarBtnEl = document.getElementById("voltarBtn");

  #pickerOverlayEl = document.getElementById("pickerOverlay");
  #pickerFecharBtnEl = document.getElementById("pickerFecharBtn");
  #pickerBuscaInputEl = document.getElementById("pickerBuscaInput");
  #pickerResultadosEl = document.getElementById("pickerResultados");

  iniciar() {
    const params = new URLSearchParams(window.location.search);
    this.#voltarPara = params.get("voltar") || this.#voltarPara;

    this.#paiEscolhaBtnEl.addEventListener("click", () => this.#abrirPicker());
    this.#pickerFecharBtnEl.addEventListener("click", () => this.#fecharPicker());
    this.#pickerBuscaInputEl.addEventListener("input", () => this.#filtrarResultados());
    this.#criarBtnEl.addEventListener("click", () => (this.#idEditando ? this.#salvar() : this.#criar()));
    this.#voltarBtnEl.addEventListener("click", () => {
      window.location.href = this.#voltarPara;
    });

    const idEditando = params.get("editar");
    const tipoEditando = idEditando && TreinosStorage.obterTipoAtividade(idEditando);
    if (tipoEditando) {
      this.#idEditando = idEditando;
      this.#tituloEl.textContent = "Mudar domínio pai";
      this.#nomeInputEl.value = tipoEditando.nome;
      this.#nomeInputEl.disabled = true;
      this.#criarBtnEl.textContent = "Salvar";
      this.#escolherPai(tipoEditando.tipoAtividadePaiId);
    }
  }

  #abrirPicker() {
    this.#pickerBuscaInputEl.value = "";
    this.#pickerOverlayEl.hidden = false;
    this.#filtrarResultados();
    this.#pickerBuscaInputEl.focus();
  }

  #fecharPicker() {
    this.#pickerOverlayEl.hidden = true;
  }

  #filtrarResultados() {
    const termo = normalizar(this.#pickerBuscaInputEl.value.trim());
    const tipos = TreinosStorage.listarTiposAtividade()
      .map((tipo) => ({ tipo, caminho: TreinosStorage.caminhoTipoAtividade(tipo.id) }))
      // Editando: nunca oferece o próprio tipo nem um descendente dele como
      // pai novo — viraria um ciclo na árvore (caminho de um descendente
      // sempre passa pelo próprio #idEditando).
      .filter(({ caminho }) => !this.#idEditando || !caminho.some((t) => t.id === this.#idEditando))
      .filter(({ caminho }) => !termo || normalizar(caminho.map((t) => t.nome).join(" ")).includes(termo))
      .sort((a, b) => a.caminho.map((t) => t.nome).join(" › ").localeCompare(b.caminho.map((t) => t.nome).join(" › ")));

    this.#pickerResultadosEl.innerHTML = "";

    if (!termo) {
      const btnRaiz = document.createElement("button");
      btnRaiz.type = "button";
      btnRaiz.className = "picker-resultado-item";
      btnRaiz.innerHTML = `<div class="picker-resultado-nome">${ROTULO_RAIZ}</div>`;
      btnRaiz.addEventListener("click", () => this.#escolherPai(null));
      this.#pickerResultadosEl.appendChild(btnRaiz);
    }

    tipos.forEach(({ tipo, caminho }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-resultado-item";
      const nomes = caminho.map((t) => t.nome);
      const nomeProprio = nomes[nomes.length - 1];
      const ancestrais = nomes.slice(0, -1).join(" › ");
      btn.innerHTML = `
        <div class="picker-resultado-nome">${nomeProprio}</div>
        ${ancestrais ? `<div class="picker-resultado-caminho">${ancestrais}</div>` : ""}
      `;
      btn.addEventListener("click", () => this.#escolherPai(tipo.id));
      this.#pickerResultadosEl.appendChild(btn);
    });
  }

  #escolherPai(paiId) {
    this.#paiEscolhidoId = paiId;
    this.#paiEscolhaBtnEl.textContent = paiId
      ? TreinosStorage.caminhoTipoAtividade(paiId).map((t) => t.nome).join(" › ")
      : ROTULO_RAIZ;
    this.#fecharPicker();
  }

  #mostrarMensagem(texto, classe) {
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.className = `mensagem ${classe}`;
    this.#mensagemEl.textContent = texto;
  }

  async #criar() {
    const nome = this.#nomeInputEl.value.trim();
    if (!nome) {
      this.#mostrarMensagem("Preencha o nome do tipo.", "erro");
      return;
    }

    TreinosStorage.criarTipoAtividade(nome, this.#paiEscolhidoId);
    await TreinosStorage.aguardarEscritas();

    this.#nomeInputEl.value = "";
    this.#escolherPai(null);
    this.#mostrarMensagem(`✓ "${nome}" criado. Pode criar outro tipo ou voltar.`, "sucesso");
    this.#voltarBtnEl.hidden = false;
  }

  async #salvar() {
    TreinosStorage.alterarPaiTipoAtividade(this.#idEditando, this.#paiEscolhidoId);
    await TreinosStorage.aguardarEscritas();

    this.#mostrarMensagem("✓ Domínio pai atualizado.", "sucesso");
    this.#voltarBtnEl.hidden = false;
  }
}

new AtividadeLivreTipoNovoController().iniciar();
