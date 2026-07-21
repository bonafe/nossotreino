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

class TreinoExecucaoController {
  #sinal = new SinalSonoro();
  #videoModal = criarVideoPlayerModal();
  #detalhesModal = criarDetalhesModal();
  #verVideoToken = 0;
  #imagemToken = 0;
  #cronometroSerie = new Cronometro({ aoTick: () => this.#atualizarSerieTimerTela() });
  #cronometroDescanso = new Cronometro({ aoTick: (segundos) => this.#tickDescanso(segundos) });

  #treino = null;
  #bibliotecaExercicios = null;
  #slots = null;
  #progresso = null;
  #orientacoesGerais = null;
  #ajusteCargaAtual = null;
  #serieJaIniciada = false;
  #descansoSegundos = 0;
  #descansoSinalMinimoTocado = false;
  #descansoSinalMaximoTocado = false;

  #voltarIconEl = document.getElementById("voltarIcon");
  #tituloEl = document.getElementById("titulo");
  #stepperEl = document.getElementById("stepper");
  #exercicioAnteriorEl = document.getElementById("exercicioAnterior");
  #progressoTagEl = document.getElementById("progressoTag");
  #exercicioProximoEl = document.getElementById("exercicioProximo");
  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #execucaoEl = document.getElementById("execucao");
  #exercicioNomeEl = document.getElementById("exercicioNome");
  #infoExercicioBtnEl = document.getElementById("infoExercicioBtn");
  #exercicioGruposEl = document.getElementById("exercicioGrupos");
  #serieAtualLabelEl = document.getElementById("serieAtualLabel");
  #alvoRepeticoesEl = document.getElementById("alvoRepeticoes");
  #isometriaNotaEl = document.getElementById("isometriaNota");
  #serieTimerEl = document.getElementById("serieTimer");
  #serieTimerValorEl = document.getElementById("serieTimerValor");
  #cargaInputEl = document.getElementById("cargaInput");
  #repeticoesCampoEl = document.getElementById("repeticoesCampo");
  #repeticoesInputEl = document.getElementById("repeticoesInput");
  #comecarSerieEl = document.getElementById("comecarSerie");
  #concluirSerieEl = document.getElementById("concluirSerie");
  #usarSubstitutoEl = document.getElementById("usarSubstituto");
  #verVideoEl = document.getElementById("verVideo");
  #imagemExercicioEl = document.getElementById("imagemExercicio");
  #descansoEl = document.getElementById("descanso");
  #descansoTempoEl = document.getElementById("descansoTempo");
  #descansoMinEl = document.getElementById("descansoMin");
  #descansoMaxEl = document.getElementById("descansoMax");
  #descansoProximoEl = document.getElementById("descansoProximo");
  #descansoAjusteCargaEl = document.getElementById("descansoAjusteCarga");
  #iniciarSerieEl = document.getElementById("iniciarSerie");
  #concluidoEl = document.getElementById("concluido");
  #resumoConclusaoEl = document.getElementById("resumoConclusao");
  #apoioContainerEl = document.getElementById("apoioContainer");

  iniciar() {
    this.#comecarSerieEl.addEventListener("click", () => this.#alternarSerie());
    this.#concluirSerieEl.addEventListener("click", () => this.#concluirSerie());
    this.#infoExercicioBtnEl.addEventListener("click", () => {
      const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[this.#itemAtual().exercicioId];
      if (exercicio) this.#detalhesModal.abrir(exercicio, this.#bibliotecaExercicios);
    });
    this.#usarSubstitutoEl.addEventListener("click", () => this.#usarSubstituto());
    this.#iniciarSerieEl.addEventListener("click", () => this.#finalizarDescanso());
    this.#exercicioAnteriorEl.addEventListener("click", () => this.#irParaExercicio(this.#slotIndexAtual() - 1));
    this.#exercicioProximoEl.addEventListener("click", () => this.#irParaExercicio(this.#slotIndexAtual() + 1));

    this.#carregar();
  }

  // A cada item de treino.exercicios (lista plana) vira um slot; a opção
  // primária é o próprio item, e cada alternativa (item.alternativas)
  // vira uma opção extra do mesmo slot — herdando a prescrição principal
  // quando não define a própria (seção 10.10 da especificação).
  #construirSlots(treino) {
    return [...treino.exercicios]
      .sort((a, b) => a.ordem - b.ordem)
      .map((item) => ({
        exercicioId: item.exercicioId,
        opcoes: [
          { exercicioId: item.exercicioId, prescricao: item.prescricao },
          ...(item.alternativas || []).map((alt) => ({
            exercicioId: alt.exercicioId,
            prescricao: alt.prescricao || item.prescricao
          }))
        ]
      }));
  }

  #slotIndexAtual() {
    return this.#slots.findIndex((slot) => slot.exercicioId === this.#progresso.exercicioId);
  }

  #sinalPausaMinima() {
    // Três bipes iguais: pausa mínima atingida, já dá para começar a próxima série.
    this.#sinal.beep({ frequency: 880, duration: 0.15, volume: 0.4 });
    setTimeout(() => this.#sinal.beep({ frequency: 880, duration: 0.15, volume: 0.4 }), 220);
    setTimeout(() => this.#sinal.beep({ frequency: 880, duration: 0.15, volume: 0.4 }), 440);
    this.#sinal.vibrar([120, 80, 120, 80, 120]);
    this.#sinal.flashTela("flash");
  }

  #sinalPausaMaxima() {
    // Mesmo som da pausa mínima, mais forte: já passou do tempo máximo de descanso.
    this.#sinal.beep({ frequency: 880, duration: 0.26, volume: 0.65 });
    setTimeout(() => this.#sinal.beep({ frequency: 880, duration: 0.26, volume: 0.65 }), 220);
    setTimeout(() => this.#sinal.beep({ frequency: 880, duration: 0.26, volume: 0.65 }), 440);
    this.#sinal.vibrar([220, 100, 220, 100, 220]);
    this.#sinal.flashTela("flash-forte");
  }

  #sinalContagemRegressiva() {
    // Bipe curto e leve, um por segundo, nos últimos 10s antes da pausa máxima.
    this.#sinal.beep({ frequency: 1046, duration: 0.09, volume: 0.32 });
  }

  // Descanso alvo: primeiro o valor específico do exercício
  // (prescricao.descansoSegundos), senão o padrão do plano
  // (orientacoesGerais.descansoPadrao), senão 60–120s.
  #pausaAlvo() {
    const item = this.#itemAtual();
    const descansoItem = item.prescricao.descansoSegundos;
    if (descansoItem != null) {
      return { min: descansoItem, max: descansoItem };
    }

    const descansoPadrao = this.#orientacoesGerais && this.#orientacoesGerais.descansoPadrao;
    return descansoPadrao
      ? { min: descansoPadrao.minSegundos, max: descansoPadrao.maxSegundos }
      : { min: 60, max: 120 };
  }

  #ultimoRegistroDoExercicio(exercicioId) {
    const historico = TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSerieMusculacao, []);
    return historico
      .filter((e) => e.exercicioId === exercicioId)
      .reduce((mais, atual) => (!mais || new Date(atual.dataHora) > new Date(mais.dataHora) ? atual : mais), null);
  }

  #chaveExecucao() {
    return TreinosStorage.chaves.execucaoMusculacao(this.#treino.id);
  }

  #salvarProgresso() {
    TreinosStorage.salvarJSON(this.#chaveExecucao(), this.#progresso);
  }

  #progressoInicial() {
    return {
      exercicioId: this.#slots[0].exercicioId,
      opcaoExercicioId: this.#slots[0].opcoes[0].exercicioId,
      serieAtual: 1,
      iniciadoEm: new Date().toISOString(),
      tempoAcumuladoSegundos: 0
    };
  }

  #carregarOuIniciarProgresso() {
    const salvo = TreinosStorage.lerJSON(this.#chaveExecucao(), null);
    const slot = salvo && this.#slots.find((s) => s.exercicioId === salvo.exercicioId);
    const opcaoValida = slot && slot.opcoes.some((o) => o.exercicioId === salvo.opcaoExercicioId);
    const valido = slot && opcaoValida && salvo.serieAtual >= 1;

    if (valido) {
      this.#progresso = salvo;
    } else {
      // Progresso ausente ou apontando pra um exercício que não existe mais
      // no plano — mesmo tratamento de hoje pra "índice fora do intervalo".
      this.#progresso = this.#progressoInicial();
      this.#salvarProgresso();
    }
  }

  // Tempo (série + descanso) acumulado no exercício atual, persistido em
  // progresso pra sobreviver a um reload no meio do exercício.
  #tempoAcumuladoExercicio() {
    return this.#progresso.tempoAcumuladoSegundos || 0;
  }

  #adicionarTempoExercicio(segundos) {
    this.#progresso.tempoAcumuladoSegundos = this.#tempoAcumuladoExercicio() + segundos;
    this.#salvarProgresso();
  }

  // Registra o tempo (séries + descansos) do exercício que acabou de ser
  // concluído — um evento por exercício, não por treino inteiro, pra
  // exercícios avulsos (feitos sem terminar o treino todo) também contarem.
  #registrarExercicioConcluido(item, exercicio) {
    const duracaoSegundos = this.#tempoAcumuladoExercicio();
    if (duracaoSegundos <= 0) return;

    TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoMusculacao, {
      treinoId: this.#treino.id,
      treinoNome: this.#treino.nome,
      exercicioId: item.exercicioId,
      exercicioNome: exercicio ? exercicio.nome : item.exercicioId,
      concluidoEm: new Date().toISOString(),
      duracaoSegundos
    });
  }

  // Imagem sempre visível na tela, independente de vídeo (que fica atrás de
  // um botão): usa o mesmo padrão de token do vídeo pra um carregamento
  // atrasado não sobrescrever a tela depois que o aluno já avançou pra
  // outro exercício.
  #atualizarImagemExercicio(exercicioId, nomeExercicio) {
    this.#imagemToken += 1;
    const token = this.#imagemToken;
    ligarImagemExercicio(this.#imagemExercicioEl, exercicioId, nomeExercicio, () => token === this.#imagemToken);
  }

  #itemAtual() {
    const slot = this.#slots[this.#slotIndexAtual()];
    return slot.opcoes.find((o) => o.exercicioId === this.#progresso.opcaoExercicioId);
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

  #renderExercicioAtual() {
    const item = this.#itemAtual();
    const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[item.exercicioId];

    const nomeExercicio = exercicio ? exercicio.nome : item.exercicioId;
    this.#exercicioNomeEl.textContent = nomeExercicio;
    this.#atualizarImagemExercicio(item.exercicioId, nomeExercicio);

    const grupos = exercicio
      ? PrescricaoFormatadores.gruposMusculares(exercicio.gruposMusculares, this.#bibliotecaExercicios.gruposMusculares)
      : [];
    this.#exercicioGruposEl.innerHTML = grupos.map((g) => `<span>${g}</span>`).join("");

    this.#serieAtualLabelEl.textContent = `Série ${this.#progresso.serieAtual} de ${item.prescricao.series}`;
    this.#alvoRepeticoesEl.textContent = PrescricaoFormatadores.metrica(item.prescricao.metrica);
    this.#isometriaNotaEl.hidden = !PrescricaoFormatadores.ehIsometria(item.prescricao.tecnicas);

    this.#repeticoesCampoEl.hidden = item.prescricao.metrica.tipo === "tempo";

    const ultimoRegistro = this.#ultimoRegistroDoExercicio(item.exercicioId);
    this.#cargaInputEl.value =
      ultimoRegistro && ultimoRegistro.cargaKg !== null ? ultimoRegistro.cargaKg : "";
    this.#repeticoesInputEl.value =
      ultimoRegistro && ultimoRegistro.repeticoes !== null ? ultimoRegistro.repeticoes : "";

    this.#verVideoToken += 1;
    const tokenDoVideo = this.#verVideoToken;
    ligarBotaoVideo(this.#verVideoEl, exercicio && exercicio.midia, this.#videoModal, () => tokenDoVideo === this.#verVideoToken);

    const slotIndex = this.#slotIndexAtual();
    const slot = this.#slots[slotIndex];
    if (slot.opcoes.length > 1) {
      const opcaoAtualIndex = slot.opcoes.findIndex((o) => o.exercicioId === this.#progresso.opcaoExercicioId);
      const proximo = slot.opcoes[(opcaoAtualIndex + 1) % slot.opcoes.length];
      const proximoExercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[proximo.exercicioId];
      this.#usarSubstitutoEl.hidden = false;
      this.#usarSubstitutoEl.textContent = `Usar substituto: ${proximoExercicio ? proximoExercicio.nome : proximo.exercicioId}`;
    } else {
      this.#usarSubstitutoEl.hidden = true;
    }

    this.#stepperEl.hidden = false;
    this.#progressoTagEl.textContent = `Exercício ${slotIndex + 1} de ${this.#slots.length}`;
    this.#exercicioAnteriorEl.disabled = slotIndex === 0;
    this.#exercicioProximoEl.disabled = slotIndex === this.#slots.length - 1;

    this.#cronometroSerie.reiniciar();
    this.#serieJaIniciada = false;
    this.#serieTimerEl.hidden = true;
    this.#serieTimerValorEl.textContent = "00:00";
    this.#concluirSerieEl.hidden = true;
    this.#atualizarBotaoSerie();
  }

  #irParaExercicio(novoSlotIndex) {
    if (novoSlotIndex < 0 || novoSlotIndex >= this.#slots.length) return;
    const slot = this.#slots[novoSlotIndex];
    this.#progresso.exercicioId = slot.exercicioId;
    this.#progresso.opcaoExercicioId = slot.opcoes[0].exercicioId;
    this.#progresso.serieAtual = 1;
    // Pulou pro exercício sem concluir o atual — descarta o tempo parcial.
    this.#progresso.tempoAcumuladoSegundos = 0;
    this.#salvarProgresso();
    this.#renderExercicioAtual();
  }

  #renderDescanso() {
    const pausa = this.#pausaAlvo();

    this.#descansoTempoEl.textContent = Formatadores.relogio(this.#descansoSegundos);
    this.#descansoTempoEl.classList.toggle("no-alvo", this.#descansoSegundos >= pausa.min && this.#descansoSegundos < pausa.max);
    this.#descansoTempoEl.classList.toggle("acima-maximo", this.#descansoSegundos >= pausa.max);

    this.#descansoMinEl.textContent = Formatadores.tempoCurto(pausa.min);
    this.#descansoMaxEl.textContent = Formatadores.tempoCurto(pausa.max);

    const item = this.#itemAtual();
    const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[item.exercicioId];
    const nomeExercicio = exercicio ? exercicio.nome : item.exercicioId;
    this.#descansoProximoEl.textContent =
      `Próximo: ${nomeExercicio} — série ${this.#progresso.serieAtual} de ${item.prescricao.series}`;
    this.#atualizarImagemExercicio(item.exercicioId, nomeExercicio);

    if (this.#ajusteCargaAtual) {
      const emoji = this.#ajusteCargaAtual.direcao === "aumentar" ? "💪" : "⚠️";
      this.#descansoAjusteCargaEl.hidden = false;
      this.#descansoAjusteCargaEl.innerHTML =
        `${emoji} <strong>${this.#ajusteCargaAtual.exercicioNome}</strong>: ${this.#ajusteCargaAtual.repeticoes} repetições ` +
        `(alvo ${this.#ajusteCargaAtual.min}–${this.#ajusteCargaAtual.max}) — considere ${this.#ajusteCargaAtual.direcao} a carga na próxima série desse exercício.`;
    } else {
      this.#descansoAjusteCargaEl.hidden = true;
    }
  }

  #tickDescanso(segundosAtuais) {
    this.#descansoSegundos = segundosAtuais;
    const pausa = this.#pausaAlvo();

    const restanteParaMaximo = pausa.max - this.#descansoSegundos;
    if (restanteParaMaximo >= 1 && restanteParaMaximo <= 10) {
      this.#sinalContagemRegressiva();
    }

    if (!this.#descansoSinalMinimoTocado && this.#descansoSegundos >= pausa.min) {
      this.#descansoSinalMinimoTocado = true;
      this.#sinalPausaMinima();
    }
    if (!this.#descansoSinalMaximoTocado && this.#descansoSegundos >= pausa.max) {
      this.#descansoSinalMaximoTocado = true;
      this.#sinalPausaMaxima();
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
    this.#adicionarTempoExercicio(descansoSegundos);

    this.#descansoEl.hidden = true;
    this.#execucaoEl.hidden = false;
    this.#renderExercicioAtual();
  }

  #concluirSerie() {
    const item = this.#itemAtual();
    const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[item.exercicioId];
    const metrica = item.prescricao.metrica;

    const cargaRaw = this.#cargaInputEl.value;
    const repeticoesRaw = this.#repeticoesInputEl.value;

    const cargaKg = cargaRaw === "" ? null : Number(cargaRaw);
    const repeticoes = metrica.tipo === "tempo" || repeticoesRaw === "" ? null : Number(repeticoesRaw);

    const serieFoiIniciada = this.#serieJaIniciada;
    const duracaoSerieSegundos = serieFoiIniciada ? this.#cronometroSerie.segundos() : 0;
    this.#cronometroSerie.pausar();
    this.#adicionarTempoExercicio(duracaoSerieSegundos);

    this.#ajusteCargaAtual = null;
    if (metrica.modo === "faixa" && repeticoes !== null) {
      const nomeExercicio = exercicio ? exercicio.nome : item.exercicioId;
      if (repeticoes > metrica.max) {
        this.#ajusteCargaAtual = { direcao: "aumentar", exercicioNome: nomeExercicio, repeticoes, min: metrica.min, max: metrica.max };
      } else if (repeticoes < metrica.min) {
        this.#ajusteCargaAtual = { direcao: "diminuir", exercicioNome: nomeExercicio, repeticoes, min: metrica.min, max: metrica.max };
      }
    }

    TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSerieMusculacao, {
      treinoId: this.#treino.id,
      treinoNome: this.#treino.nome,
      exercicioId: item.exercicioId,
      exercicioNome: exercicio ? exercicio.nome : item.exercicioId,
      serie: this.#progresso.serieAtual,
      cargaKg,
      repeticoes,
      duracaoSegundos: serieFoiIniciada ? duracaoSerieSegundos : null,
      dataHora: new Date().toISOString()
    });

    if (this.#progresso.serieAtual < item.prescricao.series) {
      this.#progresso.serieAtual += 1;
      this.#salvarProgresso();
      this.#iniciarDescanso();
      return;
    }

    // Última série do exercício atual — registra o tempo dele antes de seguir.
    this.#registrarExercicioConcluido(item, exercicio);

    const slotIndexAtual = this.#slotIndexAtual();
    if (slotIndexAtual < this.#slots.length - 1) {
      const proximoSlot = this.#slots[slotIndexAtual + 1];
      this.#progresso.exercicioId = proximoSlot.exercicioId;
      this.#progresso.opcaoExercicioId = proximoSlot.opcoes[0].exercicioId;
      this.#progresso.serieAtual = 1;
      // O descanso que vem agora é antes da primeira série do PRÓXIMO
      // exercício, então zera o acumulador pra contar a favor dele.
      this.#progresso.tempoAcumuladoSegundos = 0;
      this.#salvarProgresso();
      this.#iniciarDescanso();
      return;
    }

    this.#concluirTreino();
  }

  #usarSubstituto() {
    const slot = this.#slots[this.#slotIndexAtual()];
    const opcaoAtualIndex = slot.opcoes.findIndex((o) => o.exercicioId === this.#progresso.opcaoExercicioId);
    const proximaOpcao = slot.opcoes[(opcaoAtualIndex + 1) % slot.opcoes.length];
    this.#progresso.opcaoExercicioId = proximaOpcao.exercicioId;
    this.#progresso.serieAtual = 1;
    // Descarta o tempo parcial do exercício trocado — ele não foi concluído.
    this.#progresso.tempoAcumuladoSegundos = 0;
    this.#salvarProgresso();
    this.#renderExercicioAtual();
  }

  #concluirTreino() {
    const item = this.#itemAtual();
    const exercicio = this.#bibliotecaExercicios.bibliotecas.exercicios[item.exercicioId];
    this.#registrarExercicioConcluido(item, exercicio);

    // Soma os exercícios concluídos nesta execução (podem vir de antes de um
    // reload, já que cada um foi salvo no histórico assim que terminou).
    const historico = TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoMusculacao, []);
    const duracaoSegundos = historico
      .filter((e) => e.treinoId === this.#treino.id && e.concluidoEm >= this.#progresso.iniciadoEm)
      .reduce((soma, e) => soma + e.duracaoSegundos, 0);

    TreinosStorage.removerChave(this.#chaveExecucao());

    this.#execucaoEl.hidden = true;
    this.#concluidoEl.hidden = false;
    this.#imagemExercicioEl.hidden = true;
    this.#resumoConclusaoEl.textContent =
      `${this.#treino.nome} — ${this.#slots.length} exercícios em ${Formatadores.duracaoExtensa(duracaoSegundos)}.`;

    if (deveExibirPedidoApoio()) renderizarPedidoApoio(this.#apoioContainerEl);
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_exercicios_menu.html">menu de treinos</a>.`;
    this.#tituloEl.textContent = "Execução do Treino";
  }

  #aplicarSaltoParaExercicio(params) {
    if (!params.has("exercicio")) return;

    const exercicioAlvo = params.get("exercicio");
    const slot = this.#slots.find((s) => s.exercicioId === exercicioAlvo);
    if (!slot) return;

    const opcaoAlvo = params.get("opcao");
    const opcaoValida = slot.opcoes.some((o) => o.exercicioId === opcaoAlvo) ? opcaoAlvo : slot.opcoes[0].exercicioId;

    this.#progresso.exercicioId = slot.exercicioId;
    this.#progresso.opcaoExercicioId = opcaoValida;
    this.#progresso.serieAtual = 1;
    this.#progresso.tempoAcumuladoSegundos = 0;
    this.#salvarProgresso();

    const url = `treino_execucao.html?treino=${encodeURIComponent(this.#treino.id)}`;
    window.history.replaceState({}, "", url);
  }

  async #carregar() {
    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("treino");

    if (!treinoId) {
      this.#mostrarErro("Nenhum treino selecionado.");
      return;
    }

    this.#voltarIconEl.href = `treino_exercicios.html?treino=${encodeURIComponent(treinoId)}`;

    let dados;
    try {
      dados = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      this.#mostrarErro(
        'Nenhum plano de treino carregado ainda neste navegador. <a href="importar_dados.html">Carregue o arquivo do seu plano</a> pra começar.'
      );
      return;
    }

    this.#treino = dados.treinos.find((t) => t.id === treinoId);
    if (!this.#treino) {
      this.#mostrarErro("Este treino não foi encontrado.");
      return;
    }

    try {
      this.#bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    this.#orientacoesGerais = dados.orientacoesGerais;
    this.#slots = this.#construirSlots(this.#treino);

    if (!this.#slots.length) {
      this.#mostrarErro("Este treino ainda não tem exercícios cadastrados.");
      return;
    }

    prefetchImagensDoTreino(this.#slots.flatMap((slot) => slot.opcoes.map((opcao) => opcao.exercicioId)));

    this.#carregarOuIniciarProgresso();
    this.#aplicarSaltoParaExercicio(params);

    document.title = `${this.#treino.nome} — Execução`;
    this.#tituloEl.textContent = this.#treino.nome;
    this.#carregandoEl.hidden = true;
    this.#execucaoEl.hidden = false;

    this.#renderExercicioAtual();
  }
}

new TreinoExecucaoController().iniciar();
