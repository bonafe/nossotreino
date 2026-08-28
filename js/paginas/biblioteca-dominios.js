import { TreinosStorage } from "../storage.js";
import { existeDominio } from "../dominios-biblioteca.js";

// Ponto de entrada único (📚 em sistema.html) pra ver a coleção inteira de
// tiposAtividade (mesma coleção local editável de
// atividade_livre_tipo_novo.html, ver docs/atividade-livre-especificacao.md)
// de uma vez, cada filho identado dentro da categoria — não navega nível
// por nível. Como um item pode ter mais de uma categoria (multi-tag, não
// mais pai único), ele aparece uma vez EM CADA ramo a que pertence — é o
// comportamento correto pra um mecanismo de tags. Tocar em qualquer nó
// abre a biblioteca dele: quando o id coincide com um domínio de verdade
// em js/dominios-biblioteca.js (hoje só musculação/alongamento — ids
// coincidem de propósito, ver comentário em criarLojaDeTiposAtividade em
// js/armazenamento-indexeddb.js), abre biblioteca.html?dominio=<id> com o
// conteúdo de verdade; senão abre a mesma tela vazia pra aquele tipo, já
// pronta pra ganhar itens no futuro (ver
// docs/dominios-taxonomia-especificacao.md).
class BibliotecaDominiosController {
  #resultadosEl = document.getElementById("resultados");

  iniciar() {
    // "Criar tipo novo" abre numa aba própria (mesmo padrão de
    // treino-musculacao-novo.js/atividade-livre-novo.js) — ao voltar o
    // foco pra esta aba, recarrega a árvore pra refletir o tipo criado.
    window.addEventListener("focus", async () => {
      await TreinosStorage.recarregarTiposAtividade();
      this.#renderizar();
    });

    this.#renderizar();
  }

  #renderizar() {
    this.#resultadosEl.innerHTML = "";
    const raizes = TreinosStorage.listarPorCategoria(null).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    if (!raizes.length) {
      this.#resultadosEl.innerHTML = '<div class="picker-vazio">Nenhum domínio ainda.</div>';
      return;
    }

    raizes.forEach((tipo) => this.#adicionarNo(tipo, 0, new Set()));
  }

  // Percorre em pré-ordem (nó, depois cada filho recursivamente) — é o
  // que produz a lista plana já na ordem visual certa pra empilhar com
  // identação crescente por profundidade. `ancestrais` é um Set POR RAMO
  // (não compartilhado entre irmãos) — deixa o mesmo item aparecer sob
  // mais de uma categoria (correto pra tag), só corta um ramo que
  // reencontra um id que ele mesmo já visitou (ciclo de verdade).
  #adicionarNo(tipo, profundidade, ancestrais) {
    if (ancestrais.has(tipo.id)) return;
    this.#resultadosEl.appendChild(this.#itemEl(tipo, profundidade));
    const proximosAncestrais = new Set(ancestrais).add(tipo.id);
    TreinosStorage.listarPorCategoria(tipo.id)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .forEach((filho) => this.#adicionarNo(filho, profundidade + 1, proximosAncestrais));
  }

  #itemEl(tipo, profundidade) {
    const temDominio = existeDominio(tipo.id);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-resultado-item";
    if (profundidade > 0) btn.style.marginLeft = `${profundidade * 20}px`;
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
    if (existeDominio(tipo.id)) {
      window.location.href = `biblioteca.html?dominio=${encodeURIComponent(tipo.id)}&voltar=biblioteca_dominios.html`;
      return;
    }

    window.location.href = `biblioteca.html?dominio=${encodeURIComponent(tipo.id)}&nome=${encodeURIComponent(tipo.nome)}&voltar=biblioteca_dominios.html`;
  }
}

new BibliotecaDominiosController().iniciar();
