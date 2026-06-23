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

// User ID do Natanael (regra de movimentação interna — sem notificação)
export const NATANAEL_USER_ID = "fd75a882-75fe-4e5b-935b-d650f050d6be";
const NATANAEL_NOME = "Natanael";

// Email do Pedro: pode editar cards e mover apenas entre as colunas permitidas
export const PEDRO_EMAIL = "pedro123jrsergio@gmail.com";
export const PEDRO_ALLOWED_STATUSES: CompraStatus[] = ["solicitacao", "analise", "pendente_aprovacao"];

function isNatanaelSolicitante(compra: { solicitante?: string | null; solicitante_id?: string | null }): boolean {
  if (compra.solicitante_id && compra.solicitante_id === NATANAEL_USER_ID) return true;
  return (compra.solicitante ?? "").trim().toLowerCase() === NATANAEL_NOME.toLowerCase();
}

function isNatanaelComprador(compra: { comprador?: string | null }): boolean {
  return (compra.comprador ?? "").trim().toLowerCase() === NATANAEL_NOME.toLowerCase();
}

/**
 * Regra extra para o Natanael (silenciosa, sem notificação):
 * - Se ele é solicitante E comprador → pode mover livremente até finalizado.
 * - Caso contrário → só pode mover até pendente_aprovacao (não além).
 * Retorna true se o movimento é permitido pela regra do Natanael (ou se a regra não se aplica).
 */
export function canNatanaelMoveTo(
  compra: { solicitante?: string | null; solicitante_id?: string | null; comprador?: string | null },
  userId: string | undefined | null,
  isAdmin: boolean,
  targetStatus: CompraStatus,
): boolean {
  if (isAdmin) return true;
  if (!userId || userId !== NATANAEL_USER_ID) return true; // regra só se aplica ao Natanael
  const ambos = isNatanaelSolicitante(compra) && isNatanaelComprador(compra);
  if (ambos) return true;
  // Só pode mover até pendente_aprovacao
  const allowed: CompraStatus[] = ["solicitacao", "analise", "pendente_aprovacao", "negada"];
  return allowed.includes(targetStatus);
}

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
): boolean {
  const isPedro = !!userEmail && userEmail.trim().toLowerCase() === PEDRO_EMAIL;
  if (isPedro) {
    if (targetStatus && !PEDRO_ALLOWED_STATUSES.includes(targetStatus)) return false;
    return true;
  }
  return canEditCompra(compra, userId, isAdmin);
}

export function moveBlockedMessage(compra: { responsavel_nome?: string | null }): string {
  return compra.responsavel_nome
    ? `Apenas ${compra.responsavel_nome} (ou o criador / um admin) pode editar este card.`
    : "Apenas o responsável, o criador do card ou um admin pode editá-lo.";
}

