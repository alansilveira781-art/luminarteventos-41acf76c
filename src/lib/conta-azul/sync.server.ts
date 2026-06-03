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

// Paginação da nova API (api-v2.contaazul.com):
//   - `pagina` começa em 1
//   - `tamanho_pagina` aceita apenas: 10, 20, 50, 100, 200, 500, 1000
//   - resposta: { itens_totais: number, items: [...] } (com fallbacks)
async function fetchPaged(
  path: string,
  extraParams: Record<string, string> = {},
  size = PAGE_SIZE,
) {
  const all: any[] = [];
  let pagina = 1;
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({
      ...extraParams,
      pagina: String(pagina),
      tamanho_pagina: String(size),
    });
    const sep = path.includes("?") ? "&" : "?";
    const result = await caFetch(`${path}${sep}${params.toString()}`);
    const items: any[] = Array.isArray(result)
      ? result
      : (result?.items ?? result?.content ?? result?.data ?? []);
    if (!items || items.length === 0) break;
    all.push(...items);
    const total = Number(result?.itens_totais ?? result?.total ?? NaN);
    if (Number.isFinite(total) && all.length >= total) break;
    if (items.length < size) break;
    pagina += 1;
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
    // Plano de Contas = /categorias na API nova
    const items = await fetchPaged("/categorias");
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid ?? it.codigo ?? it.code),
        codigo: it.codigo ?? it.code ?? null,
        nome: it.nome ?? it.descricao ?? it.name ?? it.description ?? "—",
        tipo: it.tipo ?? it.type ?? it.kind ?? null,
        pai_external_id:
          it.id_pai ?? it.pai?.id ?? it.parent_id ? String(it.id_pai ?? it.pai?.id ?? it.parent_id) : null,
        ativo: (it.ativo ?? it.active) !== false,
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
    const items = await fetchPaged("/centro-de-custo", { filtro_rapido: "TODOS" });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid),
        nome: it.nome ?? it.descricao ?? it.name ?? "—",
        ativo: (it.ativo ?? it.active) !== false,
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
  // API nova: PENDENTE | QUITADO | CANCELADO | RENEGOCIADO | ATRASADO
  if (u.includes("QUIT") || u.includes("PAID") || u.includes("PAGO")) return "pago";
  if (u.includes("ATRAS") || u.includes("OVERDUE")) return "atrasado";
  return "em_aberto";
}

export async function syncContasPagar(from: string, to: string) {
  const logId = await logStart("contas_pagar");
  try {
    const items = await fetchPaged(
      "/financeiro/eventos-financeiros/contas-a-pagar/buscar",
      { data_vencimento_inicio: from, data_vencimento_fim: to },
    );
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid ?? it.id_parcela ?? it.id_evento),
        descricao: it.descricao ?? it.description ?? it.title ?? null,
        fornecedor_nome:
          it.fornecedor?.nome ?? it.pessoa?.nome ?? it.person?.name ?? it.contact?.name ?? null,
        categoria_external_id:
          it.categoria?.id ?? it.id_categoria ? String(it.categoria?.id ?? it.id_categoria) : null,
        centro_custo_external_id:
          it.centro_de_custo?.id ?? it.id_centro_de_custo
            ? String(it.centro_de_custo?.id ?? it.id_centro_de_custo)
            : null,
        valor: Number(it.valor ?? it.value ?? it.amount ?? 0),
        data_vencimento: it.data_vencimento ?? it.due_date ?? null,
        data_pagamento: it.data_pagamento ?? it.payment_date ?? null,
        status: normalizeStatus(it.status),
        documento: it.documento ?? it.document ?? null,
        observacoes: it.observacoes ?? it.notes ?? null,
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
    const items = await fetchPaged(
      "/financeiro/eventos-financeiros/contas-a-receber/buscar",
      { data_vencimento_inicio: from, data_vencimento_fim: to },
    );
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid ?? it.id_parcela ?? it.id_evento),
        descricao: it.descricao ?? it.description ?? it.title ?? null,
        cliente_nome:
          it.cliente?.nome ?? it.pessoa?.nome ?? it.person?.name ?? it.contact?.name ?? null,
        categoria_external_id:
          it.categoria?.id ?? it.id_categoria ? String(it.categoria?.id ?? it.id_categoria) : null,
        centro_custo_external_id:
          it.centro_de_custo?.id ?? it.id_centro_de_custo
            ? String(it.centro_de_custo?.id ?? it.id_centro_de_custo)
            : null,
        valor: Number(it.valor ?? it.value ?? it.amount ?? 0),
        data_vencimento: it.data_vencimento ?? it.due_date ?? null,
        data_pagamento: it.data_pagamento ?? it.payment_date ?? null,
        status: normalizeStatus(it.status),
        documento: it.documento ?? it.document ?? null,
        observacoes: it.observacoes ?? it.notes ?? null,
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

export async function syncExtrato(_from: string, _to: string) {
  // A nova plataforma não expõe um endpoint único de "Extrato Bancário".
  // Como aproximação, sincronizamos a lista de Contas Financeiras
  // (banco, caixa, cartão) com saldo atual. Um extrato completo de lançamentos
  // por dia exige combinar saldo-inicial + parcelas + transferências.
  const logId = await logStart("extrato");
  try {
    const items = await fetchPaged("/conta-financeira");
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const rows = items.map((it: any) => {
        const valor = Number(it.saldo_atual ?? it.saldo ?? it.balance ?? 0);
        return {
          external_id: String(it.id ?? it.uuid),
          conta_bancaria: it.nome ?? it.descricao ?? it.name ?? null,
          data: today,
          descricao: `Saldo atual — ${it.nome ?? it.name ?? "conta"}`,
          valor,
          tipo: valor >= 0 ? "credito" : "debito",
          categoria_external_id: null,
          centro_custo_external_id: null,
          synced_at: syncedAt,
        };
      });
      await upsertBatched("ca_extrato", rows, "external_id");
    }
    await logFinish(
      logId,
      "ok",
      items.length,
      "Sincronizadas contas financeiras com saldo atual (a nova API não tem endpoint único de extrato).",
    );
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
