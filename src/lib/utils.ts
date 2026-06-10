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
