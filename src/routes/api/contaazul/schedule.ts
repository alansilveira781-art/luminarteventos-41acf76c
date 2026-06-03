import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";

const schema = z.object({
  horarios: z.array(z.object({
    horario: z.string().regex(/^\d{2}:\d{2}$/),
    ativo: z.boolean(),
  })).max(3),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/contaazul/schedule")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await requireAdminOfModule(request, "financeiro");
        if ("error" in guard) return json({ error: guard.error }, guard.status);

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return json({ error: "Payload inválido" }, 400);

        const sb = supabaseAdmin as any;
        await sb.from("ca_sync_schedule").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const rows = parsed.data.horarios.map((h, i) => ({
          horario: `${h.horario}:00`,
          ativo: h.ativo,
          ordem: i + 1,
        }));
        if (rows.length) {
          const { error } = await sb.from("ca_sync_schedule").insert(rows);
          if (error) return json({ error: error.message }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
