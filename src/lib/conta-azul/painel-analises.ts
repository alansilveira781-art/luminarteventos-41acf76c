// Séries e textos automáticos do Painel Financeiro (Dashboard do Financeiro).
import type { DreGroupId } from "./dre";

export type Fatia = { catId: string; nome: string; valor: number };

const MESES_CURTOS = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmtPct1 = (n: number) =>
  `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Rótulo curto do período (ex.: "Ago/2026" ou "2026" quando mês = 0). */
export function labelPeriodo(ano: number, mes: number): string {
  return mes > 0 ? `${MESES_CURTOS[mes]}/${ano}` : String(ano);
}

/** Período imediatamente anterior (mês anterior; se mês = 0, ano anterior). */
export function periodoAnterior(ano: number, mes: number): { ano: number; mes: number } {
  if (mes <= 0) return { ano: ano - 1, mes: 0 };
  if (mes === 1) return { ano: ano - 1, mes: 12 };
  return { ano, mes: mes - 1 };
}

/** Converte o mapa de um grupo do DRE (catId → valor) em fatias ordenadas. */
export function fatiasDoGrupo(
  grupos: Map<DreGroupId, Map<string, number>>,
  grupo: DreGroupId,
  planoMap: Map<string, { nome: string }>,
): Fatia[] {
  const det = grupos.get(grupo);
  if (!det) return [];
  return Array.from(det.entries())
    .map(([catId, valor]) => ({
      catId,
      nome: planoMap.get(catId)?.nome ?? "Sem categoria",
      valor: Math.abs(valor),
    }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

/** Agrupa as fatias menores em "Outros" mantendo os `top` maiores. */
export function comOutros(fatias: Fatia[], top = 8): Fatia[] {
  if (fatias.length <= top) return fatias;
  const head = fatias.slice(0, top);
  const resto = fatias.slice(top).reduce((s, f) => s + f.valor, 0);
  if (resto > 0) head.push({ catId: "__outros", nome: "Outros", valor: resto });
  return head;
}

const variacao = (atual: number, ant: number): number | null =>
  ant > 0 ? (atual - ant) / ant : null;

function frasesVariacao(atual: number, ant: number, labelAnt: string): string {
  const v = variacao(atual, ant);
  if (v === null) return ant === 0 && atual > 0 ? `Não houve valor em ${labelAnt}.` : "";
  if (Math.abs(v) < 0.005) return `Praticamente estável em relação a ${labelAnt} (${fmtBRL(ant)}).`;
  const dir = v > 0 ? "acima" : "abaixo";
  return `${fmtPct1(Math.abs(v))} ${dir} de ${labelAnt} (${fmtBRL(ant)}).`;
}

function destaqueMovimento(atuais: Fatia[], anteriores: Fatia[]): string {
  const mapAnt = new Map(anteriores.map((f) => [f.catId, f.valor]));
  const mapAtual = new Map(atuais.map((f) => [f.catId, f.valor]));
  const chaves = new Set([...mapAnt.keys(), ...mapAtual.keys()]);
  let maiorAlta: { nome: string; delta: number } | null = null;
  let maiorQueda: { nome: string; delta: number } | null = null;
  chaves.forEach((k) => {
    const nome =
      atuais.find((f) => f.catId === k)?.nome ?? anteriores.find((f) => f.catId === k)?.nome ?? "";
    const delta = (mapAtual.get(k) ?? 0) - (mapAnt.get(k) ?? 0);
    if (delta > 0 && (!maiorAlta || delta > maiorAlta.delta)) maiorAlta = { nome, delta };
    if (delta < 0 && (!maiorQueda || delta < maiorQueda.delta)) maiorQueda = { nome, delta };
  });
  const partes: string[] = [];
  const alta = maiorAlta as { nome: string; delta: number } | null;
  const queda = maiorQueda as { nome: string; delta: number } | null;
  if (alta) partes.push(`maior alta em "${alta.nome}" (+${fmtBRL(alta.delta)})`);
  if (queda) partes.push(`maior queda em "${queda.nome}" (${fmtBRL(queda.delta)})`);
  return partes.length ? `Destaques: ${partes.join(" e ")}.` : "";
}

/** Texto automático da composição de receitas. */
export function textoReceitas(
  atuais: Fatia[],
  anteriores: Fatia[],
  ano: number,
  mes: number,
): string {
  const total = atuais.reduce((s, f) => s + f.valor, 0);
  const totalAnt = anteriores.reduce((s, f) => s + f.valor, 0);
  const labelAtual = labelPeriodo(ano, mes);
  const ant = periodoAnterior(ano, mes);
  const labelAnt = labelPeriodo(ant.ano, ant.mes);
  if (total <= 0) return `Sem receitas registradas em ${labelAtual}.`;
  const maior = atuais[0];
  const partes = [
    `Receita Bruta de ${fmtBRL(total)} em ${labelAtual}.`,
    frasesVariacao(total, totalAnt, labelAnt),
    maior
      ? `A maior contribuição veio de "${maior.nome}" (${fmtBRL(maior.valor)}, ${fmtPct1(maior.valor / total)} do total).`
      : "",
    destaqueMovimento(atuais, anteriores),
  ];
  return partes.filter(Boolean).join(" ");
}

/** Texto automático dos Custos Variáveis. */
export function textoCustosVariaveis(
  atuais: Fatia[],
  anteriores: Fatia[],
  receitaBruta: number,
  ano: number,
  mes: number,
): string {
  const total = atuais.reduce((s, f) => s + f.valor, 0);
  const totalAnt = anteriores.reduce((s, f) => s + f.valor, 0);
  const labelAtual = labelPeriodo(ano, mes);
  const ant = periodoAnterior(ano, mes);
  const labelAnt = labelPeriodo(ant.ano, ant.mes);
  if (total <= 0) return `Sem custos variáveis registrados em ${labelAtual}.`;
  const partes = [
    `Custos Variáveis de ${fmtBRL(total)} em ${labelAtual}${receitaBruta > 0 ? `, equivalentes a ${fmtPct1(total / receitaBruta)} da Receita Bruta` : ""}.`,
    frasesVariacao(total, totalAnt, labelAnt),
    atuais[0]
      ? `Maior item: "${atuais[0].nome}" (${fmtBRL(atuais[0].valor)}, ${fmtPct1(atuais[0].valor / total)} do CV).`
      : "",
    destaqueMovimento(atuais, anteriores),
  ];
  return partes.filter(Boolean).join(" ");
}

export type FaturamentoComparativo = {
  faturado: number;
  recebido: number;
  conversao: number | null;
  aReceber: number;
  qtdVendas: number;
  faturadoAnt: number;
  recebidoAnt: number;
  conversaoAnt: number | null;
};

/** Compara o faturamento das vendas (data de registro) com a receita recebida no mês. */
export function compararFaturamento(
  vendas: { dataRegistro: string | null; valorFinal: number }[],
  recebido: number,
  recebidoAnt: number,
  ano: number,
  mes: number,
): FaturamentoComparativo {
  const ant = periodoAnterior(ano, mes);
  const noPeriodo = (data: string | null, a: number, m: number) => {
    if (!data) return false;
    const y = Number(data.slice(0, 4));
    const mm = Number(data.slice(5, 7));
    if (y !== a) return false;
    return m > 0 ? mm === m : true;
  };
  let faturado = 0;
  let qtdVendas = 0;
  let faturadoAnt = 0;
  vendas.forEach((v) => {
    if (noPeriodo(v.dataRegistro, ano, mes)) {
      faturado += Number(v.valorFinal) || 0;
      qtdVendas += 1;
    } else if (noPeriodo(v.dataRegistro, ant.ano, ant.mes)) {
      faturadoAnt += Number(v.valorFinal) || 0;
    }
  });
  return {
    faturado,
    recebido,
    conversao: faturado > 0 ? recebido / faturado : null,
    aReceber: Math.max(0, faturado - recebido),
    qtdVendas,
    faturadoAnt,
    recebidoAnt,
    conversaoAnt: faturadoAnt > 0 ? recebidoAnt / faturadoAnt : null,
  };
}

/** Texto automático do bloco Faturamento x Recebimento. */
export function textoFaturamento(c: FaturamentoComparativo, ano: number, mes: number): string {
  const labelAtual = labelPeriodo(ano, mes);
  const ant = periodoAnterior(ano, mes);
  const labelAnt = labelPeriodo(ant.ano, ant.mes);
  if (c.faturado <= 0) return `Nenhuma venda registrada em ${labelAtual}.`;
  const partes = [
    `Foram ${c.qtdVendas} venda(s) registradas em ${labelAtual}, somando ${fmtBRL(c.faturado)}.`,
    `No mesmo período entraram ${fmtBRL(c.recebido)} em caixa` +
      (c.conversao !== null ? `, ou seja, ${fmtPct1(c.conversao)} do que foi vendido no mês ficou no próprio mês.` : "."),
    c.aReceber > 0 ? `Restam ${fmtBRL(c.aReceber)} previstos para os meses seguintes.` : "",
    c.conversaoAnt !== null && c.conversao !== null
      ? `Em ${labelAnt} a conversão em caixa foi de ${fmtPct1(c.conversaoAnt)} (faturamento de ${fmtBRL(c.faturadoAnt)}).`
      : "",
  ];
  return partes.filter(Boolean).join(" ");
}

// ---------- Custo de operação x Receita (série anual) ----------

export type DetalheGrupo = { id: DreGroupId; label: string; valor: number };

export type PontoCustoOperacao = {
  mes: number;
  label: string;
  receita: number;
  custoOperacao: number;
  /** custoOperacao / receita (null quando não há receita) */
  pct: number | null;
  /** Composição do custo de operação, grupo a grupo (mesmos rótulos do demonstrativo) */
  detalhe: DetalheGrupo[];
  /** Há saídas de caixa classificadas suficientes para calcular o percentual do mês. */
  completo: boolean;
};

type CalcDre = (ano: number, mes: number) => Partial<Record<DreGroupId, number>>;
type TemCobertura = (ano: number, mes: number) => boolean;

/** Composição gerencial acordada para o indicador de custo de operação. */
const COMPOSICAO_OPERACAO: { id: DreGroupId; label: string; grupos: DreGroupId[] }[] = [
  { id: "RV", label: "Potencial de Vendas", grupos: ["AC", "DM", "DC"] },
  { id: "RO", label: "Custos", grupos: ["CV", "CD", "CI"] },
  { id: "RG", label: "Despesas", grupos: ["DS", "DA", "DT", "DR", "DF"] },
];

/**
 * Série Jan..Dez do ano: Receita Bruta x custo gerencial para operar a empresa.
 * Investimentos, Outras Saídas e subtotais calculados não entram no indicador.
 */
export function serieCustoOperacao(ano: number, calc: CalcDre, temCobertura?: TemCobertura): PontoCustoOperacao[] {
  const out: PontoCustoOperacao[] = [];
  for (let m = 1; m <= 12; m++) {
    const t = calc(ano, m);
    const receita = t.RB ?? 0;
    const detalhe = COMPOSICAO_OPERACAO.map((g) => ({
      id: g.id,
      label: g.label,
      valor: g.grupos.reduce((s, id) => s + Math.abs(t[id] ?? 0), 0),
    })).filter((d) => d.valor > 0);
    const custoOperacao = detalhe.reduce((s, d) => s + d.valor, 0);
    const completo = receita > 0 && custoOperacao > 0 && (temCobertura?.(ano, m) ?? true);
    out.push({
      mes: m,
      label: MESES_CURTOS[m],
      receita,
      custoOperacao,
      pct: completo ? custoOperacao / receita : null,
      detalhe,
      completo,
    });
  }
  return out;
}


export type ResumoCustoOperacao = {
  media: number | null;
  meses: number;
  melhor: PontoCustoOperacao | null;
  pior: PontoCustoOperacao | null;
};

/** Percentual consolidado dos meses completos (exclui mês corrente, futuros e dados incompletos). */
export function mediaMesesCompletos(serie: PontoCustoOperacao[], ano: number): ResumoCustoOperacao {
  const hoje = new Date();
  const ultimoCompleto =
    ano < hoje.getFullYear() ? 12 : ano > hoje.getFullYear() ? 0 : hoje.getMonth(); // mês anterior ao corrente
  const validos = serie.filter((p) => p.mes <= ultimoCompleto && p.completo && p.pct !== null);
  if (validos.length === 0) return { media: null, meses: 0, melhor: null, pior: null };
  const receitaTotal = validos.reduce((s, p) => s + p.receita, 0);
  const custoTotal = validos.reduce((s, p) => s + p.custoOperacao, 0);
  const media = receitaTotal > 0 ? custoTotal / receitaTotal : null;
  const ord = [...validos].sort((a, b) => (a.pct as number) - (b.pct as number));
  return { media, meses: validos.length, melhor: ord[0], pior: ord[ord.length - 1] };
}
