import type { VendaRow } from "./vendas.functions";

export type Filtros = {
  empresa: string | "Todos";
  ano: number | "Todos";
  mes: string | "Todos";
  trimestre: 1 | 2 | 3 | 4 | "Todos";
  consultor: string | "Todos";
  classificacao: string | "Todos";
};

export const filtrosIniciais: Filtros = {
  empresa: "Todos",
  ano: "Todos",
  mes: "Todos",
  trimestre: "Todos",
  consultor: "Todos",
  classificacao: "Todos",
};

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const norm = (s: string | null) => (s ?? "").toString().trim();

// Trata "-", "—", "N/A", "" e nulos como vazio (lixo de importação)
const GARBAGE_TEXT = new Set(["", "-", "—", "--", "n/a", "na", "null", "none", "sem"]);
export function cleanText(v: string | null | undefined): string {
  const s = norm(v ?? null).toLowerCase();
  if (GARBAGE_TEXT.has(s)) return "";
  return norm(v ?? null);
}

const MAX_VALID_YEAR = new Date().getFullYear() + 5;
function validYear(y: number | null | undefined): number | null {
  if (y == null) return null;
  const n = Number(y);
  return Number.isFinite(n) && n > 1900 && n <= MAX_VALID_YEAR ? n : null;
}

function pickDateIso(r: VendaRow): string | null {
  // Régua fixa: sempre data de registro/fechamento; evento só como fallback.
  return r.dataRegistro || r.dataEvento || null;
}
function parseMonth(iso: string | null): number | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null;
}
function parseYear(iso: string | null): number | null {
  if (!iso) return null;
  return validYear(Number(iso.slice(0, 4)));
}

// Derivation helpers — sempre pela data de registro
export function getAno(r: VendaRow): number | null {
  return parseYear(pickDateIso(r));
}
export function getMes(r: VendaRow): string | null {
  const m = parseMonth(pickDateIso(r));
  return m ? MESES_PT[m - 1] : null;
}
export function getTrimestre(r: VendaRow): 1 | 2 | 3 | 4 | null {
  const m = parseMonth(pickDateIso(r));
  if (!m) return null;
  return (Math.ceil(m / 3) as 1 | 2 | 3 | 4);
}

export function applyFilters(rows: VendaRow[], f: Filtros): VendaRow[] {
  const mesAlvo = f.mes === "Todos" ? null : String(f.mes).toLowerCase();
  return rows.filter((r) => {
    if (f.empresa !== "Todos" && cleanText(r.empresa) !== f.empresa) return false;
    if (f.ano !== "Todos") {
      const ano = getAno(r);
      if (ano !== f.ano) return false;
    }
    if (mesAlvo) {
      const mes = (getMes(r) ?? "").toLowerCase();
      if (mes !== mesAlvo) return false;
    }
    if (f.trimestre !== "Todos" && getTrimestre(r) !== f.trimestre) return false;
    if (f.consultor !== "Todos" && cleanText(r.consultor) !== f.consultor) return false;
    if (f.classificacao !== "Todos" && cleanText(r.classificacao) !== f.classificacao) return false;
    return true;
  });
}

export function previousPeriod(rows: VendaRow[], f: Filtros): VendaRow[] {
  if (f.ano === "Todos") return [];
  const prev: Filtros = { ...f, ano: (f.ano as number) - 1 };
  return applyFilters(rows, prev);
}

// ---------- KPIs ----------
export type Kpis = {
  vendasTotais: number;
  quantidade: number;
  desconto: number;
  ticketMedio: number;
  vendasAnterior: number;
  quantidadeAnterior: number;
  descontoAnterior: number;
  ticketAnterior: number;
  pctVendas: number;
  pctQuantidade: number;
  pctDesconto: number;
  pctTicket: number;
};

const sumValor = (rows: VendaRow[]) => rows.reduce((s, r) => s + (r.valorFinal || 0), 0);
const sumDesc = (rows: VendaRow[]) => rows.reduce((s, r) => s + (r.desconto || 0), 0);
function pct(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function kpis(curr: VendaRow[], prev: VendaRow[]): Kpis {
  const v = sumValor(curr);
  const q = curr.length;
  const d = sumDesc(curr);
  const t = q ? v / q : 0;
  const vp = sumValor(prev);
  const qp = prev.length;
  const dp = sumDesc(prev);
  const tp = qp ? vp / qp : 0;
  return {
    vendasTotais: v, quantidade: q, desconto: d, ticketMedio: t,
    vendasAnterior: vp, quantidadeAnterior: qp, descontoAnterior: dp, ticketAnterior: tp,
    pctVendas: pct(v, vp), pctQuantidade: pct(q, qp), pctDesconto: pct(d, dp), pctTicket: pct(t, tp),
  };
}

// Totals helpers (BV / Comissão)
export const totalBV = (rows: VendaRow[]) => rows.reduce((s, r) => s + (r.valorBV || 0), 0);
export const totalComissao = (rows: VendaRow[]) => rows.reduce((s, r) => s + (r.valorComissao || 0), 0);

// ---------- Séries ----------
export function evolucaoTrimestre(rows: VendaRow[]) {
  const buckets: Record<number, { valor: number; qtde: number }> = {
    1: { valor: 0, qtde: 0 }, 2: { valor: 0, qtde: 0 },
    3: { valor: 0, qtde: 0 }, 4: { valor: 0, qtde: 0 },
  };
  for (const r of rows) {
    const t = getTrimestre(r);
    if (!t) continue;
    buckets[t].valor += r.valorFinal || 0;
    buckets[t].qtde += r.quantidade || 0;
  }
  return [1, 2, 3, 4].map((t) => ({
    trim: `${t}º Trim`,
    valor: buckets[t].valor,
    qtde: buckets[t].qtde,
    ticket: buckets[t].qtde ? buckets[t].valor / buckets[t].qtde : 0,
  }));
}

function rankBy(
  rows: VendaRow[],
  key: (r: VendaRow) => string | null,
  agg: (r: VendaRow) => number = (r) => r.valorFinal || 0,
) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = (key(r) ?? "").trim();
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + agg(r));
  }
  return [...map.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export const rankingConsultor = (rows: VendaRow[]) => rankBy(rows, (r) => r.consultor);
export const valorPorClassificacao = (rows: VendaRow[]) => rankBy(rows, (r) => r.classificacao);
export function rankingCerimonial(rows: VendaRow[]): { nome: string; valor: number; bv: number }[] {
  const map = new Map<string, { valor: number; bv: number }>();
  for (const r of rows) {
    const k = (r.cerimonial ?? "").trim();
    if (!k) continue;
    const cur = map.get(k) ?? { valor: 0, bv: 0 };
    cur.valor += r.valorFinal || 0;
    cur.bv += r.valorBV || 0;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([nome, v]) => ({ nome, valor: v.valor, bv: v.bv }))
    .sort((a, b) => b.valor - a.valor);
}
export const vendasPorCerimonial = rankingCerimonial;
export const rankingDecorador = (rows: VendaRow[]) => rankBy(rows, (r) => r.decorador);
export const vendasPorDecorador = rankingDecorador;
export const vendasPorTipoEvento = (rows: VendaRow[]) =>
  rankBy(rows, (r) => r.tipoEvento || r.classificacao);

export function comissoesPorVendedor(rows: VendaRow[]) {
  // Soma de valor_comissao (comissão real da venda) por consultor
  return rankBy(rows, (r) => r.consultor, (r) => r.valorComissao || 0);
}

export function evolucaoTicketTrimestre(rows: VendaRow[]) {
  return evolucaoTrimestre(rows).map((b) => ({ trim: b.trim, ticket: b.ticket, qtde: b.qtde }));
}

export function realVsMeta(rows: VendaRow[], meta: number) {
  const realizado = sumValor(rows);
  return { realizado, meta, pct: meta > 0 ? (realizado / meta) * 100 : 0 };
}

// ---------- Indicadores: Ano A vs Ano B ----------
export function compararAnos(allRows: VendaRow[], anoA: number, anoB: number, baseFilters: Omit<Filtros, "ano">) {
  const fA: Filtros = { ...baseFilters, ano: anoA };
  const fB: Filtros = { ...baseFilters, ano: anoB };
  const rowsA = applyFilters(allRows, fA);
  const rowsB = applyFilters(allRows, fB);
  const kA = kpis(rowsA, []);
  const kB = kpis(rowsB, []);
  const evolA = evolucaoTrimestre(rowsA);
  const evolB = evolucaoTrimestre(rowsB);
  const serie = [0, 1, 2, 3].map((i) => ({
    trim: evolA[i].trim,
    anoA: evolA[i].valor,
    anoB: evolB[i].valor,
  }));
  return {
    rowsA, rowsB, kpisA: kA, kpisB: kB, serie,
    pizzaA: valorPorClassificacao(rowsA),
    pizzaB: valorPorClassificacao(rowsB),
    tabela: [
      { ind: "Vendas totais", a: kA.vendasTotais, b: kB.vendasTotais },
      { ind: "Qtde de vendas", a: kA.quantidade, b: kB.quantidade },
      { ind: "Ticket médio", a: kA.ticketMedio, b: kB.ticketMedio },
      { ind: "Desconto total", a: kA.desconto, b: kB.desconto },
    ].map((r) => ({ ...r, pct: pct(r.a, r.b) })),
  };
}

// ---------- Helpers de domínio ----------
export function uniqueValues(rows: VendaRow[], get: (r: VendaRow) => string | number | null) {
  const s = new Set<string | number>();
  for (const r of rows) {
    const v = get(r);
    if (v !== null && v !== undefined && v !== "") s.add(v as string | number);
  }
  return [...s];
}
