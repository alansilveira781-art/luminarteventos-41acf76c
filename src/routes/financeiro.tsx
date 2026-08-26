import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const { isMasterAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (loading) return null;
  // O quadro antigo foi desativado: todas as aquisições vivem em Compras.
  if (pathname === "/financeiro" || pathname === "/financeiro/") return <Navigate to="/compras" />;
  // Dashboard/configurações legados permanecem restritos durante a transição.
  if (!isMasterAdmin) return <Navigate to="/" />;
  return <Outlet />;
}
