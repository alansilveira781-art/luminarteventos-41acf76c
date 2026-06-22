import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/comercial/dashboard/indicadores")({
  component: Indicadores,
});

function Indicadores() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Indicadores — em reconstrução</p>
      </Card>
    </div>
  );
}
