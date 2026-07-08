// Diagnóstico do endpoint de parcelas do Conta Azul.
// Testa três coisas para o lançamento MAXMIDIAS (external_id fixo):
//   1) caFetch(/parcelas/{external_id}) — id do evento serve como id de parcela?
//   2) caFetch(/contas-a-pagar/buscar?...) — encontra o item na listagem e
//      grava o JSON completo (para inspecionar parcelas[], parcela_id, etc).
//   3) Se a listagem trouxer um id de parcela diferente, testa
//      caFetch(/parcelas/{esse_id}) também.
// Tudo grava em ca_sync_log; não trunca (chunks de 200_000 chars).
import { createFileRoute } from "@tanstack/react-router";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";
import { caFetch } from "@/lib/conta-azul/client.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EXTERNAL_ID = "94a2a5b6-d95c-4c0f-a3f0-b95e81fd3f15";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function logChunked(recurso: string, obj: unknown, status: "sucesso" | "erro") {
  const sb = supabaseAdmin as any;
  const serialized = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  const CHUNK = 200_000;
  if (serialized.length <= CHUNK) {
    await sb.from("ca_sync_log").insert({
      recurso,
      status,
      mensagem: serialized,
      finished_at: new Date().toISOString(),
    });
    return;
  }
  const total = Math.ceil(serialized.length / CHUNK);
  for (let i = 0; i < total; i++) {
    await sb.from("ca_sync_log").insert({
      recurso: `${recurso}_${i + 1}`,
      status,
      mensagem: `[parte ${i + 1}/${total}]\n` + serialized.slice(i * CHUNK, (i + 1) * CHUNK),
      finished_at: new Date().toISOString(),
    });
  }
}

async function tryFetch(url: string): Promise<{ ok: boolean; body: unknown; erro?: string }> {
  try {
    const body = await caFetch(url);
    return { ok: true, body };
  } catch (e: any) {
    return { ok: false, body: null, erro: String(e?.message ?? e) };
  }
}

async function handle({ request }: { request: Request }) {
  const guard = await requireAdminOfModule(request, "financeiro");
  if ("error" in guard) return json({ error: guard.error }, guard.status);

  const resultados: any[] = [];

  // 1. Testar /parcelas/{external_id}
  {
    const url = `/financeiro/eventos-financeiros/parcelas/${EXTERNAL_ID}`;
    const r = await tryFetch(url);
    await logChunked(
      "diag_parcela",
      { tentativa: "1_parcela_com_id_evento", url, ok: r.ok, erro: r.erro ?? null, body: r.body },
      r.ok ? "sucesso" : "erro",
    );
    resultados.push({ etapa: "1_parcela_com_id_evento", url, ok: r.ok, erro: r.erro ?? null });
  }

  // 2. Buscar na listagem — junho/2026
  let itemEncontrado: any = null;
  {
    // A listagem v2 usa `data_vencimento_de` / `data_vencimento_ate` (mesmos
    // parâmetros usados pelo sync). Cobrimos junho/2026.
    const params = new URLSearchParams({
      data_vencimento_de: "2026-06-01",
      data_vencimento_ate: "2026-06-30",
      pagina: "1",
      tamanho_pagina: "200",
    });
    const url = `/financeiro/eventos-financeiros/contas-a-pagar/buscar?${params.toString()}`;
    const r = await tryFetch(url);
    if (r.ok && r.body) {
      const arr: any[] =
        (Array.isArray((r.body as any).items) && (r.body as any).items) ||
        (Array.isArray((r.body as any).itens) && (r.body as any).itens) ||
        (Array.isArray(r.body) && (r.body as any[])) ||
        [];
      itemEncontrado = arr.find((x) => String(x?.id) === EXTERNAL_ID) ?? null;
    }
    await logChunked(
      "diag_listagem_item",
      {
        etapa: "2_listagem_buscar",
        url,
        ok: r.ok,
        erro: r.erro ?? null,
        item_encontrado: itemEncontrado,
        listagem_size: r.ok ? (Array.isArray((r.body as any)?.items) ? (r.body as any).items.length : Array.isArray((r.body as any)?.itens) ? (r.body as any).itens.length : Array.isArray(r.body) ? (r.body as any[]).length : null) : null,
      },
      r.ok ? "sucesso" : "erro",
    );
    resultados.push({ etapa: "2_listagem_buscar", url, ok: r.ok, encontrou_item: !!itemEncontrado });
  }

  // 3. Se a listagem trouxer um id de parcela diferente, testar /parcelas/{esse_id}
  if (itemEncontrado) {
    const candidatos = new Map<string, string>();
    const add = (source: string, v: any) => {
      if (v != null && v !== "" && String(v) !== EXTERNAL_ID) {
        candidatos.set(String(v), source);
      }
    };
    add("parcelas[0].id", itemEncontrado?.parcelas?.[0]?.id);
    add("parcelas[0].id_parcela", itemEncontrado?.parcelas?.[0]?.id_parcela);
    add("parcela_id", itemEncontrado?.parcela_id);
    add("id_parcela", itemEncontrado?.id_parcela);
    add("evento.id", itemEncontrado?.evento?.id);
    add("id_evento", itemEncontrado?.id_evento);
    add("evento_financeiro_id", itemEncontrado?.evento_financeiro_id);

    if (candidatos.size === 0) {
      await logChunked(
        "diag_parcela",
        { etapa: "3_sem_id_parcela_diferente", item_keys: Object.keys(itemEncontrado ?? {}) },
        "erro",
      );
      resultados.push({ etapa: "3_sem_id_parcela_diferente", item_keys: Object.keys(itemEncontrado ?? {}) });
    } else {
      for (const [id, source] of candidatos) {
        const url = `/financeiro/eventos-financeiros/parcelas/${id}`;
        const r = await tryFetch(url);
        await logChunked(
          "diag_parcela",
          { etapa: `3_parcela_${source}`, id, source, url, ok: r.ok, erro: r.erro ?? null, body: r.body },
          r.ok ? "sucesso" : "erro",
        );
        resultados.push({ etapa: `3_parcela_${source}`, id, source, url, ok: r.ok, erro: r.erro ?? null });
      }
    }
  }

  return json({ ok: true, external_id: EXTERNAL_ID, resultados });
}

export const Route = createFileRoute("/api/contaazul/diag-maxmidias")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
