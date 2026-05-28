import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { CARD_STATUSES } from "@/lib/comercial/types";
import { StatusDefaultsTable } from "@/components/StatusDefaultsTable";

export const Route = createFileRoute("/comercial/configuracoes")({
  component: ComercialConfiguracoes,
});

function ComercialConfiguracoes() {
  const { isAdmin, modulos } = useAuth();
  const isComercialAdmin = isAdmin || modulos.some((m) => m.slug === "comercial" && m.is_admin);
  if (!isComercialAdmin) return <Navigate to="/comercial" />;

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Defina o responsável padrão de cada status do quadro de vendas. Ao mover um card para um status com padrão configurado, o consultor é atribuído automaticamente."
      />
      <StatusDefaultsTable
        tableName="comercial_status_defaults"
        moduleSlug="comercial"
        statuses={CARD_STATUSES as unknown as { key: string; label: string; color: string }[]}
      />
    </>
  );
}
