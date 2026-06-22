import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/comercial/dashboard/painel")({
  component: PainelVendas,
});

function PainelVendas() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Painel de Vendas — em reconstrução</p>
      </Card>
    </div>
  );
}
