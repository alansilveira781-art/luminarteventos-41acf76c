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
  { value: "servico", label: "Serviço" },
] as const;

export type TipoCompra = typeof TIPO_COMPRA_OPTIONS[number]["value"];

export const STATUS_LABEL: Record<CompraStatus, string> = COMPRA_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<CompraStatus, string>,
);

// Email do Pedro: pode editar qualquer card, mas só pode mover nestes pares (origem → destino)
export const PEDRO_EMAIL = "pedro123jrsergio@gmail.com";
export const PEDRO_ALLOWED_MOVES: Array<[CompraStatus, CompraStatus]> = [
  ["solicitacao", "analise"],
  ["analise", "pendente_aprovacao"],
];
const PEDRO_ALLOWED_SOURCES: CompraStatus[] = PEDRO_ALLOWED_MOVES.map(([from]) => from);

export const PEDRO_MOVE_BLOCKED_MSG =
  "Pedro só pode mover cards de Solicitação → Análise e de Análise → Pendente Aprovação.";


export function canEditCompra(
  compra: { responsavel_id?: string | null; created_by?: string | null },
  userId: string | undefined | null,
  isAdmin: boolean,
  userEmail?: string | undefined | null,
): boolean {
  if (isAdmin) return true;
  const isPedro = !!userEmail && userEmail.trim().toLowerCase() === PEDRO_EMAIL;
  if (isPedro) return true;
  if (!userId) return false;
  if (compra.responsavel_id && compra.responsavel_id === userId) return true;
  if (compra.created_by && compra.created_by === userId) return true;
  // Cards antigos sem responsável nem criador conhecidos: liberar para evitar travar dados legados.
  if (!compra.responsavel_id && !compra.created_by) return true;
  return false;
}

export function canMoveCompra(
  compra: { responsavel_id?: string | null; created_by?: string | null },
  userId: string | undefined | null,
  isAdmin: boolean,
  userEmail?: string | undefined | null,
  targetStatus?: CompraStatus,
  currentStatus?: CompraStatus,
  // Responsável definido na Configuração para o STATUS DE DESTINO (null se não houver).
  statusResponsavelId?: string | null,
): boolean {
  const isPedro = !!userEmail && userEmail.trim().toLowerCase() === PEDRO_EMAIL;
  if (isPedro) {
    if (!targetStatus) {
      // chamada genérica (ex.: habilitar arraste): permite se o card está em um status de origem permitido
      if (!currentStatus) return true;
      return PEDRO_ALLOWED_SOURCES.includes(currentStatus);
    }
    if (!currentStatus) {
      return PEDRO_ALLOWED_MOVES.some(([, to]) => to === targetStatus);
    }
    return PEDRO_ALLOWED_MOVES.some(([from, to]) => from === currentStatus && to === targetStatus);
  }

  // Admin move qualquer card para qualquer status.
  if (isAdmin) return true;

  // Se o status de destino tem responsável configurado, SOMENTE ele (ou admin) pode mover para lá.
  if (targetStatus && statusResponsavelId) {
    return !!userId && userId === statusResponsavelId;
  }

  // Status de destino sem responsável configurado: mantém a regra padrão de edição.
  return canEditCompra(compra, userId, isAdmin, userEmail);
}

export function moveBlockedMessage(compra: { responsavel_nome?: string | null }): string {
  return compra.responsavel_nome
    ? `Apenas ${compra.responsavel_nome} (ou o criador / um admin) pode editar este card.`
    : "Apenas o responsável, o criador do card ou um admin pode editá-lo.";
}

