import { TreinosStorage } from "../storage.js";
import { normalizar } from "../identificadores.js";

class AtividadeLivreNovoController {
  #tipoEscolhidoId = null;

  #tipoEscolhaBtnEl = document.getElementById("tipoEscolhaBtn");
  #dataInputEl = document.getElementById("dataInput");
  #horaInputEl = document.getElementById("horaInput");
  #duracaoInputEl = document.getElementById("duracaoInput");
  #observacaoInputEl = document.getElementById("observacaoInput");
  #salvarBtnEl = document.getElementById("salvarBtn");
  #mensagemEl = document.getElementById("mensagem");

  #pickerOverlayEl = document.getElementById("pickerOverlay");
  #pickerFecharBtnEl = document.getElementById("pickerFecharBtn");
  #pickerBuscaInputEl = document.getElementById("pickerBuscaInput");
  #pickerResultadosEl = document.getElementById("pickerResultados");

  iniciar() {
    this.#preencherAgora();

    this.#tipoEscolhaBtnEl.addEventListener("click", () => this.#abrirPicker());
    this.#pickerFecharBtnEl.addEventListener("click", () => this.#fecharPicker());
    this.#pickerBuscaInputEl.addEventListener("input", () => this.#filtrarResultados());
    this.#salvarBtnEl.addEventListener("click", () => this.#salvar());

    // "Criar tipo novo" abre numa aba própria — ao voltar pra esta aba,
    // reflete o tipo criado lá sem recarregar a página (perderia o
    // formulário em preenchimento). Mesmo padrão de
    // treino-musculacao-novo.js.
    window.addEventListener("focus", () => this.#atualizarTiposEmFoco());
  }

  #preencherAgora() {
    const agora = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    this.#dataInputEl.value = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
    this.#horaInputEl.value = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
  }

  async #atualizarTiposEmFoco() {
    await TreinosStorage.recarregarTiposAtividade();
    if (!this.#pickerOverlayEl.hidden) this.#filtrarResultados();
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
      .filter(({ caminho }) => !termo || normalizar(caminho.map((t) => t.nome).join(" ")).includes(termo))
      .sort((a, b) => a.caminho.map((t) => t.nome).join(" › ").localeCompare(b.caminho.map((t) => t.nome).join(" › ")));

    this.#pickerResultadosEl.innerHTML = "";
    if (!tipos.length) {
      this.#pickerResultadosEl.innerHTML = '<div class="picker-vazio">Nenhum tipo encontrado. Crie um novo tipo pelo link acima.</div>';
      return;
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
      btn.addEventListener("click", () => this.#escolherTipo(tipo));
      this.#pickerResultadosEl.appendChild(btn);
    });
  }

  #escolherTipo(tipo) {
    this.#tipoEscolhidoId = tipo.id;
    const caminho = TreinosStorage.caminhoTipoAtividade(tipo.id).map((t) => t.nome);
    this.#tipoEscolhaBtnEl.textContent = caminho.join(" › ");
    this.#fecharPicker();
  }

  #mostrarMensagem(texto) {
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.className = "mensagem erro";
    this.#mensagemEl.textContent = texto;
  }

  async #salvar() {
    if (!this.#tipoEscolhidoId) {
      this.#mostrarMensagem("Escolha o tipo de atividade.");
      return;
    }
    if (!this.#dataInputEl.value || !this.#horaInputEl.value) {
      this.#mostrarMensagem("Preencha a data e a hora.");
      return;
    }
    const duracaoMinutos = Number(this.#duracaoInputEl.value);
    if (!duracaoMinutos || duracaoMinutos <= 0) {
      this.#mostrarMensagem("Informe uma duração maior que zero.");
      return;
    }

    const tipo = TreinosStorage.obterTipoAtividade(this.#tipoEscolhidoId);
    const dataHora = new Date(`${this.#dataInputEl.value}T${this.#horaInputEl.value}`).toISOString();

    TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoLivre, {
      tipoAtividadeId: this.#tipoEscolhidoId,
      tipoAtividadeNome: tipo ? tipo.nome : "",
      dataHora,
      duracaoSegundos: Math.round(duracaoMinutos * 60),
      observacao: this.#observacaoInputEl.value.trim() || null
    });

    await TreinosStorage.aguardarEscritas();
    window.location.href = "atividade_livre_menu.html";
  }
}

new AtividadeLivreNovoController().iniciar();
