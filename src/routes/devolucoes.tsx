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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { normalize } from "@/lib/utils";
import { format } from "date-fns";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { PeriodoFilter, filterByPeriodo, periodoFromPreset, type Periodo, type PeriodoPreset } from "@/components/PeriodoFilter";
import { TablePagination } from "@/components/TablePagination";

export const Route = createFileRoute("/devolucoes")({
  component: DevolucoesPage,
});

function DevolucoesPage() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth();
  const isAdmin = isModuleAdmin("estoque");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { sort, toggleSort, applySort } = useSort();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("mes");
  const [periodo, setPeriodo] = useState<Periodo>(periodoFromPreset("mes"));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

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

  const { data: solicitantes } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () =>
      (await supabase.from("solicitantes").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  // Saídas em aberto / parcial — vamos agrupar por (data+solicitante+evento)
  const { data: saidasAbertas } = useQuery({
    queryKey: ["saidas-abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, data_movimento, quantidade, item_id, solicitante_id, evento_projeto, saida_status, requisicao_numero, item:itens(nome,codigo,unidade), solicitante:solicitantes(nome)")
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
    mutationFn: async (payload: { linhas: any[]; idsSemDevolucao: string[] }) => {
      const { linhas, idsSemDevolucao } = payload;
      if (linhas.length === 0 && idsSemDevolucao.length === 0) {
        throw new Error("Informe a quantidade devolvida de pelo menos um item ou marque como sem devolução");
      }
      if (linhas.length) {
        const { error } = await supabase.from("movimentacoes").insert(linhas);
        if (error) throw error;
      }
      if (idsSemDevolucao.length) {
        const { error } = await supabase
          .from("movimentacoes")
          .update({ saida_status: "finalizada" })
          .in("id", idsSemDevolucao);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Devolução registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Excluir devolução (revertendo estoque)
  const delMut = useMutation({
    mutationFn: async (rows: any[]) => {
      for (const r of rows) {
        // se a devolução agregou estoque, devolver: subtrair
        if (r.condicao !== "perdido" && r.item_id) {
          const { data: it } = await supabase.from("itens").select("quantidade_atual").eq("id", r.item_id).single();
          if (it) {
            await supabase.from("itens").update({ quantidade_atual: Number(it.quantidade_atual) - Number(r.quantidade) }).eq("id", r.item_id);
          }
        }
      }
      const ids = rows.map((r) => r.id);
      const { error } = await supabase.from("movimentacoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Devolução(ões) excluída(s)");
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filtro
  const sBusca = normalize(q);
  const filtered = useMemo(() => {
    const list = (devolucoes ?? []).filter((m: any) => {
      if (!sBusca) return true;
      return normalize([
        m.item?.nome, m.item?.codigo, m.solicitante?.nome,
        m.responsavel_recebimento, m.responsavel_lancamento,
        m.observacoes, m.condicao,
      ].join(" ")).includes(sBusca);
    });
    return applySort(list, (m: any, k: string) => {
      if (k === "item") return m.item?.nome;
      if (k === "solicitante") return m.solicitante?.nome;
      if (k === "unidade") return m.item?.unidade;
      if (k === "quantidade") return Number(m.quantidade);
      return m[k];
    });
  }, [devolucoes, sBusca, sort]);

  const filteredPeriodo = useMemo(
    () => filterByPeriodo(filtered, periodo, (m: any) => m.data_movimento),
    [filtered, periodo],
  );
  useMemo(() => { setPage(1); }, [sBusca, sort, periodo]);
  const pageCount = Math.max(1, Math.ceil(filteredPeriodo.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filteredPeriodo.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredPeriodo, page],
  );

  const sel = useBulkSelection(pageItems);

  const BULK_FIELDS: BulkField[] = [
    { key: "data_movimento", label: "Data/Hora", type: "datetime" },
    { key: "responsavel_lancamento", label: "Responsável pela devolução", type: "text" },
    { key: "responsavel_recebimento", label: "Responsável pelo recebimento", type: "text" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ];
  const bulkMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const ids = Array.from(sel.selected);
      if (!ids.length) return;
      const norm = normalizeBulkPatch(patch);
      const { error } = await supabase.from("movimentacoes").update(norm as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devolucoes"] });
      toast.success("Devoluções atualizadas");
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleBulkDelete() {
    const ids = Array.from(sel.selected);
    const rows = (devolucoes ?? []).filter((d: any) => ids.includes(d.id));
    if (!rows.length) return;
    if (!confirm(`Excluir ${rows.length} devolução(ões)? O estoque será revertido.`)) return;
    delMut.mutate(rows);
  }

  return (
    <>
      <PageHeader
        title="Devoluções"
        description="Itens retornando ao estoque"
        actions={<Button type="button" size="lg" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova devolução</Button>}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por item, código, solicitante, responsável, condição…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <PeriodoFilter
            preset={periodoPreset}
            periodo={periodo}
            onChange={(p, per) => { setPeriodoPreset(p); setPeriodo(per); }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {filteredPeriodo.length === 0
            ? "Nenhuma devolução"
            : `Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredPeriodo.length)} de ${filteredPeriodo.length} devoluções`}
        </div>
      </Card>

      {isAdmin && (
        <BulkActionsBar
          count={sel.count}
          onEdit={() => setBulkOpen(true)}
          onClear={sel.clear}
          extraActions={
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={delMut.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionadas
            </Button>
          }
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                {isAdmin && (
                  <th className="px-3 py-3 w-8">
                    <Checkbox checked={sel.allSelected} onCheckedChange={() => sel.toggleAll()} />
                  </th>
                )}
                <SortableTh sort={sort} onToggle={toggleSort} k="data_movimento" label="Data" />
                <SortableTh sort={sort} onToggle={toggleSort} k="item" label="Item" />
                <SortableTh sort={sort} onToggle={toggleSort} k="solicitante" label="Solicitante" />
                <SortableTh sort={sort} onToggle={toggleSort} k="quantidade" label="Qtd" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="unidade" label="UN" />
                <SortableTh sort={sort} onToggle={toggleSort} k="responsavel_lancamento" label="Devolvido por" />
                <SortableTh sort={sort} onToggle={toggleSort} k="responsavel_recebimento" label="Recebido por" />
                <th className="px-4 py-3 font-medium">Obs</th>
                {isAdmin && <th className="px-3 py-3 w-12" />}
              </tr>
            </thead>
            <tbody>
              {pageItems.length ? pageItems.map((m: any) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <Checkbox checked={sel.selected.has(m.id)} onCheckedChange={() => sel.toggle(m.id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{m.item?.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.solicitante?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">+{Number(m.quantidade)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.item?.unidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.responsavel_lancamento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.responsavel_recebimento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{m.observacoes ?? ""}</td>
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir devolução"
                        onClick={() => {
                          if (!confirm("Excluir esta devolução? O estoque será revertido.")) return;
                          delMut.mutate([m]);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-10 text-muted-foreground">Nenhuma devolução registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova devolução</DialogTitle></DialogHeader>
          <DevolucaoForm
            saidas={saidasAbertas ?? []}
            devolvidoPorOrigem={devolvidoPorOrigem ?? new Map()}
            solicitantes={solicitantes ?? []}
            onSubmit={(payload: any) => mut.mutate(payload)}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>

      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={sel.count}
        fields={BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(patch) => bulkMut.mutate(patch)}
      />
    </>
  );
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["devolucoes"] });
  qc.invalidateQueries({ queryKey: ["saidas"] });
  qc.invalidateQueries({ queryKey: ["saidas-abertas"] });
  qc.invalidateQueries({ queryKey: ["devolvido-por-origem"] });
  qc.invalidateQueries({ queryKey: ["itens"] });
  qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
  qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
}

// Agrupa as saídas em "lotes" por requisicao_numero (ou data+solicitante+evento)
function groupSaidas(saidas: any[]) {
  const groups = new Map<string, { key: string; numero: number | null; label: string; searchKey: string; data: string; solicitante: any; evento: string | null; itens: any[] }>();
  for (const s of saidas) {
    const key = s.requisicao_numero != null
      ? `req-${s.requisicao_numero}`
      : `${s.data_movimento}__${s.solicitante_id ?? "null"}__${s.evento_projeto ?? "null"}`;
    if (!groups.has(key)) {
      const numeroStr = s.requisicao_numero != null ? `#${String(s.requisicao_numero).padStart(4, "0")} · ` : "";
      const dataStr = format(new Date(s.data_movimento), "dd/MM/yyyy HH:mm");
      const solNome = s.solicitante?.nome ?? "s/ solicitante";
      groups.set(key, {
        key,
        numero: s.requisicao_numero ?? null,
        label: `${numeroStr}${dataStr} · ${solNome}${s.evento_projeto ? " · " + s.evento_projeto : ""}`,
        searchKey: "",
        data: s.data_movimento,
        solicitante: s.solicitante,
        evento: s.evento_projeto,
        itens: [],
      });
    }
    groups.get(key)!.itens.push(s);
  }
  const arr = Array.from(groups.values());
  for (const g of arr) {
    g.searchKey = [
      g.numero != null ? String(g.numero).padStart(4, "0") : "",
      g.numero != null ? `#${String(g.numero).padStart(4, "0")}` : "",
      g.numero != null ? `req-${g.numero}` : "",
      format(new Date(g.data), "dd/MM/yyyy"),
      format(new Date(g.data), "dd/MM/yyyy HH:mm"),
      g.solicitante?.nome ?? "",
      g.evento ?? "",
      g.itens.map((i: any) => `${i.item?.codigo ?? ""} ${i.item?.nome ?? ""}`).join(" "),
    ].join(" ");
  }
  return arr.sort((a, b) => b.data.localeCompare(a.data));
}

function SaidaCombobox({ grupos, value, onChange }: { grupos: any[]; value: string; onChange: (key: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = grupos.find((g) => g.key === value);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return grupos;
    return grupos.filter((g) => {
      const hay = normalize(g.searchKey);
      return terms.every((t) => hay.includes(t));
    });
  }, [grupos, search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button type="button" variant="outline" role="combobox" aria-expanded={open}
        className="w-full justify-between font-normal" onClick={() => setOpen((c) => !c)}>
        <span className="truncate text-left">
          {selected ? selected.label : <span className="text-muted-foreground">Escolha uma saída em aberto…</span>}
        </span>
        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[360px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder="Buscar por nº, solicitante, data, item…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0" />
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma saída encontrada.</div>
            ) : filtered.map((g) => (
              <button key={g.key} type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onPointerDown={(e) => { e.preventDefault(); onChange(g.key); setSearch(""); setOpen(false); }}>
                <span className="truncate">{g.label} <span className="text-muted-foreground">({g.itens.length} item{g.itens.length > 1 ? "s" : ""})</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DevolucaoForm({ saidas, devolvidoPorOrigem, solicitantes, onSubmit, submitting }: any) {
  const grupos = useMemo(() => groupSaidas(saidas), [saidas]);
  const [grupoKey, setGrupoKey] = useState("");
  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    responsavel_recebimento: "",
    responsavel_lancamento: "",
    observacoes: "",
  });
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [semDevolucao, setSemDevolucao] = useState<Record<string, boolean>>({});

  const grupo = grupos.find((g) => g.key === grupoKey);
  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));

  const handleSelectGrupo = (key: string) => {
    setGrupoKey(key);
    setQtds({});
    setSemDevolucao({});
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!grupo) return toast.error("Selecione uma saída");

      const linhas: any[] = [];
      const idsSemDevolucao: string[] = [];
      for (const s of grupo.itens) {
        if (semDevolucao[s.id]) {
          idsSemDevolucao.push(s.id);
          continue;
        }
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
      if (linhas.length === 0 && idsSemDevolucao.length === 0) {
        return toast.error("Informe a quantidade devolvida ou marque ao menos um item como sem devolução");
      }
      onSubmit({ linhas, idsSemDevolucao });
    }} className="space-y-4">
      <FormSection>
        <FormField label="Saída vinculada*" wide>
          <SaidaCombobox grupos={grupos} value={grupoKey} onChange={handleSelectGrupo} />
        </FormField>
        <FormField label="Data*"><Input required type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></FormField>
        <FormField label="Responsável pela devolução">
          <Input list="solicitantes-list" value={meta.responsavel_lancamento}
            onChange={(e) => setM("responsavel_lancamento", e.target.value)} placeholder="Pesquise ou digite um nome…" />
        </FormField>
        <FormField label="Responsável pelo recebimento">
          <Input list="solicitantes-list" value={meta.responsavel_recebimento}
            onChange={(e) => setM("responsavel_recebimento", e.target.value)} placeholder="Pesquise ou digite um nome…" />
        </FormField>
        <datalist id="solicitantes-list">
          {(solicitantes ?? []).map((s: any) => (<option key={s.id} value={s.nome} />))}
        </datalist>
        <FormField label="Observações" wide><Textarea rows={2} value={meta.observacoes} onChange={(e) => setM("observacoes", e.target.value)} /></FormField>
      </FormSection>

      {grupo && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Itens da saída</h3>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col />
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-20" />
                  <col className="w-28" />
                  <col className="w-24" />
                </colgroup>
                <thead className="bg-muted/50">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2 font-medium text-left whitespace-nowrap">Item</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Saída</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Já devolvido</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Saldo</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Devolver agora</th>
                    <th className="px-3 py-2 font-medium text-center whitespace-nowrap">Sem devolução</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.itens.map((s: any) => {
                    const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
                    const saldo = Number(s.quantidade) - jaDev;
                    const sem = !!semDevolucao[s.id];
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium truncate">{s.item?.nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{Number(s.quantidade)} {s.item?.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">{jaDev}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{saldo}</td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" max={saldo} step="0.01"
                            value={sem ? "" : (qtds[s.id] ?? "")}
                            onChange={(e) => setQtds((q) => ({ ...q, [s.id]: e.target.value }))}
                            placeholder="0" disabled={saldo <= 0 || sem} className="h-8 text-right" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Checkbox checked={sem} onCheckedChange={(v) => {
                            setSemDevolucao((m) => ({ ...m, [s.id]: !!v }));
                            if (v) setQtds((q) => ({ ...q, [s.id]: "" }));
                          }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">Marque "Sem devolução" para encerrar o saldo do item sem registrar uma devolução. Deixe a quantidade em branco/0 nos itens que não estão sendo devolvidos agora.</p>
        </div>
      )}

      <FormActions><Button type="submit" size="lg" disabled={submitting || !grupo}>{submitting ? "Registrando…" : "Registrar devolução"}</Button></FormActions>
    </form>
  );
}
