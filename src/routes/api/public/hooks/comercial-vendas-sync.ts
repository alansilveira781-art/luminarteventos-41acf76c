import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/comercial-vendas-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { syncVendasFromDropbox } = await import(
          "@/lib/comercial/vendas-db.functions"
        );
        const result = await syncVendasFromDropbox();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
