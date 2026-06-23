import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useDashboard } from "./comercial.dashboard";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { DollarSign } from "lucide-react";

export const Route = createFileRoute("/comercial/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { rows, filtered, filtros, setFiltros } = useDashboard();

  const totalVendas = useMemo(
    () => filtered.reduce((s, r) => s + (r.valorFinal || 0), 0),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <FiltrosBar
          rows={rows}
          filtros={filtros}
          onChange={setFiltros}
          fields={["empresa", "ano", "mes"]}
        />
        <div className="mt-2 text-xs text-muted-foreground">
          {rows.length.toLocaleString("pt-BR")} vendas carregadas
          {" · "}
          {filtered.length.toLocaleString("pt-BR")} no filtro atual
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Vendas Totais" Icon={DollarSign} valor={totalVendas} />
      </div>
    </div>
  );
}
