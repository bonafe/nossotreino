import { TreinosStorage } from "../storage.js";
import { normalizar } from "../identificadores.js";
import { DIAS_SEMANA, Formatadores } from "../formatadores.js";

class AtividadeLivreNovoController {
  #tipoEscolhidoId = null;
  #modo = "unica"; // "unica" | "recorrente"

  #modoUnicaBtnEl = document.getElementById("modoUnicaBtn");
  #modoRecorrenteBtnEl = document.getElementById("modoRecorrenteBtn");
  #campoUnicaEl = document.getElementById("campoUnica");
  #campoRecorrenteEl = document.getElementById("campoRecorrente");
  #campoHoraUnicaEl = document.getElementById("campoHoraUnica");
  #diasSemanaGrupoEl = document.getElementById("diasSemanaGrupo");

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
    this.#renderizarDiasSemana();

    this.#modoUnicaBtnEl.addEventListener("click", () => this.#alternarModo("unica"));
    this.#modoRecorrenteBtnEl.addEventListener("click", () => this.#alternarModo("recorrente"));

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

  #alternarModo(modo) {
    this.#modo = modo;
    this.#modoUnicaBtnEl.setAttribute("aria-pressed", String(modo === "unica"));
    this.#modoRecorrenteBtnEl.setAttribute("aria-pressed", String(modo === "recorrente"));
    this.#campoUnicaEl.hidden = modo !== "unica";
    this.#campoHoraUnicaEl.hidden = modo !== "unica";
    this.#campoRecorrenteEl.hidden = modo !== "recorrente";
    this.#salvarBtnEl.textContent = modo === "unica" ? "Registrar atividade" : "Criar atividade recorrente";
  }

  // Cada dia da semana marcado ganha seu próprio campo de hora — dias
  // diferentes podem acontecer em horários diferentes, só a duração
  // (campo compartilhado, fora desta lista) é igual pra todos.
  #renderizarDiasSemana() {
    this.#diasSemanaGrupoEl.innerHTML = DIAS_SEMANA.map(
      (dia) => `
        <div class="dia-semana-linha">
          <label class="dia-semana-check">
            <input type="checkbox" class="dia-semana-input" value="${dia}" />
            <span>${Formatadores.rotuloDia(dia)}</span>
          </label>
          <input type="time" class="dia-semana-hora" data-dia="${dia}" hidden />
        </div>
      `
    ).join("");

    this.#diasSemanaGrupoEl.querySelectorAll(".dia-semana-input").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const horaEl = checkbox.closest(".dia-semana-linha").querySelector(".dia-semana-hora");
        horaEl.hidden = !checkbox.checked;
        if (checkbox.checked && !horaEl.value) horaEl.value = this.#horaInputEl.value || "19:00";
      });
    });
  }

  #horariosSelecionados() {
    return Array.from(this.#diasSemanaGrupoEl.querySelectorAll(".dia-semana-input:checked")).map((checkbox) => {
      const horaEl = checkbox.closest(".dia-semana-linha").querySelector(".dia-semana-hora");
      return { dia: checkbox.value, hora: horaEl.value };
    });
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
      .map((tipo) => ({ tipo, caminhos: TreinosStorage.caminhosTipoAtividade(tipo.id) }))
      // Busca contra TODOS os caminhos do item, não só o canônico — achar
      // Judô buscando "grappling" precisa funcionar mesmo que o caminho
      // exibido seja o de "artes marciais japonesas".
      .filter(({ caminhos }) => !termo || caminhos.some((c) => normalizar(c.map((t) => t.nome).join(" ")).includes(termo)))
      .sort((a, b) =>
        a.caminhos[0].map((t) => t.nome).join(" › ").localeCompare(b.caminhos[0].map((t) => t.nome).join(" › "))
      );

    this.#pickerResultadosEl.innerHTML = "";
    if (!tipos.length) {
      this.#pickerResultadosEl.innerHTML = '<div class="picker-vazio">Nenhum tipo encontrado. Crie um novo tipo pelo link acima.</div>';
      return;
    }

    tipos.forEach(({ tipo, caminhos }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-resultado-item";
      const nomes = caminhos[0].map((t) => t.nome);
      const nomeProprio = nomes[nomes.length - 1];
      const outros =
        caminhos.length > 1 ? `+${caminhos.length - 1} outro${caminhos.length > 2 ? "s" : ""} caminho${caminhos.length > 2 ? "s" : ""}` : "";
      const ancestrais = [nomes.slice(0, -1).join(" › "), outros].filter(Boolean).join(" · ");
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
    const caminho = TreinosStorage.caminhosTipoAtividade(tipo.id)[0].map((t) => t.nome);
    this.#tipoEscolhaBtnEl.textContent = caminho.join(" › ");
    this.#fecharPicker();
    if (this.#modo === "unica") this.#preencherComUltimaDoTipo(tipo.id);
  }

  // Repete hora e duração da última atividade registrada desse tipo (em
  // qualquer ciclo do aluno ativo, mesmo agregado de atividade_livre_menu.js)
  // — a data continua sendo hoje, só a hora/duração são um chute melhor que
  // "agora" pra atividades que sempre acontecem no mesmo horário. Só faz
  // sentido no modo "uma vez" (recorrente não tem uma data única pra
  // âncorar a busca da "última sessão").
  #preencherComUltimaDoTipo(tipoId) {
    const historico = TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(TreinosStorage.chaves.historicoSessaoLivre);
    const doTipo = historico
      .filter((entrada) => entrada.tipoAtividadeId === tipoId)
      .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

    const ultima = doTipo[0];
    if (!ultima) return;

    const pad = (n) => String(n).padStart(2, "0");
    const dataHora = new Date(ultima.dataHora);
    this.#horaInputEl.value = `${pad(dataHora.getHours())}:${pad(dataHora.getMinutes())}`;
    this.#duracaoInputEl.value = Math.round(ultima.duracaoSegundos / 60);
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
    const duracaoMinutos = Number(this.#duracaoInputEl.value);
    if (!duracaoMinutos || duracaoMinutos <= 0) {
      this.#mostrarMensagem("Informe uma duração maior que zero.");
      return;
    }

    if (this.#modo === "unica") {
      await this.#salvarUnica(duracaoMinutos);
    } else {
      await this.#salvarRecorrente(duracaoMinutos);
    }
  }

  async #salvarUnica(duracaoMinutos) {
    if (!this.#dataInputEl.value) {
      this.#mostrarMensagem("Preencha a data.");
      return;
    }
    if (!this.#horaInputEl.value) {
      this.#mostrarMensagem("Preencha a hora.");
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

  async #salvarRecorrente(duracaoMinutos) {
    const horarios = this.#horariosSelecionados();
    if (!horarios.length) {
      this.#mostrarMensagem("Marque pelo menos um dia da semana.");
      return;
    }
    if (horarios.some((h) => !h.hora)) {
      this.#mostrarMensagem("Preencha a hora de cada dia marcado.");
      return;
    }

    TreinosStorage.criarAtividadeRecorrente({
      tipoAtividadeId: this.#tipoEscolhidoId,
      horarios,
      duracaoSegundos: Math.round(duracaoMinutos * 60),
      observacao: this.#observacaoInputEl.value.trim() || null
    });

    await TreinosStorage.aguardarEscritas();
    window.location.href = "agenda.html";
  }
}

new AtividadeLivreNovoController().iniciar();
