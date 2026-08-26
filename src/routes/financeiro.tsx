import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const { isMasterAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search }) as Record<string, unknown>;
  if (loading) return null;
  // O quadro antigo foi desativado: todas as aquisições vivem em Compras.
  // Links antigos (/financeiro?id=...) apontavam para cards de aquisição.
  if (pathname === "/financeiro" || pathname === "/financeiro/") {
    const id = typeof search?.id === "string" ? search.id : undefined;
    return id ? <Navigate to="/compras" search={{ id, origem: "demanda" }} /> : <Navigate to="/compras" />;
  }
  // Dashboard/configurações legados permanecem restritos durante a transição.
  if (!isMasterAdmin) return <Navigate to="/" />;
  return <Outlet />;
}
