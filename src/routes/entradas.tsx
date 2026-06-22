import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { normalize, matchTokens, isAjusteMovimentacao } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Upload, FileCode2, Trash2, Pencil, Search, Copy, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { MoneyInput } from "@/components/MoneyInput";
import { QuantidadeInput } from "@/components/QuantidadeInput";
import { toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { entradaTipoLabels } from "@/lib/labels";
import { ImportDialog } from "@/components/ImportDialog";
import { ENTRADA_TEMPLATE } from "@/lib/import-utils";
import { parseNfeXml } from "@/lib/nfe-parser";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { ItemInfoHover } from "@/components/ItemInfoHover";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { FornecedorForm } from "@/components/forms/FornecedorForm";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotasSefaz } from "@/components/estoque/NotasSefaz";
import { EMPRESAS } from "@/lib/empresas";
import { PeriodoFilter, filterByPeriodo, periodoFromPreset, type Periodo, type PeriodoPreset } from "@/components/PeriodoFilter";
import { TablePagination } from "@/components/TablePagination";
import { ensureValidSession, describeSupabaseError } from "@/lib/supabase-guard";

export const Route = createFileRoute("/entradas")({
  component: EntradasPage,
});

function EntradasPage() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth(); const isAdmin = isModuleAdmin("estoque");
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importingXml, setImportingXml] = useState(false);
  const [q, setQ] = useState<string>(""); const qd = useDebouncedValue(q, 300);
  const [filterItemQ, setFilterItemQ] = useState<string>(""); const filterItemQd = useDebouncedValue(filterItemQ, 300);
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("mes");
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoFromPreset("mes"));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [filterEvento, setFilterEvento] = useState<string>("__all");
  const { sort, toggleSort, applySort } = useSort();

  // Edição de linha única: deletar a antiga e inserir a nova
  // (triggers do banco fazem a reversão e a reaplicação no estoque).
  const editMut = useMutation({
    mutationFn: async (p: { original: any; patch: any }) => {
      const { original, patch } = p;
      const { id: _ignore, item: _i, fornecedor: _f, created_at: _c, updated_at: _u, ...base } = original;
      const novo = { ...base, ...patch };
      const { error: delErr } = await supabase.from("movimentacoes").delete().eq("id", original.id);
      if (delErr) throw delErr;
      const { error } = await supabase.from("movimentacoes").insert(novo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Entrada atualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editGroupMut = useMutation({
    mutationFn: async (p: { grupo: any; meta: any; linhas: Array<{ item_id: string; quantidade: number; valor_unitario: number | null }> }) => {
      const old: any[] = p.grupo.linhas ?? [];
      // Apagar antigas (triggers revertem o estoque)
      const oldIds = old.map((o) => o.id);
      const { error: delErr } = await supabase.from("movimentacoes").delete().in("id", oldIds);
      if (delErr) throw delErr;
      // Inserir novas mantendo o mesmo requisicao_numero (triggers aplicam o estoque)
      const requisicao_numero = p.grupo.numero ?? null;
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "entrada" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
        valor_unitario: l.valor_unitario,
        requisicao_numero,
      }));
      const { error } = await supabase.from("movimentacoes").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Entrada atualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (grupo: any) => {
      const linhas: any[] = grupo.linhas ?? [grupo];
      const ids = linhas.map((l) => l.id);
      // Triggers revertem o estoque automaticamente
      const { error } = await supabase.from("movimentacoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Entrada excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelMut = useMutation({
    mutationFn: async (grupos: any[]) => {
      const ids: string[] = [];
      for (const g of grupos) {
        const linhas: any[] = g.linhas ?? [g];
        ids.push(...linhas.map((l) => l.id));
      }
      if (!ids.length) return;
      const { error } = await supabase.from("movimentacoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Entradas excluídas");
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });


  const { data: entradas } = useQuery({
    queryKey: ["entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo,unidade), fornecedor:fornecedores(nome,documento)")
        .eq("tipo", "entrada")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: itens } = useQuery({
    queryKey: ["itens-select"],
    queryFn: async () =>
      await fetchAllRows<any>("itens", "id,nome,codigo,codigo_proprio,unidade,valor_unitario", {
        orderBy: { column: "nome", ascending: true },
        pageSize: 1000,
      }),
    staleTime: 0,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").eq("status", "ativo").order("nome")).data ?? [],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [editingFornecedor, setEditingFornecedor] = useState<any | null>(null);
  const fornMut = useMutation({
    mutationFn: async (p: any) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("fornecedores").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores-select"] });
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado");
      setEditingFornecedor(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Múltiplos itens em uma única entrada: criamos N movimentações compartilhando metadados + requisicao_numero
  const mut = useMutation({
    mutationFn: async (p: { meta: any; linhas: Array<{ item_id: string; quantidade: number; valor_unitario: number | null; valor_total: number | null; desconto: number; frete: number; ipi: number; outros_custos: number }> }) => {
      await ensureValidSession();
      const { data: numData, error: numErr } = await supabase.rpc("next_requisicao_numero" as any);
      if (numErr) throw numErr;
      const requisicao_numero = numData as number;
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "entrada" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
        valor_unitario: l.valor_unitario,
        valor_total: l.valor_total,
        desconto: l.desconto,
        frete: l.frete,
        ipi: l.ipi,
        outros_custos: l.outros_custos,
        requisicao_numero,
      }));
      const { data: inseridos, error } = await supabase.from("movimentacoes").insert(inserts).select("id");
      if (error) throw error;
      if (!inseridos || inseridos.length !== inserts.length) {
        throw new Error("O lançamento não foi confirmado pelo banco. Verifique seu acesso e tente novamente.");
      }
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
      toast.success("Entrada registrada");
      setOpen(false);
    },
    onError: (e: any) => {
      console.error("[entradas] insert error:", e);
      toast.error(describeSupabaseError(e));
    },
  });

  // Filtros + agrupamento por requisicao_numero
  const filteredBaseList = (entradas ?? []).filter((m: any) => {
    if (filterItemQd.trim()) {
      const itemHay = `${m.item?.codigo ?? ""} ${m.item?.nome ?? ""}`;
      if (!matchTokens(itemHay, filterItemQd)) return false;
    }
    if (filterEvento !== "__all" && (m.evento_projeto ?? "") !== filterEvento) return false;
    if (!qd.trim()) return true;
    const hay = [
      m.item?.nome, m.item?.codigo, m.fornecedor?.nome, m.fornecedor?.documento,
      m.entrada_tipo, m.nota_fiscal, m.responsavel_lancamento, m.observacoes,
      m.requisicao_numero ? `req-${String(m.requisicao_numero).padStart(4, "0")}` : "",
    ].join(" ");
    return matchTokens(hay, qd);
  });
  // Lista distinct de eventos para o filtro
  const eventosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (entradas ?? []).forEach((m: any) => { if (m.evento_projeto) s.add(m.evento_projeto); });
    return Array.from(s).sort();
  }, [entradas]);
  const grupos = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of filteredBaseList) {
      const key = m.requisicao_numero != null ? `req-${m.requisicao_numero}` : `solo-${m.id}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          numero: m.requisicao_numero,
          data_movimento: m.data_movimento,
          fornecedor_id: m.fornecedor_id,
          fornecedor: m.fornecedor,
          entrada_tipo: m.entrada_tipo,
          nota_fiscal: m.nota_fiscal,
          observacoes: m.observacoes,
          responsavel_lancamento: m.responsavel_lancamento,
          linhas: [],
          qtd_total: 0,
          valor_total: 0,
        });
      }
      const g = map.get(key)!;
      g.linhas.push(m);
      g.qtd_total += Number(m.quantidade);
      g.valor_total += Number(m.valor_unitario ?? 0) * Number(m.quantidade ?? 0);
    }
    const arr = Array.from(map.values());
    return applySort(arr, (g: any, k: string) => {
      if (k === "data_movimento") return g.data_movimento;
      if (k === "fornecedor") return g.fornecedor?.nome;
      if (k === "valor_total") return g.valor_total;
      if (k === "quantidade") return g.qtd_total;
      if (k === "numero") return g.numero ?? 0;
      return g[k];
    });
  }, [filteredBaseList, sort]);

  const gruposPeriodo = useMemo(
    () => filterByPeriodo(grupos, periodo, (g: any) => g.data_movimento),
    [grupos, periodo],
  );
  useEffect(() => { setPage(1); }, [q, filterItemQ, filterEvento, periodo, sort]);
  const pageCount = Math.max(1, Math.ceil(gruposPeriodo.length / PAGE_SIZE));
  const pageGrupos = useMemo(
    () => gruposPeriodo.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [gruposPeriodo, page],
  );
  const sel = useBulkSelection(pageGrupos);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const ENTRADA_BULK_FIELDS: BulkField[] = [
    { key: "fornecedor_id", label: "Fornecedor", type: "select", allowClear: true,
      options: (fornecedores ?? []).map((f: any) => ({ value: f.id, label: f.nome })) },
    { key: "nota_fiscal", label: "Nota fiscal", type: "text" },
    { key: "entrada_tipo", label: "Tipo de entrada", type: "select",
      options: Object.entries(entradaTipoLabels).map(([v, l]) => ({ value: v, label: l as string })) },
    { key: "responsavel_lancamento", label: "Responsável", type: "text" },
    { key: "data_movimento", label: "Data do movimento", type: "datetime" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ];
  const bulkMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const groupIds = Array.from(sel.selected);
      const movIds: string[] = [];
      for (const g of grupos) {
        if (groupIds.includes(g.id)) movIds.push(...g.linhas.map((l: any) => l.id));
      }
      if (!movIds.length) return;
      const { error } = await supabase.from("movimentacoes").update(patch as any).in("id", movIds);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      toast.success("Entradas atualizadas");
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });
  function handleBulkDelete() {
    const ids = Array.from(sel.selected);
    const rows = grupos.filter((g: any) => ids.includes(g.id));
    if (!rows.length) return;
    if (!confirm(`Excluir ${rows.length} entrada(s)? O estoque será revertido.`)) return;
    bulkDelMut.mutate(rows);
  }

  return (
    <>
      <PageHeader
        title="Entradas"
        description="Registro de itens recebidos no estoque"
        actions={
          <>
            <Button type="button" size="lg" variant="outline" onClick={() => setImportingXml(true)}>
              <FileCode2 className="h-4 w-4 mr-1" /> Importar NF-e (XML)
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setImportingExcel(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar Excel
            </Button>
            <Button type="button" size="lg" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Nova entrada
            </Button>
          </>
        }
      />

      <Tabs defaultValue="entradas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="sefaz">Notas emitidas (SEFAZ)</TabsTrigger>
        </TabsList>

        <TabsContent value="entradas" className="space-y-4 mt-0">

      <Card className="p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por item, código, fornecedor, NF, responsável…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative w-[260px]">
            <Input
              placeholder="Filtrar por item (digite código ou nome)"
              value={filterItemQ}
              onChange={(e) => setFilterItemQ(e.target.value)}
              list="entradas-filter-itens-list"
            />
            <datalist id="entradas-filter-itens-list">
              {(itens ?? []).slice(0, 500).map((it: any) => (
                <option key={it.id} value={`${it.codigo} — ${it.nome}`} />
              ))}
            </datalist>
          </div>
          <Select value={filterEvento} onValueChange={setFilterEvento}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por evento/projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos eventos/projetos</SelectItem>
              {eventosDisponiveis.map((ev) => (
                <SelectItem key={ev} value={ev}>{ev}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterItemQ || filterEvento !== "__all" || q) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFilterItemQ(""); setFilterEvento("__all"); setQ(""); }}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
          <PeriodoFilter
            preset={periodoPreset}
            periodo={periodo}
            onChange={(p, per) => { setPeriodoPreset(p); setPeriodo(per); }}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {gruposPeriodo.length === 0
            ? "Nenhuma entrada"
            : `Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, gruposPeriodo.length)} de ${gruposPeriodo.length} entradas`}
        </div>
      </Card>

      {isAdmin && (
        <BulkActionsBar
          count={sel.count}
          onEdit={() => setBulkOpen(true)}
          onClear={sel.clear}
          extraActions={
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDelMut.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionadas
            </Button>
          }
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-180px)]">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                {isAdmin && (
                  <th className="px-3 py-3 w-8">
                    <Checkbox checked={sel.allSelected} onCheckedChange={() => sel.toggleAll()} />
                  </th>
                )}
                <th className="px-3 py-3 w-8"></th>
                <SortableTh sort={sort} onToggle={toggleSort} k="numero" label="REQ" />
                <SortableTh sort={sort} onToggle={toggleSort} k="data_movimento" label="Data" />
                <SortableTh sort={sort} onToggle={toggleSort} k="entrada_tipo" label="Tipo" />
                <SortableTh sort={sort} onToggle={toggleSort} k="fornecedor" label="Fornecedor" />
                <th className="px-4 py-3 font-medium text-right">Itens</th>
                <SortableTh sort={sort} onToggle={toggleSort} k="quantidade" label="Qtd total" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="valor_total" label="Valor total" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="nota_fiscal" label="NF" />
                <SortableTh sort={sort} onToggle={toggleSort} k="responsavel_lancamento" label="Responsável" />
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {pageGrupos.length ? pageGrupos.map((g: any) => {
                const isOpen = !!expandido[g.id];
                const colCount = (isAdmin ? 1 : 0) + 1 + 9 + (isAdmin ? 1 : 0);
                return (
                  <>
                    <tr key={g.id} className="border-t border-border hover:bg-muted/30">
                      {isAdmin && (
                        <td className="px-3 py-3">
                          <Checkbox checked={sel.selected.has(g.id)} onCheckedChange={() => sel.toggle(g.id)} />
                        </td>
                      )}
                      <td className="px-1 py-3">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setExpandido((p) => ({ ...p, [g.id]: !p[g.id] }))}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                        {g.numero != null ? `REQ-${String(g.numero).padStart(4, "0")}` : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(g.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.entrada_tipo ? entradaTipoLabels[g.entrada_tipo] ?? g.entrada_tipo : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.fornecedor?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{g.linhas.length}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-success">+{g.qtd_total}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {g.valor_total > 0 ? `R$ ${g.valor_total.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{g.nota_fiscal ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.responsavel_lancamento ?? "—"}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button type="button" variant="ghost" size="icon" onClick={() => { setPrefill(g); setOpen(true); }} title="Duplicar">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(g)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => {
                              const msg = g.linhas.length > 1
                                ? `Excluir esta requisição com ${g.linhas.length} itens? O estoque será revertido.`
                                : "Excluir esta entrada? O estoque será revertido.";
                              if (confirm(msg)) delMut.mutate(g);
                            }} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isOpen && (
                      <tr key={`${g.id}-exp`} className="bg-muted/20">
                        <td colSpan={colCount} className="px-6 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground">
                              <tr>
                                <th className="text-left py-1 font-medium">Item</th>
                                <th className="text-left py-1 font-medium">Código</th>
                                <th className="text-right py-1 font-medium">Qtd</th>
                                <th className="text-left py-1 font-medium pl-2">UN</th>
                                <th className="text-right py-1 font-medium pl-2">Valor unit.</th>
                                <th className="text-right py-1 font-medium pl-2">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.linhas.map((l: any) => (
                                <tr key={l.id} className="border-t border-border/40">
                                  <td className="py-1 font-medium">{l.item?.nome}</td>
                                  <td className="py-1 font-mono text-muted-foreground">{l.item?.codigo}</td>
                                  <td className="py-1 text-right tabular-nums">{Number(l.quantidade)}</td>
                                  <td className="py-1 pl-2 text-muted-foreground">{l.item?.unidade}</td>
                                  <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
                                    {l.valor_unitario != null ? `R$ ${Number(l.valor_unitario).toFixed(2)}` : "—"}
                                  </td>
                                  <td className="py-1 pl-2 text-right tabular-nums">
                                    {l.valor_unitario != null ? `R$ ${(Number(l.valor_unitario) * Number(l.quantidade)).toFixed(2)}` : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              }) : (
                <tr><td colSpan={isAdmin ? 12 : 10} className="text-center py-10 text-muted-foreground">Nenhuma entrada encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={sel.count}
        fields={ENTRADA_BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(p) => bulkMut.mutate(normalizeBulkPatch(p))}
        title="Editar entradas em massa"
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPrefill(null); }}>
        <DialogContent className="max-w-[min(1500px,98vw)] w-[98vw]">
          <DialogHeader><DialogTitle>{prefill ? "Duplicar entrada" : "Nova entrada"}</DialogTitle></DialogHeader>
          <EntradaForm
            key={prefill?.id ?? "new"}
            prefill={prefill}
            itens={itens ?? []}
            fornecedores={fornecedores ?? []}
            onEditFornecedor={(f: any) => setEditingFornecedor(f)}
            onSubmit={(meta: any, linhas: any) => mut.mutate({ meta, linhas })}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-[min(1500px,98vw)] w-[98vw]">
          <DialogHeader>
            <DialogTitle>
              Editar entrada{editing?.numero != null ? ` REQ-${String(editing.numero).padStart(4, "0")}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <EntradaForm
              key={`edit-${editing.id}`}
              prefill={editing}
              isEditing
              itens={itens ?? []}
              fornecedores={fornecedores ?? []}
              onEditFornecedor={(f: any) => setEditingFornecedor(f)}
              onSubmit={(meta: any, linhas: any) => editGroupMut.mutate({ grupo: editing, meta, linhas })}
              submitting={editGroupMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFornecedor} onOpenChange={(v) => !v && setEditingFornecedor(null)}>
        <DialogContent className="max-w-[min(1100px,96vw)] w-[96vw]">
          <DialogHeader><DialogTitle>Editar fornecedor</DialogTitle></DialogHeader>
          {editingFornecedor && (
            <FornecedorForm
              initial={editingFornecedor}
              onSubmit={(p: any) => fornMut.mutate({ ...p, id: editingFornecedor.id })}
              submitting={fornMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importingExcel}
        onOpenChange={setImportingExcel}
        title="Importar entradas via Excel"
        description="Envie uma planilha com as entradas. O item é localizado pelo campo 'codigo_item' e o fornecedor pelo nome (criado se não existir)."
        templateFilename="modelo_entradas.xlsx"
        templateHeaders={ENTRADA_TEMPLATE.headers}
        templateExample={ENTRADA_TEMPLATE.example}
        onImport={async (rows) => {
          const errors: string[] = []; let inserted = 0, skipped = 0;
          const { data: itensAll } = await supabase.from("itens").select("id,codigo");
          const itensMap = new Map((itensAll ?? []).map((i: any) => [String(i.codigo).toLowerCase(), i.id]));
          const { data: fornAll } = await supabase.from("fornecedores").select("id,nome");
          const fornMap = new Map((fornAll ?? []).map((f: any) => [String(f.nome).toLowerCase(), f.id]));

          for (const [idx, r] of rows.entries()) {
            const cod = String(r.codigo_item ?? "").trim().toLowerCase();
            const item_id = itensMap.get(cod);
            if (!item_id) { skipped++; errors.push(`Linha ${idx + 2}: item '${r.codigo_item}' não encontrado`); continue; }
            const qtd = Number(r.quantidade || 0);
            if (qtd <= 0) { skipped++; errors.push(`Linha ${idx + 2}: quantidade inválida`); continue; }
            let fornecedor_id: string | null = null;
            const fornNome = String(r.fornecedor_nome ?? "").trim();
            if (fornNome) {
              fornecedor_id = fornMap.get(fornNome.toLowerCase()) ?? null;
              if (!fornecedor_id) {
                const { data: novo } = await supabase.from("fornecedores").insert({ nome: fornNome }).select("id").single();
                if (novo) { fornecedor_id = novo.id; fornMap.set(fornNome.toLowerCase(), novo.id); }
              }
            }
            const data_movimento = r.data_movimento ? new Date(r.data_movimento).toISOString() : new Date().toISOString();
            const { error } = await supabase.from("movimentacoes").insert({
              tipo: "entrada", entrada_tipo: "compra", item_id, fornecedor_id,
              quantidade: qtd, valor_unitario: r.valor_unitario ? Number(r.valor_unitario) : null,
              empresa: r.empresa ? String(r.empresa).trim() : null,
              nota_fiscal: r.nota_fiscal || null, data_movimento,
              responsavel_lancamento: r.responsavel_lancamento || null, observacoes: r.observacoes || null,
            });
            if (error) { skipped++; errors.push(`Linha ${idx + 2}: ${error.message}`); }
            else inserted++;
          }
          qc.invalidateQueries({ queryKey: ["entradas"] });
          qc.invalidateQueries({ queryKey: ["itens"] });
          return { inserted, skipped, errors };
        }}
      />

      <NfeImportDialog open={importingXml} onOpenChange={setImportingXml} onDone={() => {
        qc.invalidateQueries({ queryKey: ["entradas"] });
        qc.invalidateQueries({ queryKey: ["itens"] });
        qc.invalidateQueries({ queryKey: ["fornecedores"] });
      }} />

        </TabsContent>

        <TabsContent value="sefaz" className="mt-0">
          <NotasSefaz />
        </TabsContent>
      </Tabs>
    </>
  );
}

type XmlItemMap = {
  mode: "existing" | "create" | "skip";
  existing_item_id?: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
};

function NfeImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [mappings, setMappings] = useState<XmlItemMap[]>([]);

  const { data: itensAll } = useQuery({
    queryKey: ["itens-select"],
    queryFn: async () =>
      await fetchAllRows<any>("itens", "id,nome,codigo,codigo_proprio,unidade,valor_unitario", {
        orderBy: { column: "nome", ascending: true },
        pageSize: 1000,
      }),
    staleTime: 60_000,
  });

  const loadPreview = async (f: File) => {
    try {
      const p = await parseNfeXml(f);
      setPreview(p);
      // Pré-mapeamento: tenta achar item existente por código
      const itens = itensAll ?? [];
      const next: XmlItemMap[] = p.itens.map((it: any) => {
        const match = itens.find(
          (x: any) =>
            String(x.codigo).trim().toLowerCase() === String(it.codigo).trim().toLowerCase() ||
            (x.codigo_proprio && String(x.codigo_proprio).trim().toLowerCase() === String(it.codigo).trim().toLowerCase()),
        );
        return {
          mode: match ? "existing" : "create",
          existing_item_id: match?.id,
          codigo: it.codigo,
          nome: it.nome,
          unidade: it.unidade || "un",
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
        };
      });
      setMappings(next);
    } catch (e: any) {
      toast.error(e.message);
      setPreview(null);
      setMappings([]);
    }
  };

  const updateMap = (idx: number, patch: Partial<XmlItemMap>) =>
    setMappings((arr) => arr.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      let fornecedor_id: string | null = null;
      const nome = preview.fornecedor.nome;
      const { data: existente } = await supabase.from("fornecedores").select("id").ilike("nome", nome).maybeSingle();
      if (existente) fornecedor_id = existente.id;
      else {
        const { data: novo, error } = await supabase
          .from("fornecedores")
          .insert({ nome, documento: preview.fornecedor.cnpj ?? null })
          .select("id")
          .single();
        if (error) throw error;
        fornecedor_id = novo.id;
      }

      let inserted = 0;
      let skipped = 0;
      for (const m of mappings) {
        if (m.mode === "skip") { skipped++; continue; }
        let item_id: string | null = null;
        if (m.mode === "existing") {
          if (!m.existing_item_id) { skipped++; continue; }
          item_id = m.existing_item_id;
        } else {
          // create
          const codigo = m.codigo.trim();
          const nomeIt = m.nome.trim();
          if (!codigo || !nomeIt) { skipped++; continue; }
          // dedupe por codigo
          const { data: jaExiste } = await supabase.from("itens").select("id").eq("codigo", codigo).maybeSingle();
          if (jaExiste) item_id = jaExiste.id;
          else {
            const { data: novoItem, error: errIt } = await supabase
              .from("itens")
              .insert({ codigo, nome: nomeIt, unidade: m.unidade || "un", valor_unitario: m.valor_unitario || null })
              .select("id")
              .single();
            if (errIt) { toast.error(`Item ${codigo}: ${errIt.message}`); skipped++; continue; }
            item_id = novoItem.id;
          }
        }
        const { error: errMov } = await supabase.from("movimentacoes").insert({
          tipo: "entrada",
          entrada_tipo: "compra",
          item_id,
          fornecedor_id,
          quantidade: m.quantidade,
          valor_unitario: m.valor_unitario,
          nota_fiscal: preview.numero ?? null,
          data_movimento: preview.emissao ? new Date(preview.emissao).toISOString() : new Date().toISOString(),
        });
        if (!errMov) inserted++;
        else skipped++;
      }
      toast.success(`${inserted} item(ns) importado(s)${skipped ? ` · ${skipped} ignorado(s)` : ""}`);
      onDone();
      onOpenChange(false);
      setFile(null); setPreview(null); setMappings([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setFile(null); setPreview(null); setMappings([]); } }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Importar NF-e (XML)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="p-4 bg-muted/30 text-sm">
            <div className="font-medium mb-1">Como funciona</div>
            <div className="text-muted-foreground text-xs">
              Para cada item da NF-e você pode <strong>associar</strong> a um item já cadastrado no estoque,
              <strong> cadastrar manualmente</strong> (editando código, nome e unidade) ou <strong>ignorar</strong>.
            </div>
          </Card>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Arquivo XML</label>
            <Input type="file" accept=".xml" onChange={async (e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f); setPreview(null); setMappings([]);
              if (f) await loadPreview(f);
            }} />
          </div>

          {preview && (
            <Card className="p-3 text-sm space-y-2">
              <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{preview.fornecedor.nome}</strong> {preview.fornecedor.cnpj ? `(${preview.fornecedor.cnpj})` : ""}</div>
              <div><span className="text-muted-foreground">NF nº:</span> {preview.numero ?? "—"} · {preview.itens.length} item(ns)</div>

              <div className="max-h-[55vh] overflow-auto border-t border-border pt-2 space-y-2">
                {mappings.map((m, idx) => (
                  <div key={idx} className="rounded-md border border-border p-2 space-y-2 bg-card">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{preview.itens[idx].nome}</div>
                        <div className="text-muted-foreground font-mono">
                          XML: {preview.itens[idx].codigo} · {m.quantidade} {preview.itens[idx].unidade} · R$ {Number(m.valor_unitario).toFixed(2)}
                        </div>
                      </div>
                      <Select value={m.mode} onValueChange={(v) => updateMap(idx, { mode: v as XmlItemMap["mode"] })}>
                        <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="existing">Associar a existente</SelectItem>
                          <SelectItem value="create">Cadastrar novo</SelectItem>
                          <SelectItem value="skip">Ignorar este item</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {m.mode === "existing" && (
                      <div>
                        <ItemSearchSelect
                          itens={itensAll ?? []}
                          value={m.existing_item_id ?? ""}
                          onChange={(v) => updateMap(idx, { existing_item_id: v })}
                        />
                      </div>
                    )}

                    {m.mode === "create" && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <label className="text-[10px] uppercase text-muted-foreground">Código</label>
                          <Input value={m.codigo} onChange={(e) => updateMap(idx, { codigo: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase text-muted-foreground">Nome</label>
                          <Input value={m.nome} onChange={(e) => updateMap(idx, { nome: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-1">
                          <label className="text-[10px] uppercase text-muted-foreground">Unidade</label>
                          <Input value={m.unidade} onChange={(e) => updateMap(idx, { unidade: e.target.value })} className="h-8 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={handleImport} disabled={!preview || busy}>
              {busy ? "Importando…" : "Importar entrada"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Linha = { item_id: string; quantidade: string; valor_unitario: string; desconto: string; frete: string; ipi: string; outros_custos: string };
const novaLinha = (overrides: Partial<Linha> = {}): Linha => ({ item_id: "", quantidade: "", valor_unitario: "", desconto: "0", frete: "0", ipi: "0", outros_custos: "0", ...overrides });

function EntradaForm({ prefill, isEditing, itens, fornecedores, onEditFornecedor, onSubmit, submitting }: any) {
  const [meta, setMeta] = useState({
    data_movimento: isEditing && prefill?.data_movimento
      ? toBRTInputDateTime(prefill.data_movimento)
      : toBRTInputDateTime(),
    entrada_tipo: prefill?.entrada_tipo ?? "compra",
    empresa: prefill?.empresa ?? "",
    fornecedor_id: prefill?.fornecedor_id ?? "",
    nota_fiscal: prefill?.nota_fiscal ?? "",
    observacoes: prefill?.observacoes ?? "",
  });
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    if (prefill?.linhas?.length) {
      return prefill.linhas.map((l: any) => novaLinha({
        item_id: l.item_id,
        quantidade: String(l.quantidade),
        valor_unitario: l.valor_unitario != null ? String(l.valor_unitario) : "",
        desconto: l.desconto != null ? String(l.desconto) : "0",
        frete: l.frete != null ? String(l.frete) : "0",
        ipi: l.ipi != null ? String(l.ipi) : "0",
        outros_custos: l.outros_custos != null ? String(l.outros_custos) : "0",
      }));
    }
    if (prefill) {
      return [
        novaLinha({ item_id: prefill.item_id, quantidade: String(prefill.quantidade), valor_unitario: prefill.valor_unitario != null ? String(prefill.valor_unitario) : "" }),
        novaLinha(),
      ];
    }
    return [novaLinha()];
  });

  const itensList = useMemo(() => {
    if (!isEditing || !prefill?.linhas?.length) return itens;
    const map = new Map<string, any>(itens.map((i: any) => [i.id, i]));
    for (const l of prefill.linhas) {
      if (!map.has(l.item_id) && l.item) {
        map.set(l.item_id, { id: l.item_id, nome: l.item.nome, codigo: l.item.codigo, unidade: l.item.unidade, valor_unitario: l.valor_unitario ?? null });
      }
    }
    return Array.from(map.values());
  }, [itens, isEditing, prefill]);

  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const valorRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [autoOpenIdx, setAutoOpenIdx] = useState<number | null>(null);

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));
  const setL = (i: number, k: keyof Linha, v: string) => {
    setLinhas((arr) => {
      const novo = [...arr];
      novo[i] = { ...novo[i], [k]: v };
      if (k === "item_id") {
        const it = itensList.find((x: any) => x.id === v);
        if (it?.valor_unitario != null && !novo[i].valor_unitario) {
          novo[i].valor_unitario = String(it.valor_unitario);
        }
      }
      return novo;
    });
  };
  const focusQty = (i: number) => { setTimeout(() => { const el = qtyRefs.current[i]; if (el) { el.focus(); el.select(); } }, 30); };
  const focusValor = (i: number) => { setTimeout(() => { const el = valorRefs.current[i]; if (el) { el.focus(); el.select(); } }, 0); };
  const goNextItem = (i: number) => {
    setLinhas((arr) => i === arr.length - 1 ? [...arr, novaLinha()] : arr);
    setAutoOpenIdx(i + 1);
  };
  const addLinha = () => setLinhas((a) => [...a, novaLinha()]);
  const remLinha = (i: number) => setLinhas((a) => (a.length === 1 ? a : a.filter((_, idx) => idx !== i)));

  const calcLinha = (l: Linha) => {
    const qtd = Number(l.quantidade || 0);
    const vu = Number(l.valor_unitario || 0);
    const desc = Number(l.desconto || 0);
    const fre = Number(l.frete || 0);
    const ip = Number(l.ipi || 0);
    const out = Number(l.outros_custos || 0);
    return qtd * vu - desc + fre + ip + out;
  };
  const subtotal = linhas.reduce((acc, l) => acc + Number(l.valor_unitario || 0) * Number(l.quantidade || 0), 0);
  const sumDesc = linhas.reduce((acc, l) => acc + Number(l.desconto || 0), 0);
  const sumFrete = linhas.reduce((acc, l) => acc + Number(l.frete || 0), 0);
  const sumIpi = linhas.reduce((acc, l) => acc + Number(l.ipi || 0), 0);
  const sumOutros = linhas.reduce((acc, l) => acc + Number(l.outros_custos || 0), 0);
  const totalGeral = linhas.reduce((acc, l) => acc + calcLinha(l), 0);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const validas = linhas.filter((l) => l.item_id && Number(l.quantidade) > 0);
      if (validas.length === 0) return toast.error("Adicione pelo menos um item");
      onSubmit(
        {
          data_movimento: fromBRTInputDateTime(meta.data_movimento),
          entrada_tipo: meta.entrada_tipo,
          fornecedor_id: meta.fornecedor_id || null,
          empresa: meta.empresa || null,
          nota_fiscal: meta.nota_fiscal || null,
          observacoes: meta.observacoes || null,
        },
        validas.map((l) => {
          const qtd = Number(l.quantidade);
          const vu = l.valor_unitario === "" ? 0 : Number(l.valor_unitario);
          const desc = Number(l.desconto || 0);
          const fre = Number(l.frete || 0);
          const ip = Number(l.ipi || 0);
          const out = Number(l.outros_custos || 0);
          const valor_total = qtd * vu - desc + fre + ip + out;
          return {
            item_id: l.item_id,
            quantidade: qtd,
            valor_unitario: l.valor_unitario === "" ? null : vu,
            valor_total: Number(valor_total.toFixed(4)),
            desconto: Number(desc.toFixed(4)),
            frete: Number(fre.toFixed(4)),
            ipi: Number(ip.toFixed(4)),
            outros_custos: Number(out.toFixed(4)),
          };
        }),
      );
    }} onKeyDown={(e) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault();
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo de entrada*">
          <Select value={meta.entrada_tipo} onValueChange={(v) => setM("entrada_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(entradaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Empresa*">
          <Select value={meta.empresa} onValueChange={(v) => setM("empresa", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Fornecedor">
          <EntitySearchSelect options={fornecedores} value={meta.fornecedor_id} onChange={(v) => setM("fornecedor_id", v)} onEdit={onEditFornecedor} placeholder="—" searchPlaceholder="Buscar fornecedor…" />
        </FormField>
        <FormField label="Nota fiscal / documento"><Input value={meta.nota_fiscal} onChange={(e) => setM("nota_fiscal", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={meta.observacoes} onChange={(e) => setM("observacoes", e.target.value)} /></FormField>
      </FormSection>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Itens da entrada</h3>
          <Button type="button" size="sm" variant="outline" onClick={addLinha}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar item
          </Button>
        </div>
        <Card className="p-3 space-y-3">
          {linhas.map((l, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-start border-b border-border/40 pb-3 last:border-0 last:pb-0">
              <div className="flex-1 basis-full lg:basis-[260px] min-w-[200px]">
                <div className="flex items-center gap-1.5 h-4">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item</label>
                  {l.item_id && <ItemInfoHover itemId={l.item_id} />}
                </div>
                <ItemSearchSelect itens={itensList} value={l.item_id} onChange={(v) => setL(i, "item_id", v)} autoOpen={(!l.item_id && i === linhas.length - 1 && i > 0) || autoOpenIdx === i} onAfterSelect={() => focusQty(i)} />
              </div>
              <div className="w-[70px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Qtd</label>
                <QuantidadeInput ref={(el) => { qtyRefs.current[i] = el; }} value={Number(l.quantidade) || 0} onChange={(n) => setL(i, "quantidade", String(n))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (l.item_id && Number(l.quantidade) > 0) focusValor(i); } }} className="px-2" />
              </div>
              <div className="w-[110px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Cust. Unit.</label>
                <MoneyInput value={Number(l.valor_unitario || 0)} onChange={(n) => setL(i, "valor_unitario", n ? String(n) : "")}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (l.item_id && Number(l.quantidade) > 0) goNextItem(i); } }} hidePrefix decimals={4} />
              </div>
              <div className="w-[90px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Desconto</label>
                <MoneyInput value={Number(l.desconto || 0)} onChange={(n) => setL(i, "desconto", String(n))} hidePrefix />
              </div>
              <div className="w-[90px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Frete</label>
                <MoneyInput value={Number(l.frete || 0)} onChange={(n) => setL(i, "frete", String(n))} hidePrefix />
              </div>
              <div className="w-[90px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">IPI</label>
                <MoneyInput value={Number(l.ipi || 0)} onChange={(n) => setL(i, "ipi", String(n))} hidePrefix />
              </div>
              <div className="w-[90px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Outros</label>
                <MoneyInput value={Number(l.outros_custos || 0)} onChange={(n) => setL(i, "outros_custos", String(n))} hidePrefix />
              </div>
              <div className="w-[110px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Total linha</label>
                <div className="h-9 flex items-center px-2 rounded-md border border-input bg-muted/30 text-sm tabular-nums">
                  R$ {calcLinha(l).toFixed(2)}
                </div>
              </div>
              <div className="flex items-end h-[52px]">
                <Button type="button" variant="ghost" size="icon" onClick={() => remLinha(i)} disabled={linhas.length === 1} title="Remover">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap justify-between border-t border-border pt-2 mt-2 text-sm gap-2">
            <span className="text-muted-foreground">
              Subtotal: R$ {subtotal.toFixed(2)} · Desc: R$ {sumDesc.toFixed(2)} · Frete: R$ {sumFrete.toFixed(2)} · IPI: R$ {sumIpi.toFixed(2)} · Outros: R$ {sumOutros.toFixed(2)}
            </span>
            <span className="font-semibold">Valor total: R$ {totalGeral.toFixed(2)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Os custos adicionais entram no valor total de cada item e atualizam o custo médio do estoque.</p>
        </Card>
      </div>

      <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : (isEditing ? "Salvar alterações" : "Registrar entrada")}</Button></FormActions>
    </form>
  );
}

function EntradaEditForm({ original, itens, fornecedores, onEditFornecedor, onSubmit, submitting }: any) {
  const [form, setForm] = useState({
    data_movimento: new Date(original.data_movimento).toISOString().slice(0, 16),
    entrada_tipo: original.entrada_tipo ?? "compra",
    item_id: original.item_id,
    fornecedor_id: original.fornecedor_id ?? "",
    quantidade: String(original.quantidade),
    valor_unitario: original.valor_unitario != null ? String(original.valor_unitario) : "",
    nota_fiscal: original.nota_fiscal ?? "",
    observacoes: original.observacoes ?? "",
  });
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!form.item_id || Number(form.quantidade) <= 0) return toast.error("Item e quantidade obrigatórios");
      onSubmit({
        data_movimento: new Date(form.data_movimento).toISOString(),
        entrada_tipo: form.entrada_tipo,
        item_id: form.item_id,
        fornecedor_id: form.fornecedor_id || null,
        quantidade: Number(form.quantidade),
        valor_unitario: form.valor_unitario === "" ? null : Number(form.valor_unitario),
        nota_fiscal: form.nota_fiscal || null,
        observacoes: form.observacoes || null,
      });
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={form.data_movimento} onChange={(e) => set("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo*">
          <Select value={form.entrada_tipo} onValueChange={(v) => set("entrada_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(entradaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Item*" wide>
          <ItemSearchSelect itens={itens} value={form.item_id} onChange={(v) => set("item_id", v)} />
        </FormField>
        <FormField label="Quantidade*"><QuantidadeInput value={Number(form.quantidade) || 0} onChange={(n) => set("quantidade", String(n))} /></FormField>
        <FormField label="Valor unit. (R$)"><MoneyInput value={Number(form.valor_unitario || 0)} onChange={(n) => set("valor_unitario", n ? String(n) : "")} decimals={4} /></FormField>
        <FormField label="Fornecedor">
          <EntitySearchSelect
            options={fornecedores}
            value={form.fornecedor_id}
            onChange={(v) => set("fornecedor_id", v)}
            onEdit={onEditFornecedor}
            placeholder="—"
            searchPlaceholder="Buscar fornecedor…"
          />
        </FormField>
        <FormField label="Nota fiscal"><Input value={form.nota_fiscal} onChange={(e) => set("nota_fiscal", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
      </FormSection>
      <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : "Salvar alterações"}</Button></FormActions>
    </form>
  );
}
