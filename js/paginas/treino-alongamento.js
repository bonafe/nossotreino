import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { PrescricaoFormatadores } from "../prescricao-formatadores.js";
import { Formatadores } from "../formatadores.js";
import { SinalSonoro } from "../sinal-sonoro.js";
import { Cronometro } from "../cronometro.js";
import { criarVideoPlayerModal, ligarBotaoVideo } from "../video-player-modal.js";
import { ligarImagemExercicio, prefetchImagensDoTreino } from "../imagem-exercicio.js";
import { criarDetalhesModal } from "../detalhes-modal.js";
import { deveExibirPedidoApoio, renderizarPedidoApoio } from "../apoio.js";

// Motor sequencial simplificado, modelado em treino-execucao.js (musculação)
// — sem carga, repetições realizadas, ajuste de carga ou substituto, já
// que um treino de alongamento (treinosAlongamento[], ver
// docs/treino-alongamento-especificacao.md) não tem essas opções: cada
// slot tem uma única opção, sem alternativas.
class TreinoAlongamentoController {
  #sinal = new SinalSonoro();
  #videoModal = criarVideoPlayerModal();
  #detalhesModal = criarDetalhesModal(this.#videoModal);
  #verVideoToken = 0;
  #imagemToken = 0;
  #cronometroSerie = new Cronometro({ aoTick: () => this.#atualizarSerieTimerTela() });
  #cronometroDescanso = new Cronometro({ aoTick: (segundos) => this.#tickDescanso(segundos) });

  #treinoAlongamento = null;
  #bibliotecaExercicios = null;
  #slots = null;
  #progresso = null;
  #origemTreinoId = null;
  #serieJaIniciada = false;
  #descansoSegundos = 0;
  #descansoSinalMinimoTocado = false;
  #descansoSinalMaximoTocado = false;

  #voltarIconEl = document.getElementById("voltarIcon");
  #tituloEl = document.getElementById("titulo");
  #stepperEl = document.getElementById("stepper");
  #alongamentoAnteriorEl = document.getElementById("alongamentoAnterior");
  #progressoTagEl = document.getElementById("progressoTag");
  #alongamentoProximoEl = document.getElementById("alongamentoProximo");
  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #execucaoEl = document.getElementById("execucao");
  #alongamentoNomeEl = document.getElementById("alongamentoNome");
  #infoAlongamentoBtnEl = document.getElementById("infoAlongamentoBtn");
  #alongamentoGruposEl = document.getElementById("alongamentoGrupos");
  #serieAtualLabelEl = document.getElementById("serieAtualLabel");
  #alvoMetricaEl = document.getElementById("alvoMetrica");
  #serieTimerEl = document.getElementById("serieTimer");
  #serieTimerValorEl = document.getElementById("serieTimerValor");
  #comecarSerieEl = document.getElementById("comecarSerie");
  #concluirSerieEl = document.getElementById("concluirSerie");
  #verVideoEl = document.getElementById("verVideo");
  #imagemAlongamentoEl = document.getElementById("imagemAlongamento");
  #descansoEl = document.getElementById("descanso");
  #descansoTempoEl = document.getElementById("descansoTempo");
  #descansoMinEl = document.getElementById("descansoMin");
  #descansoMaxEl = document.getElementById("descansoMax");
  #descansoProximoEl = document.getElementById("descansoProximo");
  #iniciarSerieEl = document.getElementById("iniciarSerie");
  #concluidoEl = document.getElementById("concluido");
  #resumoConclusaoEl = document.getElementById("resumoConclusao");
  #apoioContainerEl = document.getElementById("apoioContainer");

  iniciar() {
    this.#comecarSerieEl.addEventListener("click", () => this.#alternarSerie());
    this.#concluirSerieEl.addEventListener("click", () => this.#concluirSerie());
    this.#iniciarSerieEl.addEventListener("click", () => this.#finalizarDescanso());
    this.#alongamentoAnteriorEl.addEventListener("click", () => this.#irParaAlongamento(this.#slotIndexAtual() - 1));
    this.#alongamentoProximoEl.addEventListener("click", () => this.#irParaAlongamento(this.#slotIndexAtual() + 1));
    this.#infoAlongamentoBtnEl.addEventListener("click", () => {
      const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[this.#itemAtual().alongamentoId];
      if (alongamento) this.#detalhesModal.abrir(alongamento, this.#bibliotecaExercicios, "alongamento");
    });

    this.#carregar();
  }

  #construirSlots(treinoAlongamento) {
    return [...treinoAlongamento.alongamentos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((item) => ({ alongamentoId: item.alongamentoId, prescricao: item.prescricao }));
  }

  #slotIndexAtual() {
    return this.#slots.findIndex((slot) => slot.alongamentoId === this.#progresso.alongamentoId);
  }

  #pausaAlvo() {
    const item = this.#itemAtual();
    const descansoItem = item.prescricao.descansoSegundos;
    if (descansoItem != null) return { min: descansoItem, max: descansoItem };
    return { min: 15, max: 30 };
  }

  #chaveExecucao() {
    return TreinosStorage.chaves.execucaoAlongamento(this.#treinoAlongamento.id);
  }

  #salvarProgresso() {
    TreinosStorage.salvarJSON(this.#chaveExecucao(), this.#progresso);
  }

  #progressoInicial() {
    return {
      alongamentoId: this.#slots[0].alongamentoId,
      serieAtual: 1,
      iniciadoEm: new Date().toISOString(),
      tempoAcumuladoSegundos: 0
    };
  }

  #carregarOuIniciarProgresso() {
    const salvo = TreinosStorage.lerJSON(this.#chaveExecucao(), null);
    const slotValido = salvo && this.#slots.some((s) => s.alongamentoId === salvo.alongamentoId);
    const valido = slotValido && salvo.serieAtual >= 1;

    if (valido) {
      this.#progresso = salvo;
    } else {
      this.#progresso = this.#progressoInicial();
      this.#salvarProgresso();
    }
  }

  #tempoAcumuladoAlongamento() {
    return this.#progresso.tempoAcumuladoSegundos || 0;
  }

  #adicionarTempoAlongamento(segundos) {
    this.#progresso.tempoAcumuladoSegundos = this.#tempoAcumuladoAlongamento() + segundos;
    this.#salvarProgresso();
  }

  // Um registro por alongamento concluído (não por treino inteiro), pra
  // alongamentos feitos avulsos também contarem — mesmo princípio da
  // musculação (ver seção 7 de docs/treino-alongamento-especificacao.md).
  #registrarAlongamentoConcluido(item, alongamento) {
    const duracaoSegundos = this.#tempoAcumuladoAlongamento();
    if (duracaoSegundos <= 0) return;

    TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoAlongamento, {
      treinoId: this.#treinoAlongamento.id,
      origemTreinoId: this.#origemTreinoId,
      alongamentoId: item.alongamentoId,
      alongamentoNome: alongamento ? alongamento.nome : item.alongamentoId,
      concluidoEm: new Date().toISOString(),
      duracaoSegundos
    });
  }

  // Mirror de historicoSerieMusculacao — um registro por série concluída
  // (não só por alongamento inteiro), pra alimentar
  // treino_alongamento_progresso.html com gráfico/tabela por item, mesmo
  // padrão de estatística da musculação (ver seção 7 de
  // docs/treino-alongamento-especificacao.md).
  #registrarSerieConcluida(item, alongamento, duracaoSegundos) {
    TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSerieAlongamento, {
      treinoId: this.#treinoAlongamento.id,
      treinoNome: this.#treinoAlongamento.nome,
      alongamentoId: item.alongamentoId,
      alongamentoNome: alongamento ? alongamento.nome : item.alongamentoId,
      serie: this.#progresso.serieAtual,
      duracaoSegundos,
      dataHora: new Date().toISOString()
    });
  }

  #atualizarImagemAlongamento(alongamentoId, nome) {
    this.#imagemToken += 1;
    const token = this.#imagemToken;
    ligarImagemExercicio(this.#imagemAlongamentoEl, alongamentoId, nome, () => token === this.#imagemToken, "alongamento");
  }

  #itemAtual() {
    return this.#slots[this.#slotIndexAtual()];
  }

  #atualizarBotaoSerie() {
    if (this.#cronometroSerie.rodando) {
      this.#comecarSerieEl.textContent = "⏸ Pausar";
    } else if (this.#serieJaIniciada) {
      this.#comecarSerieEl.textContent = "▶ Continuar";
    } else {
      this.#comecarSerieEl.textContent = "▶ Começar série";
    }
  }

  #atualizarSerieTimerTela() {
    this.#serieTimerValorEl.textContent = Formatadores.relogio(this.#cronometroSerie.segundos());
  }

  #alternarSerie() {
    if (this.#cronometroSerie.rodando) {
      this.#cronometroSerie.pausar();
    } else {
      this.#sinal.destravar();
      this.#serieJaIniciada = true;
      this.#cronometroSerie.iniciar();
      this.#serieTimerEl.hidden = false;
      this.#concluirSerieEl.hidden = false;
    }
    this.#atualizarSerieTimerTela();
    this.#atualizarBotaoSerie();
  }

  #renderAlongamentoAtual() {
    const item = this.#itemAtual();
    const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[item.alongamentoId];

    const nome = alongamento ? alongamento.nome : item.alongamentoId;
    this.#alongamentoNomeEl.textContent = nome;
    this.#atualizarImagemAlongamento(item.alongamentoId, nome);

    const grupos = alongamento
      ? PrescricaoFormatadores.gruposMusculares(alongamento.gruposMusculares, this.#bibliotecaExercicios.gruposMusculares)
      : [];
    this.#alongamentoGruposEl.innerHTML = grupos.map((g) => `<span>${g}</span>`).join("");

    this.#serieAtualLabelEl.textContent = `Série ${this.#progresso.serieAtual} de ${item.prescricao.series}`;
    this.#alvoMetricaEl.textContent = PrescricaoFormatadores.metrica(item.prescricao.metrica);

    this.#verVideoToken += 1;
    const tokenDoVideo = this.#verVideoToken;
    ligarBotaoVideo(this.#verVideoEl, alongamento && alongamento.midia, this.#videoModal, () => tokenDoVideo === this.#verVideoToken);

    const slotIndex = this.#slotIndexAtual();
    this.#stepperEl.hidden = false;
    this.#progressoTagEl.textContent = `Alongamento ${slotIndex + 1} de ${this.#slots.length}`;
    this.#alongamentoAnteriorEl.disabled = slotIndex === 0;
    this.#alongamentoProximoEl.disabled = slotIndex === this.#slots.length - 1;

    this.#cronometroSerie.reiniciar();
    this.#serieJaIniciada = false;
    this.#serieTimerEl.hidden = true;
    this.#serieTimerValorEl.textContent = "00:00";
    this.#concluirSerieEl.hidden = true;
    this.#atualizarBotaoSerie();
  }

  #irParaAlongamento(novoSlotIndex) {
    if (novoSlotIndex < 0 || novoSlotIndex >= this.#slots.length) return;
    const slot = this.#slots[novoSlotIndex];
    this.#progresso.alongamentoId = slot.alongamentoId;
    this.#progresso.serieAtual = 1;
    this.#progresso.tempoAcumuladoSegundos = 0;
    this.#salvarProgresso();
    this.#renderAlongamentoAtual();
  }

  #renderDescanso() {
    const pausa = this.#pausaAlvo();

    this.#descansoTempoEl.textContent = Formatadores.relogio(this.#descansoSegundos);
    this.#descansoTempoEl.classList.toggle("no-alvo", this.#descansoSegundos >= pausa.min && this.#descansoSegundos < pausa.max);
    this.#descansoTempoEl.classList.toggle("acima-maximo", this.#descansoSegundos >= pausa.max);

    this.#descansoMinEl.textContent = Formatadores.tempoCurto(pausa.min);
    this.#descansoMaxEl.textContent = Formatadores.tempoCurto(pausa.max);

    const item = this.#itemAtual();
    const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[item.alongamentoId];
    const nome = alongamento ? alongamento.nome : item.alongamentoId;
    this.#descansoProximoEl.textContent = `Próximo: ${nome} — série ${this.#progresso.serieAtual} de ${item.prescricao.series}`;
    this.#atualizarImagemAlongamento(item.alongamentoId, nome);
  }

  #tickDescanso(segundosAtuais) {
    this.#descansoSegundos = segundosAtuais;
    const pausa = this.#pausaAlvo();

    if (!this.#descansoSinalMinimoTocado && this.#descansoSegundos >= pausa.min) {
      this.#descansoSinalMinimoTocado = true;
      this.#sinal.beep({ frequency: 880, duration: 0.15, volume: 0.4 });
    }
    if (!this.#descansoSinalMaximoTocado && this.#descansoSegundos >= pausa.max) {
      this.#descansoSinalMaximoTocado = true;
      this.#sinal.beep({ frequency: 880, duration: 0.26, volume: 0.65 });
      this.#sinal.vibrar([220, 100, 220]);
    }

    this.#renderDescanso();
  }

  #iniciarDescanso() {
    this.#sinal.destravar();

    this.#descansoSegundos = 0;
    this.#descansoSinalMinimoTocado = false;
    this.#descansoSinalMaximoTocado = false;

    this.#execucaoEl.hidden = true;
    this.#descansoEl.hidden = false;

    this.#renderDescanso();
    this.#cronometroDescanso.reiniciar();
    this.#cronometroDescanso.iniciar();
  }

  #finalizarDescanso() {
    const descansoSegundos = this.#cronometroDescanso.segundos();
    this.#cronometroDescanso.pausar();
    this.#adicionarTempoAlongamento(descansoSegundos);

    this.#descansoEl.hidden = true;
    this.#execucaoEl.hidden = false;
    this.#renderAlongamentoAtual();
  }

  #concluirSerie() {
    const item = this.#itemAtual();
    const alongamento = this.#bibliotecaExercicios.bibliotecas.alongamentos[item.alongamentoId];

    const serieFoiIniciada = this.#serieJaIniciada;
    const duracaoSerieSegundos = serieFoiIniciada ? this.#cronometroSerie.segundos() : 0;
    this.#cronometroSerie.pausar();
    this.#adicionarTempoAlongamento(duracaoSerieSegundos);

    this.#registrarSerieConcluida(item, alongamento, serieFoiIniciada ? duracaoSerieSegundos : null);

    if (this.#progresso.serieAtual < item.prescricao.series) {
      this.#progresso.serieAtual += 1;
      this.#salvarProgresso();
      this.#iniciarDescanso();
      return;
    }

    // Última série do alongamento atual — registra o tempo dele antes de seguir.
    this.#registrarAlongamentoConcluido(item, alongamento);

    const slotIndexAtual = this.#slotIndexAtual();
    if (slotIndexAtual < this.#slots.length - 1) {
      const proximoSlot = this.#slots[slotIndexAtual + 1];
      this.#progresso.alongamentoId = proximoSlot.alongamentoId;
      this.#progresso.serieAtual = 1;
      this.#progresso.tempoAcumuladoSegundos = 0;
      this.#salvarProgresso();
      this.#iniciarDescanso();
      return;
    }

    this.#concluirTreino();
  }

  #concluirTreino() {
    const historico = TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoAlongamento, []);
    const duracaoSegundos = historico
      .filter((e) => e.treinoId === this.#treinoAlongamento.id && e.concluidoEm >= this.#progresso.iniciadoEm)
      .reduce((soma, e) => soma + e.duracaoSegundos, 0);

    TreinosStorage.removerChave(this.#chaveExecucao());

    this.#execucaoEl.hidden = true;
    this.#concluidoEl.hidden = false;
    this.#imagemAlongamentoEl.hidden = true;
    this.#resumoConclusaoEl.textContent =
      `${this.#treinoAlongamento.nome} — ${this.#slots.length} alongamentos em ${Formatadores.duracaoExtensa(duracaoSegundos)}.`;

    if (deveExibirPedidoApoio()) renderizarPedidoApoio(this.#apoioContainerEl);
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_alongamento_menu.html">menu de alongamento</a>.`;
    this.#tituloEl.textContent = "Execução do Alongamento";
  }

  // Mirror de #aplicarSaltoParaExercicio em treino-execucao.js — permite
  // entrar direto num alongamento específico a partir do clique num card
  // de treino_alongamento_exercicios.html.
  #aplicarSaltoParaAlongamento(params) {
    if (!params.has("alongamento")) return;

    const alongamentoAlvo = params.get("alongamento");
    const slot = this.#slots.find((s) => s.alongamentoId === alongamentoAlvo);
    if (!slot) return;

    this.#progresso.alongamentoId = slot.alongamentoId;
    this.#progresso.serieAtual = 1;
    this.#progresso.tempoAcumuladoSegundos = 0;
    this.#salvarProgresso();

    const url =
      `treino_alongamento.html?treino=${encodeURIComponent(this.#treinoAlongamento.id)}` +
      (this.#origemTreinoId ? `&origem=${encodeURIComponent(this.#origemTreinoId)}` : "");
    window.history.replaceState({}, "", url);
  }

  async #carregar() {
    const params = new URLSearchParams(window.location.search);
    const treinoAlongamentoId = params.get("treino");
    this.#origemTreinoId = params.get("origem");

    if (!treinoAlongamentoId) {
      this.#mostrarErro("Nenhum treino selecionado.");
      return;
    }

    this.#voltarIconEl.href =
      `treino_alongamento_exercicios.html?treino=${encodeURIComponent(treinoAlongamentoId)}` +
      (this.#origemTreinoId ? `&origem=${encodeURIComponent(this.#origemTreinoId)}` : "");

    let dados;
    try {
      dados = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      this.#mostrarErro(
        'Nenhum plano de treino carregado ainda neste navegador. <a href="alunos.html">Escolha ou crie um aluno</a> pra começar.'
      );
      return;
    }

    this.#treinoAlongamento = (dados.treinosAlongamento || []).find((t) => t.id === treinoAlongamentoId);
    if (!this.#treinoAlongamento) {
      this.#mostrarErro("Este treino não foi encontrado.");
      return;
    }

    try {
      this.#bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    this.#slots = this.#construirSlots(this.#treinoAlongamento);
    if (!this.#slots.length) {
      this.#mostrarErro("Este treino ainda não tem alongamentos cadastrados.");
      return;
    }

    prefetchImagensDoTreino(this.#slots.map((slot) => slot.alongamentoId), "alongamento");
    this.#carregarOuIniciarProgresso();
    this.#aplicarSaltoParaAlongamento(params);

    document.title = `${this.#treinoAlongamento.nome} — Execução`;
    this.#tituloEl.textContent = this.#treinoAlongamento.nome;
    this.#carregandoEl.hidden = true;
    this.#execucaoEl.hidden = false;

    this.#renderAlongamentoAtual();
  }
}

new TreinoAlongamentoController().iniciar();
