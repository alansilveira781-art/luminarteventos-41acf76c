import { createFileRoute } from "@tanstack/react-router";
import { requireSharedSecret } from "@/lib/public-endpoint-auth";

export const Route = createFileRoute("/api/public/hooks/comercial-vendas-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireSharedSecret(request, "VENDAS_SYNC_SECRET");
        if (denied) return denied;
        const { syncVendasFromDropbox } = await import(
          "@/lib/comercial/vendas-db.functions"
        );
        const result = await syncVendasFromDropbox();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
