import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza string: remove acentos, lower-case e trim. Útil para buscas tolerantes. */
export function normalize(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Verifica se um termo aparece no conteúdo, ignorando acentos e case. */
export function matchesNormalized(haystack: unknown, needle: string): boolean {
  const n = normalize(needle);
  if (!n) return true;
  return normalize(haystack).includes(n);
}

/** Busca por tokens: divide a query por espaços e exige que TODOS os tokens estejam no haystack (qualquer ordem). */
export function matchTokens(haystack: unknown, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const h = normalize(haystack);
  return tokens.every((t) => h.includes(t));
}

/** Prefixo padrão das observações/finalidades de ajuste geradas pela conferência Egestor. */
const AJUSTE_EGESTOR_PREFIXO = "Ajuste por conferência Egestor";

/**
 * Identifica movimentações de ajuste geradas automaticamente pela conferência
 * Egestor, que devem ser ocultadas nas listas de Entradas e Saídas e nos
 * agregados do Dashboard, sem afetar o cálculo de saldo. O discriminador é a
 * observação/finalidade que começa com o prefixo da conferência Egestor —
 * ajustes manuais com entrada_tipo/saida_tipo = "ajuste" mas sem esse prefixo
 * continuam visíveis.
 */
export function isAjusteMovimentacao(m: any): boolean {
  if (!m) return false;
  const obs = String(m.observacoes ?? "").trim();
  const finalidade = String(m.finalidade ?? "").trim();
  const obsIsAjuste = obs.startsWith(AJUSTE_EGESTOR_PREFIXO);
  const finalidadeIsAjuste = finalidade.startsWith(AJUSTE_EGESTOR_PREFIXO);

  if (m.tipo === "entrada") {
    return obsIsAjuste;
  }

  if (m.tipo === "saida") {
    if (obsIsAjuste) return true;
    if (finalidadeIsAjuste) return true;
    return false;
  }

  return false;
}
