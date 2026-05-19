import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, PackageX, ShoppingCart } from "lucide-react";

type ItemAlerta = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  quantidade_atual: number;
  quantidade_minima: number;
  unidade: string;
  status: string;
};

export function AlertaEstoqueCard() {
  const { data: itens = [] } = useQuery({
    queryKey: ["alerta-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id,codigo,nome,categoria,quantidade_atual,quantidade_minima,unidade,status")
        .in("status", ["baixo_estoque", "sem_estoque"])
        .order("status", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemAlerta[];
    },
  });

  if (itens.length === 0) {
    return (
      <Card className="p-4 mb-4 border-success/30 bg-success/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-success/15 text-success flex items-center justify-center">
            ✓
          </div>
          <div>
            <div className="text-sm font-semibold">Estoque saudável</div>
            <div className="text-xs text-muted-foreground">Nenhum item com baixo estoque ou sem estoque no momento.</div>
          </div>
        </div>
      </Card>
    );
  }

  const semEstoque = itens.filter((i) => i.status === "sem_estoque");
  const baixoEstoque = itens.filter((i) => i.status === "baixo_estoque");

  return (
    <Card className="p-4 mb-4 border-warning/40 bg-warning/5">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Alerta de estoque</div>
          <div className="text-xs text-muted-foreground">
            {semEstoque.length > 0 && <span className="text-destructive font-medium">{semEstoque.length} sem estoque</span>}
            {semEstoque.length > 0 && baixoEstoque.length > 0 && <span> · </span>}
            {baixoEstoque.length > 0 && <span>{baixoEstoque.length} com baixo estoque</span>}
            {" — considere abrir solicitações de compra."}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left">Item</th>
              <th className="px-2 py-1 text-left">Categoria</th>
              <th className="px-2 py-1 text-right">Atual</th>
              <th className="px-2 py-1 text-right">Mínimo</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {itens.slice(0, 12).map((i) => (
              <tr key={i.id} className="border-t border-warning/20">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{i.nome}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{i.codigo}</div>
                </td>
                <td className="px-2 py-1.5 text-xs">{i.categoria ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Number(i.quantidade_atual)} {i.unidade}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{Number(i.quantidade_minima)}</td>
                <td className="px-2 py-1.5">
                  {i.status === "sem_estoque" ? (
                    <Badge variant="destructive" className="gap-1"><PackageX className="h-3 w-3" /> Sem estoque</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-warning text-warning">Baixo estoque</Badge>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/compras" search={{ novoItem: i.id } as any}>
                      <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Solicitar
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itens.length > 12 && (
          <div className="text-xs text-muted-foreground text-center pt-2">+ {itens.length - 12} outros itens — ver lista completa em Estoque</div>
        )}
      </div>
    </Card>
  );
}
