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
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { entradaTipoLabels } from "@/lib/labels";

export const Route = createFileRoute("/entradas")({
  component: EntradasPage,
});

function EntradasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: entradas } = useQuery({
    queryKey: ["entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo,unidade), fornecedor:fornecedores(nome)")
        .eq("tipo", "entrada")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: itens } = useQuery({
    queryKey: ["itens-select"],
    queryFn: async () => (await supabase.from("itens").select("id,nome,codigo,unidade").order("nome")).data ?? [],
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => (await supabase.from("fornecedores").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("movimentacoes").insert({ ...p, tipo: "entrada" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      toast.success("Entrada registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Entradas"
        description="Registro de itens recebidos no estoque"
        actions={<Button type="button" size="lg" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova entrada</Button>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium text-right">Qtd</th>
                <th className="px-4 py-3 font-medium text-right">Valor total</th>
                <th className="px-4 py-3 font-medium">NF</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {entradas?.length ? entradas.map((m: any) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{m.item?.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.entrada_tipo ? entradaTipoLabels[m.entrada_tipo] : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.fornecedor?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">+{Number(m.quantidade)} {m.item?.unidade}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {m.valor_unitario ? `R$ ${(Number(m.valor_unitario) * Number(m.quantidade)).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.nota_fiscal ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.responsavel_lancamento ?? "—"}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma entrada registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nova entrada</DialogTitle></DialogHeader>
          <EntradaForm itens={itens ?? []} fornecedores={fornecedores ?? []} onSubmit={(p: any) => mut.mutate(p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function EntradaForm({ itens, fornecedores, onSubmit, submitting }: any) {
  const [f, setF] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    entrada_tipo: "compra",
    item_id: "",
    fornecedor_id: "",
    quantidade: 1,
    valor_unitario: "",
    nota_fiscal: "",
    responsavel_lancamento: "",
    observacoes: "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const total = f.valor_unitario && f.quantidade ? (Number(f.valor_unitario) * Number(f.quantidade)).toFixed(2) : null;

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!f.item_id) return toast.error("Selecione um item");
      onSubmit({
        ...f,
        data_movimento: new Date(f.data_movimento).toISOString(),
        quantidade: Number(f.quantidade),
        valor_unitario: f.valor_unitario ? Number(f.valor_unitario) : null,
        fornecedor_id: f.fornecedor_id || null,
      });
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={f.data_movimento} onChange={(e) => set("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo de entrada*">
          <Select value={f.entrada_tipo} onValueChange={(v) => set("entrada_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(entradaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Item*">
          <Select value={f.item_id} onValueChange={(v) => set("item_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{itens.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.nome}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Fornecedor">
          <Select value={f.fornecedor_id} onValueChange={(v) => set("fornecedor_id", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{fornecedores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Quantidade*"><Input required type="number" min="0.01" step="0.01" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></FormField>
        <FormField label="Valor unitário (R$)"><Input type="number" min="0" step="0.01" value={f.valor_unitario} onChange={(e) => set("valor_unitario", e.target.value)} /></FormField>
        {total && <div className="md:col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Valor total: <span className="text-foreground font-medium">R$ {total}</span></div>}
        <FormField label="Nota fiscal / documento"><Input value={f.nota_fiscal} onChange={(e) => set("nota_fiscal", e.target.value)} /></FormField>
        <FormField label="Responsável pelo lançamento"><Input value={f.responsavel_lancamento} onChange={(e) => set("responsavel_lancamento", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Registrando…" : "Registrar entrada"}</Button></FormActions>
      </FormSection>
    </form>
  );
}
