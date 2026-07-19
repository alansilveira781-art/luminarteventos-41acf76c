import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";
import { reprocessarRateios } from "@/lib/conta-azul/sync.server";

const postSchema = z.object({
  ids: z.array(z.string()).optional(),
  tipo: z.enum(["pagar", "receber"]).optional(),
  limite: z.number().int().min(1).max(500).optional(),
  modo: z.enum(["suspeitos", "todos"]).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/contaazul/reprocessar-rateios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await requireAdminOfModule(request, "financeiro");
        if ("error" in guard) return json({ error: guard.error }, guard.status);
        let body: unknown = {};
        try { body = await request.json(); } catch {}
        const parsed = postSchema.safeParse(body);
        if (!parsed.success) return json({ error: "Payload inválido" }, 400);
        try {
          const r = await reprocessarRateios(parsed.data);
          return json(r);
        } catch (e: any) {
          return json({ error: String(e?.message ?? e) }, 500);
        }
      },
    },
  },
});
