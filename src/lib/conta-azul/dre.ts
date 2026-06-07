// Estrutura oficial do DRE (de Estrutura.xlsx) + mapeamento por prefixo do plano de contas.

export type DreGroupId =
  | "RB" | "DR" | "RL"
  | "AC" | "DM" | "DC" | "RV"
  | "CV" | "CD" | "CI" | "RO"
  | "DS" | "DA" | "DT" | "RG"
  | "RF_REC" | "DF" | "RF_TOT"
  | "OE" | "OS" | "RNO"
  | "RN"
  | "IN" | "LU"
  | "SC";

export type DreLine = {
  id: DreGroupId;
  label: string;
  /** "sum" = soma das contas com esse prefixo; "calc" = subtotal calculado */
  kind: "sum" | "calc";
  /** sinal aplicado ao valor das contas ao somar no resultado (+1 receita, -1 despesa). Ignorado para "calc". */
  sign: 1 | -1;
  /** prefixo(s) do plano de contas que entram nesta linha. */
  prefixes?: string[];
  /** fórmula para subtotais (ids de outras linhas a somar). */
  formula?: DreGroupId[];
};

export const DRE_STRUCTURE: DreLine[] = [
  { id: "RB", label: "(+) Receita Bruta", kind: "sum", sign: 1, prefixes: ["RB"] },
  { id: "DR", label: "(-) Deduções da Receita", kind: "sum", sign: -1, prefixes: ["DR"] },
  { id: "RL", label: "(=) Receita Líquida", kind: "calc", sign: 1, formula: ["RB", "DR"] },

  { id: "AC", label: "(-) Aquisição de Clientes", kind: "sum", sign: -1, prefixes: ["AC"] },
  { id: "DM", label: "(-) Despesas com Marketing", kind: "sum", sign: -1, prefixes: ["DM"] },
  { id: "DC", label: "(-) Despesas Comerciais", kind: "sum", sign: -1, prefixes: ["DC"] },
  { id: "RV", label: "(=) Resultado de Venda", kind: "calc", sign: 1, formula: ["RL", "AC", "DM", "DC"] },

  { id: "CV", label: "(-) Custos Variáveis", kind: "sum", sign: -1, prefixes: ["CV"] },
  { id: "CD", label: "(-) Custos Diretos", kind: "sum", sign: -1, prefixes: ["CD"] },
  { id: "CI", label: "(-) Custos Indiretos", kind: "sum", sign: -1, prefixes: ["CI"] },
  { id: "RO", label: "(=) Resultado da Operação", kind: "calc", sign: 1, formula: ["RV", "CV", "CD", "CI"] },

  { id: "DS", label: "(-) Despesas com Sócio", kind: "sum", sign: -1, prefixes: ["DS"] },
  { id: "DA", label: "(-) Despesas Administrativas", kind: "sum", sign: -1, prefixes: ["DA"] },
  { id: "DT", label: "(-) Despesas Tributárias", kind: "sum", sign: -1, prefixes: ["DT"] },
  { id: "RG", label: "(=) Resultado Gerencial", kind: "calc", sign: 1, formula: ["RO", "DS", "DA", "DT"] },

  { id: "RF_REC", label: "(+) Receitas Financeiras", kind: "sum", sign: 1, prefixes: ["RF"] },
  { id: "DF", label: "(-) Despesas Financeiras", kind: "sum", sign: -1, prefixes: ["DF"] },
  { id: "RF_TOT", label: "(=) Resultado Financeiro", kind: "calc", sign: 1, formula: ["RF_REC", "DF"] },

  { id: "OE", label: "(+) Outras Entradas", kind: "sum", sign: 1, prefixes: ["OE"] },
  { id: "OS", label: "(-) Outras Saídas", kind: "sum", sign: -1, prefixes: ["OS"] },
  { id: "RNO", label: "(=) Resultado Não Operacional", kind: "calc", sign: 1, formula: ["OE", "OS"] },

  { id: "RN", label: "(=) Resultado do Negócio", kind: "calc", sign: 1, formula: ["RG", "RF_TOT", "RNO"] },

  { id: "IN", label: "(-) Investimentos", kind: "sum", sign: -1, prefixes: ["IV"] },
  { id: "LU", label: "(=) Lucro", kind: "calc", sign: 1, formula: ["RN", "IN"] },
];

const PREFIX_INDEX: Record<string, DreGroupId> = (() => {
  const m: Record<string, DreGroupId> = {};
  DRE_STRUCTURE.forEach((l) => l.prefixes?.forEach((p) => (m[p] = l.id)));
  return m;
})();

/** Constrói um índice prefixo → grupo a partir de uma estrutura DRE arbitrária (ex.: vinda do banco). */
export function buildPrefixIndex(estrutura: DreLine[]): Record<string, DreGroupId> {
  const m: Record<string, DreGroupId> = {};
  estrutura.forEach((l) => l.prefixes?.forEach((p) => (m[p] = l.id)));
  return m;
}

/** Extrai o grupo do DRE a partir do prefixo do nome do plano de contas ("XX - Nome").
 * Retorna null quando não há prefixo reconhecido — o lançamento deve ser ignorado. */
export function grupoDoPlanoNome(
  nome: string | null | undefined,
  prefixIndex: Record<string, DreGroupId> = PREFIX_INDEX,
): DreGroupId | null {
  if (!nome) return null;
  const match = nome.trim().match(/^([A-Z]{2,3})\s*-/);
  if (!match) return null;
  return prefixIndex[match[1]] ?? null;
}


export type ContaRow = {
  valor: number | string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
  categoria_external_id: string | null;
  centro_custo_external_id?: string | null;
  descricao?: string | null;
};

export type PlanoMin = { external_id: string; nome: string };

export type Visao = "realizado" | "projetado";

export type MontarDreOpts = {
  ano: number;
  /** 0 = ano todo */
  mes: number;
  visao: Visao;
  centroCustoId?: string;
};

export type DreRowOut = {
  id: DreGroupId | string;
  label: string;
  valor: number;
  pct: number;
  kind: "header" | "detail" | "calc";
  indent?: number;
};

function inPeriodoStr(date: string | null, ano: number, mes: number): boolean {
  if (!date) return false;
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  if (y !== ano) return false;
  if (mes > 0 && m !== mes) return false;
  return true;
}

function passaVisao(row: ContaRow, visao: Visao, ano: number, mes: number): boolean {
  if (visao === "realizado") {
    // Já pago (caixa efetivo) — usa data de pagamento; se ausente, cai para vencimento.
    if (row.status !== "pago") return false;
    const data = row.data_pagamento ?? row.data_vencimento;
    return inPeriodoStr(data, ano, mes);
  }
  // Projetado: ainda não pago (em aberto ou atrasado) — usa data de vencimento
  if (row.status === "pago") return false;
  return inPeriodoStr(row.data_vencimento, ano, mes);
}




const TRANSFER_DESC_PATTERNS: RegExp[] = [
  /^\s*transfer[eê]ncia\s+entre\s+(contas|empresas|bancos)/i,
  /^\s*transfer[eê]ncia\s+banc[aá]ria/i,
  /^\s*ajuste\s+de\s+saldo/i,
  /^\s*saldo\s+inicial/i,
  /^\s*aplica[cç][aã]o\s+(financeira|cdb|autom[aá]tica)/i,
  /^\s*resgate\s+de\s+aplica[cç][aã]o/i,
];

export function isTransferencia(planoNome: string | undefined | null, descricao?: string | null): boolean {
  if (planoNome) {
    const n = planoNome.toLowerCase();
    if (n.includes("transferência") || n.includes("transferencia") || n.includes("saldo conta") || n.includes("saldo inicial")) return true;
  }
  if (descricao && TRANSFER_DESC_PATTERNS.some((re) => re.test(descricao))) return true;
  return false;
}

export function montarDRE(
  pagar: ContaRow[],
  receber: ContaRow[],
  planos: PlanoMin[],
  opts: MontarDreOpts,
  estrutura: DreLine[] = DRE_STRUCTURE,
): { linhas: DreRowOut[]; totais: Partial<Record<DreGroupId, number>> } {
  const planoMap = new Map<string, PlanoMin>();
  planos.forEach((p) => planoMap.set(p.external_id, p));
  const prefixIndex = buildPrefixIndex(estrutura);

  // soma por (grupo, categoria_external_id)
  const detPorGrupo = new Map<DreGroupId, Map<string, number>>();
  const totalPorGrupo = new Map<DreGroupId, number>();

  const acumula = (rows: ContaRow[]) => {
    rows.forEach((c) => {
      if (opts.centroCustoId && c.centro_custo_external_id !== opts.centroCustoId) return;
      if (!passaVisao(c, opts.visao, opts.ano, opts.mes)) return;
      const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
      if (isTransferencia(plano?.nome, c.descricao)) return;
      const grupo = grupoDoPlanoNome(plano?.nome, prefixIndex);
      if (!grupo) return;
      const v = Math.abs(Number(c.valor || 0));
      const det = detPorGrupo.get(grupo) ?? new Map<string, number>();
      const k = c.categoria_external_id ?? "_";
      det.set(k, (det.get(k) ?? 0) + v);
      detPorGrupo.set(grupo, det);
      totalPorGrupo.set(grupo, (totalPorGrupo.get(grupo) ?? 0) + v);
    });
  };
  acumula(pagar);
  acumula(receber);

  // calcula subtotais
  const valorLinha = new Map<DreGroupId, number>();
  const getVal = (id: DreGroupId): number => {
    if (valorLinha.has(id)) return valorLinha.get(id)!;
    const line = estrutura.find((l) => l.id === id);
    if (!line) { valorLinha.set(id, 0); return 0; }
    let v = 0;
    if (line.kind === "sum") {
      v = (totalPorGrupo.get(id) ?? 0) * line.sign;
    } else if (line.formula) {
      v = line.formula.reduce((s, f) => s + getVal(f), 0);
    }
    valorLinha.set(id, v);
    return v;
  };
  estrutura.forEach((l) => getVal(l.id));

  const rb = valorLinha.get("RB") ?? 0;
  const pct = (v: number) => (rb > 0 ? v / rb : 0);

  const linhas: DreRowOut[] = [];
  estrutura.forEach((line) => {
    const v = valorLinha.get(line.id) ?? 0;
    linhas.push({
      id: line.id,
      label: line.label,
      valor: v,
      pct: pct(v),
      kind: line.kind === "calc" ? "calc" : "header",
    });
    if (line.kind === "sum") {
      const det = detPorGrupo.get(line.id);
      if (det) {
        Array.from(det.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([catId, valor]) => {
            const nome = planoMap.get(catId)?.nome ?? "Sem categoria";
            const signed = valor * line.sign;
            linhas.push({
              id: `${line.id}:${catId}`,
              label: `    ${nome}`,
              valor: signed,
              pct: pct(signed),
              kind: "detail",
              indent: 1,
            });
          });
      }
    }
  });

  const totais: Partial<Record<DreGroupId, number>> = {};
  valorLinha.forEach((v, k) => (totais[k] = v));
  return { linhas, totais };
}

/** Soma do extrato (caixa) excluindo transferências. */
export function totaisExtrato(
  extrato: { data: string | null; valor: number | string | null; categoria_external_id: string | null; descricao: string | null }[],
  planos: PlanoMin[],
  ano: number,
  mes: number,
): { receitas: number; despesas: number } {
  const planoMap = new Map<string, PlanoMin>();
  planos.forEach((p) => planoMap.set(p.external_id, p));
  let rec = 0;
  let des = 0;
  extrato.forEach((e) => {
    if (!inPeriodoStr(e.data, ano, mes)) return;
    const plano = e.categoria_external_id ? planoMap.get(e.categoria_external_id) : undefined;
    if (isTransferencia(plano?.nome, e.descricao)) return;
    const v = Number(e.valor || 0);
    if (v >= 0) rec += v;
    else des += -v;
  });
  return { receitas: rec, despesas: des };
}

/** Retorna os lançamentos identificados como transferências bancárias (auditoria). */
export function transferenciasNoPeriodo(
  pagar: ContaRow[],
  receber: ContaRow[],
  planos: PlanoMin[],
  opts: MontarDreOpts,
): { count: number; total: number; itens: { data: string | null; descricao: string | null; nome: string | null; valor: number; origem: "pagar" | "receber" }[] } {
  const planoMap = new Map<string, PlanoMin>();
  planos.forEach((p) => planoMap.set(p.external_id, p));
  const itens: { data: string | null; descricao: string | null; nome: string | null; valor: number; origem: "pagar" | "receber" }[] = [];
  const consider = (rows: ContaRow[], origem: "pagar" | "receber") => {
    rows.forEach((c: any) => {
      if (opts.centroCustoId && c.centro_custo_external_id !== opts.centroCustoId) return;
      if (!passaVisao(c, opts.visao, opts.ano, opts.mes)) return;
      const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
      if (!isTransferencia(plano?.nome, c.descricao)) return;
      const data = opts.visao === "realizado" ? (c.data_pagamento ?? c.data_vencimento) : c.data_vencimento;
      const nome = origem === "pagar" ? (c.fornecedor_nome ?? null) : (c.cliente_nome ?? null);
      itens.push({ data, descricao: c.descricao ?? null, nome, valor: Math.abs(Number(c.valor || 0)), origem });
    });
  };
  consider(pagar, "pagar");
  consider(receber, "receber");
  const total = itens.reduce((s, x) => s + x.valor, 0);
  return { count: itens.length, total, itens: itens.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")) };
}
