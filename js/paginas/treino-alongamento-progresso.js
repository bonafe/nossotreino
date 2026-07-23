import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { Formatadores } from "../formatadores.js";
import { GraficoProgressoAlongamento } from "../grafico-linha.js";

const CORES_GRUPO = [
  { borda: "#bef264", fundo: "rgba(190, 242, 100, 0.08)" },
  { borda: "#38bdf8", fundo: "rgba(56, 189, 248, 0.08)" }
];

// Mirror de treino-exercicio-progresso.js, mas com uma métrica só (tempo
// sustentado, em segundos) — alongamento não tem carga/repetições.
class TreinoAlongamentoProgressoController {
  #grafico = new GraficoProgressoAlongamento({ seletor: "#grafico" });

  iniciar() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const alvo = btn.dataset.tab;
        document.getElementById("painelGrafico").hidden = alvo !== "grafico";
        document.getElementById("painelTabela").hidden = alvo !== "tabela";
      });
    });

    this.#carregar();
  }

  #agruparPorSessao(entradas) {
    const ordenadas = [...entradas].sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    const grupos = [];
    let chaveAnterior = null;

    ordenadas.forEach((entrada) => {
      const chave = `${entrada.treinoId}__${Formatadores.chaveDataLocal(entrada.dataHora)}`;
      if (chave !== chaveAnterior) {
        grupos.push({
          chave,
          treinoNome: entrada.treinoNome,
          indiceCor: grupos.length % 2,
          entradas: []
        });
        chaveAnterior = chave;
      }
      grupos[grupos.length - 1].entradas.push(entrada);
    });

    return grupos;
  }

  #media(valores) {
    return valores.reduce((soma, v) => soma + v, 0) / valores.length;
  }

  #agruparPorDia(entradas) {
    const porDia = new Map();

    entradas.forEach((entrada) => {
      const dia = Formatadores.chaveDataLocal(entrada.dataHora);
      if (!porDia.has(dia)) porDia.set(dia, { tempos: [] });
      if (entrada.duracaoSegundos !== null && entrada.duracaoSegundos !== undefined) {
        porDia.get(dia).tempos.push(entrada.duracaoSegundos);
      }
    });

    return [...porDia.entries()]
      .map(([dia, grupo]) => ({
        data: new Date(`${dia}T12:00:00`),
        mediaSegundos: grupo.tempos.length ? this.#media(grupo.tempos) : null,
        totalSeries: grupo.tempos.length
      }))
      .sort((a, b) => a.data - b.data);
  }

  #montarTabela(grupos) {
    const corpo = document.getElementById("tabelaCorpo");
    corpo.innerHTML = "";

    grupos.forEach((grupo) => {
      const cor = CORES_GRUPO[grupo.indiceCor];

      const trCabecalho = document.createElement("tr");
      trCabecalho.className = "grupo-cabecalho";
      trCabecalho.style.background = cor.fundo;
      trCabecalho.style.borderLeft = `4px solid ${cor.borda}`;
      trCabecalho.innerHTML = `<td colspan="3"><strong>${grupo.treinoNome}</strong> — ${Formatadores.dataExtenso(grupo.entradas[0].dataHora)}</td>`;
      corpo.appendChild(trCabecalho);

      grupo.entradas.forEach((entrada) => {
        const tr = document.createElement("tr");
        tr.style.borderLeft = `4px solid ${cor.borda}`;
        tr.innerHTML = `
          <td>${entrada.serie}</td>
          <td>${entrada.duracaoSegundos != null ? Formatadores.tempoCurto(entrada.duracaoSegundos) : "—"}</td>
          <td>${Formatadores.hora(entrada.dataHora)}</td>
        `;
        corpo.appendChild(tr);
      });
    });
  }

  #mostrarErro(mensagem) {
    document.getElementById("carregando").hidden = true;
    const erroEl = document.getElementById("erro");
    erroEl.hidden = false;
    erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_alongamento_menu.html">menu de alongamento</a>.`;
    document.getElementById("titulo").textContent = "Progresso do Alongamento";
  }

  async #carregar() {
    const params = new URLSearchParams(window.location.search);
    const alongamentoId = params.get("alongamento");
    const treinoId = params.get("treino");

    document.getElementById("voltarLink").href = treinoId
      ? `treino_alongamento_exercicios.html?treino=${encodeURIComponent(treinoId)}`
      : "treino_alongamento_menu.html";

    if (!alongamentoId) {
      this.#mostrarErro("Nenhum alongamento selecionado.");
      return;
    }

    let bibliotecaExercicios;
    try {
      bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    const alongamento = bibliotecaExercicios.bibliotecas.alongamentos[alongamentoId];
    const nomeAlongamento = alongamento ? alongamento.nome : alongamentoId;

    document.title = `${nomeAlongamento} — Progresso`;
    document.getElementById("titulo").textContent = nomeAlongamento;
    document.getElementById("carregando").hidden = true;

    const historico = TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(TreinosStorage.chaves.historicoSerieAlongamento);
    const entradas = historico.filter((e) => e.alongamentoId === alongamentoId);

    if (!entradas.length) {
      document.getElementById("vazio").hidden = false;
      return;
    }

    const totalTagEl = document.getElementById("totalTag");
    totalTagEl.hidden = false;
    totalTagEl.textContent = `${entradas.length} série${entradas.length === 1 ? "" : "s"} registradas`;

    document.querySelector(".tabs").hidden = false;
    document.getElementById("painelGrafico").hidden = false;

    this.#grafico.renderizar(this.#agruparPorDia(entradas));
    this.#montarTabela(this.#agruparPorSessao(entradas));
  }
}

new TreinoAlongamentoProgressoController().iniciar();
