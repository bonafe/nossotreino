import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { GraficoMedidas } from "../grafico-medidas.js";
import { METRICAS, VISTAS, metricaPorChave, formatarValor, formatarDelta, variacaoEntre } from "../medidas-corporais.js";

class CorpoMenuController {
  #aluno = TreinosStorage.obterAlunoDoPlanoAtivo();
  #grafico = new GraficoMedidas({ seletor: "#graficoMedidas" });
  #metricaChave = "peso:nenhum";
  #meses = 0;
  #urlsMiniaturas = [];
  #avaliacaoParaExcluir = null;

  #metricaSelectEl = document.getElementById("metricaSelect");
  #listaEl = document.getElementById("lista");
  #confirmOverlayEl = document.getElementById("confirmOverlay");

  iniciar() {
    if (!this.#aluno) {
      window.location.href = "alunos.html";
      return;
    }
    document.getElementById("subtitulo").textContent = this.#aluno.nome || "Acompanhe a evolução do corpo.";

    METRICAS.forEach((m) => this.#metricaSelectEl.add(new Option(m.rotulo, m.chave)));
    this.#metricaSelectEl.addEventListener("change", () => {
      this.#metricaChave = this.#metricaSelectEl.value;
      this.#renderizarGrafico();
    });
    document.querySelectorAll(".periodo-btn").forEach((botao) =>
      botao.addEventListener("click", () => {
        this.#meses = Number(botao.dataset.meses);
        document.querySelectorAll(".periodo-btn").forEach((b) => b.classList.toggle("active", b === botao));
        this.#renderizarGrafico();
      })
    );

    document.getElementById("confirmCancelar").addEventListener("click", () => this.#fecharConfirmacao());
    document.getElementById("confirmOk").addEventListener("click", () => this.#confirmarExclusao());

    this.#renderizar();
  }

  #avaliacoes() {
    return TreinosStorage.listarAvaliacoesDoAluno(this.#aluno.alunoId);
  }

  #renderizar() {
    const avaliacoes = this.#avaliacoes();
    document.getElementById("primeira").hidden = avaliacoes.length > 0;
    document.getElementById("evolucao").hidden = avaliacoes.length === 0;
    if (!avaliacoes.length) return;

    // Abre o gráfico numa métrica que de fato tem dados.
    const comDados = METRICAS.find((m) => TreinosStorage.lerSerieDeMedida(this.#aluno.alunoId, m.tipo, m.lado).length);
    if (comDados && !TreinosStorage.lerSerieDeMedida(this.#aluno.alunoId, ...this.#separar(this.#metricaChave)).length) {
      this.#metricaChave = comDados.chave;
    }
    this.#metricaSelectEl.value = this.#metricaChave;

    this.#renderizarGrafico();
    this.#renderizarVariacao(avaliacoes);
    this.#renderizarLista(avaliacoes);
  }

  #separar(chave) {
    const metrica = metricaPorChave(chave);
    return [metrica.tipo, metrica.lado];
  }

  #renderizarGrafico() {
    const metrica = metricaPorChave(this.#metricaChave);
    let pontos = TreinosStorage.lerSerieDeMedida(this.#aluno.alunoId, metrica.tipo, metrica.lado).map((p) => ({
      data: new Date(p.medidoEm),
      valor: p.valor,
      metodo: p.metodo
    }));

    if (this.#meses > 0) {
      const limite = new Date();
      limite.setMonth(limite.getMonth() - this.#meses);
      pontos = pontos.filter((p) => p.data >= limite);
    }

    document.getElementById("graficoVazio").hidden = pontos.length > 0;
    this.#grafico.renderizar(pontos, metrica.unidade);
  }

  // Variação objetiva entre a última avaliação e a anterior — sem adjetivos.
  #renderizarVariacao(avaliacoes) {
    const card = document.getElementById("variacaoCard");
    if (avaliacoes.length < 2) {
      card.hidden = true;
      return;
    }
    const antes = avaliacoes[avaliacoes.length - 2];
    const depois = avaliacoes[avaliacoes.length - 1];
    const linhas = variacaoEntre(antes, depois);
    card.hidden = !linhas.length;
    if (!linhas.length) return;

    document.getElementById("variacaoTitulo").textContent = `Desde ${Formatadores.dataExtenso(antes.medidoEm)}`;
    document.getElementById("variacaoLista").innerHTML = linhas
      .map(
        (l) => `<div class="variacao-linha">
          <span>${l.metrica.rotulo}</span>
          <span class="variacao-valores">${formatarValor(l.antes)} → ${formatarValor(l.depois, l.metrica.unidade)}</span>
          <span class="variacao-delta">${formatarDelta(l.delta, l.metrica.unidade)}</span>
        </div>`
      )
      .join("");
  }

  #renderizarLista(avaliacoes) {
    this.#urlsMiniaturas.forEach((url) => URL.revokeObjectURL(url));
    this.#urlsMiniaturas = [];
    this.#listaEl.innerHTML = "";

    [...avaliacoes].reverse().forEach((avaliacao) => {
      const peso = avaliacao.medidas.find((m) => m.tipo === "peso");
      const circunferencias = avaliacao.medidas.filter((m) => m.tipo !== "peso").length;
      const partes = [];
      if (peso) partes.push(formatarValor(peso.valor, "kg"));
      if (circunferencias) partes.push(`${circunferencias} medida${circunferencias > 1 ? "s" : ""}`);
      if (avaliacao.fotos.length) partes.push(`${avaliacao.fotos.length} foto${avaliacao.fotos.length > 1 ? "s" : ""}`);

      const div = document.createElement("div");
      div.className = "card-corpo";
      div.innerHTML = `
        <div class="avaliacao-topo">
          <span class="avaliacao-data">${Formatadores.dataHora(avaliacao.medidoEm)}</span>
        </div>
        <div class="avaliacao-resumo">${partes.join(" · ") || "Sem dados"}</div>
        <div class="miniaturas"></div>
        <div class="avaliacao-acoes">
          <a class="botao secondary" href="corpo_avaliacao_nova.html?editar=${encodeURIComponent(avaliacao.id)}">Editar</a>
          <button type="button" class="danger">Excluir</button>
        </div>`;
      div.querySelector("button.danger").addEventListener("click", () => this.#abrirConfirmacao(avaliacao));
      this.#listaEl.appendChild(div);
      this.#carregarMiniaturas(avaliacao, div.querySelector(".miniaturas"));
    });
  }

  async #carregarMiniaturas(avaliacao, contenedor) {
    for (const vista of VISTAS) {
      const foto = avaliacao.fotos.find((f) => f.vista === vista.id);
      if (!foto) continue;
      const blob = await TreinosStorage.obterFotoCorporal(foto.fotoId);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      this.#urlsMiniaturas.push(url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = vista.rotulo;
      contenedor.appendChild(img);
    }
    if (!contenedor.children.length) contenedor.remove();
  }

  #abrirConfirmacao(avaliacao) {
    this.#avaliacaoParaExcluir = avaliacao;
    const fotos = avaliacao.fotos.length;
    const medidas = avaliacao.medidas.length;
    document.getElementById("confirmTexto").textContent =
      `Excluir a avaliação de ${Formatadores.dataHora(avaliacao.medidoEm)}? Serão removidas ${fotos} foto${fotos === 1 ? "" : "s"} e ${medidas} medida${medidas === 1 ? "" : "s"}. Não dá pra desfazer.`;
    this.#confirmOverlayEl.hidden = false;
  }

  #fecharConfirmacao() {
    this.#confirmOverlayEl.hidden = true;
    this.#avaliacaoParaExcluir = null;
  }

  async #confirmarExclusao() {
    if (this.#avaliacaoParaExcluir) {
      TreinosStorage.excluirAvaliacao(this.#avaliacaoParaExcluir.id);
      await TreinosStorage.aguardarEscritas();
    }
    this.#fecharConfirmacao();
    this.#renderizar();
  }
}

new CorpoMenuController().iniciar();
