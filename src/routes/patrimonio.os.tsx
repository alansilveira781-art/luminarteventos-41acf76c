import { createFileRoute } from "@tanstack/react-router";
import { PatrimonioOS } from "@/components/patrimonio/OrdensServico";

export const Route = createFileRoute("/patrimonio/os")({
  component: () => <PatrimonioOS />,
});
