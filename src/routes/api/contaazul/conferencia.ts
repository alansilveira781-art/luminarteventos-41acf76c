import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";
import { conferirLiquidacoes, reprocessarRateios } from "@/lib/conta-azul/sync.server";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const postSchema = z.object({
  acao: z.enum(["conferir", "corrigir"]).default("conferir"),
  tipo: z.enum(["pagar", "receber"]),
  vencDe: dia.optional(),
  vencAte: dia.optional(),
  ids: z.array(z.string()).max(500).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/contaazul/conferencia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await requireAdminOfModule(request, "financeiro");
        if ("error" in guard) return json({ error: guard.error }, guard.status);
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {}
        const parsed = postSchema.safeParse(body);
        if (!parsed.success) return json({ error: "Payload inválido" }, 400);
        const { acao, tipo, vencDe, vencAte, ids } = parsed.data;
        try {
          if (acao === "corrigir") {
            if (!ids || ids.length === 0) return json({ error: "Nenhum lançamento informado" }, 400);
            const r = await reprocessarRateios({
              ids: ids.slice(0, 40),
              tipo,
              limite: 40,
              permitirNovos: true,
            });
            return json({ ...r, pendentes: Math.max(0, ids.length - 40) });
          }
          if (!vencDe || !vencAte) return json({ error: "Informe o período de vencimento" }, 400);
          const r = await conferirLiquidacoes({ tipo, vencDe, vencAte });
          return json(r);
        } catch (e: any) {
          return json({ error: String(e?.message ?? e) }, 500);
        }
      },
    },
  },
});
