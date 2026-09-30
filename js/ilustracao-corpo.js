// Ilustrações próprias do Nosso Treino pra cada medida: silhueta simples +
// linha da fita + marcos anatômicos. SVG inline, sem arquivo externo (já
// fica offline junto do código). Vista frontal: o lado "esquerdo" da
// pessoa aparece à direita de quem olha a figura.
const COR_CORPO = "#64748b";
const COR_FITA = "#bef264";
const COR_MARCO = "#38bdf8";

const SILHUETA = `
  <circle cx="60" cy="22" r="13" fill="none" stroke="${COR_CORPO}" stroke-width="3"/>
  <path d="M44 44 Q60 38 76 44 L80 100 Q82 112 78 122 L74 128 L46 128 L42 122 Q38 112 40 100 Z" fill="none" stroke="${COR_CORPO}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M44 46 L28 100" fill="none" stroke="${COR_CORPO}" stroke-width="3" stroke-linecap="round"/>
  <path d="M76 46 L92 100" fill="none" stroke="${COR_CORPO}" stroke-width="3" stroke-linecap="round"/>
  <path d="M48 128 L46 228 M72 128 L74 228" fill="none" stroke="${COR_CORPO}" stroke-width="3" stroke-linecap="round"/>
`;

function fita(x1, x2, y) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${COR_FITA}" stroke-width="4" stroke-linecap="round"/>`;
}

function marco(x, y) {
  return `<circle cx="${x}" cy="${y}" r="3.2" fill="${COR_MARCO}"/>`;
}

function fitaInclinada(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COR_FITA}" stroke-width="4" stroke-linecap="round"/>`;
}

function camadaDaMedida(tipo, lado) {
  // Braço esquerdo da pessoa = lado direito da figura (x maior), e vice-versa.
  const direitaDaFigura = lado === "esquerdo";
  switch (tipo) {
    case "cintura":
      return fita(38, 82, 88) + marco(41, 70) + marco(41, 106) + `<line x1="41" y1="70" x2="41" y2="106" stroke="${COR_MARCO}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    case "quadril":
      return fita(36, 84, 116);
    case "braco": {
      return direitaDaFigura ? fitaInclinada(66, 66, 92, 76) : fitaInclinada(54, 66, 28, 76);
    }
    case "coxa": {
      return direitaDaFigura ? fita(58, 84, 156) : fita(36, 62, 156);
    }
    case "panturrilha": {
      return direitaDaFigura ? fita(62, 86, 190) : fita(34, 58, 190);
    }
    default:
      return "";
  }
}

function balanca() {
  return `
    <rect x="22" y="150" width="76" height="50" rx="10" fill="none" stroke="${COR_CORPO}" stroke-width="3"/>
    <rect x="38" y="160" width="44" height="16" rx="4" fill="none" stroke="${COR_FITA}" stroke-width="3"/>
    <circle cx="60" cy="100" r="13" fill="none" stroke="${COR_CORPO}" stroke-width="3"/>
    <path d="M44 120 L76 120 L72 146 L48 146 Z" fill="none" stroke="${COR_CORPO}" stroke-width="3" stroke-linejoin="round"/>
  `;
}

export function ilustracaoMedida(tipo, lado = "nenhum") {
  const conteudo = tipo === "peso" ? balanca() : SILHUETA + camadaDaMedida(tipo, lado);
  return `<svg class="ilustracao-corpo" viewBox="0 0 120 240" role="img" aria-label="Como medir: ${tipo}" xmlns="http://www.w3.org/2000/svg">${conteudo}</svg>`;
}

// Guia de enquadramento sobreposto à câmera (vista frontal/lateral/costas
// usam a mesma moldura: linha central, marca da cabeça e dos pés).
export function guiaEnquadramento() {
  return `<svg class="guia-enquadramento" viewBox="0 0 120 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="6" width="92" height="228" rx="6" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
    <line x1="60" y1="6" x2="60" y2="234" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
    <ellipse cx="60" cy="24" rx="12" ry="15" fill="none" stroke="rgba(190,242,100,0.75)" stroke-width="1.5"/>
    <line x1="30" y1="226" x2="90" y2="226" stroke="rgba(190,242,100,0.75)" stroke-width="1.5"/>
  </svg>`;
}
