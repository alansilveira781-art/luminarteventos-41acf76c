import { createFileRoute } from "@tanstack/react-router";
import { PatrimonioMovimentacoes } from "@/components/patrimonio/Movimentacoes";

export const Route = createFileRoute("/patrimonio/saidas")({
  component: () => <PatrimonioMovimentacoes tipo="saida" titulo="Saídas de Patrimônio" descricao="Empréstimos para eventos, manutenções e transferências" />,
});
