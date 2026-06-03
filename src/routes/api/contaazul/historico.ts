import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";
import { runHistoricoBackfill } from "@/lib/conta-azul/sync.server";

const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/contaazul/historico")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await requireAdminOfModule(request, "financeiro");
        if ("error" in guard) return json({ error: guard.error }, guard.status);

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return json({ error: "Datas inválidas (YYYY-MM-DD)" }, 400);

        const jobId = await runHistoricoBackfill(parsed.data.from, parsed.data.to);
        return json({ jobId });
      },
    },
  },
});
