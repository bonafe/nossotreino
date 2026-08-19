import { TreinosStorage } from "../storage.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { Formatadores } from "../formatadores.js";
import { GraficoProgressoExercicio } from "../grafico-linha.js";

const CORES_GRUPO = [
  { peso: "rgba(190, 242, 100, 0.95)", reps: "rgba(56, 189, 248, 0.95)", borda: "#bef264", fundo: "rgba(190, 242, 100, 0.08)" },
  { peso: "rgba(190, 242, 100, 0.45)", reps: "rgba(56, 189, 248, 0.45)", borda: "#38bdf8", fundo: "rgba(56, 189, 248, 0.08)" }
];

class TreinoExercicioProgressoController {
  #grafico = new GraficoProgressoExercicio({ seletor: "#grafico" });

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
      if (!porDia.has(dia)) porDia.set(dia, { pesos: [], reps: [] });
      const grupo = porDia.get(dia);
      if (entrada.cargaKg !== null && entrada.cargaKg !== undefined) grupo.pesos.push(entrada.cargaKg);
      if (entrada.repeticoes !== null && entrada.repeticoes !== undefined) grupo.reps.push(entrada.repeticoes);
    });

    return [...porDia.entries()]
      .map(([dia, grupo]) => ({
        data: new Date(`${dia}T12:00:00`),
        mediaCarga: grupo.pesos.length ? this.#media(grupo.pesos) : null,
        totalCarga: grupo.pesos.length,
        mediaRepeticoes: grupo.reps.length ? this.#media(grupo.reps) : null,
        totalRepeticoes: grupo.reps.length
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
      trCabecalho.innerHTML = `<td colspan="4"><strong>${grupo.treinoNome}</strong> — ${Formatadores.dataExtenso(grupo.entradas[0].dataHora)}</td>`;
      corpo.appendChild(trCabecalho);

      grupo.entradas.forEach((entrada) => {
        const tr = document.createElement("tr");
        tr.style.borderLeft = `4px solid ${cor.borda}`;
        tr.innerHTML = `
          <td>${entrada.serie}</td>
          <td>${entrada.cargaKg ?? "—"}</td>
          <td>${entrada.repeticoes ?? "—"}</td>
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
    erroEl.innerHTML = `${mensagem} Volte ao <a href="treino_musculacao_menu.html">menu de treinos</a>.`;
    document.getElementById("titulo").textContent = "Progresso do Exercício";
  }

  async #carregar() {
    const params = new URLSearchParams(window.location.search);
    const exercicioId = params.get("exercicio");
    const treinoId = params.get("treino");

    document.getElementById("voltarLink").href = treinoId
      ? `treino_musculacao_exercicios.html?treino=${encodeURIComponent(treinoId)}`
      : "treino_musculacao_menu.html";

    if (!exercicioId) {
      this.#mostrarErro("Nenhum exercício selecionado.");
      return;
    }

    let bibliotecaExercicios;
    try {
      bibliotecaExercicios = await carregarBiblioteca();
    } catch (erro) {
      this.#mostrarErro("Não foi possível carregar a biblioteca de exercícios. Verifique sua conexão e tente novamente.");
      return;
    }

    const exercicio = bibliotecaExercicios.bibliotecas.exercicios[exercicioId];
    const nomeExercicio = exercicio ? exercicio.nome : exercicioId;

    document.title = `${nomeExercicio} — Progresso`;
    document.getElementById("titulo").textContent = nomeExercicio;
    document.getElementById("carregando").hidden = true;

    const historico = TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(TreinosStorage.chaves.historicoSerieMusculacao);
    const entradas = historico.filter((e) => e.exercicioId === exercicioId);

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

new TreinoExercicioProgressoController().iniciar();
