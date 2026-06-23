import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/comercial/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  return (
    <Card className="p-8 text-sm text-muted-foreground">
      Dashboard em reconstrução. Vamos adicionar os cards e gráficos um a um.
    </Card>
  );
}
