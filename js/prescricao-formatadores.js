export class PrescricaoFormatadores {
  // `sinergistas` (exercícios) e `secundarios` (alongamentos, ver
  // docs/estrutura-biblioteca-alongamentos.md) são o mesmo conceito com
  // nome de campo diferente entre os dois catálogos.
  static gruposMusculares(gruposDoExercicio, gruposMuscularesBiblioteca) {
    const ids = [
      ...((gruposDoExercicio && gruposDoExercicio.principais) || []),
      ...((gruposDoExercicio && gruposDoExercicio.sinergistas) || []),
      ...((gruposDoExercicio && gruposDoExercicio.secundarios) || []),
      ...((gruposDoExercicio && gruposDoExercicio.estabilizadores) || [])
    ];
    return ids.map((id) => (gruposMuscularesBiblioteca[id] && gruposMuscularesBiblioteca[id].nome) || id);
  }

  static metrica(metrica) {
    if (!metrica) return "";

    const unidade = metrica.unidade || (metrica.tipo === "tempo" ? "segundos" : "repetições");

    if (metrica.modo === "faixa") return `${metrica.min} a ${metrica.max} ${unidade}`;
    if (metrica.modo === "fixo") return `${metrica.valor} ${unidade}`;
    if (metrica.modo === "maximo" && metrica.tipo === "tempo") return "Tempo máximo";
    return "Máximo de repetições";
  }

  static ehIsometria(tecnicas) {
    return Array.isArray(tecnicas) && tecnicas.some((tecnica) => tecnica.tipo === "isometria");
  }
}
