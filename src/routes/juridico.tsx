import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/juridico")({ component: JuridicoLayout });

function JuridicoLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  if (loading) return null;
  if (!(isAdmin || hasModule("juridico"))) return <Navigate to="/" />;
  return <Outlet />;
}
