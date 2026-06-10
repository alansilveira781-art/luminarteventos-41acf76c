import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/comercial/dashboard/")({
  component: () => <Navigate to="/comercial/dashboard/painel" />,
});
