import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/comercial")({
  component: ComercialLayout,
});

function ComercialLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !hasModule("comercial")) return <Navigate to="/" />;
  return <Outlet />;
}
