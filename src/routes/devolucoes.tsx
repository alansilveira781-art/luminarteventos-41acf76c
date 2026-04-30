import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { condicaoLabels } from "@/lib/labels";

export const Route = createFileRoute("/devolucoes")({
  component: DevolucoesPage,
});

function DevolucoesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: devolucoes } = useQuery({
    queryKey: ["devolucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo,unidade), solicitante:solicitantes(nome)")
        .eq("tipo", "devolucao")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // saídas em aberto / parcial para vincular
  const { data: saidasAbertas } = useQuery({
    queryKey: ["saidas-abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, data_movimento, quantidade, item_id, solicitante_id, saida_status, item:itens(nome,codigo,unidade), solicitante:solicitantes(nome)")
        .eq("tipo", "saida")
        .in("saida_status", ["aberta", "parcialmente_devolvida"])
        .order("data_movimento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("movimentacoes").insert({ ...p, tipo: "devolucao" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devolucoes"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["saidas-abertas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Devolução registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Devoluções"
        description="Itens retornando ao estoque"
        actions={<Button type="button" size="lg" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova devolução</Button>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Solicitante</th>
                <th className="px-4 py-3 font-medium text-right">Qtd</th>
                <th className="px-4 py-3 font-medium">Condição</th>
                <th className="px-4 py-3 font-medium">Recebido por</th>
                <th className="px-4 py-3 font-medium">Obs</th>
              </tr>
            </thead>
            <tbody>
              {devolucoes?.length ? devolucoes.map((m: any) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{m.item?.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.solicitante?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">+{Number(m.quantidade)} {m.item?.unidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.condicao ? condicaoLabels[m.condicao] : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.responsavel_recebimento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{m.observacoes ?? ""}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma devolução registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nova devolução</DialogTitle></DialogHeader>
          <DevolucaoForm saidas={saidasAbertas ?? []} onSubmit={(p: any) => mut.mutate(p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DevolucaoForm({ saidas, onSubmit, submitting }: any) {
  const [f, setF] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    saida_origem_id: "",
    quantidade: 1,
    condicao: "perfeito",
    responsavel_recebimento: "",
    responsavel_lancamento: "",
    observacoes: "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const saida = useMemo(() => saidas.find((s: any) => s.id === f.saida_origem_id), [saidas, f.saida_origem_id]);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!f.saida_origem_id) return toast.error("Vincule a uma saída");
      if (!saida) return;
      if (Number(f.quantidade) > Number(saida.quantidade)) {
        return toast.error(`Quantidade maior que a da saída original (${saida.quantidade})`);
      }
      onSubmit({
        data_movimento: new Date(f.data_movimento).toISOString(),
        item_id: saida.item_id,
        solicitante_id: saida.solicitante_id,
        saida_origem_id: f.saida_origem_id,
        quantidade: Number(f.quantidade),
        condicao: f.condicao,
        responsavel_recebimento: f.responsavel_recebimento,
        responsavel_lancamento: f.responsavel_lancamento,
        observacoes: f.observacoes,
      });
    }} className="space-y-4">
      <FormSection>
        <FormField label="Saída vinculada*" wide>
          <Select value={f.saida_origem_id} onValueChange={(v) => set("saida_origem_id", v)}>
            <SelectTrigger><SelectValue placeholder="Escolha uma saída em aberto…" /></SelectTrigger>
            <SelectContent>
              {saidas.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma saída em aberto</div>}
              {saidas.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{format(new Date(s.data_movimento), "dd/MM")} · {s.item?.nome} · {s.quantidade} {s.item?.unidade} · {s.solicitante?.nome ?? "s/ solicitante"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saida && <p className="text-xs text-muted-foreground mt-1">Item: {saida.item?.nome} · Qtd da saída: {saida.quantidade} {saida.item?.unidade}</p>}
        </FormField>
        <FormField label="Data*"><Input required type="datetime-local" value={f.data_movimento} onChange={(e) => set("data_movimento", e.target.value)} /></FormField>
        <FormField label="Quantidade devolvida*"><Input required type="number" min="0.01" step="0.01" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></FormField>
        <FormField label="Condição*">
          <Select value={f.condicao} onValueChange={(v) => set("condicao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(condicaoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Responsável pela devolução"><Input value={f.responsavel_lancamento} onChange={(e) => set("responsavel_lancamento", e.target.value)} /></FormField>
        <FormField label="Responsável pelo recebimento"><Input value={f.responsavel_recebimento} onChange={(e) => set("responsavel_recebimento", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Registrando…" : "Registrar devolução"}</Button></FormActions>
      </FormSection>
    </form>
  );
}
