// Diagnóstico temporário: captura payload cru do Conta Azul para o
// lançamento MAXMIDIAS / "Captação e Edição" R$ 1.200 rateado.
import { createFileRoute } from "@tanstack/react-router";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";
import { caFetch } from "@/lib/conta-azul/client.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handle({ request }: { request: Request }) {
  const guard = await requireAdminOfModule(request, "financeiro");
  if ("error" in guard) return json({ error: guard.error }, guard.status);

  const sb = supabaseAdmin as any;

  // 1. Localizar candidatos em ca_contas_pagar
  const { data: candidatos, error: qErr } = await sb
    .from("ca_contas_pagar")
    .select("external_id, descricao, fornecedor_nome, valor, data_vencimento")
    .or("descricao.ilike.%Captação e Edição%,descricao.ilike.%Captacao e Edicao%,fornecedor_nome.ilike.%MAXMIDIAS%")
    .eq("valor", 1200);

  if (qErr) return json({ error: qErr.message }, 500);
  if (!candidatos?.length) {
    return json({ ok: false, message: "Nenhum lançamento encontrado com os critérios.", candidatos: [] });
  }

  const resultados: any[] = [];
  for (const c of candidatos) {
    const externalId = c.external_id;
    let payload: any = null;
    let erro: string | null = null;
    try {
      payload = await caFetch(`/financeiro/eventos-financeiros/contas-a-pagar/${externalId}`);
    } catch (e: any) {
      erro = String(e?.message ?? e);
    }

    const serialized = JSON.stringify({ candidato: c, payload, erro }, null, 2);

    // Quebrar em chunks caso muito grande (mensagem é TEXT, sem limite real,
    // mas o pedido pediu chunks numerados por segurança).
    const CHUNK = 200_000;
    if (serialized.length <= CHUNK) {
      await sb.from("ca_sync_log").insert({
        recurso: "diag_maxmidias",
        status: erro ? "erro" : "sucesso",
        mensagem: serialized,
        finished_at: new Date().toISOString(),
      });
    } else {
      const total = Math.ceil(serialized.length / CHUNK);
      for (let i = 0; i < total; i++) {
        await sb.from("ca_sync_log").insert({
          recurso: `diag_maxmidias_${i + 1}`,
          status: erro ? "erro" : "sucesso",
          mensagem: `[parte ${i + 1}/${total} de external_id=${externalId}]\n` + serialized.slice(i * CHUNK, (i + 1) * CHUNK),
          finished_at: new Date().toISOString(),
        });
      }
    }

    resultados.push({ external_id: externalId, fornecedor: c.fornecedor_nome, descricao: c.descricao, ok: !erro, erro });
  }

  return json({ ok: true, candidatos_encontrados: candidatos.length, resultados });
}

export const Route = createFileRoute("/api/contaazul/diag-maxmidias")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
