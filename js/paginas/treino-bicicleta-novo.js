import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { gerarIdUnico } from "../identificadores.js";

// Mesma heurística de treino-bicicleta-menu.js: a modalidade cardio não tem
// um campo dedicado de "categoria", então filtra pelo nome/aliases.
function ehModalidadeBicicleta(modalidade) {
  const textos = [modalidade.nome, ...(modalidade.aliases || [])];
  return textos.some((texto) => texto && texto.toLowerCase().includes("bicicleta"));
}

class TreinoBicicletaNovoController {
  #dados = null;
  #bibliotecaExercicios = null;

  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #formEl = document.getElementById("formTreino");
  #nomeInputEl = document.getElementById("nomeInput");
  #modalidadeInputEl = document.getElementById("modalidadeInput");
  #seriesInputEl = document.getElementById("seriesInput");
  #tempoEstimuloInputEl = document.getElementById("tempoEstimuloInput");
  #intensidadeEstimuloInputEl = document.getElementById("intensidadeEstimuloInput");
  #tempoRecuperacaoInputEl = document.getElementById("tempoRecuperacaoInput");
  #intensidadeRecuperacaoInputEl = document.getElementById("intensidadeRecuperacaoInput");
  #salvarBtnEl = document.getElementById("salvarBtn");
  #mensagemEl = document.getElementById("mensagem");

  iniciar() {
    this.#salvarBtnEl.addEventListener("click", () => this.#salvarTreino());
    this.#carregarDados();
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_bicicleta_menu.html">menu de bicicleta</a>.`;
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

    this.#popularModalidades();
    this.#carregandoEl.hidden = true;
    this.#formEl.hidden = false;
  }

  #popularModalidades() {
    const modalidades = Object.values(this.#bibliotecaExercicios.bibliotecas.cardio.modalidades).filter(
      ehModalidadeBicicleta
    );
    this.#modalidadeInputEl.innerHTML = "";
    modalidades.forEach((modalidade) => {
      this.#modalidadeInputEl.appendChild(new Option(modalidade.nome, modalidade.id));
    });
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

    const modalidadeId = this.#modalidadeInputEl.value;
    if (!modalidadeId) {
      this.#mostrarMensagem("Nenhuma modalidade de bicicleta cadastrada na biblioteca ainda.");
      return;
    }

    this.#dados.treinosCardio = this.#dados.treinosCardio || [];
    const idsExistentes = new Set(this.#dados.treinosCardio.map((t) => t.id));
    const id = gerarIdUnico(nome, idsExistentes, "treino-cardio");

    const treinoCardio = {
      id,
      nome,
      modalidadeId,
      // O motor (treino_bicicleta.html) só sabe tocar o ciclo intervalado
      // estímulo/recuperação — outros tipos ficam fora de escopo por
      // enquanto (seção 8 de docs/treino-bicicleta-especificacao.md).
      treino: {
        tipo: "intervalado",
        series: Number(this.#seriesInputEl.value) || 1,
        estimulo: {
          duracaoSegundos: Number(this.#tempoEstimuloInputEl.value) || 1,
          intensidade: { modo: "percepcao-livre", valor: this.#intensidadeEstimuloInputEl.value }
        },
        recuperacao: {
          duracaoSegundos: Number(this.#tempoRecuperacaoInputEl.value) || 1,
          intensidade: { modo: "percepcao-livre", valor: this.#intensidadeRecuperacaoInputEl.value }
        }
      },
      observacao: null,
      status: "ativo",
      versao: 1
    };

    this.#dados.treinosCardio.push(treinoCardio);
    TreinosStorage.definirDadosTreinos(this.#dados);

    window.location.href = "treino_bicicleta_menu.html";
  }
}

new TreinoBicicletaNovoController().iniciar();
