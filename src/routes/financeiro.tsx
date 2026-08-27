import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const search = useRouterState({ select: (state) => state.location.search }) as Record<string, unknown>;
  // Módulo Aquisições encerrado: tudo vive no Quadro de Compras.
  const id = typeof search?.id === "string" ? search.id : undefined;
  return id ? <Navigate to="/compras" search={{ id, origem: "demanda" }} /> : <Navigate to="/compras" />;
}

