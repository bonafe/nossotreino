import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { SinalSonoro } from "../sinal-sonoro.js";
import { Cronometro } from "../cronometro.js";
import { Formatadores } from "../formatadores.js";
import { deveExibirPedidoApoio, renderizarPedidoApoio } from "../apoio.js";

class TreinoBicicletaController {
  #sinal = new SinalSonoro();
  #cronometro = new Cronometro({ aoTick: (segundos) => this.#tick(segundos) });

  #config = null;
  #cycleSegundos = 0;
  #totalSegundos = 0;
  #elapsed = 0;
  #ultimaFase = null;

  #bodyEl = document.body;
  #voltarIconEl = document.getElementById("voltarIcon");
  #tituloEl = document.getElementById("titulo");
  #phaseEl = document.getElementById("phase");
  #instructionEl = document.getElementById("instruction");
  #phaseTimeEl = document.getElementById("phaseTime");
  #totalTimeEl = document.getElementById("totalTime");
  #cycleEl = document.getElementById("cycle");
  #nextChangeEl = document.getElementById("nextChange");
  #progressEl = document.getElementById("progress");
  #startPauseBtn = document.getElementById("startPause");
  #resetBtn = document.getElementById("reset");
  #hintEl = document.getElementById("hint");
  #apoioContainerEl = document.getElementById("apoioContainer");

  #estilosIntensidade = {
    leve: { label: "LEVE", instructionPrefix: "Recuperação leve", som: () => this.#somLeve() },
    maxima: { label: "MÁXIMA", instructionPrefix: "Intensidade máxima", som: () => this.#somMaxima() }
  };

  iniciar() {
    this.#startPauseBtn.addEventListener("click", () => {
      if (this.#cronometro.rodando) this.#pausar();
      else this.#iniciarCronometro();
    });
    this.#resetBtn.addEventListener("click", () => this.#reiniciar());
    this.#carregarTreino();
  }

  #somLeve() {
    // Espelho do #somMaxima: mesmo estilo, descendo do agudo para o grave: entrando em LEVE.
    this.#sinal.beep({ frequency: 1500, duration: 0.16, type: "square", volume: 0.42 });
    setTimeout(() => this.#sinal.beep({ frequency: 1250, duration: 0.16, type: "square", volume: 0.42 }), 190);
    setTimeout(() => this.#sinal.beep({ frequency: 1000, duration: 0.28, type: "square", volume: 0.46 }), 380);
    this.#sinal.vibrar([160, 70, 160, 70, 240]);
    this.#sinal.flashTela("flash", this.#bodyEl);
  }

  #somMaxima() {
    // Três bipes onda quadrada, do grave para o agudo: entrando em MÁXIMA.
    this.#sinal.beep({ frequency: 1000, duration: 0.16, type: "square", volume: 0.42 });
    setTimeout(() => this.#sinal.beep({ frequency: 1250, duration: 0.16, type: "square", volume: 0.42 }), 190);
    setTimeout(() => this.#sinal.beep({ frequency: 1500, duration: 0.28, type: "square", volume: 0.46 }), 380);
    this.#sinal.vibrar([160, 70, 160, 70, 240]);
    this.#sinal.flashTela("flash", this.#bodyEl);
  }

  #somConcluido() {
    this.#sinal.beep({ frequency: 700, duration: 0.16, type: "triangle", volume: 0.42 });
    setTimeout(() => this.#sinal.beep({ frequency: 950, duration: 0.16, type: "triangle", volume: 0.42 }), 190);
    setTimeout(() => this.#sinal.beep({ frequency: 1250, duration: 0.16, type: "triangle", volume: 0.42 }), 380);
    setTimeout(() => this.#sinal.beep({ frequency: 1600, duration: 0.45, type: "triangle", volume: 0.48 }), 570);
    this.#sinal.vibrar([180, 80, 180, 80, 320]);
    this.#sinal.flashTela("flash", this.#bodyEl);
  }

  #infoFaseAtual() {
    if (this.#elapsed >= this.#totalSegundos) {
      return {
        phase: "fim",
        intensidade: null,
        phaseLabel: "FIM",
        instruction: "Treino concluído",
        phaseRemaining: 0,
        next: "-",
        serie: this.#config.series
      };
    }

    const pos = this.#elapsed % this.#cycleSegundos;
    const serie = Math.floor(this.#elapsed / this.#cycleSegundos) + 1;

    if (pos < this.#config.tempoRecuperacaoSegundos) {
      const estilo = this.#estilosIntensidade[this.#config.intensidadeRecuperacao];
      return {
        phase: "recuperacao",
        intensidade: this.#config.intensidadeRecuperacao,
        phaseLabel: estilo.label,
        instruction: "Recuperação — " + estilo.instructionPrefix,
        phaseRemaining: this.#config.tempoRecuperacaoSegundos - pos,
        next: this.#estilosIntensidade[this.#config.intensidadeEstimulo].label,
        serie
      };
    }

    const estilo = this.#estilosIntensidade[this.#config.intensidadeEstimulo];
    return {
      phase: "estimulo",
      intensidade: this.#config.intensidadeEstimulo,
      phaseLabel: estilo.label,
      instruction: "Estímulo — " + estilo.instructionPrefix,
      phaseRemaining: this.#cycleSegundos - pos,
      next: this.#estilosIntensidade[this.#config.intensidadeRecuperacao].label,
      serie
    };
  }

  #render() {
    const info = this.#infoFaseAtual();
    const totalRemaining = Math.max(0, this.#totalSegundos - this.#elapsed);

    this.#bodyEl.classList.toggle("leve", info.intensidade === "leve");
    this.#bodyEl.classList.toggle("maxima", info.intensidade === "maxima");
    this.#bodyEl.classList.toggle("fim", info.phase === "fim");
    this.#bodyEl.classList.toggle("pulse-maxima", info.intensidade === "maxima" && this.#cronometro.rodando);

    this.#phaseEl.textContent = info.phaseLabel;
    this.#instructionEl.textContent = info.instruction;
    this.#phaseTimeEl.textContent = Formatadores.relogio(info.phaseRemaining);
    this.#totalTimeEl.textContent = Formatadores.relogio(totalRemaining);
    this.#cycleEl.textContent = `Série ${Math.min(info.serie, this.#config.series)} / ${this.#config.series}`;
    this.#nextChangeEl.textContent = info.next;
    this.#progressEl.style.width = `${Math.min(100, (this.#elapsed / this.#totalSegundos) * 100)}%`;

    if (info.phase === "fim") {
      this.#phaseTimeEl.textContent = "00:00";
      this.#startPauseBtn.textContent = "CONCLUÍDO";
      this.#startPauseBtn.disabled = true;
    } else {
      this.#startPauseBtn.disabled = false;
      this.#startPauseBtn.textContent = this.#cronometro.rodando ? "PAUSAR" : "INICIAR";
    }
  }

  #registrarSessaoConcluida() {
    TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoBicicleta, {
      modalidadeId: this.#config.modalidadeId,
      treinoId: this.#config.treinoCardioId,
      origemTreinoId: this.#config.origemTreinoId,
      nome: this.#config.nome,
      dataHora: new Date().toISOString(),
      duracaoSegundos: this.#totalSegundos,
      series: this.#config.series
    });
  }

  #tick(segundosAtuais) {
    this.#elapsed = segundosAtuais;
    const info = this.#infoFaseAtual();

    if (this.#elapsed >= this.#totalSegundos) {
      this.#elapsed = this.#totalSegundos;
      this.#cronometro.pausar();
      this.#render();
      this.#somConcluido();
      this.#registrarSessaoConcluida();
      if (deveExibirPedidoApoio()) renderizarPedidoApoio(this.#apoioContainerEl);
      return;
    }

    if (info.intensidade !== this.#ultimaFase) {
      this.#ultimaFase = info.intensidade;
      this.#estilosIntensidade[info.intensidade].som();
    }

    this.#render();
  }

  #iniciarCronometro() {
    this.#sinal.destravar();

    if (this.#elapsed >= this.#totalSegundos) return;

    if (!this.#cronometro.rodando) {
      const info = this.#infoFaseAtual();
      this.#ultimaFase = info.intensidade;
      if (this.#elapsed === 0) this.#estilosIntensidade[info.intensidade].som();
      this.#cronometro.iniciar();
      this.#render();
    }
  }

  #pausar() {
    this.#cronometro.pausar();
    this.#render();
  }

  #reiniciar() {
    this.#pausar();
    this.#cronometro.reiniciar();
    this.#elapsed = 0;
    this.#ultimaFase = null;
    this.#startPauseBtn.disabled = false;
    this.#render();
  }

  #mostrarErro(mensagem, mostrarLinkImportar) {
    this.#bodyEl.classList.remove("carregando");
    this.#bodyEl.classList.add("erro");
    this.#tituloEl.textContent = "Treino de Bike";
    this.#cycleEl.textContent = "Erro";
    this.#phaseEl.textContent = "😕";
    this.#instructionEl.textContent = mensagem;
    this.#phaseTimeEl.textContent = "";
    this.#hintEl.hidden = !mostrarLinkImportar;
    this.#hintEl.innerHTML = mostrarLinkImportar
      ? 'Se ainda não carregou os dados neste navegador, <a href="importar_dados.html">carregue o arquivo do seu plano</a> primeiro.'
      : "";
  }

  #iniciarComConfig(cfg) {
    this.#config = cfg;
    this.#cycleSegundos = cfg.tempoEstimuloSegundos + cfg.tempoRecuperacaoSegundos;
    this.#totalSegundos = cfg.series * this.#cycleSegundos;

    this.#bodyEl.classList.remove("carregando");
    this.#tituloEl.textContent = cfg.nome || "Treino de Bike";
    document.title = `${cfg.nome || "Treino de Bike"} — Treino de Bicicleta`;

    this.#startPauseBtn.disabled = false;
    this.#resetBtn.disabled = false;
    this.#hintEl.hidden = true;

    this.#render();
  }

  #extrairConfig(treinoCardio, modalidade, origemTreinoId) {
    const cfg = treinoCardio.treino;
    return {
      modalidadeId: treinoCardio.modalidadeId,
      treinoCardioId: treinoCardio.id,
      origemTreinoId,
      nome: `${treinoCardio.nome} — ${modalidade.nome}`,
      series: cfg.series,
      tempoEstimuloSegundos: cfg.estimulo.duracaoSegundos,
      tempoRecuperacaoSegundos: cfg.recuperacao.duracaoSegundos,
      intensidadeEstimulo: cfg.estimulo.intensidade.valor,
      intensidadeRecuperacao: cfg.recuperacao.intensidade.valor
    };
  }

  async #carregarTreino() {
    const params = new URLSearchParams(window.location.search);
    const treinoCardioId = params.get("treino");
    const origemTreinoId = params.get("origem");

    this.#voltarIconEl.href = origemTreinoId
      ? `treino_exercicios.html?treino=${encodeURIComponent(origemTreinoId)}`
      : "treino_bicicleta_menu.html";

    if (!treinoCardioId) {
      this.#mostrarErro("Nenhum treino selecionado.");
      return;
    }

    let dados;
    let bibliotecaExercicios;
    try {
      dados = await TreinosStorage.carregarDadosTreinos();
      bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar este treino.", true);
      return;
    }

    const treinoCardio = (dados.treinosCardio || []).find((t) => t.id === treinoCardioId);
    const modalidade = treinoCardio && bibliotecaExercicios.bibliotecas.cardio.modalidades[treinoCardio.modalidadeId];

    if (!treinoCardio || !modalidade) {
      this.#mostrarErro("Não foi possível carregar este treino.", true);
      return;
    }

    // O motor só sabe tocar o ciclo intervalado estímulo/recuperação —
    // outros tipos (ex. contínuo) ficam fora de escopo por enquanto.
    if (treinoCardio.treino.tipo !== "intervalado" || !treinoCardio.treino.estimulo || !treinoCardio.treino.recuperacao) {
      this.#mostrarErro("Este tipo de treino de bicicleta ainda não é suportado.");
      return;
    }

    this.#iniciarComConfig(this.#extrairConfig(treinoCardio, modalidade, origemTreinoId));
  }
}

new TreinoBicicletaController().iniciar();
