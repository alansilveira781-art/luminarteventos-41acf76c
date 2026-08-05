import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { DistribuicaoBonificacao } from "@/components/financeiro/DistribuicaoBonificacao";

export const Route = createFileRoute("/financeiro-op/bonificacao/")({
  component: BonificacaoPage,
  head: () => ({
    meta: [
      { title: "Bonificação de Produção | Financeiro" },
      { name: "description", content: "Distribuição de bonificação por produtor a partir dos eventos realizados no calendário." },
      { property: "og:title", content: "Bonificação de Produção | Financeiro" },
      { property: "og:description", content: "Distribuição de bonificação por produtor a partir dos eventos realizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BonificacaoPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Bonificação"
        description="Distribuição de bonificação por produtor, com base nos eventos realizados no calendário."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/financeiro-op/bonificacao/configuracoes">
              <Settings className="h-4 w-4" /> Configurações
            </Link>
          </Button>
        }
      />
      <DistribuicaoBonificacao />
    </div>
  );
}
