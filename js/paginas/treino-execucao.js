import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { SinalSonoro } from "../sinal-sonoro.js";
import { Cronometro } from "../cronometro.js";

class TreinoExecucaoController {
  #sinal = new SinalSonoro();
  #cronometroSerie = new Cronometro({ aoTick: () => this.#atualizarSerieTimerTela() });
  #cronometroDescanso = new Cronometro({ aoTick: (segundos) => this.#tickDescanso(segundos) });

  #treino = null;
  #exercicios = null;
  #slots = null;
  #progresso = null;
  #guia = null;
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
  #descansoEl = document.getElementById("descanso");
  #descansoTempoEl = document.getElementById("descansoTempo");
  #descansoMinEl = document.getElementById("descansoMin");
  #descansoMaxEl = document.getElementById("descansoMax");
  #descansoProximoEl = document.getElementById("descansoProximo");
  #descansoAjusteCargaEl = document.getElementById("descansoAjusteCarga");
  #iniciarSerieEl = document.getElementById("iniciarSerie");
  #concluidoEl = document.getElementById("concluido");
  #resumoConclusaoEl = document.getElementById("resumoConclusao");

  iniciar() {
    this.#comecarSerieEl.addEventListener("click", () => this.#alternarSerie());
    this.#concluirSerieEl.addEventListener("click", () => this.#concluirSerie());
    this.#usarSubstitutoEl.addEventListener("click", () => this.#usarSubstituto());
    this.#iniciarSerieEl.addEventListener("click", () => this.#finalizarDescanso());
    this.#exercicioAnteriorEl.addEventListener("click", () => this.#irParaExercicio(this.#progresso.slotIndex - 1));
    this.#exercicioProximoEl.addEventListener("click", () => this.#irParaExercicio(this.#progresso.slotIndex + 1));

    this.#carregar();
  }

  #gruposMusculares(grupoMuscular) {
    return [grupoMuscular.principal, grupoMuscular.sinergista1, grupoMuscular.sinergista2].filter(Boolean);
  }

  #construirSlots(treino) {
    const slots = [];
    treino.blocos.forEach((bloco) => {
      bloco.itens.forEach((item) => {
        if (item.substituto && slots.length) {
          slots[slots.length - 1].opcoes.push(item);
        } else {
          slots.push({ opcoes: [item] });
        }
      });
    });
    return slots;
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

  #pausaAlvo() {
    return (this.#guia && this.#guia.pausaSegundos) || { min: 60, max: 120 };
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

  #carregarOuIniciarProgresso() {
    const salvo = TreinosStorage.lerJSON(this.#chaveExecucao(), null);
    const valido = salvo &&
      salvo.slotIndex >= 0 && salvo.slotIndex < this.#slots.length &&
      salvo.opcaoIndex >= 0 && salvo.opcaoIndex < this.#slots[salvo.slotIndex].opcoes.length &&
      salvo.serieAtual >= 1;

    if (valido) {
      this.#progresso = salvo;
    } else {
      this.#progresso = { slotIndex: 0, opcaoIndex: 0, serieAtual: 1, iniciadoEm: new Date().toISOString(), tempoAcumuladoSegundos: 0 };
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

  #itemAtual() {
    return this.#slots[this.#progresso.slotIndex].opcoes[this.#progresso.opcaoIndex];
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
    const exercicio = this.#exercicios[item.exercicioId];

    this.#exercicioNomeEl.textContent = exercicio ? exercicio.nome : item.exercicioId;

    const grupos = this.#gruposMusculares(item.grupoMuscular);
    this.#exercicioGruposEl.innerHTML = grupos.map((g) => `<span>${g}</span>`).join("");

    this.#serieAtualLabelEl.textContent = `Série ${this.#progresso.serieAtual} de ${item.series}`;
    this.#alvoRepeticoesEl.textContent = this.#formatarRepeticoes(item.repeticoes);
    this.#isometriaNotaEl.hidden = item.tecnica !== "isometria";

    this.#repeticoesCampoEl.hidden = item.repeticoes.modo === "tempo";

    const ultimoRegistro = this.#ultimoRegistroDoExercicio(item.exercicioId);
    this.#cargaInputEl.value =
      ultimoRegistro && ultimoRegistro.cargaKg !== null ? ultimoRegistro.cargaKg : "";
    this.#repeticoesInputEl.value =
      ultimoRegistro && ultimoRegistro.repeticoes !== null ? ultimoRegistro.repeticoes : "";

    if (exercicio && exercicio.videoUrl) {
      this.#verVideoEl.hidden = false;
      this.#verVideoEl.href = exercicio.videoUrl;
    } else {
      this.#verVideoEl.hidden = true;
    }

    const slot = this.#slots[this.#progresso.slotIndex];
    if (slot.opcoes.length > 1) {
      const proximo = slot.opcoes[(this.#progresso.opcaoIndex + 1) % slot.opcoes.length];
      const proximoExercicio = this.#exercicios[proximo.exercicioId];
      this.#usarSubstitutoEl.hidden = false;
      this.#usarSubstitutoEl.textContent = `Usar substituto: ${proximoExercicio ? proximoExercicio.nome : proximo.exercicioId}`;
    } else {
      this.#usarSubstitutoEl.hidden = true;
    }

    this.#stepperEl.hidden = false;
    this.#progressoTagEl.textContent = `Exercício ${this.#progresso.slotIndex + 1} de ${this.#slots.length}`;
    this.#exercicioAnteriorEl.disabled = this.#progresso.slotIndex === 0;
    this.#exercicioProximoEl.disabled = this.#progresso.slotIndex === this.#slots.length - 1;

    this.#cronometroSerie.reiniciar();
    this.#serieJaIniciada = false;
    this.#serieTimerEl.hidden = true;
    this.#serieTimerValorEl.textContent = "00:00";
    this.#concluirSerieEl.hidden = true;
    this.#atualizarBotaoSerie();
  }

  #formatarRepeticoes(repeticoes) {
    if (repeticoes.modo === "faixa") return `${repeticoes.min} a ${repeticoes.max} repetições`;
    if (repeticoes.modo === "tempo") return `${repeticoes.segundos} segundos`;
    return "Máximo de repetições";
  }

  #irParaExercicio(novoSlotIndex) {
    if (novoSlotIndex < 0 || novoSlotIndex >= this.#slots.length) return;
    this.#progresso.slotIndex = novoSlotIndex;
    this.#progresso.opcaoIndex = 0;
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
    const exercicio = this.#exercicios[item.exercicioId];
    this.#descansoProximoEl.textContent =
      `Próximo: ${exercicio ? exercicio.nome : item.exercicioId} — série ${this.#progresso.serieAtual} de ${item.series}`;

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
    const exercicio = this.#exercicios[item.exercicioId];

    const cargaRaw = this.#cargaInputEl.value;
    const repeticoesRaw = this.#repeticoesInputEl.value;

    const cargaKg = cargaRaw === "" ? null : Number(cargaRaw);
    const repeticoes = (item.repeticoes.modo === "tempo" || repeticoesRaw === "") ? null : Number(repeticoesRaw);

    const serieFoiIniciada = this.#serieJaIniciada;
    const duracaoSerieSegundos = serieFoiIniciada ? this.#cronometroSerie.segundos() : 0;
    this.#cronometroSerie.pausar();
    this.#adicionarTempoExercicio(duracaoSerieSegundos);

    this.#ajusteCargaAtual = null;
    if (item.repeticoes.modo === "faixa" && repeticoes !== null) {
      if (repeticoes > item.repeticoes.max) {
        this.#ajusteCargaAtual = { direcao: "aumentar", exercicioNome: exercicio ? exercicio.nome : item.exercicioId, repeticoes, min: item.repeticoes.min, max: item.repeticoes.max };
      } else if (repeticoes < item.repeticoes.min) {
        this.#ajusteCargaAtual = { direcao: "diminuir", exercicioNome: exercicio ? exercicio.nome : item.exercicioId, repeticoes, min: item.repeticoes.min, max: item.repeticoes.max };
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

    if (this.#progresso.serieAtual < item.series) {
      this.#progresso.serieAtual += 1;
      this.#salvarProgresso();
      this.#iniciarDescanso();
      return;
    }

    // Última série do exercício atual — registra o tempo dele antes de seguir.
    this.#registrarExercicioConcluido(item, exercicio);

    if (this.#progresso.slotIndex < this.#slots.length - 1) {
      this.#progresso.slotIndex += 1;
      this.#progresso.opcaoIndex = 0;
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
    const slot = this.#slots[this.#progresso.slotIndex];
    this.#progresso.opcaoIndex = (this.#progresso.opcaoIndex + 1) % slot.opcoes.length;
    this.#progresso.serieAtual = 1;
    // Descarta o tempo parcial do exercício trocado — ele não foi concluído.
    this.#progresso.tempoAcumuladoSegundos = 0;
    this.#salvarProgresso();
    this.#renderExercicioAtual();
  }

  #concluirTreino() {
    const item = this.#itemAtual();
    const exercicio = this.#exercicios[item.exercicioId];
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
    this.#resumoConclusaoEl.textContent =
      `${this.#treino.nome} — ${this.#slots.length} exercícios em ${Formatadores.duracaoExtensa(duracaoSegundos)}.`;
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_exercicios_menu.html">menu de treinos</a>.`;
    this.#tituloEl.textContent = "Execução do Treino";
  }

  #aplicarSaltoParaExercicio(params) {
    if (!params.has("exercicio")) return;

    const slotAlvo = Number(params.get("exercicio"));
    if (!Number.isInteger(slotAlvo) || slotAlvo < 0 || slotAlvo >= this.#slots.length) return;

    const opcaoAlvo = Number(params.get("opcao"));
    const opcaoValida = Number.isInteger(opcaoAlvo) && opcaoAlvo >= 0 && opcaoAlvo < this.#slots[slotAlvo].opcoes.length
      ? opcaoAlvo
      : 0;

    this.#progresso.slotIndex = slotAlvo;
    this.#progresso.opcaoIndex = opcaoValida;
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
      this.#mostrarErro('Nenhum dado de treino carregado ainda neste navegador. <a href="importar_dados.html">Carregue o arquivo dados_treinos.json</a> pra começar.');
      return;
    }

    this.#treino = dados.treinos.find((t) => t.id === treinoId);
    if (!this.#treino) {
      this.#mostrarErro("Este treino não foi encontrado.");
      return;
    }

    this.#exercicios = dados.exercicios;
    this.#guia = dados.guia;
    this.#slots = this.#construirSlots(this.#treino);

    if (!this.#slots.length) {
      this.#mostrarErro("Este treino ainda não tem exercícios cadastrados.");
      return;
    }

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
