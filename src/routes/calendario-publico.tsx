import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GanttEventos, type EventoCal } from "@/components/eventos/GanttEventos";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/calendario-publico")({
  head: () => ({
    meta: [
      { title: "Calendário de Eventos — Grupo Luminart" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CalendarioPublico,
});

function fmtDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, dd] = d.split("-").map(Number);
  if (!y || !m || !dd) return "—";
  return format(new Date(y, m - 1, dd), "dd/MM/yyyy");
}

function stripDate(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fmtRange(ini?: string | null, fim?: string | null): string {
  if (!ini && !fim) return "—";
  if (!ini) return fmtDay(fim);
  const iniStr = stripDate(ini);
  const fimStr = stripDate(fim);
  if (!fimStr || fimStr === iniStr) return fmtDay(ini);
  return `${fmtDay(ini)} - ${fmtDay(fim)}`;
}

function CalendarioPublico() {
  const { user, loading: authLoading, isAdmin, hasModule } = useAuth();

  const { data: perfil, isLoading: perfilLoading } = useQuery({
    enabled: !!user,
    queryKey: ["perfil-expectador-eventos", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("is_expectador_eventos")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { is_expectador_eventos: boolean } | null;
    },
  });

  const autorizado =
    !!user && (isAdmin || hasModule("eventos") || !!perfil?.is_expectador_eventos);

  const { data: eventos = [], isLoading } = useQuery({
    enabled: autorizado,
    queryKey: ["eventos-publico"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("eventos")
        .select(
          "id,codigo_evento,nome,local,cidade,tipo,data_evento,data_evento_fim,data_montagem,data_montagem_fim,data_desmontagem,data_desmontagem_fim,produtor,observacoes,cor,situacao,hora_montagem,hora_desmontagem"
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

  const [selecionado, setSelecionado] = useState<EventoCal | null>(null);

  if (authLoading || (user && perfilLoading)) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Calendário de Eventos</h1>
          <p className="text-muted-foreground text-sm">
            Este calendário é restrito. Faça login com uma conta autorizada para visualizar.
          </p>
          <Button asChild>
            <Link to="/auth">Fazer login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Acesso não autorizado</h1>
          <p className="text-muted-foreground text-sm">
            Sua conta ainda não tem permissão para ver o Calendário de Eventos. Peça a um administrador para liberar o acesso.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-dvh bg-background text-foreground p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-2">
            <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Grupo Luminart</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Calendário de Eventos</h1>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link to="/">← Voltar para os módulos</Link>
            </Button>
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
            <GanttEventos
              eventos={eventos}
              readOnly
              modoInicial="mensal"
              onSelectEvento={(ev: EventoCal) => setSelecionado(ev)}
            />
          )}
        </div>
      </div>

      <Dialog open={!!selecionado} onOpenChange={(o) => !o && setSelecionado(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selecionado?.codigo_evento ?? selecionado?.nome ?? "Evento"}
            </DialogTitle>
          </DialogHeader>
          {selecionado && (
            <div className="space-y-4 text-base sm:text-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow label="Nome" value={selecionado.nome} />
                <InfoRow label="Tipo" value={selecionado.tipo} />
                <InfoRow label="Local" value={selecionado.local} />
                <InfoRow label="Cidade" value={selecionado.cidade} />
                {selecionado.produtor && <InfoRow label="Produtor" value={selecionado.produtor} />}
              </div>

              <div className="space-y-2 pt-2">
                <div className="rounded-md border-l-4 border-blue-600 bg-blue-600/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-blue-900 dark:text-blue-200 font-semibold">Evento</div>
                  <div className="text-lg font-medium">{fmtRange(selecionado.data_evento, selecionado.data_evento_fim)}</div>
                </div>
                <div className="rounded-md border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-amber-900 dark:text-amber-200 font-semibold">Montagem</div>
                  <div className="text-lg font-medium">{fmtRange(selecionado.data_montagem, selecionado.data_montagem_fim)}</div>
                </div>
                <div className="rounded-md border-l-4 border-slate-400 bg-slate-400/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-700 dark:text-slate-200 font-semibold">Desmontagem</div>
                  <div className="text-lg font-medium">{fmtRange(selecionado.data_desmontagem, selecionado.data_desmontagem_fim)}</div>
                </div>
              </div>

              {selecionado.observacoes && (
                <div>
                  <div className="text-sm uppercase tracking-wide text-muted-foreground font-semibold mb-1">Observações</div>
                  <div className="whitespace-pre-wrap">{selecionado.observacoes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelecionado(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-sm uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-lg">{value?.trim() ? value : "—"}</div>
    </div>
  );
}
