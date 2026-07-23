import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/operacao")({ component: OperacaoLayout });

function OperacaoLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !hasModule("operacao")) return <Navigate to="/" />;
  return <Outlet />;
}
