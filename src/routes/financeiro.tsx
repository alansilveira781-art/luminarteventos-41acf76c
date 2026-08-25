import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const { isMasterAdmin, loading } = useAuth();
  if (loading) return null;
  // Aquisições foi unificado ao Quadro de Compras; a tela antiga fica só para admins mestres.
  if (!isMasterAdmin) return <Navigate to="/" />;
  return <Outlet />;
}
