// Utilitários do campo "Prazo" (data limite) usado em Compras, Aquisições e Solicitações.

const TZ = "America/Sao_Paulo";

export type PrazoStatus = "vencido" | "proximo" | "ok";

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export function hojeBRT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function toUTCDate(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** Dias restantes até o prazo (negativo se já passou). null se não houver prazo. */
export function diasParaPrazo(prazo?: string | null): number | null {
  const p = (prazo ?? "").trim();
  if (!p) return null;
  const alvo = toUTCDate(p);
  if (Number.isNaN(alvo)) return null;
  return Math.round((alvo - toUTCDate(hojeBRT())) / 86_400_000);
}

/**
 * Semáforo do prazo:
 * - vermelho (vencido): a data já passou
 * - amarelo (proximo): faltam 2 dias ou menos (inclui hoje)
 * - verde (ok): ainda há tempo
 */
export function prazoStatus(prazo?: string | null): PrazoStatus | null {
  const dias = diasParaPrazo(prazo);
  if (dias == null) return null;
  if (dias < 0) return "vencido";
  if (dias <= 2) return "proximo";
  return "ok";
}

export function prazoLabel(prazo?: string | null): string {
  const dias = diasParaPrazo(prazo);
  if (dias == null) return "";
  const data = new Date(toUTCDate(prazo!)).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  if (dias < 0) return `Prazo ${data} · vencido há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return `Prazo ${data} · vence hoje`;
  return `Prazo ${data} · faltam ${dias} dia(s)`;
}

export const PRAZO_DOT_CLASS: Record<PrazoStatus, string> = {
  vencido: "bg-destructive",
  proximo: "bg-amber-500",
  ok: "bg-emerald-500",
};

/**
 * Prazo que está valendo para o card de compra.
 * A partir da aprovação, o prazo de execução (prazo_aprovacao) substitui
 * o prazo da fase de solicitação/aprovação.
 */
export function prazoVigente(c?: {
  prazo?: string | null;
  prazo_aprovacao?: string | null;
} | null): string | null {
  if (!c) return null;
  return c.prazo_aprovacao ?? c.prazo ?? null;
}

/**
 * Semáforo do prazo considerando o status da compra:
 * verde só quando o card chega em "finalizado". Entre a aprovação e o
 * fim, mostra vermelho (vencido) ou amarelo.
 */
export function prazoStatusCompra(prazo?: string | null, status?: string | null): PrazoStatus | null {
  const base = prazoStatus(prazo);
  if (!base) return null;
  const s = String(status ?? "");
  if (s === "finalizado") return "ok";
  if (["aprovada", "em_andamento", "a_receber"].includes(s)) {
    return base === "vencido" ? "vencido" : "proximo";
  }
  return base;
}


