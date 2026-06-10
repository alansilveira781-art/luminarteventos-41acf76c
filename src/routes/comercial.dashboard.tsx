import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { listVendasDropbox, type VendaRow } from "@/lib/comercial/vendas.functions";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { applyFilters, filtrosIniciais, previousPeriod, type Filtros } from "@/lib/comercial/vendas-metrics";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/comercial/dashboard")({
  component: DashboardLayout,
});

type Ctx = {
  rows: VendaRow[];
  filtered: VendaRow[];
  previous: VendaRow[];
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  fetchedAt: string;
};

const DashboardCtx = createContext<Ctx | null>(null);
export function useDashboard() {
  const c = useContext(DashboardCtx);
  if (!c) throw new Error("useDashboard fora do provider");
  return c;
}

const TABS = [
  { to: "/comercial/dashboard/painel", label: "Painel de Vendas" },
  { to: "/comercial/dashboard/relatorios", label: "Relatórios de Vendas" },
  { to: "/comercial/dashboard/vendedores", label: "Vendedores" },
  { to: "/comercial/dashboard/indicadores", label: "Indicadores" },
] as const;

function DashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [filtros, setFiltros] = usePersistedState<Filtros>("comercial.dashboard.filtros.v1", filtrosIniciais);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-dropbox"],
    queryFn: () => listVendasDropbox(),
    staleTime: 5 * 60 * 1000,
  });

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => applyFilters(rows, filtros), [rows, filtros]);
  const previous = useMemo(() => previousPeriod(rows, filtros), [rows, filtros]);

  const showTrimestre = pathname.includes("/indicadores");

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Dashboard Comercial"
        description="Dados carregados do CONTROLE DE VENDAS (Dropbox)"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["comercial-vendas-dropbox"] })}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Card className="p-4">
        <FiltrosBar rows={rows} filtros={filtros} onChange={setFiltros} showTrimestre={showTrimestre} />
      </Card>

      {isLoading && (
        <Card className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
        </Card>
      )}

      {!isLoading && (error || data?.error) && (
        <Card className="p-6 flex items-start gap-3 text-sm border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <div className="font-medium text-destructive">Não foi possível carregar a planilha</div>
            <div className="text-muted-foreground mt-1">{(error as Error)?.message ?? data?.error}</div>
          </div>
        </Card>
      )}

      {!isLoading && !data?.error && data && (
        <DashboardCtx.Provider
          value={{ rows, filtered, previous, filtros, setFiltros, fetchedAt: data.fetchedAt }}
        >
          <Outlet />
        </DashboardCtx.Provider>
      )}
    </div>
  );
}
