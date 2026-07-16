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

export function nextCompraStatus(status?: CompraStatus | null): CompraStatus | null {
  if (!status) return null;
  const idx = COMPRA_STATUSES.findIndex((s) => s.key === status);
  if (idx < 0) return null;
  for (let i = idx + 1; i < COMPRA_STATUSES.length; i++) {
    const key = COMPRA_STATUSES[i].key;
    if (key === "negada") continue;
    return key;
  }
  return null;
}


export function canEditCompra(
  compra: { responsavel_id?: string | null; created_by?: string | null },
  userId: string | undefined | null,
  isAdmin: boolean,
  userEmail?: string | undefined | null,
  statusResponsavelId?: string | null,
): boolean {
  if (isAdmin) return true;
  const isPedro = !!userEmail && userEmail.trim().toLowerCase() === PEDRO_EMAIL;
  if (isPedro) return true;
  if (!userId) return false;
  if (compra.responsavel_id && compra.responsavel_id === userId) return true;
  if (compra.created_by && compra.created_by === userId) return true;
  // Responsável configurado para o status atual do card pode editar,
  // mesmo que o responsavel_id do card aponte para outra pessoa.
  if (statusResponsavelId && statusResponsavelId === userId) return true;
  // Cards antigos sem responsável nem criador conhecidos: liberar para evitar travar dados legados.
  if (!compra.responsavel_id && !compra.created_by) return true;
  return false;
}

/**
 * Pode excluir a compra: admin, module_admin de compras, criador,
 * responsável do card, ou o responsável configurado do status atual.
 */
export function canDeleteCompra(
  compra: { responsavel_id?: string | null; created_by?: string | null; status?: CompraStatus },
  userId: string | undefined | null,
  isAdmin: boolean,
  statusResponsavelId?: string | null,
): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  if (compra.created_by && compra.created_by === userId) return true;
  if (compra.responsavel_id && compra.responsavel_id === userId) return true;
  if (statusResponsavelId && statusResponsavelId === userId) return true;
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
  // Responsável definido na Configuração para o STATUS DE ORIGEM (null se não houver).
  currentStatusResponsavelId?: string | null,
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

  // Regra: fora da aprovação, o card só pode avançar para o próximo status da sequência.
  // O responsável da origem pode empurrar, e o responsável do destino pode puxar.
  if (targetStatus) {
    const isRespDestino = !!statusResponsavelId && !!userId && userId === statusResponsavelId;
    const isRespOrigem = !!currentStatusResponsavelId && !!userId && userId === currentStatusResponsavelId;

    if (currentStatus === "pendente_aprovacao") {
      return (targetStatus === "aprovada" || targetStatus === "negada") && isRespOrigem;
    }

    if (currentStatus) {
      const next = nextCompraStatus(currentStatus);
      if (!next || targetStatus !== next) return false;
    }

    if (isRespDestino || isRespOrigem) return true;

    // Se algum dos status (origem OU destino) tem responsável configurado,
    // NÃO cair no fallback permissivo — apenas responsáveis/admin podem mover.
    if (statusResponsavelId || currentStatusResponsavelId) return false;

    // Sem nenhum responsável configurado: exigir vínculo explícito com o card
    // (criador ou responsável do card). Cards legados sem vínculo não podem
    // ser movidos por qualquer usuário.
    if (!userId) return false;
    if (compra.created_by && compra.created_by === userId) return true;
    if (compra.responsavel_id && compra.responsavel_id === userId) return true;
    return false;
  }

  return canEditCompra(compra, userId, isAdmin, userEmail, currentStatusResponsavelId);
}


export function moveBlockedMessage(compra: { responsavel_nome?: string | null }): string {
  return compra.responsavel_nome
    ? `Apenas ${compra.responsavel_nome} (ou o criador / um admin) pode editar este card.`
    : "Apenas o responsável, o criador do card ou um admin pode editá-lo.";
}

