import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { saidaTipoLabels } from "@/lib/labels";

export const Route = createFileRoute("/saidas")({
  component: SaidasPage,
});

function SaidasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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
    queryFn: async () => (await supabase.from("itens").select("id,nome,codigo,unidade,quantidade_atual").order("nome")).data ?? [],
  });
  const { data: solicitantes } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async (p: any) => {
      // valida estoque
      const item = (itens ?? []).find((i: any) => i.id === p.item_id);
      if (!item) throw new Error("Item inválido");
      if (Number(p.quantidade) > Number(item.quantidade_atual)) {
        throw new Error(`Estoque insuficiente. Disponível: ${item.quantidade_atual} ${item.unidade}`);
      }
      const { error } = await supabase.from("movimentacoes").insert({ ...p, tipo: "saida" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
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
                <th className="px-4 py-3 font-medium">Solicitante</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Finalidade</th>
                <th className="px-4 py-3 font-medium text-right">Qtd</th>
                <th className="px-4 py-3 font-medium">Devolver até</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {saidas?.length ? saidas.map((m: any) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{m.item?.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.solicitante?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.saida_tipo ? saidaTipoLabels[m.saida_tipo] : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{m.finalidade ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-destructive">-{Number(m.quantidade)} {m.item?.unidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.data_prevista_devolucao ? format(new Date(m.data_prevista_devolucao), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.saida_status} /></td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma saída registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nova saída</DialogTitle></DialogHeader>
          <SaidaForm itens={itens ?? []} solicitantes={solicitantes ?? []} onSubmit={(p: any) => mut.mutate(p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SaidaForm({ itens, solicitantes, onSubmit, submitting }: any) {
  const [f, setF] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    saida_tipo: "evento",
    item_id: "",
    solicitante_id: "",
    quantidade_solicitada: 1,
    quantidade: 1,
    finalidade: "",
    responsavel_retirada: "",
    responsavel_lancamento: "",
    data_prevista_devolucao: "",
    observacoes: "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const item = itens.find((i: any) => i.id === f.item_id);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!f.item_id) return toast.error("Selecione um item");
      onSubmit({
        ...f,
        data_movimento: new Date(f.data_movimento).toISOString(),
        quantidade: Number(f.quantidade),
        quantidade_solicitada: Number(f.quantidade_solicitada),
        solicitante_id: f.solicitante_id || null,
        data_prevista_devolucao: f.data_prevista_devolucao || null,
      });
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={f.data_movimento} onChange={(e) => set("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo*">
          <Select value={f.saida_tipo} onValueChange={(v) => set("saida_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(saidaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Item*">
          <Select value={f.item_id} onValueChange={(v) => set("item_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{itens.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.nome} ({i.quantidade_atual} {i.unidade})</SelectItem>)}</SelectContent>
          </Select>
          {item && <p className="text-xs text-muted-foreground mt-1">Disponível: {Number(item.quantidade_atual)} {item.unidade}</p>}
        </FormField>
        <FormField label="Solicitante">
          <Select value={f.solicitante_id} onValueChange={(v) => set("solicitante_id", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{solicitantes.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Qtd solicitada"><Input type="number" min="0.01" step="0.01" value={f.quantidade_solicitada} onChange={(e) => set("quantidade_solicitada", e.target.value)} /></FormField>
        <FormField label="Qtd liberada*"><Input required type="number" min="0.01" step="0.01" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></FormField>
        <FormField label="Evento / finalidade" wide><Input value={f.finalidade} onChange={(e) => set("finalidade", e.target.value)} /></FormField>
        <FormField label="Responsável pela retirada"><Input value={f.responsavel_retirada} onChange={(e) => set("responsavel_retirada", e.target.value)} /></FormField>
        <FormField label="Responsável pelo lançamento"><Input value={f.responsavel_lancamento} onChange={(e) => set("responsavel_lancamento", e.target.value)} /></FormField>
        <FormField label="Data prevista de devolução"><Input type="date" value={f.data_prevista_devolucao} onChange={(e) => set("data_prevista_devolucao", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Registrando…" : "Registrar saída"}</Button></FormActions>
      </FormSection>
    </form>
  );
}
