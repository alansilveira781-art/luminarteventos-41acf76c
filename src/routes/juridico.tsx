import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useJuridicoSolicitante } from "@/hooks/useJuridicoSolicitante";

export const Route = createFileRoute("/juridico")({ component: JuridicoLayout });

function JuridicoLayout() {
  const { isAdmin, hasModule, loading } = useAuth();
  const { podeSolicitar, loading: loadingSolic } = useJuridicoSolicitante();
  const { pathname } = useLocation();
  if (loading || loadingSolic) return null;
  const temModulo = isAdmin || hasModule("juridico");
  // Usuários liberados apenas para o formulário acessam somente /juridico/solicitar
  if (!temModulo) {
    if (pathname.startsWith("/juridico/solicitar") && podeSolicitar) return <Outlet />;
    return <Navigate to="/" />;
  }
  return <Outlet />;
}
