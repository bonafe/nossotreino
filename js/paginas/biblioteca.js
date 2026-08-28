import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca, invalidarCacheBiblioteca } from "../biblioteca-exercicios.js";
import { PrescricaoFormatadores } from "../prescricao-formatadores.js";
import { normalizar } from "../identificadores.js";
import { criarDetalhesModal } from "../detalhes-modal.js";
import { criarVideoPlayerModal } from "../video-player-modal.js";
import { criarCriticaModal } from "../critica-comunidade.js";
import { obterDominio, existeDominio, obterEm } from "../dominios-biblioteca.js";
import { caminhoImagemExercicio } from "../imagem-exercicio.js";

// Tela de navegação/gestão da biblioteca personalizada — complementa o
// picker de treino_musculacao_novo.html/treino_alongamento_novo.html (que só existe
// dentro do fluxo de montar um treino) com um lugar dedicado pra ver,
// criar e editar exercícios/alongamentos sem precisar estar montando
// treino nenhum. Ver seção 26 de docs/especificacao-biblioteca-exercicios.md.
class BibliotecaController {
  #dominioId = "musculacao";
  #dominio = null;
  #bibliotecaExercicios = null;
  #personalizadosPorId = new Map();

  #videoModal = criarVideoPlayerModal();
  #criticaModal = criarCriticaModal();
  #detalhesModal = criarDetalhesModal(this.#videoModal, this.#criticaModal);

  #voltarIconEl = document.getElementById("voltarIcon");
  #tituloEl = document.getElementById("titulo");
  #subtituloEl = document.getElementById("subtitulo");
  #categoriasLinkEl = document.getElementById("categoriasLink");
  #categoriasTextoEl = document.getElementById("categoriasTexto");
  #criarLinkEl = document.getElementById("criarLink");
  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #conteudoEl = document.getElementById("conteudo");
  #buscaInputEl = document.getElementById("buscaInput");
  #filtrosDinamicosEl = document.getElementById("filtrosDinamicos");
  #limparFiltrosBtnEl = document.getElementById("limparFiltrosBtn");
  #resultadosEl = document.getElementById("resultados");

  iniciar() {
    const params = new URLSearchParams(window.location.search);
    this.#dominioId = params.get("dominio") || "musculacao";
    const voltarParam = params.get("voltar");
    this.#configurarCategoriasLink();

    // Domínio sem biblioteca de verdade ainda (ex.: um tipo da árvore de
    // atividade livre sem exercícios cadastrados, chegando por
    // biblioteca_dominios.html) — mostra vazio em vez de cair no fallback
    // de obterDominio() pra musculação, que renderizaria o conteúdo
    // errado.
    if (!existeDominio(this.#dominioId)) {
      this.#tituloEl.textContent = `📚 ${params.get("nome") || this.#dominioId}`;
      this.#subtituloEl.textContent = "Ainda sem exercícios cadastrados aqui.";
      this.#voltarIconEl.href = voltarParam || "biblioteca_dominios.html";
      this.#criarLinkEl.hidden = true;
      this.#carregandoEl.hidden = true;
      this.#conteudoEl.hidden = false;
      this.#conteudoEl.querySelector(".campo").hidden = true;
      this.#conteudoEl.querySelector(".filtros-biblioteca").hidden = true;
      this.#resultadosEl.innerHTML =
        '<div class="picker-vazio">Nenhum exercício cadastrado ainda aqui. No futuro você vai poder adicionar exercícios pra este domínio.</div>';
      return;
    }

    this.#dominio = obterDominio(this.#dominioId);

    this.#tituloEl.textContent = `📚 ${this.#dominio.tituloBiblioteca}`;
    this.#subtituloEl.textContent = "Oficiais e personalizados — toque num item pra ver detalhes.";
    this.#voltarIconEl.href = voltarParam || this.#dominio.menu;
    this.#criarLinkEl.href = `exercicio_novo.html?dominio=${encodeURIComponent(this.#dominioId)}&voltar=${encodeURIComponent(
      `biblioteca.html?dominio=${this.#dominioId}`
    )}`;

    this.#buscaInputEl.addEventListener("input", () => this.#renderizarResultados());
    this.#limparFiltrosBtnEl.addEventListener("click", () => this.#limparFiltros());
    // Fecha um dropdown de filtro aberto ao clicar fora dele.
    document.addEventListener("click", (evento) => {
      if (!evento.target.closest(".filtro-grupo")) this.#fecharTodosOsFiltros();
    });

    window.addEventListener("focus", () => this.#carregarDados());

    this.#carregarDados();
  }

  // Todo domínio mostrado aqui (com ou sem biblioteca de verdade em
  // DOMINIOS) corresponde a um nó em tiposAtividade — musculação/
  // alongamento são semeados junto com o banco, e qualquer outro só
  // aparece em biblioteca.html porque biblioteca_dominios.html achou ele
  // nessa coleção. "Categorias" reaproveita o mesmo formulário/picker de
  // criar tipo (atividade_livre_tipo_novo.html?editar=<id>), numa aba nova
  // como todo link de edição desta tela.
  #configurarCategoriasLink() {
    const tipo = TreinosStorage.obterTipoAtividade(this.#dominioId);
    if (!tipo) {
      this.#categoriasLinkEl.hidden = true;
      return;
    }

    const voltarAqui = window.location.pathname + window.location.search;
    this.#categoriasLinkEl.href = `atividade_livre_tipo_novo.html?editar=${encodeURIComponent(this.#dominioId)}&voltar=${encodeURIComponent(voltarAqui)}`;
    const nomes = (tipo.categoriaIds || []).map((cid) => {
      const caminho = TreinosStorage.caminhosTipoAtividade(cid)[0] || [];
      return caminho.map((t) => t.nome).join(" › ");
    });
    this.#categoriasTextoEl.textContent = nomes.length ? nomes.join(", ") : "— nenhuma (raiz) —";
    this.#categoriasLinkEl.hidden = false;
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="${this.#dominio.menu}">menu</a>.`;
  }

  async #carregarDados() {
    const primeiraCarga = !this.#bibliotecaExercicios;

    // Sem isso, um item criado/editado/excluído (nesta aba via "+"/"Editar",
    // que abrem numa aba própria, ou em qualquer outra) nunca apareceria
    // aqui sem recarregar a página inteira — carregarBiblioteca() guarda
    // um cache em memória por carregamento de página, e essa tela some e
    // volta de foco o tempo todo (ver window.addEventListener("focus", ...)
    // em #iniciar). Mesmo mecanismo de treino-musculacao-novo.js/
    // treino-alongamento-novo.js.
    if (!primeiraCarga) {
      await TreinosStorage.recarregarBibliotecaPersonalizada();
      invalidarCacheBiblioteca();
    }

    try {
      this.#bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca. Verifique sua conexão e tente novamente.");
      return;
    }

    this.#personalizadosPorId = new Map(
      TreinosStorage.listarBibliotecaPersonalizada()
        .filter((registro) => registro.dominio === this.#dominioId)
        .map((registro) => [registro.id, registro])
    );

    // Só monta os filtros na primeira carga — refazer o DOM a cada refresh
    // (ex.: ao voltar o foco depois de criar um item em outra aba, ver
    // window.addEventListener("focus", ...) acima) perderia o que a
    // pessoa já tinha marcado.
    if (primeiraCarga) this.#renderizarFiltros();

    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = true;
    this.#conteudoEl.hidden = false;
    this.#renderizarResultados();
  }

  #colecao() {
    return obterEm(this.#bibliotecaExercicios.bibliotecas, this.#dominio.colecaoPath) || {};
  }

  #resolverOpcoesFiltro(filtro) {
    if (filtro.opcoesEstaticas) return filtro.opcoesEstaticas;
    const catalogo = this.#bibliotecaExercicios[filtro.opcoesDe] || {};
    return Object.entries(catalogo)
      .map(([id, item]) => [id, item.nome])
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }

  // `extrator` combina vários campos do item numa lista só de valores
  // (ex.: grupo muscular casa contra principais + sinergistas/secundarios +
  // estabilizadores de uma vez — mesma lógica de PrescricaoFormatadores.gruposMusculares,
  // só que devolvendo os ids em vez dos nomes já resolvidos); `chave` lê um
  // campo de valor único direto de `entrada` (ex.: classificacao.categoria).
  #extrairValoresDoItem(item, filtro) {
    if (filtro.extrator === "gruposMusculares") {
      const g = item.gruposMusculares || {};
      return [...(g.principais || []), ...(g.sinergistas || []), ...(g.secundarios || []), ...(g.estabilizadores || [])];
    }
    if (filtro.extrator === "equipamentos") {
      const e = item.equipamentos || {};
      return [...(e.obrigatorios || []), ...(e.opcionais || [])].map((v) => (typeof v === "string" ? v : v.equipamentoId));
    }
    const valor = obterEm(item, filtro.chave.split("."));
    return valor == null ? [] : [valor];
  }

  #renderizarFiltros() {
    this.#filtrosDinamicosEl.innerHTML = "";
    (this.#dominio.filtros || []).forEach((filtro) => {
      const opcoes = this.#resolverOpcoesFiltro(filtro);
      const grupoEl = document.createElement("div");
      grupoEl.className = "filtro-grupo";
      grupoEl.dataset.filtro = filtro.extrator || filtro.chave;
      grupoEl.innerHTML = `
        <button type="button" class="filtro-toggle">${filtro.rotulo}</button>
        <div class="filtro-opcoes" hidden>
          ${opcoes
            .map(
              ([valor, rotulo]) =>
                `<label class="filtro-opcao"><input type="checkbox" value="${valor}" /><span>${rotulo}</span></label>`
            )
            .join("")}
        </div>
      `;

      const toggleEl = grupoEl.querySelector(".filtro-toggle");
      const opcoesEl = grupoEl.querySelector(".filtro-opcoes");
      toggleEl.addEventListener("click", (evento) => {
        evento.stopPropagation();
        const estavaAberto = !opcoesEl.hidden;
        this.#fecharTodosOsFiltros();
        opcoesEl.hidden = estavaAberto;
      });
      opcoesEl.querySelectorAll("input").forEach((input) => {
        input.addEventListener("change", () => {
          this.#atualizarRotuloFiltro(toggleEl, filtro.rotulo, opcoesEl);
          this.#renderizarResultados();
        });
      });

      this.#filtrosDinamicosEl.appendChild(grupoEl);
    });
  }

  #fecharTodosOsFiltros() {
    this.#filtrosDinamicosEl.querySelectorAll(".filtro-opcoes").forEach((el) => {
      el.hidden = true;
    });
  }

  #atualizarRotuloFiltro(toggleEl, rotuloBase, opcoesEl) {
    const total = opcoesEl.querySelectorAll("input:checked").length;
    toggleEl.textContent = total ? `${rotuloBase} (${total})` : rotuloBase;
  }

  #limparFiltros() {
    this.#buscaInputEl.value = "";
    this.#renderizarFiltros();
    this.#renderizarResultados();
  }

  #valoresSelecionados(opcoesEl) {
    return Array.from(opcoesEl.querySelectorAll("input:checked")).map((input) => input.value);
  }

  #renderizarResultados() {
    const busca = normalizar(this.#buscaInputEl.value.trim());
    const gruposFiltro = Array.from(this.#filtrosDinamicosEl.querySelectorAll(".filtro-grupo")).map((grupoEl, indice) => ({
      filtro: this.#dominio.filtros[indice],
      selecionados: this.#valoresSelecionados(grupoEl.querySelector(".filtro-opcoes"))
    }));

    const itens = Object.values(this.#colecao())
      .filter((item) => {
        if (busca) {
          const textos = [item.nome, ...(item.aliases || []), ...(item.tags || [])].map(normalizar);
          if (!textos.some((texto) => texto.includes(busca))) return false;
        }

        return gruposFiltro.every(({ filtro, selecionados }) => {
          if (!selecionados.length) return true;
          const valoresDoItem = this.#extrairValoresDoItem(item, filtro);
          return selecionados.some((valor) => valoresDoItem.includes(valor));
        });
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    this.#resultadosEl.innerHTML = "";
    if (!itens.length) {
      this.#resultadosEl.innerHTML = '<div class="picker-vazio">Nenhum item encontrado com esses filtros.</div>';
      return;
    }

    itens.forEach((item) => this.#resultadosEl.appendChild(this.#montarItemEl(item)));
  }

  #montarItemEl(item) {
    const grupos = PrescricaoFormatadores.gruposMusculares(item.gruposMusculares, this.#bibliotecaExercicios.gruposMusculares);
    const personalizado = this.#personalizadosPorId.get(item.id);

    const el = document.createElement("div");
    el.className = "picker-resultado-item";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.innerHTML = `
      <div class="picker-resultado-linha">
        <img class="picker-resultado-imagem" alt="" loading="lazy" src="${caminhoImagemExercicio(item.id, this.#dominioId)}" />
        <div class="picker-resultado-conteudo">
          <div class="picker-resultado-cabecalho">
            <div class="picker-resultado-nome">${item.nome}${
      personalizado ? `<span class="badge-personalizado">${personalizado.origem === "edicao" ? "Editado" : "Personalizado"}</span>` : ""
    }</div>
            <div class="picker-resultado-acoes">
              <a class="editar-link" href="exercicio_novo.html?dominio=${encodeURIComponent(this.#dominioId)}&id=${encodeURIComponent(
      item.id
    )}&voltar=${encodeURIComponent(`biblioteca.html?dominio=${this.#dominioId}`)}" target="_blank" rel="noopener" aria-label="Editar">✏️</a>
              <button type="button" class="info-btn" aria-label="Ver detalhes">ⓘ</button>
            </div>
          </div>
          ${grupos.length ? `<div class="picker-resultado-grupos">${grupos.map((g) => `<span>${g}</span>`).join("")}</div>` : ""}
        </div>
      </div>
    `;

    // Nem todo item tem imagem gerada ainda (mesma degradação de
    // ligarImagemExercicio em js/imagem-exercicio.js) — some a miniatura
    // em vez de mostrar o ícone de imagem quebrada do navegador. Fica
    // visível por padrão (só o placeholder de fundo) em vez de esconder
    // até confirmar o load: com `loading="lazy"`, deixar a imagem
    // invisível (opacity/hidden) antes do load faz alguns navegadores
    // nunca disparar o carregamento — vira um beco sem saída.
    const imagemEl = el.querySelector(".picker-resultado-imagem");
    imagemEl.addEventListener("error", () => {
      imagemEl.hidden = true;
    });

    const abrirDetalhes = () => this.#detalhesModal.abrir(item, this.#bibliotecaExercicios, this.#dominioId);
    el.addEventListener("click", abrirDetalhes);
    el.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        abrirDetalhes();
      }
    });
    el.querySelector(".info-btn").addEventListener("click", (evento) => {
      evento.stopPropagation();
      abrirDetalhes();
    });
    el.querySelector(".editar-link").addEventListener("click", (evento) => evento.stopPropagation());

    return el;
  }
}

new BibliotecaController().iniciar();
