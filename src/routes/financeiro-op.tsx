import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useDiaristaAcesso } from "@/lib/diaristas-acesso";

export const Route = createFileRoute("/financeiro-op")({
  component: FinanceiroOpLayout,
});

function FinanceiroOpLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  const { podeLancar, loading: loadingAcesso } = useDiaristaAcesso();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || loadingAcesso) return null;

  const temModulo = isAdmin || hasModule("financeiro_op");
  // Lançadores de diárias acessam apenas as telas de diaristas.
  const ehRotaDiaristas = pathname.startsWith("/financeiro-op/diaristas");

  if (!temModulo && !(podeLancar && ehRotaDiaristas)) return <Navigate to="/" />;
  return <Outlet />;
}
