// Definições do Protocolo Nosso Treino v1 (ver
// docs/medidas-fotos-especificacao.md, seção 4): quais medidas existem, em
// que unidade/método, faixa plausível e regras de leitura. Sem acesso a
// storage — só regra de domínio pura, compartilhada pelas telas de corpo.
export const PROTOCOLO_ATUAL = { id: "nosso-treino", versao: 1 };

export const LIMITE_DUPLA_MEDICAO_CM = 1.0;

// `chave` = `${tipo}:${lado}` — identifica uma métrica em formulários e gráficos.
export const METRICAS = [
  { chave: "peso:nenhum", tipo: "peso", lado: "nenhum", rotulo: "Peso", unidade: "kg", metodo: "balanca", faixa: [20, 400] },
  { chave: "cintura:nenhum", tipo: "cintura", lado: "nenhum", rotulo: "Cintura", unidade: "cm", metodo: "ponto-medio-oms", faixa: [10, 300] },
  { chave: "quadril:nenhum", tipo: "quadril", lado: "nenhum", rotulo: "Quadril", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] },
  { chave: "braco:esquerdo", tipo: "braco", lado: "esquerdo", rotulo: "Braço esquerdo", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] },
  { chave: "braco:direito", tipo: "braco", lado: "direito", rotulo: "Braço direito", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] },
  { chave: "coxa:esquerdo", tipo: "coxa", lado: "esquerdo", rotulo: "Coxa esquerda", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] },
  { chave: "coxa:direito", tipo: "coxa", lado: "direito", rotulo: "Coxa direita", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] },
  { chave: "panturrilha:esquerdo", tipo: "panturrilha", lado: "esquerdo", rotulo: "Panturrilha esquerda", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] },
  { chave: "panturrilha:direito", tipo: "panturrilha", lado: "direito", rotulo: "Panturrilha direita", unidade: "cm", metodo: "maior-circunferencia", faixa: [10, 300] }
];

export function metricaPorChave(chave) {
  return METRICAS.find((m) => m.chave === chave) || null;
}

export function chaveDaMedida(medida) {
  return `${medida.tipo}:${medida.lado || "nenhum"}`;
}

export const VISTAS = [
  { id: "frente", rotulo: "Frente" },
  { id: "lado", rotulo: "Lado" },
  { id: "costas", rotulo: "Costas" }
];

// Instruções curtas por tipo de medida (texto original do Nosso Treino).
export const INSTRUCOES = {
  peso: "Suba na balança, parado, com o peso distribuído nos dois pés. Sempre que der, use a mesma balança, no mesmo tipo de piso.",
  cintura:
    "Em pé e relaxado, ache a última costela e o topo do osso do quadril; a cintura é o ponto do meio entre os dois. Fita na horizontal, sem apertar a pele. Leia ao final de uma expiração normal.",
  quadril: "Em pé, pés juntos. Passe a fita na parte mais larga dos glúteos, na horizontal, sem apertar a pele.",
  braco: "Braço relaxado ao lado do corpo. Passe a fita no ponto mais grosso entre o ombro e o cotovelo, perpendicular ao braço, sem apertar.",
  coxa: "Em pé, peso distribuído nas duas pernas. Passe a fita no ponto mais grosso da coxa, perpendicular à perna, sem apertar.",
  panturrilha: "Em pé, perna relaxada. Passe a fita no ponto mais grosso da panturrilha, perpendicular à perna, sem apertar."
};

// Aceita vírgula ou ponto decimal; devolve null pra vazio/inválido.
export function lerNumero(texto) {
  if (texto === null || texto === undefined) return null;
  const limpo = String(texto).trim().replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

export function formatarValor(valor, unidade) {
  const texto = Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return unidade ? `${texto} ${unidade}` : texto;
}

export function arredondar1(valor) {
  return Math.round(valor * 10) / 10;
}

// Dupla medição (modo preciso): diferença ≤ 1,0 cm → média; maior → pede
// nova medição. Só vale pra circunferências (cm).
export function reconciliarLeituras(leitura1, leitura2) {
  const diferenca = Math.abs(leitura1 - leitura2);
  if (diferenca > LIMITE_DUPLA_MEDICAO_CM + 1e-9) return { ok: false, diferenca };
  return { ok: true, valor: arredondar1((leitura1 + leitura2) / 2), diferenca };
}

// Validação suave: devolve uma mensagem de aviso (nunca bloqueia) ou null.
export function avisoDeFaixa(metrica, valor) {
  const [minimo, maximo] = metrica.faixa;
  if (valor >= minimo && valor <= maximo) return null;
  const sugestao = valor > 0 && valor * 10 >= minimo && valor * 10 <= maximo ? ` Talvez quisesse ${formatarValor(valor * 10, metrica.unidade)}.` : "";
  return `Você informou ${metrica.rotulo.toLowerCase()} de ${formatarValor(valor, metrica.unidade)}.${sugestao}`;
}

// Variação objetiva entre duas avaliações — sem julgamento de valor.
export function variacaoEntre(avaliacaoAntes, avaliacaoDepois) {
  const resultado = [];
  METRICAS.forEach((metrica) => {
    const antes = avaliacaoAntes.medidas.find((m) => chaveDaMedida(m) === metrica.chave);
    const depois = avaliacaoDepois.medidas.find((m) => chaveDaMedida(m) === metrica.chave);
    if (!antes || !depois) return;
    resultado.push({ metrica, antes: antes.valor, depois: depois.valor, delta: arredondar1(depois.valor - antes.valor) });
  });
  return resultado;
}

export function formatarDelta(delta, unidade) {
  const sinal = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sinal}${Math.abs(delta).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${unidade}`;
}
