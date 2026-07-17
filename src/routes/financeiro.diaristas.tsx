import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro/diaristas")({
  component: DiaristasLayout,
});

function DiaristasLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !hasModule("financeiro")) return <Navigate to="/" />;
  return <Outlet />;
}
