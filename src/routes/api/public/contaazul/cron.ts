// Cron tick — chamado a cada minuto por pg_cron.
// Verifica se a hora atual (America/Fortaleza) coincide com algum horário ativo
// em ca_sync_schedule e, se sim, roda syncIncrementalD1().
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncIncrementalD1 } from "@/lib/conta-azul/sync.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function nowInFortalezaHHMM(): string {
  // America/Fortaleza = UTC-3, sem horário de verão.
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export const Route = createFileRoute("/api/public/contaazul/cron")({
  server: {
    handlers: {
      POST: async () => {
        const hhmm = nowInFortalezaHHMM();
        const sb = supabaseAdmin as any;
        const { data: schedules } = await sb
          .from("ca_sync_schedule")
          .select("horario,ativo")
          .eq("ativo", true);

        const match = (schedules ?? []).some((s: any) => {
          const t = String(s.horario ?? "").slice(0, 5);
          return t === hhmm;
        });
        if (!match) return json({ skipped: true, hhmm });

        try {
          const result = await syncIncrementalD1();
          return json({ ran: true, hhmm, result });
        } catch (e: any) {
          return json({ ran: true, hhmm, error: String(e?.message ?? e) }, 500);
        }
      },
    },
  },
});
