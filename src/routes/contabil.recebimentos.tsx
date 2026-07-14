import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { subMonths } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { MoneyInput } from "@/components/MoneyInput";
import { toast } from "sonner";
import { format } from "date-fns";
import { EMPRESAS } from "@/lib/empresas";
import { SortableTh, useSort } from "@/components/SortableTh";
import { PeriodoFilter, periodoDoMes, filterByPeriodo, type Periodo, type PeriodoPreset } from "@/components/PeriodoFilter";
import { usePersistedState } from "@/hooks/usePersistedState";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/recebimentos")({
  component: RecebimentosPage,
});

type Recebimento = {
  id: string;
  empresa: string;
  nota_id: string | null;
  numero_nf: string | null;
  nome_evento: string | null;
  data_recebimento: string;
  valor_recebido: number;
  banco: string | null;
  observacoes: string | null;
};

type NotaOpt = { id: string; numero: string | null; empresa: string; valor_bruto: number; nome_evento: string | null };

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MES_ANTERIOR = periodoDoMes(subMonths(new Date(), 1));

function RecebimentosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recebimento | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("__all");
  const [periodoPreset, setPeriodoPreset] = usePersistedState<PeriodoPreset>("contabil-recebimentos-preset", "mes");
  const [periodo, setPeriodo] = useState<Periodo>(MES_ANTERIOR);
  const { sort, toggleSort, applySort } = useSort();

  const { data: recebimentos } = useQuery({
    queryKey: ["contabil-recebimentos"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_recebimentos")
        .select("*")
        .order("data_recebimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Recebimento[];
    },
  });

  const { data: notas } = useQuery({
    queryKey: ["contabil-notas-opt"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_notas_fiscais")
        .select("id, numero, empresa, valor_bruto, nome_evento")
        .order("data_emissao", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as NotaOpt[];
    },
  });

  const notasMap = useMemo(() => {
    const m = new Map<string, NotaOpt>();
    for (const n of notas ?? []) m.set(n.id, n);
    return m;
  }, [notas]);

  const filtered = useMemo(() => {
    let rows = (recebimentos ?? []).filter((r) => filtroEmpresa === "__all" || r.empresa === filtroEmpresa);
    rows = filterByPeriodo(rows, periodo, (r) => r.data_recebimento);
    return applySort(rows as any, (r: any, k) => {
      if (k === "evento") return r.nome_evento ?? notasMap.get(r.nota_id ?? "")?.nome_evento ?? "";
      if (k === "numero_nf") return r.numero_nf ?? notasMap.get(r.nota_id ?? "")?.numero ?? "";
      return r[k];
    });
  }, [recebimentos, filtroEmpresa, periodo, sort, notasMap, applySort]);

  const totalFiltrado = filtered.reduce((s, r) => s + Number(r.valor_recebido || 0), 0);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Recebimento>) => {
      if (editing) {
        const { error } = await sb.from("contabil_recebimentos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("contabil_recebimentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["contabil-recebimentos-mes"] });
      toast.success(editing ? "Recebimento atualizado" : "Recebimento registrado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contabil_recebimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["contabil-recebimentos-mes"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function abrirNovo() {
    setEditing(null);
    setOpen(true);
  }
  function abrirEditar(r: Recebimento) {
    setEditing(r);
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Recebimentos"
        description="Registre todas as entradas bancárias referentes às notas fiscais emitidas. A apuração mensal de impostos usa esses valores como faturamento."
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-1" /> Novo recebimento
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <div className="text-xs uppercase text-muted-foreground mb-1">Empresa</div>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Período</div>
          <PeriodoFilter
            preset={periodoPreset}
            periodo={periodo}
            onChange={(p, per) => { setPeriodoPreset(p); setPeriodo(per); }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <SortableTh sort={sort} onToggle={toggleSort} k="data_recebimento" label="Data" />
              <SortableTh sort={sort} onToggle={toggleSort} k="empresa" label="Empresa" />
              <SortableTh sort={sort} onToggle={toggleSort} k="numero_nf" label="Nº NF" />
              <SortableTh sort={sort} onToggle={toggleSort} k="evento" label="Evento" />
              <SortableTh sort={sort} onToggle={toggleSort} k="banco" label="Banco" />
              <SortableTh sort={sort} onToggle={toggleSort} k="valor_recebido" label="Valor recebido" align="right" />
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">Nenhum recebimento registrado.</td></tr>
            ) : filtered.map((r) => {
              const nota = r.nota_id ? notasMap.get(r.nota_id) : null;
              const evento = r.nome_evento ?? nota?.nome_evento ?? "—";
              const numeroNF = r.numero_nf ?? nota?.numero ?? "—";
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs">{format(new Date(r.data_recebimento), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-2">{r.empresa}</td>
                  <td className="px-4 py-2 font-mono text-xs">{numeroNF}</td>
                  <td className="px-4 py-2">{evento}</td>
                  <td className="px-4 py-2 text-xs">{r.banco ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(Number(r.valor_recebido))}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => abrirEditar(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover recebimento?")) delMut.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/30">
                <td colSpan={5} className="px-4 py-2 text-sm font-semibold">Total</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(totalFiltrado)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar recebimento" : "Novo recebimento"}</DialogTitle>
          </DialogHeader>
          <RecebimentoForm
            initial={editing}
            notas={notas ?? []}
            recebimentos={recebimentos ?? []}
            onSubmit={(p) => saveMut.mutate(p)}
            saving={saveMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecebimentoForm({
  initial,
  notas,
  recebimentos,
  onSubmit,
  saving,
}: {
  initial: Recebimento | null;
  notas: NotaOpt[];
  recebimentos: Recebimento[];
  onSubmit: (p: Partial<Recebimento>) => void;
  saving: boolean;
}) {
  const [empresa, setEmpresa] = useState<string>(initial?.empresa ?? EMPRESAS[0]);
  const [notaId, setNotaId] = useState<string>(initial?.nota_id ?? "__none");
  const [data, setData] = useState<string>(initial?.data_recebimento ?? new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState<string>(String(initial?.valor_recebido ?? ""));
  const [banco, setBanco] = useState<string>(initial?.banco ?? "");
  const [evento, setEvento] = useState<string>(initial?.nome_evento ?? "");
  const [obs, setObs] = useState<string>(initial?.observacoes ?? "");

  // Soma já recebida por nota (excluindo o registro em edição)
  const recebidoPorNota = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recebimentos) {
      if (!r.nota_id) continue;
      if (initial && r.id === initial.id) continue;
      m.set(r.nota_id, (m.get(r.nota_id) ?? 0) + Number(r.valor_recebido || 0));
    }
    return m;
  }, [recebimentos, initial]);

  const notasEmpresa = notas.filter((n) => n.empresa === empresa);
  const notaSelecionada = notaId !== "__none" ? notas.find((n) => n.id === notaId) : null;
  const jaRecebido = notaSelecionada ? (recebidoPorNota.get(notaSelecionada.id) ?? 0) : 0;
  const restante = notaSelecionada ? +(Number(notaSelecionada.valor_bruto) - jaRecebido).toFixed(2) : 0;
  const quitada = !!notaSelecionada && restante <= 0;
  const valorNum = Number(valor || 0);
  const excedeRestante = !!notaSelecionada && valorNum > restante + 0.001;

  function handleNotaChange(v: string) {
    setNotaId(v);
    if (v !== "__none") {
      const n = notas.find((x) => x.id === v);
      if (n) {
        const ja = recebidoPorNota.get(n.id) ?? 0;
        const rest = +(Number(n.valor_bruto) - ja).toFixed(2);
        if (!valor || Number(valor) === 0) setValor(String(Math.max(0, rest)));
        if (!evento && n.nome_evento) setEvento(n.nome_evento);
      }
    }
  }

  function submit() {
    if (!data || !empresa || !valor) {
      toast.error("Preencha empresa, data e valor.");
      return;
    }
    if (quitada) {
      toast.error("Esta nota fiscal já foi totalmente recebida.");
      return;
    }
    if (excedeRestante) {
      toast.error(`O valor excede o restante da NF (${fmtBRL(restante)}).`);
      return;
    }
    onSubmit({
      empresa,
      nota_id: notaId === "__none" ? null : notaId,
      data_recebimento: data,
      valor_recebido: Number(valor),
      banco: banco.trim() || null,
      nome_evento: evento.trim() || null,
      observacoes: obs.trim() || null,
    });
  }

  return (
    <div className="space-y-4">
      <FormSection>
        <FormField label="Empresa">
          <Select value={empresa} onValueChange={(v) => { setEmpresa(v); setNotaId("__none"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Nota fiscal vinculada">
          <Select value={notaId} onValueChange={handleNotaChange}>
            <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— sem vínculo —</SelectItem>
              {notasEmpresa.map((n) => {
                const ja = recebidoPorNota.get(n.id) ?? 0;
                const rest = +(Number(n.valor_bruto) - ja).toFixed(2);
                const isQuit = rest <= 0;
                return (
                  <SelectItem key={n.id} value={n.id} disabled={isQuit && n.id !== initial?.nota_id}>
                    NF {n.numero ?? "—"} · {fmtBRL(n.valor_bruto)}
                    {isQuit ? " · quitada" : ` · resta ${fmtBRL(rest)}`}
                    {n.nome_evento ? ` · ${n.nome_evento}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>
      {notaSelecionada && (
        <div className={`text-xs px-3 py-2 rounded-md border ${quitada ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted/40 border-border text-muted-foreground"}`}>
          NF {notaSelecionada.numero ?? "—"} · valor bruto {fmtBRL(notaSelecionada.valor_bruto)} · já recebido {fmtBRL(jaRecebido)} · <strong className="text-foreground">restante {fmtBRL(restante)}</strong>
          {quitada && " — esta NF já foi totalmente recebida, não é possível registrar novos valores."}
        </div>
      )}
      <FormSection>
        <FormField label="Data do recebimento">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </FormField>
        <FormField label="Valor recebido (R$)">
          <MoneyInput value={Number(valor || 0)} onChange={(n) => setValor(n ? String(n) : "")} />
        </FormField>
        <FormField label="Banco">
          <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ex.: Itaú" />
        </FormField>
        <FormField label="Evento" wide>
          <Input value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Nome do evento" />
        </FormField>
      </FormSection>
      <FormField label="Observações">
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </FormField>
      <FormActions>
        <Button onClick={submit} disabled={saving || quitada || excedeRestante}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </FormActions>
    </div>
  );
}
