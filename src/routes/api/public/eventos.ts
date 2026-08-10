import { createFileRoute } from "@tanstack/react-router";
import { listEventos } from "@/lib/sheets.functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export type EventoPublico = {
  id: string;
  nome: string;
  local: string;
  uf: string;
  produtor: string;
  dataInicio: string;
  dataFim: string;
  origem: "calendario" | "planilha";
};

export const Route = createFileRoute("/api/public/eventos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [cal, sheet] = await Promise.all([
          (supabaseAdmin as any)
            .from("eventos")
            .select("codigo_evento, nome, local, cidade, produtor, data_evento, data_evento_fim")
            .not("codigo_evento", "is", null)
            .is("evento_pai_id", null)
            .order("data_evento_fim", { ascending: false }),
          listEventos().catch(() => ({ rows: [], error: "" } as any)),
        ]);

        const calRows: EventoPublico[] = ((cal?.data ?? []) as any[]).map((r) => ({
          id: r.codigo_evento ?? "",
          nome: r.nome ?? "",
          local: r.local ?? "",
          uf: r.cidade ?? "",
          produtor: r.produtor ?? "",
          dataInicio: r.data_evento ?? "",
          dataFim: r.data_evento_fim ?? "",
          origem: "calendario" as const,
        }));

        const sheetRows: EventoPublico[] = ((sheet?.rows ?? []) as any[]).map((r) => ({
          id: r.id ?? "",
          nome: r.nome ?? "",
          local: r.local ?? "",
          uf: r.uf ?? "",
          produtor: r.produtor ?? "",
          dataInicio: r.dataInicio ?? "",
          dataFim: r.dataFim ?? "",
          origem: "planilha" as const,
        }));

        const seen = new Set<string>();
        const eventos = [...calRows, ...sheetRows].filter((r) => {
          if (!r.id || seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });

        return new Response(JSON.stringify({ eventos }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      },
    },
  },
});
