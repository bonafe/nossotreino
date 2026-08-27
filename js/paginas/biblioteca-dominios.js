import { TreinosStorage } from "../storage.js";
import { existeDominio } from "../dominios-biblioteca.js";

// Ponto de entrada único (📚 em sistema.html) pra navegar a árvore de
// tiposAtividade (mesma árvore local editável de
// atividade_livre_tipo_novo.html, ver docs/atividade-livre-especificacao.md)
// como se fosse uma árvore de domínios/subdomínios de biblioteca. Quando o
// nó escolhido coincide com um domínio de verdade em
// js/dominios-biblioteca.js (hoje só musculação/alongamento — ids
// coincidem de propósito, ver comentário em criarLojaDeTiposAtividade em
// js/armazenamento-indexeddb.js), manda direto pra biblioteca.html; senão
// continua descendo a árvore (se tiver filhos) ou abre a biblioteca vazia
// pra aquele tipo (se for folha) — já pronta pra quando outros domínios
// ganharem biblioteca própria (ver docs/dominios-taxonomia-especificacao.md).
class BibliotecaDominiosController {
  #paiId = null;

  #voltarIconEl = document.getElementById("voltarIcon");
  #caminhoEl = document.getElementById("caminho");
  #criarLinkEl = document.getElementById("criarLink");
  #resultadosEl = document.getElementById("resultados");

  iniciar() {
    const params = new URLSearchParams(window.location.search);

    this.#voltarIconEl.addEventListener("click", (evento) => {
      if (!this.#paiId) return; // raiz: deixa o link ir pra sistema.html
      evento.preventDefault();
      const atual = TreinosStorage.obterTipoAtividade(this.#paiId);
      this.#navegarPara(atual ? atual.tipoAtividadePaiId : null);
    });

    // "Criar tipo novo" abre numa aba própria (mesmo padrão de
    // treino-musculacao-novo.js/atividade-livre-novo.js) já com o nível
    // atual pré-selecionado como pai (?pai=) — ao voltar o foco pra esta
    // aba, recarrega a árvore sem perder onde a pessoa estava navegando.
    window.addEventListener("focus", () => this.#atualizarEmFoco());

    this.#navegarPara(params.get("pai"));
  }

  async #atualizarEmFoco() {
    await TreinosStorage.recarregarTiposAtividade();
    this.#renderizar();
  }

  #navegarPara(paiId) {
    this.#paiId = paiId || null;
    this.#caminhoEl.textContent = this.#paiId
      ? TreinosStorage.caminhoTipoAtividade(this.#paiId)
          .map((t) => t.nome)
          .join(" › ")
      : "Escolha um domínio";
    this.#criarLinkEl.href = this.#paiId
      ? `atividade_livre_tipo_novo.html?pai=${encodeURIComponent(this.#paiId)}&voltar=${encodeURIComponent(this.#voltarAtual())}`
      : `atividade_livre_tipo_novo.html?voltar=${encodeURIComponent(this.#voltarAtual())}`;
    this.#renderizar();
  }

  #renderizar() {
    const filhos = TreinosStorage.listarFilhosDeTipoAtividade(this.#paiId).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );

    this.#resultadosEl.innerHTML = "";
    if (!filhos.length) {
      this.#resultadosEl.innerHTML = '<div class="picker-vazio">Nenhum tipo aqui ainda.</div>';
      return;
    }

    filhos.forEach((tipo) => this.#resultadosEl.appendChild(this.#itemEl(tipo)));
  }

  #itemEl(tipo) {
    const temDominio = existeDominio(tipo.id);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-resultado-item";
    btn.innerHTML = `
      <div class="picker-resultado-cabecalho">
        <div class="picker-resultado-nome">${tipo.nome}</div>
        ${temDominio ? '<span class="picker-resultado-badge">📖 biblioteca</span>' : ""}
      </div>
    `;
    btn.addEventListener("click", () => this.#abrir(tipo));
    return btn;
  }

  #abrir(tipo) {
    // Domínio de verdade sempre manda pra biblioteca.html, mesmo que o nó
    // também tenha filhos na árvore de atividade livre — a biblioteca de
    // exercícios é a fonte "oficial" e vence.
    if (existeDominio(tipo.id)) {
      window.location.href = `biblioteca.html?dominio=${encodeURIComponent(tipo.id)}&voltar=${encodeURIComponent(this.#voltarAtual())}`;
      return;
    }

    if (TreinosStorage.listarFilhosDeTipoAtividade(tipo.id).length > 0) {
      this.#navegarPara(tipo.id);
      return;
    }

    window.location.href = `biblioteca.html?dominio=${encodeURIComponent(tipo.id)}&nome=${encodeURIComponent(
      tipo.nome
    )}&voltar=${encodeURIComponent(this.#voltarAtual())}`;
  }

  #voltarAtual() {
    return this.#paiId ? `biblioteca_dominios.html?pai=${encodeURIComponent(this.#paiId)}` : "biblioteca_dominios.html";
  }
}

new BibliotecaDominiosController().iniciar();
