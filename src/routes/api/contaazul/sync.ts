import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";
import {
  syncRecurso,
  syncTudo,
  ultimoSyncOk,
  type Recurso,
} from "@/lib/conta-azul/sync.server";

const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurso: z
    .enum(["plano_contas", "centros_custo", "contas_pagar", "contas_receber", "extrato", "tudo"])
    .optional(),
  modo: z.enum(["incremental", "completo"]).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/contaazul/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await requireAdminOfModule(request, "financeiro");
        if ("error" in guard) return json({ error: guard.error }, guard.status);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return json({ error: "Datas inválidas (use YYYY-MM-DD)" }, 400);

        const { from, to, recurso, modo } = parsed.data;
        const incremental = (modo ?? "incremental") === "incremental";
        try {
          if (!recurso || recurso === "tudo") {
            const result = await syncTudo(from, to, { incremental });
            return json(result);
          }
          // Só pagar/receber suportam incremental via data_alteracao.
          let desde: string | undefined;
          if (incremental && (recurso === "contas_pagar" || recurso === "contas_receber")) {
            const ts = await ultimoSyncOk(recurso);
            desde = ts ?? undefined;
          }
          const qtd = await syncRecurso(recurso as Recurso, from, to, desde);
          return json({ recurso, qtd, modo: desde ? "incremental" : "completo" });
        } catch (e: any) {
          return json({ error: String(e?.message ?? e) }, 500);
        }
      },
    },
  },
});
