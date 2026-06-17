// Cron tick — chamado a cada minuto por pg_cron, e também imediatamente
// pela UI quando uma carga histórica é iniciada (para não esperar 1 min
// pelo primeiro mês).
//
// A cada chamada:
//   1. Se a hora atual (America/Fortaleza) bate com um horário ativo em
//      ca_sync_schedule → roda syncIncrementalD1().
//   2. Sempre que houver um job histórico pendente/em_andamento, processa
//      um mês (processNextHistoricoChunk). Aceita GET e POST.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncIncrementalD1, processNextHistoricoChunk } from "@/lib/conta-azul/sync.server";
import { requireProjectApiKey } from "@/lib/public-endpoint-auth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function nowInFortalezaHHMM(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function handle({ request }: { request: Request }) {
  const denied = requireProjectApiKey(request);
  if (denied) return denied;
  const hhmm = nowInFortalezaHHMM();
  const sb = supabaseAdmin as any;
  const result: any = { hhmm };

  // 1. Histórico — sempre tenta processar um mês.
  try {
    result.historico = await processNextHistoricoChunk();
  } catch (e: any) {
    result.historico_error = String(e?.message ?? e);
  }

  // 2. Sync incremental D-1 — só se bater algum horário agendado.
  const { data: schedules } = await sb
    .from("ca_sync_schedule")
    .select("horario,ativo")
    .eq("ativo", true);
  const match = (schedules ?? []).some((s: any) => String(s.horario ?? "").slice(0, 5) === hhmm);
  if (match) {
    try {
      result.incremental = await syncIncrementalD1();
    } catch (e: any) {
      result.incremental_error = String(e?.message ?? e);
    }
  } else {
    result.incremental_skipped = true;
  }

  return json(result);
}

export const Route = createFileRoute("/api/public/contaazul/cron")({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
    },
  },
});
