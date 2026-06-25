import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/financeiro-op/")({
  component: () => <Navigate to="/financeiro-op/dashboard" />,
});
