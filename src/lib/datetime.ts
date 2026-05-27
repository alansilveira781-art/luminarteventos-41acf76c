// Utilitários de data/hora fixados no fuso de Brasília (UTC-3, sem horário de verão).
// Use em inputs <input type="date"> / <input type="datetime-local"> e em exibições.

const BRT_OFFSET_MIN = -180; // UTC-3
const TZ = "America/Sao_Paulo";

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Valor para <input type="datetime-local"> representando o instante em BRT. */
export function toBRTInputDateTime(d: Date | string | number = new Date()): string {
  const date = toDate(d);
  const brt = new Date(date.getTime() + (BRT_OFFSET_MIN - date.getTimezoneOffset() * -1 + date.getTimezoneOffset()) * 0);
  // Mais simples: somar o offset desejado ao UTC.
  const shifted = new Date(date.getTime() + BRT_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** Valor para <input type="date"> representando o dia em BRT. */
export function toBRTInputDate(d: Date | string | number = new Date()): string {
  const date = toDate(d);
  const shifted = new Date(date.getTime() + BRT_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Converte string de <input type="datetime-local"> (sem TZ) interpretada
 * como horário de Brasília para ISO UTC, pronta para salvar.
 */
export function fromBRTInputDateTime(value: string): string {
  if (!value) return value;
  const v = value.length === 16 ? `${value}:00` : value;
  return new Date(`${v}-03:00`).toISOString();
}

/** Formata um instante no fuso de Brasília. */
export function formatBRT(
  d: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(toDate(d));
}
