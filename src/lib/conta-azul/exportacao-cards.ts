/**
 * Montagem das linhas de importação do Conta Azul a partir dos cards de
 * Compras e Despesas (planilha modelo de importação).
 *
 * Colunas do modelo:
 * Data de Competência · Data de Vencimento · Data de Pagamento · Valor ·
 * Categoria · Descrição · Cliente/Fornecedor · CNPJ/CPF Cliente/Fornecedor ·
 * Centro de Custo · Observações
 */

export const CA_EXPORT_HEADERS = [
  "Data de Competência",
  "Data de Vencimento",
  "Data de Pagamento",
  "Valor",
  "Categoria",
  "Descrição",
  "Cliente/Fornecedor",
  "CNPJ/CPF Cliente/Fornecedor",
  "Centro de Custo",
] as const;

export type PagamentoMin = {
  forma: string | null;
  parcelamento: string | null;
  valor: number | null;
  data_pagamento: string | null;
  pago: boolean | null;
  pago_em: string | null;
  ordem: number | null;
};

export type CardMin = {
  tipo: "COMPRA" | "DESPESA";
  id: string;
  numero: number | null;
  titulo: string | null;
  fornecedor: string | null;
  documento: string | null;
  observacoes: string | null;
  evento_projeto: string | null;
  valor_total: number | null;
  data_compra: string | null;
  data_solicitacao: string | null;
  created_at: string | null;
  categoria: string | null;
  pagamentos: PagamentoMin[];
};

export type LinhaExport = {
  cardKey: string;
  cardId: string;
  tipo: "COMPRA" | "DESPESA";
  competencia: string | null;
  vencimento: string | null;
  pagamento: string | null;
  valor: number;
  categoria: string | null;
  descricao: string;
  fornecedor: string;
  documento: string;
  centroCusto: string;
  observacoes: string;
  parcelaLabel: string;
};

/** Caracteres proibidos pelas orientações da planilha do Conta Azul. */
export function limparTexto(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/['"!@#%¨&*()ªº§+_?°[\]{}:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Soma dias a uma data YYYY-MM-DD sem sofrer com fuso. */
export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia; se o mês não tiver o dia, usa o último dia dele. */
export function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const alvo = new Date(Date.UTC(y, (m || 1) - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d || 1, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Formas de pagamento em cartão de crédito (vencem no mês seguinte). */
export function ehCartaoCredito(forma: string | null | undefined): boolean {
  return normForma(forma).includes("cartao");
}


export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Número de parcelas a partir de textos como "3x", "3 vezes", "À vista". */
export function parcelasDeTexto(txt: string | null | undefined): number {
  const norm = String(txt ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!norm.trim() || norm.includes("vista")) return 1;
  const m = norm.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function distribuir(total: number, n: number): number[] {
  const t = Math.round(Number(total || 0) * 100);
  const base = Math.floor(t / n);
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] += t - base * n;
  return arr.map((c) => c / 100);
}

export const normForma = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function dataBase(card: CardMin): string | null {
  const v = card.data_compra ?? card.data_solicitacao ?? card.created_at ?? null;
  return v ? String(v).slice(0, 10) : null;
}

/**
 * Gera as linhas do card. Cada forma de pagamento vira 1..N linhas (uma por
 * parcela). Quando a parcela não tem data informada, o vencimento é calculado
 * a partir da data da compra com intervalos de 30 dias.
 * Cards sem nenhuma linha de pagamento geram uma única linha pelo valor total.
 */
export function linhasDoCard(card: CardMin, filtroForma?: (forma: string | null) => boolean): LinhaExport[] {
  const competencia = dataBase(card);
  const idLabel = `${card.tipo}-${card.numero ?? "?"}`;
  const descricao = limparTexto([card.titulo, idLabel].filter(Boolean).join(" - "));
  const fornecedor = limparTexto(card.fornecedor);
  const documento = String(card.documento ?? "").replace(/[^\d]/g, "");
  const centroCusto = limparTexto(card.evento_projeto);
  const observacoes = limparTexto(card.observacoes);

  const base = {
    cardKey: `${card.tipo}-${card.id}`,
    cardId: card.id,
    tipo: card.tipo,
    competencia,
    categoria: card.categoria,
    descricao,
    fornecedor,
    documento,
    centroCusto,
    observacoes,
  };

  const pags = [...(card.pagamentos ?? [])]
    .filter((p) => !filtroForma || filtroForma(p.forma))
    .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));

  if (pags.length === 0) {
    if (filtroForma && !filtroForma(null)) return [];
    return [
      {
        ...base,
        vencimento: competencia,
        pagamento: null,
        valor: -Math.abs(Number(card.valor_total ?? 0)),
        parcelaLabel: "1/1",
      },
    ];
  }

  // Formas com parcelamento gravado como uma linha só (ex.: "Cartão Final 1713" 3x)
  // são expandidas em parcelas de 30 em 30 dias a partir da data da compra.
  const out: LinhaExport[] = [];
  for (const p of pags) {
    const n = parcelasDeTexto(p.parcelamento);
    const jaExpandida = pags.filter(
      (o) => normForma(o.forma) === normForma(p.forma) && (o.parcelamento ?? "") === (p.parcelamento ?? ""),
    ).length;
    const expandir = n > 1 && jaExpandida < n;
    const cartao = ehCartaoCredito(p.forma);
    const valores = expandir ? distribuir(Number(p.valor ?? 0), n) : [Number(p.valor ?? 0)];
    valores.forEach((v, i) => {
      const idx = expandir ? i : indiceParcela(pags, p);
      // Cartão de crédito: a fatura vence sempre no mês seguinte à compra —
      // 1ª parcela +1 mês, 2ª +2 meses, e assim por diante (inclusive à vista).
      const venc = cartao
        ? competencia
          ? somarMeses(competencia, idx + 1)
          : null
        : expandir
          ? competencia
            ? somarDias(competencia, 30 * i)
            : null
          : (p.data_pagamento ? String(p.data_pagamento).slice(0, 10) : null)
            ?? (competencia ? somarDias(competencia, 30 * idx) : null);
      out.push({
        ...base,
        vencimento: venc,
        pagamento: !expandir && p.pago ? String(p.pago_em ?? p.data_pagamento ?? venc ?? "").slice(0, 10) || null : null,
        valor: -Math.abs(Number(v || 0)),
        parcelaLabel: expandir ? `${i + 1}/${n}` : n > 1 ? `${idx + 1}/${n}` : "1/1",
      });
    });
  }
  return out;
}


/** Posição da linha entre as parcelas da mesma forma/parcelamento. */
function indiceParcela(pags: PagamentoMin[], p: PagamentoMin): number {
  const iguais = pags.filter(
    (o) => normForma(o.forma) === normForma(p.forma) && (o.parcelamento ?? "") === (p.parcelamento ?? ""),
  );
  const i = iguais.indexOf(p);
  return i < 0 ? 0 : i;
}

export function linhaParaPlanilha(l: LinhaExport): (string | number)[] {
  return [
    formatarDataBR(l.competencia),
    formatarDataBR(l.vencimento),
    formatarDataBR(l.pagamento),
    Number(l.valor.toFixed(2)),
    limparTexto(l.categoria),
    l.descricao,
    l.fornecedor,
    l.documento,
    l.centroCusto,
  ];
}
