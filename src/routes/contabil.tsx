import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/contabil")({
  component: ContabilLayout,
});

function ContabilLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !hasModule("contabil")) return <Navigate to="/" />;
  return <Outlet />;
}
