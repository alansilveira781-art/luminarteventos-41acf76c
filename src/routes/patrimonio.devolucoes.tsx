import { createFileRoute } from "@tanstack/react-router";
import { PatrimonioDevolucoes } from "@/components/patrimonio/Devolucoes";

export const Route = createFileRoute("/patrimonio/devolucoes")({
  component: () => <PatrimonioDevolucoes />,
});
