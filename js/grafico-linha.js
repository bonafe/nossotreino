import { Formatadores } from "./formatadores.js";

export class GraficoProgressoExercicio {
  constructor({ seletor }) {
    this.seletor = seletor;
  }

  renderizar(diasAgregados) {
    const W = 800;
    const H = 360;
    const margin = { top: 20, right: 46, bottom: 34, left: 46 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const comPeso = diasAgregados.filter((d) => d.mediaCarga !== null);
    const comReps = diasAgregados.filter((d) => d.mediaRepeticoes !== null);

    const x = d3.scaleTime()
      .domain(d3.extent(diasAgregados, (d) => d.data))
      .range([0, plotW])
      .nice();

    const yPeso = d3.scaleLinear()
      .domain([0, (d3.max(comPeso, (d) => d.mediaCarga) || 1) * 1.15])
      .range([plotH, 0]);

    const yReps = d3.scaleLinear()
      .domain([0, (d3.max(comReps, (d) => d.mediaRepeticoes) || 1) * 1.15])
      .range([plotH, 0]);

    const svg = d3.select(this.seletor);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .call(d3.axisLeft(yPeso).ticks(4).tickSize(-plotW).tickFormat(""))
      .call((sel) => sel.select(".domain").remove())
      .call((sel) => sel.selectAll("line").attr("stroke", "rgba(148,163,184,0.16)"));

    g.append("g")
      .attr("transform", `translate(0,${plotH})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, diasAgregados.length)).tickFormat(d3.timeFormat("%d/%m")))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(148,163,184,0.3)"));

    g.append("g")
      .call(d3.axisLeft(yPeso).ticks(4))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(190,242,100,0.35)"));

    g.append("g")
      .attr("transform", `translate(${plotW},0)`)
      .call(d3.axisRight(yReps).ticks(4))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(56,189,248,0.35)"));

    g.append("text").attr("x", -margin.left + 4).attr("y", -8).attr("fill", "#bef264").attr("font-size", "11px").text("kg");
    g.append("text").attr("x", plotW + margin.right - 4).attr("y", -8).attr("text-anchor", "end").attr("fill", "#38bdf8").attr("font-size", "11px").text("reps");

    const linhaPeso = d3.line()
      .defined((d) => d.mediaCarga !== null)
      .x((d) => x(d.data))
      .y((d) => yPeso(d.mediaCarga))
      .curve(d3.curveMonotoneX);

    const linhaReps = d3.line()
      .defined((d) => d.mediaRepeticoes !== null)
      .x((d) => x(d.data))
      .y((d) => yReps(d.mediaRepeticoes))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(diasAgregados)
      .attr("fill", "none")
      .attr("stroke", "#bef264")
      .attr("stroke-width", 2.5)
      .attr("d", linhaPeso);

    g.append("path")
      .datum(diasAgregados)
      .attr("fill", "none")
      .attr("stroke", "#38bdf8")
      .attr("stroke-width", 2.5)
      .attr("d", linhaReps);

    g.selectAll("circle.ponto-peso")
      .data(comPeso)
      .join("circle")
      .attr("class", "ponto-peso")
      .attr("cx", (d) => x(d.data))
      .attr("cy", (d) => yPeso(d.mediaCarga))
      .attr("r", 6)
      .attr("fill", "#bef264")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.5)
      .append("title")
      .text((d) => `${Formatadores.dataExtenso(d.data.toISOString())} · média ${d.mediaCarga.toFixed(1)} kg (${d.totalCarga} série${d.totalCarga === 1 ? "" : "s"})`);

    g.selectAll("circle.ponto-reps")
      .data(comReps)
      .join("circle")
      .attr("class", "ponto-reps")
      .attr("cx", (d) => x(d.data))
      .attr("cy", (d) => yReps(d.mediaRepeticoes))
      .attr("r", 3)
      .attr("fill", "#38bdf8")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1)
      .append("title")
      .text((d) => `${Formatadores.dataExtenso(d.data.toISOString())} · média ${d.mediaRepeticoes.toFixed(1)} repetições (${d.totalRepeticoes} série${d.totalRepeticoes === 1 ? "" : "s"})`);
  }
}

// Mirror de GraficoProgressoExercicio, mas com uma métrica só (tempo
// sustentado, em segundos) — alongamento não tem carga/repetições (ver
// seção 8 de docs/treino-alongamento-especificacao.md).
export class GraficoProgressoAlongamento {
  constructor({ seletor }) {
    this.seletor = seletor;
  }

  renderizar(diasAgregados) {
    const W = 800;
    const H = 360;
    const margin = { top: 20, right: 26, bottom: 34, left: 46 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const comTempo = diasAgregados.filter((d) => d.mediaSegundos !== null);

    const x = d3.scaleTime()
      .domain(d3.extent(diasAgregados, (d) => d.data))
      .range([0, plotW])
      .nice();

    const y = d3.scaleLinear()
      .domain([0, (d3.max(comTempo, (d) => d.mediaSegundos) || 1) * 1.15])
      .range([plotH, 0]);

    const svg = d3.select(this.seletor);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(-plotW).tickFormat(""))
      .call((sel) => sel.select(".domain").remove())
      .call((sel) => sel.selectAll("line").attr("stroke", "rgba(148,163,184,0.16)"));

    g.append("g")
      .attr("transform", `translate(0,${plotH})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, diasAgregados.length)).tickFormat(d3.timeFormat("%d/%m")))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(148,163,184,0.3)"));

    g.append("g")
      .call(d3.axisLeft(y).ticks(4))
      .call((sel) => sel.selectAll("text").attr("fill", "#94a3b8").attr("font-size", "11px"))
      .call((sel) => sel.selectAll("line,.domain").attr("stroke", "rgba(190,242,100,0.35)"));

    g.append("text").attr("x", -margin.left + 4).attr("y", -8).attr("fill", "#bef264").attr("font-size", "11px").text("segundos");

    const linhaTempo = d3.line()
      .defined((d) => d.mediaSegundos !== null)
      .x((d) => x(d.data))
      .y((d) => y(d.mediaSegundos))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(diasAgregados)
      .attr("fill", "none")
      .attr("stroke", "#bef264")
      .attr("stroke-width", 2.5)
      .attr("d", linhaTempo);

    g.selectAll("circle.ponto-tempo")
      .data(comTempo)
      .join("circle")
      .attr("class", "ponto-tempo")
      .attr("cx", (d) => x(d.data))
      .attr("cy", (d) => y(d.mediaSegundos))
      .attr("r", 5)
      .attr("fill", "#bef264")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.5)
      .append("title")
      .text((d) => `${Formatadores.dataExtenso(d.data.toISOString())} · média ${Formatadores.tempoCurto(Math.round(d.mediaSegundos))} (${d.totalSeries} série${d.totalSeries === 1 ? "" : "s"})`);
  }
}
