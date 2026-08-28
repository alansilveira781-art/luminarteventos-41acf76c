import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, PackageX, ShoppingCart, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type ItemLinha = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  quantidade_atual: number;
  quantidade_minima: number;
  status: string;
  saidas: number;
  total_count: number;
};

const PAGE_SIZE = 15;
const sb = supabase as any;

export function AlertaEstoqueCard() {
  const [query, setQuery] = useState("");
  const busca = useDebouncedValue(query, 350);
  const [status, setStatus] = useState<string>("alerta");
  const [categoria, setCategoria] = useState<string>("todas");
  const [ordem, setOrdem] = useState<string>("saidas_desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [busca, status, categoria, ordem]);

  const { data: resumo } = useQuery({
    queryKey: ["compras-estoque-resumo"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("compras_estoque_resumo");
      if (error) throw error;
      const r = (data ?? [])[0] ?? {};
      return {
        sem: Number(r.sem_estoque ?? 0),
        baixo: Number(r.baixo_estoque ?? 0),
        disponivel: Number(r.disponivel ?? 0),
        total: Number(r.total ?? 0),
      };
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["compras-estoque-categorias"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("compras_estoque_categorias");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => String(r.categoria));
    },
    staleTime: 5 * 60_000,
  });

  const { data, isFetching } = useQuery({
    queryKey: ["compras-estoque-lista", busca, status, categoria, ordem, page],
    queryFn: async () => {
      const { data, error } = await sb.rpc("compras_estoque_listar", {
        _busca: busca || null,
        _status: status,
        _categoria: categoria === "todas" ? null : categoria,
        _ordem: ordem,
        _limite: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as ItemLinha[];
    },
    placeholderData: keepPreviousData,
  });

  const linhas = data ?? [];
  const total = linhas[0]?.total_count != null ? Number(linhas[0].total_count) : 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inicio = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const fim = Math.min(total, (page + 1) * PAGE_SIZE);

  const semEstoque = resumo?.sem ?? 0;
  const baixoEstoque = resumo?.baixo ?? 0;
  const alertas = semEstoque + baixoEstoque;

  return (
    <Card className={`p-4 mb-4 ${alertas > 0 ? "border-warning/40 bg-warning/5" : "border-border"}`}>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            alertas > 0 ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
          }`}
        >
          {alertas > 0 ? <AlertTriangle className="h-5 w-5" /> : <span>✓</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Estoque</div>
          <div className="text-xs text-muted-foreground">
            {alertas > 0 ? (
              <>
                {semEstoque > 0 && <span className="text-destructive font-medium">{semEstoque} sem estoque</span>}
                {semEstoque > 0 && baixoEstoque > 0 && <span> · </span>}
                {baixoEstoque > 0 && <span>{baixoEstoque} com baixo estoque</span>}
                {" — considere abrir solicitações de compra."}
              </>
            ) : (
              "Nenhum item com baixo estoque ou sem estoque no momento."
            )}
            {resumo ? ` · ${resumo.total} itens cadastrados` : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou código…"
            className="pl-8 h-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alerta">Precisa de atenção</SelectItem>
            <SelectItem value="todos">Todos os itens</SelectItem>
            <SelectItem value="sem_estoque">Sem estoque</SelectItem>
            <SelectItem value="baixo_estoque">Baixo estoque</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="saidas_desc">Mais saídas primeiro</SelectItem>
            <SelectItem value="saidas_asc">Menos saídas primeiro</SelectItem>
            <SelectItem value="saldo_asc">Menor saldo primeiro</SelectItem>
            <SelectItem value="nome">Nome (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-auto rounded-md">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
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
          <tbody className={isFetching ? "opacity-60" : undefined}>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Nenhum item encontrado.
                </td>
              </tr>
            ) : linhas.map((i) => (
              <tr key={i.id} className="border-t border-border/60">
                <td className="px-2 py-1.5">
                  <div className="font-medium">{i.nome}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{i.codigo}</div>
                </td>
                <td className="px-2 py-1.5 text-xs">{i.categoria ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Number(i.quantidade_atual)} {i.unidade}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{Number(i.quantidade_minima)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{Number(i.saidas ?? 0)}</td>
                <td className="px-2 py-1.5">
                  {i.status === "sem_estoque" ? (
                    <Badge variant="destructive" className="gap-1"><PackageX className="h-3 w-3" /> Sem estoque</Badge>
                  ) : i.status === "baixo_estoque" ? (
                    <Badge variant="outline" className="gap-1 border-warning text-warning">Baixo estoque</Badge>
                  ) : (
                    <Badge variant="outline">{i.status === "disponivel" ? "Disponível" : i.status}</Badge>
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

      <div className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {total === 0 ? "Nenhum item" : `${inicio}–${fim} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">Página {page + 1} de {totalPaginas}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={page + 1 >= totalPaginas}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
