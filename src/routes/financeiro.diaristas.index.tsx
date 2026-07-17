import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro/diaristas/")({
  component: DiaristasIndex,
});

function DiaristasIndex() {
  const { isAdmin, modulos } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro" && m.is_admin);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Diaristas"
          description="Gestão de diaristas: cadastro, apontamento e fechamento."
        />
        {isFinAdmin && (
          <Button asChild variant="outline">
            <Link to="/financeiro/diaristas/configuracoes">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Link>
          </Button>
        )}
      </div>
      <Card className="p-8 text-center text-muted-foreground text-sm">
        Em breve — apontamento diário e fechamento por período.
      </Card>
    </div>
  );
}
