import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UberDashboard } from "@/components/financeiro/UberDashboard";
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

function FinanceiroOpDashboard() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

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
        <PageHeader title="Dashboard Uber" description="Base completa importada na aba Uber" />
        <UberDashboard />
      </TabsContent>
    </Tabs>
  );
}

