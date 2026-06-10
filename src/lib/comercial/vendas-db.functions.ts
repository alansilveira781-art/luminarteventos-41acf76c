import { createServerFn } from "@tanstack/react-start";
import type { VendaRow } from "./vendas.functions";

export type ListVendasDbResult = {
  rows: VendaRow[];
  fetchedAt: string;
  error?: string;
};

export type LastSync = {
  id: string;
  started_at: string;
  finished_at: string | null;
  source: string;
  rows_total: number | null;
  rows_inserted: number | null;
  rows_updated: number | null;
  status: string;
  error: string | null;
} | null;

export type SyncResult = {
  ok: boolean;
  rows_total: number;
  rows_inserted: number;
  rows_updated: number;
  error?: string;
};

const PAGE = 1000;

export const listVendasDb = createServerFn({ method: "GET" }).handler(
  async (): Promise<ListVendasDbResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { dbRowToVenda } = await import("./vendas-parse.server");
      const all: VendaRow[] = [];
      let from = 0;
      // paginate
      while (true) {
        const { data, error } = await supabaseAdmin
          .from("comercial_vendas")
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as Record<string, unknown>[];
        for (const r of rows) all.push(dbRowToVenda(r));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return { rows: all, fetchedAt: new Date().toISOString() };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar vendas";
      return { rows: [], fetchedAt: new Date().toISOString(), error: msg };
    }
  },
);

export const getLastSync = createServerFn({ method: "GET" }).handler(
  async (): Promise<LastSync> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("comercial_vendas_sync")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as LastSync) ?? null;
  },
);

async function upsertRows(rows: VendaRow[], source: "dropbox" | "upload"): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { vendaRowToDb } = await import("./vendas-parse.server");

  // open sync log
  const { data: log } = await supabaseAdmin
    .from("comercial_vendas_sync")
    .insert({ source, status: "running", rows_total: rows.length })
    .select("id")
    .single();
  const logId = log?.id;

  let inserted = 0;
  let updated = 0;

  try {
    // Snapshot existing keys for insert/update counting
    const existingKeys = new Set<string>();
    {
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from("comercial_vendas")
          .select("nome_evento, data_evento, data_registro")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const list = (data ?? []) as Array<{
          nome_evento: string | null;
          data_evento: string | null;
          data_registro: string | null;
        }>;
        for (const r of list) {
          existingKeys.add(
            `${(r.nome_evento ?? "").toLowerCase()}|${r.data_evento ?? "1900-01-01"}|${r.data_registro ?? "1900-01-01"}`,
          );
        }
        if (list.length < PAGE) break;
        from += PAGE;
      }
    }

    const rawDbRows = rows.map((r) => vendaRowToDb(r, source));

    // Dedupe by upsert key (PG ON CONFLICT cannot affect the same row twice
    // in a single VALUES list). Keep the LAST occurrence.
    const byKey = new Map<string, ReturnType<typeof vendaRowToDb>>();
    for (const r of rawDbRows) {
      const k = `${(r.nome_evento ?? "").toLowerCase()}|${r.data_evento ?? "1900-01-01"}|${r.data_registro ?? "1900-01-01"}`;
      byKey.set(k, r);
    }
    const dbRows = Array.from(byKey.values());

    // Count inserts vs updates
    for (const r of dbRows) {
      const k = `${(r.nome_evento ?? "").toLowerCase()}|${r.data_evento ?? "1900-01-01"}|${r.data_registro ?? "1900-01-01"}`;
      if (existingKeys.has(k)) updated++;
      else inserted++;
    }

    // Upsert in chunks
    const CHUNK = 200;
    for (let i = 0; i < dbRows.length; i += CHUNK) {
      const chunk = dbRows.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin
        .from("comercial_vendas")
        .upsert(chunk, {
          onConflict: "nome_evento,data_evento,data_registro",
          ignoreDuplicates: false,
        });
      if (error) throw error;
    }

    if (logId) {
      await supabaseAdmin
        .from("comercial_vendas_sync")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          rows_total: rows.length,
          rows_inserted: inserted,
          rows_updated: updated,
        })
        .eq("id", logId);
    }

    return { ok: true, rows_total: rows.length, rows_inserted: inserted, rows_updated: updated };
  } catch (e: unknown) {
    let msg = "Falha ao sincronizar";
    if (e instanceof Error) msg = e.message;
    else if (e && typeof e === "object") {
      try { msg = JSON.stringify(e); } catch { msg = String(e); }
    } else if (e) msg = String(e);
    if (logId) {
      await supabaseAdmin
        .from("comercial_vendas_sync")
        .update({
          finished_at: new Date().toISOString(),
          status: "error",
          error: msg.slice(0, 1000),
        })
        .eq("id", logId);
    }
    return { ok: false, rows_total: rows.length, rows_inserted: 0, rows_updated: 0, error: msg };
  }
}

export const syncVendasFromDropbox = createServerFn({ method: "POST" }).handler(
  async (): Promise<SyncResult> => {
    const { fetchVendasFromDropbox } = await import("./vendas-parse.server");
    try {
      const rows = await fetchVendasFromDropbox();
      return await upsertRows(rows, "dropbox");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao baixar planilha";
      return { ok: false, rows_total: 0, rows_inserted: 0, rows_updated: 0, error: msg };
    }
  },
);

export const syncVendasFromUpload = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string }) => {
    if (!d || typeof d.base64 !== "string" || !d.base64.length) {
      throw new Error("Arquivo .xlsx inválido");
    }
    return d;
  })
  .handler(async ({ data }): Promise<SyncResult> => {
    const { parseVendasXlsx } = await import("./vendas-parse.server");
    try {
      // base64 -> ArrayBuffer
      const raw = data.base64.includes(",") ? data.base64.split(",")[1] : data.base64;
      const bin = atob(raw);
      const buf = new ArrayBuffer(bin.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
      const rows = await parseVendasXlsx(buf);
      return await upsertRows(rows, "upload");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao ler arquivo";
      return { ok: false, rows_total: 0, rows_inserted: 0, rows_updated: 0, error: msg };
    }
  });
