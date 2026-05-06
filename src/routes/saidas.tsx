import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { saidaTipoLabels } from "@/lib/labels";
import { listEventos } from "@/server/sheets.functions";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/saidas")({
  component: SaidasPage,
});

function SaidasPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const delMut = useMutation({
    mutationFn: async (m: any) => {
      // Reverter estoque (saida tirou, então adicionar de volta)
      const { data: it } = await supabase.from("itens").select("quantidade_atual").eq("id", m.item_id).single();
      if (it) {
        await supabase.from("itens").update({ quantidade_atual: Number(it.quantidade_atual) + Number(m.quantidade) }).eq("id", m.item_id);
      }
      // Apagar devoluções vinculadas
      await supabase.from("movimentacoes").delete().eq("saida_origem_id", m.id);
      const { error } = await supabase.from("movimentacoes").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Saída excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: saidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo,unidade,quantidade_atual), solicitante:solicitantes(nome)")
        .eq("tipo", "saida")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: itens } = useQuery({
    queryKey: ["itens-select-saida"],
    queryFn: async () =>
      await fetchAllRows<any>("itens", "id,nome,codigo,codigo_proprio,unidade,quantidade_atual", {
        orderBy: { column: "nome", ascending: true },
      }),
  });
  const { data: solicitantes } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  const eventosQuery = useQuery({
    queryKey: ["eventos-sheets"],
    queryFn: async () => await listEventos(),
    staleTime: 5 * 60 * 1000,
  });

  const mut = useMutation({
    mutationFn: async (p: { meta: any; linhas: Array<{ item_id: string; quantidade: number }> }) => {
      // Validar estoque por item
      for (const l of p.linhas) {
        const it = (itens ?? []).find((x: any) => x.id === l.item_id);
        if (!it) throw new Error("Item inválido");
        if (l.quantidade > Number(it.quantidade_atual)) {
          throw new Error(`Estoque insuficiente para ${it.nome}. Disponível: ${it.quantidade_atual} ${it.unidade}`);
        }
      }
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "saida" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
      }));
      const { error } = await supabase.from("movimentacoes").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
      toast.success("Saída registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Saídas"
        description="Retiradas de itens do estoque"
        actions={<Button type="button" size="lg" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova saída</Button>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Evento/Projeto</th>
                <th className="px-4 py-3 font-medium">Solicitante</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Qtd</th>
                <th className="px-4 py-3 font-medium">UN</th>
                <th className="px-4 py-3 font-medium">Devolver até</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {saidas?.length ? saidas.map((m: any) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{m.item?.nome}</td>
                  <td className="px-4 py-3 text-foreground">{m.evento_projeto ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.solicitante?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.saida_tipo ? saidaTipoLabels[m.saida_tipo] : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-destructive">-{Number(m.quantidade)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.item?.unidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.data_prevista_devolucao ? format(new Date(m.data_prevista_devolucao), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.saida_status} /></td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button type="button" variant="ghost" size="icon" onClick={() => {
                        if (confirm("Excluir esta saída? O estoque será revertido e devoluções vinculadas serão apagadas.")) delMut.mutate(m);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-10 text-muted-foreground">Nenhuma saída registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Nova saída</DialogTitle></DialogHeader>
          <SaidaForm
            itens={itens ?? []}
            solicitantes={solicitantes ?? []}
            eventos={eventosQuery.data?.eventos ?? []}
            eventosError={eventosQuery.data?.error}
            onReloadEventos={() => eventosQuery.refetch()}
            reloadingEventos={eventosQuery.isFetching}
            onSubmit={(meta: any, linhas: any) => mut.mutate({ meta, linhas })}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type Linha = { item_id: string; quantidade: string };

function SaidaForm({ itens, solicitantes, eventos, eventosError, onReloadEventos, reloadingEventos, onSubmit, submitting }: any) {
  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    saida_tipo: "evento",
    solicitante_id: "",
    evento_projeto: "",
    finalidade: "",
    sera_devolvido: "sim",
    data_prevista_devolucao: "",
    observacoes: "",
  });
  const [linhas, setLinhas] = useState<Linha[]>([{ item_id: "", quantidade: "1" }]);

  const isEvento = meta.saida_tipo === "evento";

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));
  const setL = (i: number, k: keyof Linha, v: string) => setLinhas((arr) => {
    const novo = [...arr];
    novo[i] = { ...novo[i], [k]: v };
    return novo;
  });
  const addLinha = () => setLinhas((a) => [...a, { item_id: "", quantidade: "1" }]);
  const remLinha = (i: number) => setLinhas((a) => (a.length === 1 ? a : a.filter((_, idx) => idx !== i)));

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (isEvento && !meta.evento_projeto) return toast.error("Evento/Projeto é obrigatório");
      if (meta.sera_devolvido === "sim" && !meta.data_prevista_devolucao) {
        return toast.error("Informe a data prevista de devolução");
      }
      const validas = linhas.filter((l) => l.item_id && Number(l.quantidade) > 0);
      if (validas.length === 0) return toast.error("Adicione pelo menos um item");
      onSubmit(
        {
          data_movimento: new Date(meta.data_movimento).toISOString(),
          saida_tipo: meta.saida_tipo,
          solicitante_id: meta.solicitante_id || null,
          evento_projeto: isEvento ? meta.evento_projeto : null,
          finalidade: meta.finalidade || null,
          data_prevista_devolucao: meta.sera_devolvido === "sim" ? (meta.data_prevista_devolucao || null) : null,
          observacoes: meta.observacoes || null,
        },
        validas.map((l) => ({ item_id: l.item_id, quantidade: Number(l.quantidade) })),
      );
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo*">
          <Select value={meta.saida_tipo} onValueChange={(v) => setM("saida_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(saidaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>

        {isEvento && (
          <FormField label="Evento / Projeto* (Google Sheets)" wide>
            <div className="flex gap-2">
              <Select value={meta.evento_projeto} onValueChange={(v) => setM("evento_projeto", v)}>
                <SelectTrigger><SelectValue placeholder={eventos.length ? "Selecione…" : "Carregando ou nenhum encontrado"} /></SelectTrigger>
                <SelectContent>
                  {eventos.map((ev: string) => <SelectItem key={ev} value={ev}>{ev}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={onReloadEventos} disabled={reloadingEventos} title="Recarregar lista">
                <RefreshCw className={`h-4 w-4 ${reloadingEventos ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {eventosError && <p className="text-xs text-destructive mt-1">Erro: {eventosError}</p>}
            {!eventosError && eventos.length === 0 && <p className="text-xs text-muted-foreground mt-1">Lista vazia. Verifique a planilha conectada.</p>}
          </FormField>
        )}

        <FormField label="Solicitante">
          <Select value={meta.solicitante_id} onValueChange={(v) => setM("solicitante_id", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{solicitantes.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Será devolvido?*">
          <Select value={meta.sera_devolvido} onValueChange={(v) => { setM("sera_devolvido", v); if (v === "nao") setM("data_prevista_devolucao", ""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {meta.sera_devolvido === "sim" && (
          <FormField label="Data prevista de devolução*">
            <Input required type="date" value={meta.data_prevista_devolucao} onChange={(e) => setM("data_prevista_devolucao", e.target.value)} />
          </FormField>
        )}
        <FormField label="Finalidade / detalhes" wide><Input value={meta.finalidade} onChange={(e) => setM("finalidade", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={meta.observacoes} onChange={(e) => setM("observacoes", e.target.value)} /></FormField>
      </FormSection>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Itens da saída</h3>
          <Button type="button" size="sm" variant="outline" onClick={addLinha}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar item
          </Button>
        </div>
        <Card className="p-3 space-y-2">
          {linhas.map((l, i) => {
            const it = itens.find((x: any) => x.id === l.item_id);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item</label>
                  <ItemSearchSelect itens={itens} value={l.item_id} onChange={(v) => setL(i, "item_id", v)} showStock />
                  {it && <p className="text-[10px] text-muted-foreground mt-1">Disponível: {Number(it.quantidade_atual)} {it.unidade}</p>}
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantidade</label>
                  <Input type="number" min="0.01" step="0.01" value={l.quantidade} onChange={(e) => setL(i, "quantidade", e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remLinha(i)} disabled={linhas.length === 1} title="Remover">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Registrando…" : "Registrar saída"}</Button></FormActions>
    </form>
  );
}
