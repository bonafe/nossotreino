// Gráfico de linha da evolução de uma métrica corporal (D3 global, igual
// aos demais gráficos — ver js/grafico-linha.js). Uma linha por `metodo`:
// se o método de medir mudou entre versões do protocolo, a série é
// quebrada em vez de unir pontos que não são comparáveis.
const CORES = ["#bef264", "#38bdf8", "#f472b6"];

export class GraficoMedidas {
  constructor({ seletor }) {
    this.seletor = seletor;
  }

  // pontos: [{ data: Date, valor, metodo }]
  renderizar(pontos, unidade) {
    const W = 800;
    const H = 300;
    const margem = { top: 20, right: 24, bottom: 34, left: 46 };
    const largura = W - margem.left - margem.right;
    const altura = H - margem.top - margem.bottom;

    const svg = d3.select(this.seletor);
    svg.selectAll("*").remove();
    if (!pontos.length) return;

    const x = d3.scaleTime().domain(d3.extent(pontos, (p) => p.data)).range([0, largura]);
    if (pontos.length === 1) x.domain([d3.timeDay.offset(pontos[0].data, -1), d3.timeDay.offset(pontos[0].data, 1)]);

    const [minimo, maximo] = d3.extent(pontos, (p) => p.valor);
    const folga = Math.max((maximo - minimo) * 0.2, 0.5);
    const y = d3.scaleLinear().domain([minimo - folga, maximo + folga]).range([altura, 0]).nice();

    const g = svg.append("g").attr("transform", `translate(${margem.left},${margem.top})`);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(-largura).tickFormat(""))
      .call((sel) => sel.select(".domain").remove())
      .call((sel) => sel.selectAll("line").attr("stroke", "rgba(148,163,184,0.16)"));

    g.append("g")
      .attr("transform", `translate(0,${altura})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, Math.max(2, pontos.length))).tickFormat(d3.timeFormat("%d/%m/%y")))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(148,163,184,0.3)"));

    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(148,163,184,0.3)"));

    g.append("text").attr("x", -margem.left + 4).attr("y", -8).attr("fill", "#94a3b8").attr("font-size", "11px").text(unidade);

    const metodos = [...new Set(pontos.map((p) => p.metodo))];
    const linha = d3.line().x((p) => x(p.data)).y((p) => y(p.valor));

    metodos.forEach((metodo, indice) => {
      const cor = CORES[indice % CORES.length];
      const serie = pontos.filter((p) => p.metodo === metodo);
      if (serie.length > 1) g.append("path").datum(serie).attr("fill", "none").attr("stroke", cor).attr("stroke-width", 2.5).attr("d", linha);
      g.selectAll(null)
        .data(serie)
        .enter()
        .append("circle")
        .attr("cx", (p) => x(p.data))
        .attr("cy", (p) => y(p.valor))
        .attr("r", 4.5)
        .attr("fill", cor);
    });

    if (metodos.length > 1) {
      metodos.forEach((metodo, indice) => {
        g.append("text").attr("x", largura).attr("y", -8 + indice * 13).attr("text-anchor", "end").attr("fill", CORES[indice % CORES.length]).attr("font-size", "11px").text(metodo || "método não informado");
      });
    }
  }
}
