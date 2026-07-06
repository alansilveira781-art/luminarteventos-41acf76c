import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { ContaAzulDashboard } from "@/components/financeiro/ContaAzulDashboard";

export const Route = createFileRoute("/financeiro-op/dashboard")({
  component: FinanceiroOpDashboard,
});

function FinanceiroOpDashboard() {
  return (
    <div>
      <PageHeader title="Financeiro (Conta Azul)" description="Painel, análise por evento e fluxo de caixa" />
      <ContaAzulDashboard />
    </div>
  );
}
