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
      : (result?.itens ?? result?.items ?? result?.content ?? result?.data ?? []);
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
    // Plano de Contas = /categorias na API nova.
    // `permite_apenas_filhos` é parâmetro OBRIGATÓRIO (boolean).
    const items = await fetchPaged("/categorias", { permite_apenas_filhos: "false" });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id),
        codigo: it.codigo ?? null,
        nome: it.nome ?? "—",
        tipo: it.tipo ?? null,
        pai_external_id: it.categoria_pai ? String(it.categoria_pai) : null,
        ativo: true,
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
  // Enum oficial v2: PERDIDO | RECEBIDO | EM_ABERTO | RENEGOCIADO | RECEBIDO_PARCIAL | ATRASADO
  if (u === "RECEBIDO" || u === "PAGO" || u === "QUITADO") return "pago";
  if (u === "ATRASADO" || u === "PERDIDO" || u === "OVERDUE") return "atrasado";
  return "em_aberto";
}

function mapEvento(it: any, syncedAt: string, pessoaKey: "fornecedor_nome" | "cliente_nome") {
  const pessoaNome =
    pessoaKey === "fornecedor_nome"
      ? (it.fornecedor?.nome ?? null)
      : (it.cliente?.nome ?? it.fornecedor?.nome ?? null);
  return {
    external_id: String(it.id),
    descricao: it.descricao ?? null,
    [pessoaKey]: pessoaNome,
    categoria_external_id: it.categorias?.[0]?.id ? String(it.categorias[0].id) : null,
    centro_custo_external_id: it.centros_custo?.[0]?.id ? String(it.centros_custo[0].id) : null,
    valor: Number(it.total ?? 0),
    data_vencimento: it.data_vencimento ?? null,
    data_pagamento: it.data_pagamento ?? null,
    status: normalizeStatus(it.status_traduzido ?? it.status),
    documento: it.numero_documento ?? null,
    observacoes: it.observacoes ?? null,
    synced_at: syncedAt,
  };
}

export async function syncContasPagar(from: string, to: string) {
  const logId = await logStart("contas_pagar");
  try {
    const items = await fetchPaged(
      "/financeiro/eventos-financeiros/contas-a-pagar/buscar",
      { data_vencimento_de: from, data_vencimento_ate: to },
    );
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => mapEvento(it, syncedAt, "fornecedor_nome"));
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
      { data_vencimento_de: from, data_vencimento_ate: to },
    );
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => mapEvento(it, syncedAt, "cliente_nome"));
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
  await upsertSyncState(from, to, result as any);
  return result;
}

async function upsertSyncState(
  from: string,
  to: string,
  counts: Record<string, number>,
) {
  const now = new Date().toISOString();
  const recursos = ["plano_contas", "centros_custo", "contas_pagar", "contas_receber", "extrato"] as const;
  for (const r of recursos) {
    const { data: existing } = await sb
      .from("ca_sync_state")
      .select("last_synced_from")
      .eq("recurso", r)
      .maybeSingle();
    const mergedFrom =
      existing?.last_synced_from && existing.last_synced_from < from
        ? existing.last_synced_from
        : from;
    await sb.from("ca_sync_state").upsert(
      {
        recurso: r,
        last_synced_from: mergedFrom,
        last_synced_to: to,
        last_run_at: now,
        qtd_total: counts[r] ?? 0,
        updated_at: now,
      },
      { onConflict: "recurso" },
    );
  }
}

/** Sincronização incremental D-1 → hoje. */
export async function syncIncrementalD1() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return syncTudo(from, today);
}

/** Carga histórica em blocos mensais (executa em background). */
export async function runHistoricoBackfill(from: string, to: string): Promise<string> {
  const { data: job, error } = await sb
    .from("ca_sync_jobs")
    .insert({
      tipo: "historico",
      date_from: from,
      date_to: to,
      progress: { total_meses: 0, concluidos: 0, mes_atual: null },
    })
    .select("id")
    .single();
  if (error) throw error;
  const jobId = job.id as string;

  // background — não bloqueia o response
  (async () => {
    try {
      const meses = monthsBetween(from, to);
      await sb.from("ca_sync_jobs").update({
        progress: { total_meses: meses.length, concluidos: 0, mes_atual: meses[0]?.[0] ?? null },
      }).eq("id", jobId);

      try { await syncPlanoContas(); } catch {}
      try { await syncCentrosCusto(); } catch {}
      try { await syncExtrato(from, to); } catch {}

      for (let i = 0; i < meses.length; i++) {
        const [mFrom, mTo] = meses[i];
        try { await syncContasPagar(mFrom, mTo); } catch {}
        try { await syncContasReceber(mFrom, mTo); } catch {}
        await sb.from("ca_sync_jobs").update({
          progress: { total_meses: meses.length, concluidos: i + 1, mes_atual: mFrom },
        }).eq("id", jobId);
      }
      await upsertSyncState(from, to, {});
      await sb.from("ca_sync_jobs").update({
        status: "ok",
        finished_at: new Date().toISOString(),
      }).eq("id", jobId);
    } catch (e: any) {
      await sb.from("ca_sync_jobs").update({
        status: "erro",
        mensagem: String(e?.message ?? e),
        finished_at: new Date().toISOString(),
      }).eq("id", jobId);
    }
  })();

  return jobId;
}

function monthsBetween(from: string, to: string): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const mStart = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
    const mEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const a = mStart < start ? start : mStart;
    const b = mEnd > end ? end : mEnd;
    result.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return result;
}
