import { TreinosStorage } from "../storage.js";
import { normalizar } from "../identificadores.js";

class AtividadeLivreTipoNovoController {
  #categoriasEscolhidasIds = [];
  #voltarPara = "atividade_livre_novo.html";
  #idEditando = null; // ?editar=<id> — muda de "criar tipo novo" pra "editar categorias" de um tipo existente

  #tituloEl = document.getElementById("titulo");
  #nomeInputEl = document.getElementById("nomeInput");
  #categoriasEscolhaBtnEl = document.getElementById("categoriasEscolhaBtn");
  #categoriasSelecionadasEl = document.getElementById("categoriasSelecionadas");
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

    this.#categoriasEscolhaBtnEl.addEventListener("click", () => this.#abrirPicker());
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
      this.#tituloEl.textContent = "Editar categorias";
      this.#nomeInputEl.value = tipoEditando.nome;
      this.#nomeInputEl.disabled = true;
      this.#criarBtnEl.textContent = "Salvar";
      this.#categoriasEscolhidasIds = [...(tipoEditando.categoriaIds || [])];
      this.#renderizarChips();
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
      .map((tipo) => ({ tipo, caminhos: TreinosStorage.caminhosTipoAtividade(tipo.id) }))
      // Editando: nunca oferece o próprio tipo nem um descendente dele como
      // categoria nova — viraria um ciclo (algum caminho de um descendente
      // sempre passa pelo próprio #idEditando).
      .filter(({ caminhos }) => !this.#idEditando || !caminhos.some((c) => c.some((t) => t.id === this.#idEditando)))
      .filter(({ caminhos }) => !termo || caminhos.some((c) => normalizar(c.map((t) => t.nome).join(" ")).includes(termo)))
      .sort((a, b) =>
        a.caminhos[0].map((t) => t.nome).join(" › ").localeCompare(b.caminhos[0].map((t) => t.nome).join(" › "))
      );

    this.#pickerResultadosEl.innerHTML = "";

    if (!tipos.length) {
      this.#pickerResultadosEl.innerHTML = '<div class="picker-vazio">Nenhum tipo encontrado.</div>';
      return;
    }

    tipos.forEach(({ tipo, caminhos }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-resultado-item";
      btn.setAttribute("aria-pressed", String(this.#categoriasEscolhidasIds.includes(tipo.id)));
      const nomes = caminhos[0].map((t) => t.nome);
      const nomeProprio = nomes[nomes.length - 1];
      const ancestrais = nomes.slice(0, -1).join(" › ");
      btn.innerHTML = `
        <div class="picker-resultado-nome">${nomeProprio}</div>
        ${ancestrais ? `<div class="picker-resultado-caminho">${ancestrais}</div>` : ""}
      `;
      btn.addEventListener("click", () => this.#alternarCategoria(tipo.id, btn));
      this.#pickerResultadosEl.appendChild(btn);
    });
  }

  #alternarCategoria(id, btn) {
    const indice = this.#categoriasEscolhidasIds.indexOf(id);
    if (indice === -1) this.#categoriasEscolhidasIds.push(id);
    else this.#categoriasEscolhidasIds.splice(indice, 1);
    btn.setAttribute("aria-pressed", String(indice === -1));
    this.#renderizarChips();
  }

  #removerCategoria(id) {
    const indice = this.#categoriasEscolhidasIds.indexOf(id);
    if (indice === -1) return;
    this.#categoriasEscolhidasIds.splice(indice, 1);
    this.#renderizarChips();
    if (!this.#pickerOverlayEl.hidden) this.#filtrarResultados();
  }

  #renderizarChips() {
    this.#categoriasSelecionadasEl.innerHTML = "";
    this.#categoriasEscolhidasIds.forEach((id) => {
      const caminho = TreinosStorage.caminhosTipoAtividade(id)[0] || [];
      const breadcrumb = caminho.map((t) => t.nome).join(" › ") || id;

      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span>${breadcrumb}</span>`;
      const removerBtn = document.createElement("button");
      removerBtn.type = "button";
      removerBtn.className = "chip-remover";
      removerBtn.setAttribute("aria-label", `Remover categoria ${breadcrumb}`);
      removerBtn.textContent = "×";
      removerBtn.addEventListener("click", () => this.#removerCategoria(id));
      chip.appendChild(removerBtn);

      this.#categoriasSelecionadasEl.appendChild(chip);
    });
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

    TreinosStorage.criarTipoAtividade(nome, this.#categoriasEscolhidasIds);
    await TreinosStorage.aguardarEscritas();

    this.#nomeInputEl.value = "";
    this.#categoriasEscolhidasIds = [];
    this.#renderizarChips();
    this.#mostrarMensagem(`✓ "${nome}" criado. Pode criar outro tipo ou voltar.`, "sucesso");
    this.#voltarBtnEl.hidden = false;
  }

  async #salvar() {
    TreinosStorage.alterarCategoriasTipoAtividade(this.#idEditando, this.#categoriasEscolhidasIds);
    await TreinosStorage.aguardarEscritas();

    this.#mostrarMensagem("✓ Categorias atualizadas.", "sucesso");
    this.#voltarBtnEl.hidden = false;
  }
}

new AtividadeLivreTipoNovoController().iniciar();
