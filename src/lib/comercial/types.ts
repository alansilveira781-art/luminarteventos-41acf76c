export const CARD_STATUSES = [
  { key: "lead", label: "Lead", color: "bg-slate-400" },
  { key: "projeto", label: "Projeto", color: "bg-blue-500" },
  { key: "orcamento_enviado", label: "Orçamento Enviado", color: "bg-indigo-500" },
  { key: "negociacao", label: "Negociação", color: "bg-amber-500" },
  { key: "fechamento", label: "Fechamento", color: "bg-emerald-500" },
  { key: "perda", label: "Perda", color: "bg-rose-500" },
] as const;
export type CardStatus = (typeof CARD_STATUSES)[number]["key"];

export const TIPOS_EVENTO = ["Cenografia", "Casamento", "Corporativo", "Stand"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const CONSULTORES_PADRAO = ["Pádua Costa", "Romulo Manoel"] as const;

// ----- Catálogo de descrições -----
export type TipoMedida = "unidade" | "dimensional" | "area" | "linear";

export const TIPO_MEDIDA_LABEL: Record<TipoMedida, string> = {
  unidade: "Unidade (qtde × valor)",
  dimensional: "Dimensional (L × A × C × qtde)",
  area: "Área (L × C em m²)",
  linear: "Linear (metros)",
};

export type CatalogoDescricao = {
  id: string;
  nome: string;
  tipoMedida: TipoMedida;
  valorUnitario: number; // valor padrão; editável na proposta
  unidade?: string;      // rótulo livre só para tipo "unidade" (un, pç, kg, m³…)
  createdAt: string;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  createdAt: string;
};

export type ComercialCard = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  eventoNome: string;
  eventoDataInicio: string; // YYYY-MM-DD
  eventoDataFim: string;    // YYYY-MM-DD
  valorEstimado: number;
  status: CardStatus;
  responsavel: string; // consultor(a)
  observacoes: string;
  motivoPerda?: string;
  propostaId?: string | null;
  createdAt: string;
};

export type DescricaoItem = {
  id: string;
  catalogoId: string | null;
  descricao: string;
  tipoMedida: TipoMedida;
  unidade: string; // rótulo (un, pç…) — usado em tipoMedida=unidade
  largura?: number;
  altura?: number;
  comprimento?: number;
  quantidade: number;
  valorUnitario: number;
};

export type ItemAmbiente = {
  id: string;
  nome: string;
  descricoes: DescricaoItem[];
};

export type Ambiente = {
  id: string;
  nome: string;
  imagens: string[]; // data URLs
  itens: ItemAmbiente[];
};

export type CustoExtra = { descricao: string; valor: number };

export type PropostaStatus =
  | "aguardando_aprovacao"
  | "em_revisao"
  | "enviado"
  | "em_negociacao"
  | "fechado"
  | "perdido";

export type Proposta = {
  id: string;
  numero: number;
  cardId: string | null;
  clienteId: string;
  cliente: { nome: string; telefone: string; email: string };
  evento: {
    tipo: TipoEvento | "";
    dataInicio: string;
    dataFim: string;
    local: string;
    cidade: string;
    observacoes: string;
  };
  ambientes: Ambiente[];
  custos: { frete: number; montagem: number; desmontagem: number; outros: CustoExtra[] };
  resumo: { margem: number; validade: string };
  responsavel: string;
  status: PropostaStatus;
  createdAt: string;
  approvedAt?: string | null;
};

export const PROPOSTA_STATUS_LABEL: Record<PropostaStatus, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  em_revisao: "Em revisão",
  enviado: "Enviado",
  em_negociacao: "Em negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

// ----- Helpers de cálculo -----
const n = (x: any) => Number(x) || 0;

export function descricaoSubtotal(d: DescricaoItem) {
  const qtd = n(d.quantidade);
  const v = n(d.valorUnitario);
  const L = n(d.largura);
  const A = n(d.altura);
  const C = n(d.comprimento);
  switch (d.tipoMedida) {
    case "dimensional":
      return v * (L * A * C) * qtd;
    case "area":
      return v * (L * C) * qtd;
    case "linear":
      return v * C * qtd;
    case "unidade":
    default:
      return v * qtd;
  }
}

export function descricaoMedidaLabel(d: DescricaoItem): string {
  const L = n(d.largura), A = n(d.altura), C = n(d.comprimento), q = n(d.quantidade);
  const num = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  switch (d.tipoMedida) {
    case "dimensional":
      return `${num(L)} × ${num(A)} × ${num(C)} m × ${q} un`;
    case "area":
      return `${num(L)} × ${num(C)} m² × ${q}`;
    case "linear":
      return `${num(C)} m × ${q}`;
    case "unidade":
    default:
      return `${q} ${d.unidade || "un"}`;
  }
}

export function itemSubtotal(i: ItemAmbiente) {
  return i.descricoes.reduce((s, d) => s + descricaoSubtotal(d), 0);
}
export function ambienteSubtotal(a: Ambiente) {
  return a.itens.reduce((s, i) => s + itemSubtotal(i), 0);
}
export function propostaSubtotalAmbientes(p: Proposta) {
  return (p.ambientes || []).reduce((s, a) => s + ambienteSubtotal(a), 0);
}
export function propostaCustos(p: Proposta) {
  return (
    (p.custos.frete || 0) +
    (p.custos.montagem || 0) +
    (p.custos.desmontagem || 0) +
    (p.custos.outros || []).reduce((s, c) => s + (c.valor || 0), 0)
  );
}
export function propostaTotal(p: Proposta) {
  return propostaSubtotalAmbientes(p) + propostaCustos(p);
}
