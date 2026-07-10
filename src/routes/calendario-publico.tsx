import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarioEventos, type EventoCal } from "@/components/eventos/CalendarioEventos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        .select(
          "id,codigo_evento,nome,local,cidade,tipo,data_evento,data_evento_fim,data_montagem,data_montagem_fim,data_desmontagem,data_desmontagem_fim,produtor,cor"
        )
        .order("data_evento");
      return (data ?? []) as EventoCal[];
    },
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-1">
            <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Grupo Luminart</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Calendário de Eventos</h1>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-3xl sm:text-4xl font-mono font-semibold tabular-nums">
              {format(now, "HH:mm")}
            </div>
            <div className="text-sm sm:text-base text-muted-foreground capitalize">
              {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 text-base sm:text-lg">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-16 text-xl">Carregando…</p>
          ) : (
            <CalendarioEventos eventos={eventos} readOnly />
          )}
        </div>
      </div>
    </div>
  );
}
