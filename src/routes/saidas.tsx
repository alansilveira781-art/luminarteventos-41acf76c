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
import { Plus, RefreshCw, Trash2, Pencil, Search, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { saidaTipoLabels } from "@/lib/labels";
import { listEventos } from "@/server/sheets.functions";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { SolicitanteForm } from "@/components/forms/SolicitanteForm";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/saidas")({
  component: SaidasPage,
});

function SaidasPage() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth(); const isAdmin = isModuleAdmin("estoque");
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const { sort, toggleSort, applySort } = useSort();

  const editMut = useMutation({
    mutationFn: async (p: { original: any; patch: any }) => {
      const { original, patch } = p;
      const newItemId = patch.item_id ?? original.item_id;
      const newQtd = Number(patch.quantidade ?? original.quantidade);
      const oldQtd = Number(original.quantidade);
      // Saída: estoque diminuiu. Reverter antiga e aplicar nova.
      if (newItemId === original.item_id) {
        const delta = oldQtd - newQtd; // se nova menor, devolve estoque
        if (delta !== 0) {
          const { data: it } = await supabase.from("itens").select("quantidade_atual").eq("id", original.item_id).single();
          if (it) await supabase.from("itens").update({ quantidade_atual: Number(it.quantidade_atual) + delta }).eq("id", original.item_id);
        }
      } else {
        const { data: itOld } = await supabase.from("itens").select("quantidade_atual").eq("id", original.item_id).single();
        if (itOld) await supabase.from("itens").update({ quantidade_atual: Number(itOld.quantidade_atual) + oldQtd }).eq("id", original.item_id);
        const { data: itNew } = await supabase.from("itens").select("quantidade_atual").eq("id", newItemId).single();
        if (itNew) await supabase.from("itens").update({ quantidade_atual: Number(itNew.quantidade_atual) - newQtd }).eq("id", newItemId);
      }
      const { error } = await supabase.from("movimentacoes").update(patch).eq("id", original.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Saída atualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

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
    queryFn: async () => {
      const all = await fetchAllRows<any>("itens", "id,nome,codigo,codigo_proprio,unidade,quantidade_atual", {
        orderBy: { column: "nome", ascending: true },
        pageSize: 1000,
      });
      return all.filter((i: any) => Number(i.quantidade_atual) > 0);
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: solicitantes } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("*").eq("status", "ativo").order("nome")).data ?? [],
  });

  const [editingSolicitante, setEditingSolicitante] = useState<any | null>(null);
  const solMut = useMutation({
    mutationFn: async (p: any) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("solicitantes").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitantes-select"] });
      qc.invalidateQueries({ queryKey: ["solicitantes"] });
      toast.success("Solicitante atualizado");
      setEditingSolicitante(null);
    },
    onError: (e: any) => toast.error(e.message),
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

      {(() => {
        const s = q.toLowerCase().trim();
        const filteredBase = (saidas ?? []).filter((m: any) => {
          if (!s) return true;
          return [
            m.item?.nome, m.item?.codigo, m.evento_projeto, m.solicitante?.nome,
            m.saida_tipo, m.finalidade, m.observacoes, m.saida_status,
          ].map((x) => String(x ?? "").toLowerCase()).join(" ").includes(s);
        });
        const filtered = applySort(filteredBase, (m: any, k: string) => {
          if (k === "data_movimento") return m.data_movimento;
          if (k === "item") return m.item?.nome;
          if (k === "solicitante") return m.solicitante?.nome;
          if (k === "unidade") return m.item?.unidade;
          if (k === "quantidade") return Number(m.quantidade);
          return m[k];
        });
        return (
          <>
            <Card className="p-4 mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por item, código, evento/projeto, solicitante, tipo, status…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {filtered.length} {filtered.length === 1 ? "saída" : "saídas"}
                {saidas && filtered.length !== saidas.length ? ` (de ${saidas.length})` : ""}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-180px)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <SortableTh sort={sort} onToggle={toggleSort} k="data_movimento" label="Data" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="item" label="Item" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="evento_projeto" label="Evento/Projeto" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="solicitante" label="Solicitante" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="saida_tipo" label="Tipo" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="quantidade" label="Qtd" align="right" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="unidade" label="UN" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="data_prevista_devolucao" label="Devolver até" />
                      <SortableTh sort={sort} onToggle={toggleSort} k="saida_status" label="Status" />
                      {isAdmin && <th className="px-4 py-3 font-medium"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length ? filtered.map((m: any) => (
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
                            <div className="flex gap-1 justify-end">
                              <Button type="button" variant="ghost" size="icon" onClick={() => { setPrefill(m); setOpen(true); }} title="Duplicar">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(m)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => {
                                if (confirm("Excluir esta saída? O estoque será revertido e devoluções vinculadas serão apagadas.")) delMut.mutate(m);
                              }} title="Excluir">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )) : (
                      <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-10 text-muted-foreground">Nenhuma saída encontrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        );
      })()}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPrefill(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{prefill ? "Duplicar saída" : "Nova saída"}</DialogTitle></DialogHeader>
          <SaidaForm
            key={prefill?.id ?? "new"}
            prefill={prefill}
            itens={itens ?? []}
            solicitantes={solicitantes ?? []}
            onEditSolicitante={(s: any) => setEditingSolicitante(s)}
            eventos={eventosQuery.data?.eventos ?? []}
            eventosError={eventosQuery.data?.error}
            onReloadEventos={() => eventosQuery.refetch()}
            reloadingEventos={eventosQuery.isFetching}
            onSubmit={(meta: any, linhas: any) => mut.mutate({ meta, linhas })}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar saída</DialogTitle></DialogHeader>
          {editing && (
            <SaidaEditForm
              original={editing}
              itens={itens ?? []}
              solicitantes={solicitantes ?? []}
              onEditSolicitante={(s: any) => setEditingSolicitante(s)}
              eventos={eventosQuery.data?.eventos ?? []}
              onSubmit={(patch: any) => editMut.mutate({ original: editing, patch })}
              submitting={editMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSolicitante} onOpenChange={(v) => !v && setEditingSolicitante(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Editar solicitante</DialogTitle></DialogHeader>
          {editingSolicitante && (
            <SolicitanteForm
              initial={editingSolicitante}
              onSubmit={(p: any) => solMut.mutate({ ...p, id: editingSolicitante.id })}
              submitting={solMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Linha = { item_id: string; quantidade: string };

function SaidaForm({ prefill, itens, solicitantes, onEditSolicitante, eventos, eventosError, onReloadEventos, reloadingEventos, onSubmit, submitting }: any) {
  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    saida_tipo: prefill?.saida_tipo ?? "evento",
    solicitante_id: prefill?.solicitante_id ?? "",
    evento_projeto: prefill?.evento_projeto ?? "",
    finalidade: prefill?.finalidade ?? "",
    sera_devolvido: prefill?.data_prevista_devolucao ? "sim" : "sim",
    data_prevista_devolucao: "",
    observacoes: prefill?.observacoes ?? "",
  });
  const [linhas, setLinhas] = useState<Linha[]>(
    prefill ? [{ item_id: prefill.item_id, quantidade: String(prefill.quantidade) }, { item_id: "", quantidade: "1" }]
            : [{ item_id: "", quantidade: "1" }],
  );

  const isEvento = meta.saida_tipo === "evento";

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));
  const setL = (i: number, k: keyof Linha, v: string) => setLinhas((arr) => {
    const novo = [...arr];
    novo[i] = { ...novo[i], [k]: v };
    // Auto-adicionar nova linha quando seleciona item na última
    if (k === "item_id" && v && i === arr.length - 1) {
      novo.push({ item_id: "", quantidade: "1" });
    }
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
          saida_status: meta.sera_devolvido === "sim" ? "aberta" : "finalizada",
          observacoes: meta.observacoes || null,
        },
        validas.map((l) => ({ item_id: l.item_id, quantidade: Number(l.quantidade) })),
      );
    }} onKeyDown={(e) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
      }
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
          <FormField label="Evento / Projeto*" wide>
            <div className="flex gap-2">
              <Input
                list="eventos-list"
                value={meta.evento_projeto}
                onChange={(e) => setM("evento_projeto", e.target.value)}
                placeholder="Digite para buscar ou criar…"
              />
              <datalist id="eventos-list">
                {eventos.map((ev: string) => <option key={ev} value={ev} />)}
              </datalist>
              <Button type="button" variant="outline" size="icon" onClick={onReloadEventos} disabled={reloadingEventos} title="Recarregar lista">
                <RefreshCw className={`h-4 w-4 ${reloadingEventos ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {eventosError && <p className="text-xs text-destructive mt-1">Erro: {eventosError}</p>}
          </FormField>
        )}

        <FormField label="Solicitante">
          <EntitySearchSelect
            options={solicitantes}
            value={meta.solicitante_id}
            onChange={(v) => setM("solicitante_id", v)}
            onEdit={onEditSolicitante}
            placeholder="—"
            searchPlaceholder="Buscar por nome ou apelido…"
          />
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

function SaidaEditForm({ original, itens, solicitantes, onEditSolicitante, eventos, onSubmit, submitting }: any) {
  const [form, setForm] = useState({
    data_movimento: new Date(original.data_movimento).toISOString().slice(0, 16),
    saida_tipo: original.saida_tipo ?? "evento",
    item_id: original.item_id,
    quantidade: String(original.quantidade),
    solicitante_id: original.solicitante_id ?? "",
    evento_projeto: original.evento_projeto ?? "",
    finalidade: original.finalidade ?? "",
    sera_devolvido: original.data_prevista_devolucao ? "sim" : (original.saida_status === "finalizada" ? "nao" : "sim"),
    data_prevista_devolucao: original.data_prevista_devolucao ?? "",
    saida_status: original.saida_status ?? "aberta",
    observacoes: original.observacoes ?? "",
  });
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const isEvento = form.saida_tipo === "evento";

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!form.item_id || Number(form.quantidade) <= 0) return toast.error("Item e quantidade obrigatórios");
      if (isEvento && !form.evento_projeto) return toast.error("Evento/Projeto é obrigatório");
      if (form.sera_devolvido === "sim" && !form.data_prevista_devolucao) return toast.error("Informe a data prevista de devolução");
      onSubmit({
        data_movimento: new Date(form.data_movimento).toISOString(),
        saida_tipo: form.saida_tipo,
        item_id: form.item_id,
        quantidade: Number(form.quantidade),
        solicitante_id: form.solicitante_id || null,
        evento_projeto: isEvento ? form.evento_projeto : null,
        finalidade: form.finalidade || null,
        data_prevista_devolucao: form.sera_devolvido === "sim" ? (form.data_prevista_devolucao || null) : null,
        saida_status: form.sera_devolvido === "sim" ? (form.saida_status === "finalizada" ? "aberta" : form.saida_status) : "finalizada",
        observacoes: form.observacoes || null,
      });
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={form.data_movimento} onChange={(e) => set("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo*">
          <Select value={form.saida_tipo} onValueChange={(v) => set("saida_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(saidaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Item*" wide>
          <ItemSearchSelect itens={itens} value={form.item_id} onChange={(v) => set("item_id", v)} showStock />
        </FormField>
        <FormField label="Quantidade*"><Input required type="number" min="0.01" step="0.01" value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></FormField>
        {isEvento && (
          <FormField label="Evento / Projeto*" wide>
            <Input
              list="eventos-edit-list"
              value={form.evento_projeto}
              onChange={(e) => set("evento_projeto", e.target.value)}
              placeholder="Digite para buscar ou criar…"
            />
            <datalist id="eventos-edit-list">
              {eventos.map((ev: string) => <option key={ev} value={ev} />)}
            </datalist>
          </FormField>
        )}
        <FormField label="Solicitante">
          <EntitySearchSelect
            options={solicitantes}
            value={form.solicitante_id}
            onChange={(v) => set("solicitante_id", v)}
            onEdit={onEditSolicitante}
            placeholder="—"
            searchPlaceholder="Buscar por nome ou apelido…"
          />
        </FormField>
        <FormField label="Será devolvido?*">
          <Select value={form.sera_devolvido} onValueChange={(v) => { set("sera_devolvido", v); if (v === "nao") set("data_prevista_devolucao", ""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {form.sera_devolvido === "sim" && (
          <FormField label="Data prevista de devolução*">
            <Input required type="date" value={form.data_prevista_devolucao} onChange={(e) => set("data_prevista_devolucao", e.target.value)} />
          </FormField>
        )}
        <FormField label="Finalidade" wide><Input value={form.finalidade} onChange={(e) => set("finalidade", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
      </FormSection>
      <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : "Salvar alterações"}</Button></FormActions>
    </form>
  );
}
