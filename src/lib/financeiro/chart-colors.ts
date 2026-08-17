/**
 * Paleta dos gráficos do módulo financeiro.
 * Grafite + âmbar, alinhada à logo monocromática da Luminart
 * e à interface em tons neutros.
 */

export const CHART_SERIES = [
  "#1a1a1a", // grafite
  "#d99b2b", // âmbar (acento da marca)
  "#4a4a4a", // cinza escuro
  "#8a8a8a", // cinza médio
  "#b07d22", // âmbar escuro
  "#6b6b6b", // cinza
  "#e8bd6b", // âmbar claro
  "#a8a8a8", // prata
  "#cfcfcf", // prata claro
] as const;

/** Positivo / receita / recebimento */
export const CHART_POSITIVE = "#2f6b4f";
/** Negativo / despesa / pagamento */
export const CHART_NEGATIVE = "#9b3b2f";
/** Neutro / linha de referência */
export const CHART_NEUTRAL = "#8a8a8a";
/** Acento âmbar da marca */
export const CHART_ACCENT = "#d99b2b";
/** Base grafite */
export const CHART_BASE = "#1a1a1a";

export function serieColor(i: number): string {
  return CHART_SERIES[((i % CHART_SERIES.length) + CHART_SERIES.length) % CHART_SERIES.length];
}
