import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const UberDashboard = lazy(() =>
  import("@/components/financeiro/UberDashboard").then((m) => ({ default: m.UberDashboard })),
);
const ContaAzulDashboard = lazy(() =>
  import("@/components/financeiro/ContaAzulDashboard").then((m) => ({ default: m.ContaAzulDashboard })),
);

const ChartFallback = () => (
  <div className="flex items-center justify-center py-12 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);

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
        <Suspense fallback={<ChartFallback />}>
          <ContaAzulDashboard />
        </Suspense>
      </TabsContent>

      <TabsContent value="uber" className="mt-0">
        <PageHeader title="Dashboard Uber" description="Base completa importada na aba Uber" />
        <Suspense fallback={<ChartFallback />}>
          <UberDashboard />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
