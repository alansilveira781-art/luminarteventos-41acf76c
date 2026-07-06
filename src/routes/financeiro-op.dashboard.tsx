import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UberDashboard } from "@/components/financeiro/UberDashboard";
import { UberImportButton } from "@/components/financeiro/UberImportButton";
import { ContaAzulDashboard } from "@/components/financeiro/ContaAzulDashboard";

export const Route = createFileRoute("/financeiro-op/dashboard")({
  component: FinanceiroOpDashboard,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: ((): "contaazul" | "uber" => {
      const v = s.tab as string;
      if (v === "uber") return "uber";
      return "contaazul";
    })(),
  }),
});

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function FinanceiroOpDashboard() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [uberFrom, setUberFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 23);
    return startOfMonth(d);
  });
  const [uberTo, setUberTo] = useState(() => today());

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as "contaazul" | "uber" }, replace: true })}
      className="w-full"
    >
      <TabsList className="mb-4">
        <TabsTrigger value="contaazul">Financeiro (Conta Azul)</TabsTrigger>
        <TabsTrigger value="uber">Uber</TabsTrigger>
      </TabsList>

      <TabsContent value="contaazul" className="mt-0">
        <PageHeader title="Financeiro (Conta Azul)" description="Painel, análise por evento e fluxo de caixa" />
        <ContaAzulDashboard />
      </TabsContent>

      <TabsContent value="uber" className="mt-0">
        <PageHeader title="Dashboard Uber Business" description="Corridas, gastos e padrões da sua organização Uber" />

        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
            <Input type="date" value={uberFrom} onChange={(e) => setUberFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
            <Input type="date" value={uberTo} onChange={(e) => setUberTo(e.target.value)} className="w-44" />
          </div>
        </div>

        <UberDashboard from={uberFrom} to={uberTo} />
      </TabsContent>
    </Tabs>
  );
}
