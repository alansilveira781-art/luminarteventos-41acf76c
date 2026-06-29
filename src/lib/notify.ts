import { supabase } from "@/integrations/supabase/client";
import type { CompraStatus } from "@/lib/compras";

const sb = supabase as any;

/**
 * Mapeamento de status -> papéis responsáveis (papéis fixos).
 * Notifica todos os usuários cujo perfil tenha o módulo correspondente.
 */
const STATUS_RESPONSIBLES: Record<CompraStatus, { modules: string[]; admin?: boolean; label: string }> = {
  solicitacao: { modules: ["compras"], label: "Solicitação de Compra" },
  analise: { modules: ["compras"], label: "Análise de Compra" },
  pendente_aprovacao: { modules: [], admin: true, label: "Pendente Aprovação" },
  aprovada: { modules: ["compras"], label: "Compras Aprovada" },
  negada: { modules: ["compras"], label: "Compras Negada" },
  em_andamento: { modules: ["compras"], label: "Compra Em Andamento" },
  a_receber: { modules: ["estoque"], label: "Compras a Receber" },
  finalizado: { modules: ["compras", "estoque"], label: "Finalizado" },
};

async function getUsersByModule(slug: string): Promise<string[]> {
  const { data: m } = await sb.from("modulos").select("id").eq("slug", slug).maybeSingle();
  if (!m) return [];
  const { data } = await sb.from("user_modulos").select("user_id").eq("modulo_id", m.id);
  return (data ?? []).map((x: any) => x.user_id as string);
}

async function getAdmins(): Promise<string[]> {
  const { data } = await sb.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((x: any) => x.user_id as string);
}

async function getMutedUsers(slug: string): Promise<Set<string>> {
  const { data } = await sb.from("notification_mutes").select("user_id").eq("modulo_slug", slug);
  return new Set((data ?? []).map((x: any) => x.user_id as string));
}

async function getStatusResponsavel(status: CompraStatus): Promise<string | null> {
  const { data } = await sb
    .from("compras_status_defaults")
    .select("responsavel_id")
    .eq("status", status)
    .maybeSingle();
  return (data?.responsavel_id as string) ?? null;
}

export async function notifyResponsiblesForStatus(status: CompraStatus, compraId: string, titulo: string) {
  const cfg = STATUS_RESPONSIBLES[status];
  if (!cfg) return;
  const [sets, responsavelId, mutedEstoque] = await Promise.all([
    Promise.all([
      ...cfg.modules.map((m) => getUsersByModule(m)),
      cfg.admin ? getAdmins() : Promise.resolve([] as string[]),
    ]),
    getStatusResponsavel(status),
    cfg.modules.includes("estoque") ? getMutedUsers("estoque") : Promise.resolve(new Set<string>()),
  ]);
  const flat = sets.flat().filter((id) => !mutedEstoque.has(id));
  if (responsavelId) flat.push(responsavelId);
  const ids = Array.from(new Set(flat));
  if (ids.length === 0) return;
  const rows = ids.map((user_id) => ({
    user_id,
    tipo: "compra_status",
    titulo: `Compra: ${cfg.label}`,
    mensagem: titulo,
    link: `/compras?id=${compraId}`,
  }));
  await sb.rpc("enqueue_notificacoes", { rows });
}


export async function notifyMentions(userIds: string[], compraId: string, texto: string) {
  if (!userIds.length) return;
  const rows = userIds.map((user_id) => ({
    user_id,
    tipo: "mencao",
    titulo: "Você foi mencionado em uma compra",
    mensagem: texto.slice(0, 140),
    link: `/compras?id=${compraId}`,
  }));
  await sb.rpc("enqueue_notificacoes", { rows });
}

/** Notifica um usuário específico (responsável por um card). */
export async function notifyResponsavel(params: {
  userId: string;
  titulo: string;
  mensagem?: string;
  link?: string;
  tipo?: string;
}) {
  if (!params.userId) return;
  await sb.rpc("enqueue_notificacoes", {
    rows: [{
      user_id: params.userId,
      tipo: params.tipo || "responsavel_card",
      titulo: params.titulo,
      mensagem: params.mensagem ?? null,
      link: params.link ?? null,
    }],
  });
}
