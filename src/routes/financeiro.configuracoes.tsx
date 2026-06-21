import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { DEMANDA_STATUSES } from "@/lib/demandas";
import { StatusDefaultsTable } from "@/components/StatusDefaultsTable";

export const Route = createFileRoute("/financeiro/configuracoes")({
  component: FinanceiroConfiguracoes,
});

function FinanceiroConfiguracoes() {
  const { isAdmin, modulos } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro" && m.is_admin);
  if (!isFinAdmin) return <Navigate to="/financeiro" />;

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Defina o responsável padrão de cada status do Quadro de Despesas. Ao mover um card para um status com padrão configurado, o responsável é atribuído automaticamente."
      />
      <StatusDefaultsTable
        tableName="financeiro_status_defaults"
        moduleSlug="financeiro"
        statuses={DEMANDA_STATUSES as unknown as { key: string; label: string; color: string }[]}
      />
    </>
  );
}
