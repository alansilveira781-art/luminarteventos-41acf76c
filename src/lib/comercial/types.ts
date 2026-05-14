export const CARD_STATUSES = [
  { key: "lead", label: "Lead", color: "bg-slate-400" },
  { key: "projeto", label: "Projeto", color: "bg-blue-500" },
  { key: "orcamento_enviado", label: "Orçamento Enviado", color: "bg-indigo-500" },
  { key: "negociacao", label: "Negociação", color: "bg-amber-500" },
  { key: "fechamento", label: "Fechamento", color: "bg-emerald-500" },
  { key: "perda", label: "Perda", color: "bg-rose-500" },
] as const;
export type CardStatus = (typeof CARD_STATUSES)[number]["key"];

export const TIPOS_EVENTO = ["Casamento", "Aniversário", "Corporativo", "Formatura", "Outro"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

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
  eventoData: string; // YYYY-MM-DD
  valorEstimado: number;
  status: CardStatus;
  responsavel: string;
  observacoes: string;
  motivoPerda?: string;
  propostaId?: string | null;
  createdAt: string;
};

export type ItemProposta = {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
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
    data: string;
    horarioInicio: string;
    horarioTermino: string;
    local: string;
    cidade: string;
    observacoes: string;
  };
  itens: ItemProposta[];
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
