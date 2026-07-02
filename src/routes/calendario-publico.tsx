import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarioEventos, type EventoCal } from "@/components/eventos/CalendarioEventos";

export const Route = createFileRoute("/calendario-publico")({
  head: () => ({
    meta: [
      { title: "Calendário de Eventos — Grupo Luminart" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: CalendarioPublico,
});

function CalendarioPublico() {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-publico"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("eventos")
        .select("id,codigo,nome,local,tipo,data_evento,data_montagem,data_desmontagem,cor")
        .order("data_evento");
      return (data ?? []) as EventoCal[];
    },
  });

  return (
    <div className="min-h-dvh bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Grupo Luminart</p>
          <h1 className="text-3xl font-bold">Calendário de Eventos</h1>
        </div>
        <div className="rounded-lg border bg-card p-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Carregando…</p>
          ) : (
            <CalendarioEventos eventos={eventos} readOnly />
          )}
        </div>
      </div>
    </div>
  );
}
