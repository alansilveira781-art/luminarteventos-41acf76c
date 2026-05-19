// Sync helpers — server-only. Called from /api/contaazul/sync route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { caFetch } from "./client.server";

const sb = supabaseAdmin as any;
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap (50 * 100 = 5000 itens por recurso)
const UPSERT_BATCH = 500;

async function logStart(recurso: string): Promise<string> {
  const { data, error } = await sb
    .from("ca_sync_log")
    .insert({ recurso, status: "em_andamento", started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function logFinish(id: string, status: "ok" | "erro", qtd: number, mensagem?: string) {
  await sb
    .from("ca_sync_log")
    .update({
      status,
      qtd_registros: qtd,
      mensagem: mensagem ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function fetchPaged(
  path: string,
  extraParams: Record<string, string> = {},
  size = PAGE_SIZE,
) {
  const all: any[] = [];
  let page = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({ ...extraParams, page: String(page), size: String(size) });
    const sep = path.includes("?") ? "&" : "?";
    const result = await caFetch(`${path}${sep}${params.toString()}`);
    const items = Array.isArray(result) ? result : (result?.content ?? result?.items ?? result?.data ?? []);
    if (!items || items.length === 0) break;
    all.push(...items);
    if (items.length < size) break;
    page += 1;
  }
  return all;
}

async function upsertBatched(table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const chunk = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

export async function syncPlanoContas() {
  const logId = await logStart("plano_contas");
  try {
    const items = await fetchPaged("/plan-of-accounts");
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid ?? it.code),
        codigo: it.code ?? null,
        nome: it.name ?? it.description ?? "—",
        tipo: it.type ?? it.kind ?? null,
        pai_external_id: it.parent_id ? String(it.parent_id) : null,
        ativo: it.active !== false,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_plano_contas", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export async function syncCentrosCusto() {
  const logId = await logStart("centros_custo");
  try {
    const items = await fetchPaged("/cost-centers");
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid),
        nome: it.name ?? it.description ?? "—",
        ativo: it.active !== false,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_centros_custo", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

function normalizeStatus(s?: string) {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes("PAID") || u.includes("PAGO")) return "pago";
  if (u.includes("OVERDUE") || u.includes("ATRAS")) return "atrasado";
  return "em_aberto";
}

export async function syncContasPagar(from: string, to: string) {
  const logId = await logStart("contas_pagar");
  try {
    const items = await fetchPaged("/financial-events", {
      type: "PAYABLE",
      due_date_from: from,
      due_date_to: to,
    });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid),
        descricao: it.description ?? it.title ?? null,
        fornecedor_nome: it.person?.name ?? it.contact?.name ?? null,
        categoria_external_id: it.category?.id ? String(it.category.id) : null,
        centro_custo_external_id: it.cost_center?.id ? String(it.cost_center.id) : null,
        valor: Number(it.value ?? it.amount ?? 0),
        data_vencimento: it.due_date ?? null,
        data_pagamento: it.payment_date ?? it.paid_at ?? null,
        status: normalizeStatus(it.status),
        documento: it.document ?? null,
        observacoes: it.notes ?? null,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_contas_pagar", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export async function syncContasReceber(from: string, to: string) {
  const logId = await logStart("contas_receber");
  try {
    const items = await fetchPaged("/financial-events", {
      type: "RECEIVABLE",
      due_date_from: from,
      due_date_to: to,
    });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid),
        descricao: it.description ?? it.title ?? null,
        cliente_nome: it.person?.name ?? it.contact?.name ?? null,
        categoria_external_id: it.category?.id ? String(it.category.id) : null,
        centro_custo_external_id: it.cost_center?.id ? String(it.cost_center.id) : null,
        valor: Number(it.value ?? it.amount ?? 0),
        data_vencimento: it.due_date ?? null,
        data_pagamento: it.payment_date ?? it.paid_at ?? null,
        status: normalizeStatus(it.status),
        documento: it.document ?? null,
        observacoes: it.notes ?? null,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_contas_receber", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export async function syncExtrato(from: string, to: string) {
  const logId = await logStart("extrato");
  try {
    const items = await fetchPaged("/bank-statements", { from, to });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid),
        conta_bancaria: it.bank_account?.name ?? it.account?.name ?? null,
        data: it.date ?? null,
        descricao: it.description ?? null,
        valor: Number(it.value ?? it.amount ?? 0),
        tipo: (it.value ?? 0) >= 0 ? "credito" : "debito",
        categoria_external_id: it.category?.id ? String(it.category.id) : null,
        centro_custo_external_id: it.cost_center?.id ? String(it.cost_center.id) : null,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_extrato", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export type Recurso =
  | "plano_contas"
  | "centros_custo"
  | "contas_pagar"
  | "contas_receber"
  | "extrato";

export async function syncRecurso(recurso: Recurso, from: string, to: string): Promise<number> {
  switch (recurso) {
    case "plano_contas":
      return syncPlanoContas();
    case "centros_custo":
      return syncCentrosCusto();
    case "contas_pagar":
      return syncContasPagar(from, to);
    case "contas_receber":
      return syncContasReceber(from, to);
    case "extrato":
      return syncExtrato(from, to);
  }
}

export async function syncTudo(from: string, to: string) {
  const result = {
    plano_contas: 0,
    centros_custo: 0,
    contas_pagar: 0,
    contas_receber: 0,
    extrato: 0,
    errors: [] as string[],
  };
  const tasks: Array<[Recurso, () => Promise<number>]> = [
    ["plano_contas", () => syncPlanoContas()],
    ["centros_custo", () => syncCentrosCusto()],
    ["contas_pagar", () => syncContasPagar(from, to)],
    ["contas_receber", () => syncContasReceber(from, to)],
    ["extrato", () => syncExtrato(from, to)],
  ];
  for (const [key, fn] of tasks) {
    try {
      (result as any)[key] = await fn();
    } catch (e: any) {
      result.errors.push(`${key}: ${e?.message ?? e}`);
    }
  }
  return result;
}
