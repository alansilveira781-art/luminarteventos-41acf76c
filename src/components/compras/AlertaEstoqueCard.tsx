import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, PackageX, ShoppingCart, Search } from "lucide-react";
import { normalize } from "@/lib/utils";

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

type SortMode = "saidas_desc" | "saidas_asc";

export function AlertaEstoqueCard() {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("saidas_desc");

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

  const sb = supabase as any;
  const { data: saidasPorItem = new Map<string, number>() } = useQuery({
    queryKey: ["alerta-estoque-saidas"],
    queryFn: async () => {
      const map = new Map<string, number>();
      // Saídas diretas (1 item)
      const { data: diretas } = await sb
        .from("movimentacoes")
        .select("id,item_id,quantidade,tipo")
        .eq("tipo", "saida");
      const maeIds: string[] = [];
      for (const m of (diretas ?? []) as any[]) {
        if (m.item_id) {
          map.set(m.item_id, (map.get(m.item_id) ?? 0) + Number(m.quantidade || 0));
        } else {
          maeIds.push(m.id);
        }
      }
      // Saídas multi-item
      if (maeIds.length) {
        const chunkSize = 500;
        for (let i = 0; i < maeIds.length; i += chunkSize) {
          const slice = maeIds.slice(i, i + chunkSize);
          const { data: filhos } = await sb
            .from("movimentacao_itens")
            .select("item_id,quantidade")
            .in("movimentacao_id", slice);
          for (const f of (filhos ?? []) as any[]) {
            if (!f.item_id) continue;
            map.set(f.item_id, (map.get(f.item_id) ?? 0) + Number(f.quantidade || 0));
          }
        }
      }
      return map;
    },
  });

  const filtradosOrdenados = useMemo(() => {
    const term = normalize(query);
    const list = term
      ? itens.filter((i) => normalize(i.nome).includes(term) || normalize(i.codigo).includes(term))
      : itens.slice();
    const dir = sortMode === "saidas_desc" ? -1 : 1;
    list.sort((a, b) => {
      const sa = saidasPorItem.get(a.id) ?? 0;
      const sb2 = saidasPorItem.get(b.id) ?? 0;
      if (sa !== sb2) return (sa - sb2) * dir;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return list;
  }, [itens, query, sortMode, saidasPorItem]);

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

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto…"
            className="pl-8 h-9"
          />
        </div>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-full sm:w-56 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="saidas_desc">Mais saídas primeiro</SelectItem>
            <SelectItem value="saidas_asc">Menos saídas primeiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-auto max-h-[60vh] rounded-md">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground sticky top-0 bg-warning/10 backdrop-blur z-10">
            <tr>
              <th className="px-2 py-1 text-left">Item</th>
              <th className="px-2 py-1 text-left">Categoria</th>
              <th className="px-2 py-1 text-right">Atual</th>
              <th className="px-2 py-1 text-right">Mínimo</th>
              <th className="px-2 py-1 text-right">Saídas</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {filtradosOrdenados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Nenhum item encontrado para "{query}".
                </td>
              </tr>
            ) : filtradosOrdenados.map((i) => (
              <tr key={i.id} className="border-t border-warning/20">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{i.nome}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{i.codigo}</div>
                </td>
                <td className="px-2 py-1.5 text-xs">{i.categoria ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Number(i.quantidade_atual)} {i.unidade}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{Number(i.quantidade_minima)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{(saidasPorItem.get(i.id) ?? 0).toLocaleString("pt-BR")}</td>
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
      </div>
    </Card>
  );
}
