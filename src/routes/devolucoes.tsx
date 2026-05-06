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

  // Saídas em aberto / parcial — vamos agrupar por (data+solicitante+evento) p/ representar "uma saída com vários itens"
  const { data: saidasAbertas } = useQuery({
    queryKey: ["saidas-abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, data_movimento, quantidade, item_id, solicitante_id, evento_projeto, saida_status, item:itens(nome,codigo,unidade), solicitante:solicitantes(nome)")
        .eq("tipo", "saida")
        .in("saida_status", ["aberta", "parcialmente_devolvida"])
        .order("data_movimento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Já devolvido por origem (para mostrar saldo)
  const { data: devolvidoPorOrigem } = useQuery({
    queryKey: ["devolvido-por-origem"],
    queryFn: async () => {
      const { data } = await supabase
        .from("movimentacoes")
        .select("saida_origem_id, quantidade")
        .eq("tipo", "devolucao")
        .not("saida_origem_id", "is", null);
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        m.set(r.saida_origem_id, (m.get(r.saida_origem_id) ?? 0) + Number(r.quantidade));
      });
      return m;
    },
  });

  const mut = useMutation({
    mutationFn: async (linhas: Array<any>) => {
      if (linhas.length === 0) throw new Error("Informe a quantidade devolvida de pelo menos um item");
      const { error } = await supabase.from("movimentacoes").insert(linhas);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devolucoes"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["saidas-abertas"] });
      qc.invalidateQueries({ queryKey: ["devolvido-por-origem"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
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
                <th className="px-4 py-3 font-medium">UN</th>
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
                  <td className="px-4 py-3 text-muted-foreground">{m.responsavel_recebimento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{m.observacoes ?? ""}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma devolução registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Nova devolução</DialogTitle></DialogHeader>
          <DevolucaoForm
            saidas={saidasAbertas ?? []}
            devolvidoPorOrigem={devolvidoPorOrigem ?? new Map()}
            onSubmit={(linhas: any) => mut.mutate(linhas)}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Agrupa as saídas em "lotes" por (data_movimento + solicitante + evento)
function groupSaidas(saidas: any[]) {
  const groups = new Map<string, { key: string; label: string; data: string; solicitante: any; evento: string | null; itens: any[] }>();
  for (const s of saidas) {
    const key = `${s.data_movimento}__${s.solicitante_id ?? "null"}__${s.evento_projeto ?? "null"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: `${format(new Date(s.data_movimento), "dd/MM/yyyy HH:mm")} · ${s.solicitante?.nome ?? "s/ solicitante"}${s.evento_projeto ? " · " + s.evento_projeto : ""}`,
        data: s.data_movimento,
        solicitante: s.solicitante,
        evento: s.evento_projeto,
        itens: [],
      });
    }
    groups.get(key)!.itens.push(s);
  }
  return Array.from(groups.values()).sort((a, b) => b.data.localeCompare(a.data));
}

function DevolucaoForm({ saidas, devolvidoPorOrigem, onSubmit, submitting }: any) {
  const grupos = useMemo(() => groupSaidas(saidas), [saidas]);
  const [grupoKey, setGrupoKey] = useState("");
  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    responsavel_recebimento: "",
    responsavel_lancamento: "",
    observacoes: "",
  });
  const [qtds, setQtds] = useState<Record<string, string>>({}); // por id de saída

  const grupo = grupos.find((g) => g.key === grupoKey);

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));

  const handleSelectGrupo = (key: string) => {
    setGrupoKey(key);
    setQtds({}); // reset
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!grupo) return toast.error("Selecione uma saída");

      const linhas: any[] = [];
      for (const s of grupo.itens) {
        const qtd = Number(qtds[s.id] || 0);
        if (qtd <= 0) continue;
        const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
        const saldo = Number(s.quantidade) - jaDev;
        if (qtd > saldo) {
          return toast.error(`Item ${s.item?.nome}: máximo a devolver é ${saldo} ${s.item?.unidade}`);
        }
        linhas.push({
          tipo: "devolucao",
          data_movimento: new Date(meta.data_movimento).toISOString(),
          item_id: s.item_id,
          solicitante_id: s.solicitante_id,
          saida_origem_id: s.id,
          quantidade: qtd,
          condicao: "perfeito",
          responsavel_recebimento: meta.responsavel_recebimento || null,
          responsavel_lancamento: meta.responsavel_lancamento || null,
          observacoes: meta.observacoes || null,
        });
      }
      onSubmit(linhas);
    }} className="space-y-4">
      <FormSection>
        <FormField label="Saída vinculada*" wide>
          <Select value={grupoKey} onValueChange={handleSelectGrupo}>
            <SelectTrigger><SelectValue placeholder="Escolha uma saída em aberto…" /></SelectTrigger>
            <SelectContent>
              {grupos.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma saída em aberto</div>}
              {grupos.map((g) => (
                <SelectItem key={g.key} value={g.key}>{g.label} ({g.itens.length} item{g.itens.length > 1 ? "s" : ""})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Data*"><Input required type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></FormField>
        <FormField label="Responsável pela devolução"><Input value={meta.responsavel_lancamento} onChange={(e) => setM("responsavel_lancamento", e.target.value)} /></FormField>
        <FormField label="Responsável pelo recebimento"><Input value={meta.responsavel_recebimento} onChange={(e) => setM("responsavel_recebimento", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={meta.observacoes} onChange={(e) => setM("observacoes", e.target.value)} /></FormField>
      </FormSection>

      {grupo && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Itens da saída</h3>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <colgroup>
                  <col />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-24" />
                  <col className="w-32" />
                </colgroup>
                <thead className="bg-muted/50">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2 font-medium text-left whitespace-nowrap">Item</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Saída</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Já devolvido</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Saldo</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Devolver agora</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.itens.map((s: any) => {
                    const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
                    const saldo = Number(s.quantidade) - jaDev;
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium truncate">{s.item?.nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{Number(s.quantidade)} {s.item?.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">{jaDev}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{saldo}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            max={saldo}
                            step="0.01"
                            value={qtds[s.id] ?? ""}
                            onChange={(e) => setQtds((q) => ({ ...q, [s.id]: e.target.value }))}
                            placeholder="0"
                            disabled={saldo <= 0}
                            className="h-8 text-right"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">Deixe em branco ou 0 nos itens que não estão sendo devolvidos agora.</p>
        </div>
      )}

      <FormActions><Button type="submit" size="lg" disabled={submitting || !grupo}>{submitting ? "Registrando…" : "Registrar devolução"}</Button></FormActions>
    </form>
  );
}
