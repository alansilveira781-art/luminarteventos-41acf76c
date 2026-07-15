/**
 * Agrupamento de parcelamentos em linhas únicas.
 *
 * O Conta Azul emite cada parcela como um lançamento independente
 * (external_id distinto). Não há campo de "grupo de parcelamento" — a única
 * pista confiável é o padrão `N/M - <base> N/M` na descrição.
 *
 * Este helper é usado apenas na tabela de lançamentos ao clicar em uma
 * rubrica (Análise Detalhada). KPIs e Painel Financeiro continuam contando
 * parcela a parcela.
 */

export type LancRow = {
  data: string | null;
  nome: string | null;
  descricao: string | null;
  valor: number;
  categoria_external_id: string | null;
};

export type GroupedLancRow =
  | (LancRow & { kind: "single" })
  | {
      kind: "group";
      chave: string;
      descricaoBase: string;
      totalParcelas: number; // M do padrão N/M
      parcelas: LancRow[]; // já ordenadas por data
      nome: string | null;
      dataInicio: string | null;
      dataFim: string | null;
      valor: number; // soma
      categoria_external_id: string | null;
      pagas: number; // heurística: quantas parcelas com valor > 0 (não tem status aqui) — não usada
    };

// Regex: aceita variações com espaços; captura N, M e a descrição base.
const RE = /^\s*(\d+)\s*\/\s*(\d+)\s*-\s*(.+?)\s*\1\s*\/\s*\2\s*$/;

export function parseParcela(descricao: string | null | undefined): {
  n: number;
  m: number;
  base: string;
} | null {
  if (!descricao) return null;
  const match = descricao.match(RE);
  if (!match) return null;
  const n = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(n) || !Number.isFinite(m) || m < 2) return null;
  return { n, m, base: match[3].trim() };
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/**
 * Agrupa `rows` que compartilham (nome + descrição base + valor arredondado).
 * Linhas cuja descrição não casa com o padrão N/M ficam como `kind: "single"`.
 */
export function agruparParcelamentos(rows: LancRow[]): GroupedLancRow[] {
  const groups = new Map<
    string,
    { base: string; m: number; parcelas: LancRow[]; nome: string | null; cat: string | null }
  >();
  const singles: LancRow[] = [];
  const singleIndex = new Map<LancRow, number>();

  rows.forEach((r, idx) => {
    const parsed = parseParcela(r.descricao);
    if (!parsed) {
      singleIndex.set(r, idx);
      singles.push(r);
      return;
    }
    const valorAbs = Math.round(Math.abs(r.valor));
    const chave = `${norm(r.nome ?? "")}||${norm(parsed.base)}||${valorAbs}||${parsed.m}`;
    const cur = groups.get(chave);
    if (cur) {
      cur.parcelas.push(r);
    } else {
      groups.set(chave, {
        base: parsed.base,
        m: parsed.m,
        parcelas: [r],
        nome: r.nome,
        cat: r.categoria_external_id,
      });
    }
  });

  const result: GroupedLancRow[] = [];

  // Grupos que só têm 1 parcela (não faz sentido agrupar) viram single.
  groups.forEach((g, chave) => {
    if (g.parcelas.length < 2) {
      const only = g.parcelas[0];
      singleIndex.set(only, rows.indexOf(only));
      singles.push(only);
      return;
    }
    const parcelasOrd = [...g.parcelas].sort((a, b) =>
      (a.data ?? "").localeCompare(b.data ?? ""),
    );
    const valor = parcelasOrd.reduce((s, p) => s + p.valor, 0);
    result.push({
      kind: "group",
      chave,
      descricaoBase: g.base,
      totalParcelas: g.m,
      parcelas: parcelasOrd,
      nome: g.nome,
      dataInicio: parcelasOrd[0]?.data ?? null,
      dataFim: parcelasOrd[parcelasOrd.length - 1]?.data ?? null,
      valor,
      categoria_external_id: g.cat,
      pagas: parcelasOrd.length,
    });
  });

  singles.forEach((s) => {
    result.push({ kind: "single", ...s });
  });

  // Ordena mantendo o "primeiro visto" para grupos, e a data original para singles.
  return result.sort((a, b) => {
    const da = a.kind === "group" ? a.dataInicio ?? "" : a.data ?? "";
    const db = b.kind === "group" ? b.dataInicio ?? "" : b.data ?? "";
    return da.localeCompare(db);
  });
}
