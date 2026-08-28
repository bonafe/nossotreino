const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Mesmos 7 ids usados em distribuicaoSemanal/atividadesRecorrentes do
// plano — índice 0 casa com Date#getDay() (0 = domingo).
export const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado"
];

const ROTULOS_DIA_CURTO = {
  domingo: "Dom",
  "segunda-feira": "Seg",
  "terca-feira": "Ter",
  "quarta-feira": "Qua",
  "quinta-feira": "Qui",
  "sexta-feira": "Sex",
  sabado: "Sáb"
};

export class Formatadores {
  static relogio(segundos) {
    const m = Math.floor(segundos / 60).toString().padStart(2, "0");
    const s = Math.floor(segundos % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  static duracaoExtensa(segundos) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    if (min === 0) return `${seg}s`;
    return `${min} min ${seg}s`;
  }

  static tempoCurto(segundos) {
    if (segundos % 60 === 0) return `${segundos / 60} min`;
    return `${segundos}s`;
  }

  static labelIntensidade(intensidade) {
    return intensidade === "maxima" ? "Máxima" : "Leve";
  }

  static chaveDataLocal(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  static chaveMesLocal(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  static dataCurta(data) {
    return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
  }

  static mesCurto(data) {
    return `${MESES_ABREV[data.getMonth()]}/${String(data.getFullYear()).slice(2)}`;
  }

  static minutos(minutos) {
    const totalMin = Math.round(minutos);
    if (totalMin < 60) return `${totalMin}min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }

  static dataExtenso(iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  static hora(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  static dataHora(iso) {
    return `${Formatadores.dataExtenso(iso)} ${Formatadores.hora(iso)}`;
  }

  static rotuloDia(diaId) {
    return ROTULOS_DIA_CURTO[diaId] || diaId;
  }
}
