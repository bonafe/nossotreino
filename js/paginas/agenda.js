import { TreinosStorage } from "../storage.js";
import { DIAS_SEMANA, Formatadores } from "../formatadores.js";

const DIAS_NA_JANELA = 7;
const OFFSET_INICIAL = -3; // janela rolante: 3 dias antes de hoje até 3 depois, não seg-dom fixo

class AgendaController {
  #deslocamentoDias = 0;
  #diasEl = document.getElementById("dias");
  #dadosTreinos = null; // carregado uma vez, usado só pra resolver o nome do treino de hoje

  async iniciar() {
    document.getElementById("anterioresBtn").addEventListener("click", () => this.#deslocar(-DIAS_NA_JANELA));
    document.getElementById("proximosBtn").addEventListener("click", () => this.#deslocar(DIAS_NA_JANELA));
    document.getElementById("hojeBtn").addEventListener("click", () => this.#irParaHoje());

    try {
      this.#dadosTreinos = await TreinosStorage.carregarDadosTreinos();
    } catch (erro) {
      // Sem plano/dados carregados ainda — Agenda funciona igual, só sem o
      // card de "treino de hoje" (mesma degradação de outras telas).
    }

    this.#renderizar();
  }

  #deslocar(dias) {
    this.#deslocamentoDias += dias;
    this.#renderizar();
  }

  #irParaHoje() {
    this.#deslocamentoDias = 0;
    this.#renderizar();
  }

  #renderizar() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeChave = Formatadores.chaveDataLocal(hoje.toISOString());

    const regras = TreinosStorage.listarAtividadesRecorrentes();
    const historico = TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(TreinosStorage.chaves.historicoSessaoLivre);
    const distribuicaoSemanal = this.#dadosTreinos ? this.#dadosTreinos.distribuicaoSemanal || [] : [];

    this.#diasEl.innerHTML = "";
    for (let i = OFFSET_INICIAL; i < OFFSET_INICIAL + DIAS_NA_JANELA; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + i + this.#deslocamentoDias);
      const dataChave = Formatadores.chaveDataLocal(data.toISOString());
      const ehHoje = dataChave === hojeChave;
      const diaSemana = DIAS_SEMANA[data.getDay()];

      this.#diasEl.appendChild(
        this.#diaEl({ data, dataChave, diaSemana, ehHoje, regras, historico, distribuicaoSemanal })
      );
    }
  }

  #diaEl({ data, dataChave, diaSemana, ehHoje, regras, historico, distribuicaoSemanal }) {
    const diaCard = document.createElement("div");
    diaCard.className = ehHoje ? "agenda-dia agenda-dia-hoje" : "agenda-dia";

    const cabecalho = document.createElement("div");
    cabecalho.className = "agenda-dia-cabecalho";
    cabecalho.innerHTML = `
      <span class="agenda-dia-nome">${Formatadores.rotuloDia(diaSemana)}</span>
      <span class="agenda-dia-data">${Formatadores.dataCurta(data)}</span>
      ${ehHoje ? '<span class="tag hoje">Hoje</span>' : ""}
    `;
    diaCard.appendChild(cabecalho);

    const itensEl = document.createElement("div");
    itensEl.className = "agenda-dia-itens";
    diaCard.appendChild(itensEl);

    let temItem = false;

    regras.forEach((regra) => {
      const horario = regra.horarios.find((h) => h.dia === diaSemana);
      if (!horario) return;

      temItem = true;
      const confirmacao = (regra.confirmacoes || []).find((c) => c.data === dataChave);
      itensEl.appendChild(
        confirmacao
          ? this.#itemResolvidoEl(regra, horario, confirmacao)
          : this.#itemPendenteEl(regra, horario, dataChave)
      );
    });

    if (ehHoje) {
      const entrada = distribuicaoSemanal.find((d) => d.dia === diaSemana);
      if (entrada && entrada.treinoId && this.#dadosTreinos) {
        const treino = (this.#dadosTreinos.treinos || []).find((t) => t.id === entrada.treinoId);
        if (treino) {
          temItem = true;
          itensEl.appendChild(this.#itemTreinoEl(treino));
        }
      }
    }

    historico
      .filter((entrada) => Formatadores.chaveDataLocal(entrada.dataHora) === dataChave)
      .forEach((entrada) => {
        temItem = true;
        itensEl.appendChild(this.#itemAvulsoEl(entrada));
      });

    if (!temItem) {
      itensEl.innerHTML = '<div class="agenda-item agenda-item-vazio">Nada por aqui.</div>';
    }

    return diaCard;
  }

  #itemPendenteEl(regra, horario, dataChave) {
    const el = document.createElement("div");
    el.className = "agenda-item agenda-item-pendente";
    el.innerHTML = `
      <button type="button" class="agenda-item-toque agenda-item-linha">
        <span class="agenda-item-hora">${horario.hora}</span>
        <span class="agenda-item-nome">${regra.tipoAtividadeNome}</span>
      </button>
      <div class="agenda-item-acoes" hidden>
        <button type="button" class="agenda-acao-feito">✓ Feito</button>
        <button type="button" class="agenda-acao-faltou">✗ Não aconteceu</button>
      </div>
    `;

    const acoesEl = el.querySelector(".agenda-item-acoes");
    el.querySelector(".agenda-item-toque").addEventListener("click", () => {
      acoesEl.hidden = !acoesEl.hidden;
    });
    el.querySelector(".agenda-acao-feito").addEventListener("click", () => this.#confirmar(regra.id, dataChave, "feito"));
    el.querySelector(".agenda-acao-faltou").addEventListener("click", () => this.#confirmar(regra.id, dataChave, "faltou"));

    return el;
  }

  #itemResolvidoEl(regra, horario, confirmacao) {
    const el = document.createElement("div");
    const feito = confirmacao.status === "feito";
    el.className = `agenda-item agenda-item-resolvido ${feito ? "feito" : "faltou"}`;

    if (feito) {
      el.innerHTML = `
        <div class="agenda-item-linha">
          <span class="agenda-item-hora">${horario.hora}</span>
          <span class="agenda-item-nome">✓ ${regra.tipoAtividadeNome}</span>
        </div>
      `;
      return el;
    }

    // "Faltou" continua clicável — pode virar "feito" se a pessoa errou o toque.
    el.innerHTML = `
      <button type="button" class="agenda-item-toque agenda-item-linha">
        <span class="agenda-item-hora">${horario.hora}</span>
        <span class="agenda-item-nome">✗ ${regra.tipoAtividadeNome}</span>
      </button>
    `;
    el.querySelector(".agenda-item-toque").addEventListener("click", () =>
      this.#confirmar(regra.id, confirmacao.data, "feito")
    );
    return el;
  }

  #itemTreinoEl(treino) {
    const a = document.createElement("a");
    a.className = "agenda-item agenda-item-treino agenda-item-linha";
    a.href = `treino_musculacao_exercicios.html?treino=${encodeURIComponent(treino.id)}`;
    a.innerHTML = `<span class="agenda-item-nome">🏋️ ${treino.nome}</span>`;
    return a;
  }

  #itemAvulsoEl(entrada) {
    const el = document.createElement("div");
    el.className = "agenda-item agenda-item-avulso agenda-item-linha";
    el.innerHTML = `
      <span class="agenda-item-hora">${Formatadores.hora(entrada.dataHora)}</span>
      <span class="agenda-item-nome">${entrada.tipoAtividadeNome}</span>
      <span class="agenda-item-duracao">${Formatadores.tempoCurto(entrada.duracaoSegundos)}</span>
    `;
    return el;
  }

  #confirmar(regraId, data, status) {
    TreinosStorage.confirmarAtividadeRecorrente(regraId, data, status);
    this.#renderizar();
  }
}

new AgendaController().iniciar();
