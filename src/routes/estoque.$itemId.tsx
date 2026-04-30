import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { movementKindLabels, entradaTipoLabels, saidaTipoLabels, condicaoLabels } from "@/lib/labels";

export const Route = createFileRoute("/estoque/$itemId")({
  component: ItemHistorico,
});

function ItemHistorico() {
  const { itemId } = Route.useParams();

  const { data: item } = useQuery({
    queryKey: ["item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("itens").select("*").eq("id", itemId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: movs } = useQuery({
    queryKey: ["item-movs", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, fornecedor:fornecedores(nome), solicitante:solicitantes(nome)")
        .eq("item_id", itemId)
        .order("data_movimento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!item) return <div className="text-muted-foreground">Carregando…</div>;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/estoque"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>

      <PageHeader title={item.nome} description={`Código ${item.codigo}`} />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Quantidade atual</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{Number(item.quantidade_atual)} {item.unidade}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Mínima</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{Number(item.quantidade_minima)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent><StatusBadge status={item.status} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de movimentações</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Subtipo</th>
                  <th className="py-2 pr-4 text-right">Qtd</th>
                  <th className="py-2 pr-4">Origem</th>
                  <th className="py-2 pr-4">Responsável</th>
                  <th className="py-2 pr-0">Obs</th>
                </tr>
              </thead>
              <tbody>
                {movs?.length ? movs.map((m: any) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-2.5 pr-4">{movementKindLabels[m.tipo]}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {m.tipo === "entrada" && m.entrada_tipo ? entradaTipoLabels[m.entrada_tipo] : null}
                      {m.tipo === "saida" && m.saida_tipo ? saidaTipoLabels[m.saida_tipo] : null}
                      {m.tipo === "devolucao" && m.condicao ? condicaoLabels[m.condicao] : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span className={m.tipo === "saida" ? "text-destructive" : "text-success"}>
                        {m.tipo === "saida" ? "-" : "+"}{Number(m.quantidade)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{m.fornecedor?.nome ?? m.solicitante?.nome ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{m.responsavel_lancamento ?? "—"}</td>
                    <td className="py-2.5 text-muted-foreground truncate max-w-[200px]">{m.observacoes ?? ""}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sem movimentações.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
