export type CompraStatus =
  | "solicitacao"
  | "analise"
  | "negada"
  | "pendente_aprovacao"
  | "aprovada"
  | "em_andamento"
  | "a_receber"
  | "finalizado";

export const COMPRA_STATUSES: { key: CompraStatus; label: string; color: string }[] = [
  { key: "solicitacao", label: "Solicitação de Compra", color: "bg-slate-500" },
  { key: "analise", label: "Análise de Compra", color: "bg-blue-500" },
  { key: "pendente_aprovacao", label: "Pendente Aprovação", color: "bg-amber-500" },
  { key: "aprovada", label: "Compras Aprovada", color: "bg-emerald-500" },
  { key: "em_andamento", label: "Compra Em Andamento", color: "bg-indigo-500" },
  { key: "a_receber", label: "Compras a Receber", color: "bg-cyan-500" },
  { key: "finalizado", label: "Finalizado", color: "bg-success" },
  { key: "negada", label: "Compras Negada", color: "bg-destructive" },
];

export const TIPO_COMPRA_OPTIONS = [
  { value: "mercadoria", label: "Mercadoria" },
  { value: "imobilizado", label: "Imobilizado" },
  { value: "servico", label: "Serviço" },
  { value: "administrativo", label: "Administrativo" },
] as const;

export type TipoCompra = typeof TIPO_COMPRA_OPTIONS[number]["value"];

export const STATUS_LABEL: Record<CompraStatus, string> = COMPRA_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<CompraStatus, string>,
);

export function canMoveCompra(
  compra: { responsavel_id?: string | null },
  userId: string | undefined | null,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (!compra.responsavel_id) return true;
  return !!userId && compra.responsavel_id === userId;
}

export function moveBlockedMessage(compra: { responsavel_nome?: string | null }): string {
  return compra.responsavel_nome
    ? `Apenas ${compra.responsavel_nome} pode mover este card.`
    : "Você não tem permissão para mover este card.";
}
