import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { listVendasDb } from "@/lib/comercial/vendas-db.functions";
import { applyFilters, filtrosIniciais, previousPeriod, getAno, type Filtros } from "@/lib/comercial/vendas-metrics";
import { DashboardCtx } from "@/lib/comercial/dashboard-context";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/comercial/dashboard")({
  component: DashboardLayout,
});


function DashboardLayout() {
  const qc = useQueryClient();

  const [filtros, setFiltros] = usePersistedState<Filtros>("comercial.dashboard.filtros.v4", filtrosIniciais);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-db", "dashboard"],
    queryFn: () => listVendasDb(),
    staleTime: 30 * 1000,
  });

  const rows = data?.rows ?? [];

  // Realtime: invalida cache do dashboard ao inserir/editar/excluir venda
  useEffect(() => {
    const channel = supabase
      .channel("comercial_vendas_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comercial_vendas" },
        () => { qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Se o ano selecionado não tem dados, cai para o último ano com dados
  // (ou "Todos" se não houver dados). Nunca deixa o filtro num ano vazio.
  useEffect(() => {
    if (!rows.length) return;
    if (filtros.ano === "Todos") return;
    const anosComDados = new Set<number>();
    for (const r of rows) {
      const a = getAno(r);
      if (a) anosComDados.add(a);
    }
    if (!anosComDados.has(filtros.ano as number)) {
      const ultimo = [...anosComDados].sort((a, b) => b - a)[0];
      setFiltros({ ...filtros, ano: ultimo ?? "Todos" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, filtros.ano]);

  const filtered = useMemo(() => applyFilters(rows, filtros), [rows, filtros]);
  const previous = useMemo(() => previousPeriod(rows, filtros), [rows, filtros]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Dashboard Comercial"
        description="Vendas cadastradas na aba Vendas"
      />




      {isLoading && (
        <Card className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
        </Card>
      )}

      {!isLoading && (error || data?.error) && (
        <Card className="p-6 flex items-start gap-3 text-sm border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <div className="font-medium text-destructive">Não foi possível carregar os dados</div>
            <div className="text-muted-foreground mt-1">{(error as Error)?.message ?? data?.error}</div>
          </div>
        </Card>
      )}

      {!isLoading && !data?.error && data && (
        <DashboardCtx.Provider
          value={{ rows, filtered, previous, filtros, setFiltros, fetchedAt: data.fetchedAt }}
        >
          {rows.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Nenhuma venda foi carregada. Se você já cadastrou vendas, isso pode indicar um problema de permissão (RLS) ou de carregamento. Verifique os logs ou contate o suporte.
            </Card>
          ) : (
            <Outlet />
          )}
        </DashboardCtx.Provider>
      )}
    </div>
  );
}
