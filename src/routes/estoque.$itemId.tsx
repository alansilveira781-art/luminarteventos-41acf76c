import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { movementKindLabels, entradaTipoLabels, saidaTipoLabels, condicaoLabels } from "@/lib/labels";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque/$itemId")({
  component: ItemHistorico,
});

function ItemHistorico() {
  const { itemId } = Route.useParams();
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth();
  const isAdmin = isModuleAdmin("estoque");

  const { data: item } = useQuery({
    queryKey: ["item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("itens").select("*").eq("id", itemId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Item não encontrado");
      return data;
    },
  });

  const reconciliar = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("reconciliar_estoque", { p_item_id: itemId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (novoSaldo) => {
      qc.invalidateQueries({ queryKey: ["item", itemId] });
      qc.invalidateQueries({ queryKey: ["item-movs", itemId] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success(`Saldo recalculado: ${Number(novoSaldo)} ${item?.unidade ?? ""}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao recalcular"),
  });

  const { data: movs } = useQuery({
    queryKey: ["item-movs", itemId],
    queryFn: async () => {
      // 1) Movimentações diretas (item_id direto)
      const { data: diretas, error: e1 } = await supabase
        .from("movimentacoes")
        .select(
          "id,tipo,data_movimento,quantidade,entrada_tipo,saida_tipo,condicao,observacoes,responsavel_lancamento,requisicao_numero,evento_projeto,fornecedor_id,solicitante_id,fornecedor:fornecedores(nome),solicitante:solicitantes(nome)"
        )
        .eq("item_id", itemId)
        .order("data_movimento", { ascending: false });
      if (e1) throw e1;

      // 2) Movimentações vindas de movimentacao_itens (multi-item)
      const { data: filhos, error: e2 } = await supabase
        .from("movimentacao_itens")
        .select(
          "quantidade,movimentacao:movimentacoes(id,tipo,data_movimento,entrada_tipo,saida_tipo,condicao,observacoes,responsavel_lancamento,requisicao_numero,evento_projeto,fornecedor_id,solicitante_id,fornecedor:fornecedores(nome),solicitante:solicitantes(nome))"
        )
        .eq("item_id", itemId);
      if (e2) throw e2;

      const indiretas = (filhos ?? [])
        .filter((f: any) => f.movimentacao)
        .map((f: any) => ({ ...f.movimentacao, quantidade: f.quantidade }));

      const seen = new Set<string>();
      const all = [...(diretas ?? []), ...indiretas].filter((m: any) => {
        if (!m?.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      all.sort((a: any, b: any) =>
        new Date(b.data_movimento).getTime() - new Date(a.data_movimento).getTime()
      );
      return all;
    },
  });

  const [fTipo, setFTipo] = useState<string>("__all__");
  const [fEvento, setFEvento] = useState<string | null>(null);
  const [fSaidaTipo, setFSaidaTipo] = useState<string>("__all__");
  const [fSolicitante, setFSolicitante] = useState<string>("__all__");
  const [fFornecedor, setFFornecedor] = useState<string>("__all__");
  const [fIni, setFIni] = useState("");
  const [fFim, setFFim] = useState("");

  const eventosDisponiveis = useMemo(
    () => [...new Set((movs ?? []).map((m: any) => m.evento_projeto).filter(Boolean))].sort() as string[],
    [movs],
  );
  const solicitantesDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movs ?? []) if (m.solicitante_id && m.solicitante?.nome) map.set(m.solicitante_id, m.solicitante.nome);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [movs]);
  const fornecedoresDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movs ?? []) if (m.fornecedor_id && m.fornecedor?.nome) map.set(m.fornecedor_id, m.fornecedor.nome);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [movs]);

  const movsFiltrados = useMemo(() => {
    return (movs ?? []).filter((m: any) => {
      if (fTipo !== "__all__" && m.tipo !== fTipo) return false;
      if (fEvento && m.evento_projeto !== fEvento) return false;
      if (fSaidaTipo !== "__all__" && m.saida_tipo !== fSaidaTipo) return false;
      if (fSolicitante !== "__all__" && m.solicitante_id !== fSolicitante) return false;
      if (fFornecedor !== "__all__" && m.fornecedor_id !== fFornecedor) return false;
      const d = new Date(m.data_movimento);
      if (fIni && d < new Date(fIni)) return false;
      if (fFim && d > new Date(`${fFim}T23:59:59`)) return false;
      return true;
    });
  }, [movs, fTipo, fEvento, fSaidaTipo, fSolicitante, fFornecedor, fIni, fFim]);

  const showSaidaTipoFiltro = fTipo === "__all__" || fTipo === "saida";
  const showFornecedorFiltro = fTipo === "__all__" || fTipo === "entrada";


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
          <CardContent className="text-3xl font-semibold tabular-nums flex items-center justify-between gap-2">
            <span>{Number(item.quantidade_atual)} {item.unidade}</span>
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title="Recalcular o saldo a partir do histórico de movimentações"
                onClick={() => {
                  if (confirm("Recalcular o saldo deste item a partir de todo o histórico de movimentações? O valor atual será substituído.")) {
                    reconciliar.mutate();
                  }
                }}
                disabled={reconciliar.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${reconciliar.isPending ? "animate-spin" : ""}`} />
              </Button>
            )}
          </CardContent>
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
        <CardHeader>
          <CardTitle>Histórico de movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-4">
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-muted-foreground">Movimento</label>
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-muted-foreground">Evento/Projeto</label>
              <Select value={fEvento ?? "__all__"} onValueChange={(v) => setFEvento(v === "__all__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {eventosDisponiveis.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showSaidaTipoFiltro && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase text-muted-foreground">Tipo de saída</label>
                <Select value={fSaidaTipo} onValueChange={setFSaidaTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {Object.entries(saidaTipoLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-muted-foreground">Solicitante</label>
              <Select value={fSolicitante} onValueChange={setFSolicitante}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {solicitantesDisponiveis.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showFornecedorFiltro && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase text-muted-foreground">Fornecedor</label>
                <Select value={fFornecedor} onValueChange={setFFornecedor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {fornecedoresDisponiveis.map(([id, nome]) => (
                      <SelectItem key={id} value={id}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-muted-foreground">De</label>
              <Input type="date" value={fIni} onChange={(e) => setFIni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-muted-foreground">Até</label>
              <Input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {movsFiltrados.length} de {movs?.length ?? 0} movimentações
          </p>
          <div className="overflow-x-auto">

            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Subtipo</th>
                  <th className="py-2 pr-4 text-right">Qtd</th>
                  <th className="py-2 pr-4">Requisição</th>
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
                    <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                      {m.requisicao_numero ? `REQ-${m.requisicao_numero}` : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{m.fornecedor?.nome ?? m.solicitante?.nome ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{m.responsavel_lancamento ?? "—"}</td>
                    <td className="py-2.5 text-muted-foreground truncate max-w-[200px]">{m.observacoes ?? ""}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Sem movimentações.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
