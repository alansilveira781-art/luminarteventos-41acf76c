import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ProdutoresCard, AlcadasCard } from "@/components/financeiro/BonificacaoConfig";

export const Route = createFileRoute("/financeiro-op/bonificacao/configuracoes")({
  component: BonificacaoConfigPage,
  head: () => ({
    meta: [
      { title: "Configurações da Bonificação | Financeiro" },
      { name: "description", content: "Cadastro de produtores e alçadas de complexidade usadas no cálculo da bonificação." },
      { property: "og:title", content: "Configurações da Bonificação | Financeiro" },
      { property: "og:description", content: "Produtores e alçadas de complexidade da bonificação de produção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BonificacaoConfigPage() {
  const { isAdmin, modulos, loading } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro_op" && m.is_admin);
  if (loading) return null;
  if (!isFinAdmin) return <Navigate to="/financeiro-op/bonificacao" />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Configurações da Bonificação"
        description="Produtores e alçadas de complexidade usadas no cálculo dos valores."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/financeiro-op/bonificacao">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <ProdutoresCard />
      <AlcadasCard isAdmin={isAdmin} />
    </div>
  );
}
