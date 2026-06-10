import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import type { VendaRow } from "@/lib/comercial/vendas.functions";
import {
  listVendasDb,
  getLastSync,
  syncVendasFromDropbox,
  syncVendasFromUpload,
} from "@/lib/comercial/vendas-db.functions";

import { applyFilters, filtrosIniciais, previousPeriod, type Filtros } from "@/lib/comercial/vendas-metrics";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Loader2, AlertTriangle, RefreshCw, CloudDownload, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
export function useDashboard(): Ctx {
  const c = useContext(DashboardCtx);
  if (c) return c;
  return {
    rows: [],
    filtered: [],
    previous: [],
    filtros: filtrosIniciais,
    setFiltros: () => {},
    fetchedAt: "",
  };
}

const TABS = [
  { to: "/comercial/dashboard/painel", label: "Painel de Vendas" },
  { to: "/comercial/dashboard/relatorios", label: "Relatórios de Vendas" },
  { to: "/comercial/dashboard/vendedores", label: "Vendedores" },
  { to: "/comercial/dashboard/indicadores", label: "Indicadores" },
  { to: "/comercial/dashboard/propostas", label: "Propostas" },
] as const;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function DashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [filtros, setFiltros] = usePersistedState<Filtros>("comercial.dashboard.filtros.v1", filtrosIniciais);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-db"],
    queryFn: () => listVendasDb(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: lastSync } = useQuery({
    queryKey: ["comercial-vendas-last-sync"],
    queryFn: () => getLastSync(),
    staleTime: 30 * 1000,
  });

  const rows = data?.rows ?? [];

  useEffect(() => {
    if (!rows.length) return;
    if (filtros.ano === "Todos") return;
    const anosComDados = new Set<number>();
    for (const r of rows) {
      const a = r.anoEvento ?? r.ano;
      if (a) anosComDados.add(a);
    }
    if (!anosComDados.has(filtros.ano as number)) {
      const ultimo = Math.max(...anosComDados);
      if (Number.isFinite(ultimo)) setFiltros({ ...filtros, ano: ultimo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const filtered = useMemo(() => applyFilters(rows, filtros), [rows, filtros]);
  const previous = useMemo(() => previousPeriod(rows, filtros), [rows, filtros]);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] }),
      qc.invalidateQueries({ queryKey: ["comercial-vendas-last-sync"] }),
    ]);
  }

  async function handleSyncDropbox() {
    setSyncing(true);
    const t = toast.loading("Sincronizando com Dropbox...");
    try {
      const r = await syncVendasFromDropbox();
      if (r.ok) {
        toast.success(
          `Sincronizado: ${r.rows_total} linhas (novas: ${r.rows_inserted}, atualizadas: ${r.rows_updated})`,
          { id: t },
        );
        await refreshAll();
      } else {
        toast.error(r.error ?? "Falha ao sincronizar", { id: t });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado", { id: t });
    } finally {
      setSyncing(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncing(true);
    const t = toast.loading(`Importando ${file.name}...`);
    try {
      const buf = await file.arrayBuffer();
      // ArrayBuffer -> base64
      let bin = "";
      const view = new Uint8Array(buf);
      const CHUNK = 0x8000;
      for (let i = 0; i < view.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(view.subarray(i, i + CHUNK)));
      }
      const base64 = btoa(bin);
      const r = await syncVendasFromUpload({ data: { base64 } });
      if (r.ok) {
        toast.success(
          `Importado: ${r.rows_total} linhas (novas: ${r.rows_inserted}, atualizadas: ${r.rows_updated})`,
          { id: t },
        );
        await refreshAll();
      } else {
        toast.error(r.error ?? "Falha ao importar", { id: t });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado", { id: t });
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Dashboard Comercial"
        description={`Base local · Última sincronização: ${formatWhen(lastSync?.finished_at ?? lastSync?.started_at)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar .xlsx
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncDropbox}
              disabled={syncing}
            >
              <CloudDownload className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
              Sincronizar agora
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
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
            <div className="text-muted-foreground mt-2 text-xs">
              Dica: clique em "Sincronizar agora" para popular a base a partir do Dropbox.
            </div>
          </div>
        </Card>
      )}

      {!isLoading && !data?.error && data && (
        <DashboardCtx.Provider
          value={{ rows, filtered, previous, filtros, setFiltros, fetchedAt: data.fetchedAt }}
        >
          {rows.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Nenhum dado na base ainda. Clique em <strong>Sincronizar agora</strong> para
              importar do Dropbox ou <strong>Importar .xlsx</strong> para enviar o arquivo manualmente.
            </Card>
          ) : (
            <Outlet />
          )}
        </DashboardCtx.Provider>
      )}
    </div>
  );
}
