import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro-op")({
  component: FinanceiroOpLayout,
});

function FinanceiroOpLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !hasModule("financeiro_op")) return <Navigate to="/" />;
  return <Outlet />;
}
