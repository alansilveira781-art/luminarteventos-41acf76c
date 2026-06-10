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
  ano: new Date().getFullYear(),
  mes: "Todos",
  trimestre: "Todos",
  consultor: "Todos",
  classificacao: "Todos",
};

const norm = (s: string | null) => (s ?? "").toString().trim();

export function applyFilters(rows: VendaRow[], f: Filtros): VendaRow[] {
  const mesAlvo = f.mes === "Todos" ? null : String(f.mes).toLowerCase();
  return rows.filter((r) => {
    if (f.empresa !== "Todos" && norm(r.empresa) !== f.empresa) return false;
    if (f.ano !== "Todos" && r.anoEvento !== f.ano && r.ano !== f.ano) return false;
    if (mesAlvo) {
      const mes1 = norm(r.mes).toLowerCase();
      const mes2 = norm(r.mesEvento).toLowerCase();
      if (mes1 !== mesAlvo && mes2 !== mesAlvo) return false;
    }
    if (f.trimestre !== "Todos" && r.trimestreEvento !== f.trimestre) return false;
    if (f.consultor !== "Todos" && norm(r.consultor) !== f.consultor) return false;
    if (f.classificacao !== "Todos" && norm(r.classificacao) !== f.classificacao) return false;
    return true;
  });
}

export function previousPeriod(rows: VendaRow[], f: Filtros): VendaRow[] {
  // periodo anterior = ano - 1 (mesmos demais filtros)
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

function sumValor(rows: VendaRow[]) {
  return rows.reduce((s, r) => s + (r.valorFinal || 0), 0);
}
function sumDesc(rows: VendaRow[]) {
  return rows.reduce((s, r) => s + (r.desconto || 0), 0);
}
function sumQtde(rows: VendaRow[]) {
  return rows.reduce((s, r) => s + (r.quantidade || 0), 0);
}
function pct(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function kpis(curr: VendaRow[], prev: VendaRow[]): Kpis {
  const v = sumValor(curr);
  const q = sumQtde(curr);
  const d = sumDesc(curr);
  const t = q ? v / q : 0;
  const vp = sumValor(prev);
  const qp = sumQtde(prev);
  const dp = sumDesc(prev);
  const tp = qp ? vp / qp : 0;
  return {
    vendasTotais: v,
    quantidade: q,
    desconto: d,
    ticketMedio: t,
    vendasAnterior: vp,
    quantidadeAnterior: qp,
    descontoAnterior: dp,
    ticketAnterior: tp,
    pctVendas: pct(v, vp),
    pctQuantidade: pct(q, qp),
    pctDesconto: pct(d, dp),
    pctTicket: pct(t, tp),
  };
}

// ---------- Séries ----------
export function evolucaoTrimestre(rows: VendaRow[]) {
  const buckets: Record<number, { valor: number; qtde: number }> = { 1: { valor: 0, qtde: 0 }, 2: { valor: 0, qtde: 0 }, 3: { valor: 0, qtde: 0 }, 4: { valor: 0, qtde: 0 } };
  for (const r of rows) {
    const t = r.trimestreEvento;
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

function rankBy(rows: VendaRow[], key: (r: VendaRow) => string | null, agg: (r: VendaRow) => number = (r) => r.valorFinal || 0) {
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
export const rankingCerimonial = (rows: VendaRow[]) => rankBy(rows, (r) => r.cerimonial);
export const rankingDecorador = (rows: VendaRow[]) => rankBy(rows, (r) => r.decorador);
export const vendasPorTipoEvento = (rows: VendaRow[]) => rankBy(rows, (r) => r.classificacao);

export function comissoesPorVendedor(rows: VendaRow[]) {
  // Soma de Valor BV (representa pagamento de comissão na planilha)
  return rankBy(rows, (r) => r.consultor, (r) => r.valorBV || 0);
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
    rowsA,
    rowsB,
    kpisA: kA,
    kpisB: kB,
    serie,
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

// ---------- Helpers de domínio (listas únicas para filtros) ----------
export function uniqueValues(rows: VendaRow[], get: (r: VendaRow) => string | number | null) {
  const s = new Set<string | number>();
  for (const r of rows) {
    const v = get(r);
    if (v !== null && v !== undefined && v !== "") s.add(v as string | number);
  }
  return [...s];
}
