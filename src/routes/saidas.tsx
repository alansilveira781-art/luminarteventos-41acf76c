import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuantidadeInput } from "@/components/QuantidadeInput";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, RefreshCw, Trash2, Pencil, Search, Copy, X } from "lucide-react";
import { normalize, matchTokens } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRT, toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { saidaTipoLabels } from "@/lib/labels";
import { listEventos } from "@/lib/sheets.functions";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { ItemInfoHover } from "@/components/ItemInfoHover";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { ComboboxCreatable } from "@/components/ComboboxCreatable";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { SolicitanteForm } from "@/components/forms/SolicitanteForm";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import { EMPRESAS } from "@/lib/empresas";
import { PeriodoFilter, filterByPeriodo, periodoFromPreset, type Periodo, type PeriodoPreset } from "@/components/PeriodoFilter";
import { TablePagination } from "@/components/TablePagination";

export const Route = createFileRoute("/saidas")({
  component: SaidasPage,
});

function SaidasPage() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth(); const isAdmin = isModuleAdmin("estoque");
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [q, setQ] = useState<string>(""); const qd = useDebouncedValue(q, 300);
  const [filterItemQ, setFilterItemQ] = useState<string>(""); const filterItemQd = useDebouncedValue(filterItemQ, 300);
  const [filterEvento, setFilterEvento] = useState<string>("__all");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("__all");
  const { sort, toggleSort, applySort } = useSort();
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("mes");
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoFromPreset("mes"));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;


  // Edição de linha única: deletar a antiga e inserir a nova
  // (triggers do banco fazem a reversão e a reaplicação no estoque).
  const editMut = useMutation({
    mutationFn: async (p: { original: any; patch: any }) => {
      const { original, patch } = p;
      const newItemId = patch.item_id ?? original.item_id;
      const newQtd = Number(patch.quantidade ?? original.quantidade);
      // Validar estoque (considerando reversão do registro atual)
      const { data: itAtual } = await supabase
        .from("itens")
        .select("nome,unidade,quantidade_atual")
        .eq("id", newItemId)
        .single();
      if (itAtual) {
        const disponivelApos = newItemId === original.item_id
          ? Number(itAtual.quantidade_atual) + Number(original.quantidade)
          : Number(itAtual.quantidade_atual);
        if (newQtd > disponivelApos) {
          throw new Error(`Estoque insuficiente para ${itAtual.nome}. Disponível: ${disponivelApos} ${itAtual.unidade}`);
        }
      }
      const { id: _ignore, item: _i, solicitante: _s, created_at: _c, updated_at: _u, ...base } = original;
      const novo = { ...base, ...patch };
      const { error: delErr } = await supabase.from("movimentacoes").delete().eq("id", original.id);
      if (delErr) throw delErr;
      const { error } = await supabase.from("movimentacoes").insert(novo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Saída atualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editGroupMut = useMutation({
    mutationFn: async (p: { grupo: any; meta: any; linhas: Array<{ item_id: string; quantidade: number }> }) => {
      const old: any[] = p.grupo.linhas ?? [];
      // Bloquear se houver devoluções vinculadas a qualquer linha
      for (const m of old) {
        const { data: dev } = await supabase.from("movimentacoes").select("id").eq("saida_origem_id", m.id).limit(1);
        if (dev && dev.length) throw new Error("Esta requisição já tem devoluções vinculadas. Exclua as devoluções antes de editar.");
      }
      // Validar estoque considerando reversão das antigas
      const itemIds = Array.from(new Set([...old.map((o) => o.item_id), ...p.linhas.map((l) => l.item_id)]));
      const { data: itensCur } = await supabase.from("itens").select("id,nome,unidade,quantidade_atual").in("id", itemIds);
      const stockMap = new Map<string, { nome: string; unidade: string; qtd: number }>();
      for (const i of itensCur ?? []) stockMap.set(i.id, { nome: i.nome, unidade: i.unidade, qtd: Number(i.quantidade_atual) });
      for (const m of old) { const s = stockMap.get(m.item_id); if (s) s.qtd += Number(m.quantidade); }
      for (const l of p.linhas) {
        const s = stockMap.get(l.item_id);
        if (!s) throw new Error("Item inválido");
        if (l.quantidade > s.qtd) throw new Error(`Estoque insuficiente para ${s.nome}. Disponível: ${s.qtd} ${s.unidade}`);
        s.qtd -= l.quantidade;
      }
      // Apagar antigas (triggers devolvem o estoque)
      const oldIds = old.map((o) => o.id);
      const { error: delErr } = await supabase.from("movimentacoes").delete().in("id", oldIds);
      if (delErr) throw delErr;
      // Inserir novas mantendo o mesmo requisicao_numero (triggers descontam estoque)
      const requisicao_numero = p.grupo.numero ?? null;
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "saida" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
        requisicao_numero,
      }));
      const { error } = await supabase.from("movimentacoes").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Saída atualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (grupo: any) => {
      const linhas: any[] = grupo.linhas ?? [grupo];
      // Apagar devoluções vinculadas primeiro (triggers revertem estoque delas)
      for (const m of linhas) {
        await supabase.from("movimentacoes").delete().eq("saida_origem_id", m.id);
      }
      const ids = linhas.map((l) => l.id);
      // Apagar saídas (triggers devolvem o estoque)
      const { error } = await supabase.from("movimentacoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
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
        pageSize: 1000,
      }),
    staleTime: 0,
  });
  const { data: solicitantes } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("*").eq("status", "ativo").order("nome")).data ?? [],
    staleTime: 0,
    refetchOnMount: "always",
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
      const { data: numData, error: numErr } = await supabase.rpc("next_requisicao_numero" as any);
      if (numErr) throw numErr;
      const requisicao_numero = numData as number;
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "saida" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
        requisicao_numero,
      }));
      const { error } = await supabase.from("movimentacoes").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
      qc.invalidateQueries({ queryKey: ["item-movs"] });
      qc.invalidateQueries({ queryKey: ["item"] });
      toast.success("Saída registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filtros + agrupamento por requisicao_numero
  const filteredBaseList = (saidas ?? []).filter((m: any) => {
    if (filterItemQd.trim()) {
      const itemHay = `${m.item?.codigo ?? ""} ${m.item?.nome ?? ""}`;
      if (!matchTokens(itemHay, filterItemQd)) return false;
    }
    if (filterEvento !== "__all" && (m.evento_projeto ?? "") !== filterEvento) return false;
    if (filterEmpresa !== "__all" && (m.empresa ?? "") !== filterEmpresa) return false;
    if (!qd.trim()) return true;
    const hay = [
      m.item?.nome, m.item?.codigo, m.evento_projeto, m.solicitante?.nome,
      m.saida_tipo, m.finalidade, m.observacoes, m.saida_status,
      m.requisicao_numero ? `req-${String(m.requisicao_numero).padStart(4, "0")}` : "",
    ].join(" ");
    return matchTokens(hay, qd);
  });
  const eventosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (saidas ?? []).forEach((m: any) => { if (m.evento_projeto) s.add(m.evento_projeto); });
    return Array.from(s).sort();
  }, [saidas]);
  const grupos = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of filteredBaseList) {
      const key = m.requisicao_numero != null ? `req-${m.requisicao_numero}` : `solo-${m.id}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key, // usado para bulk selection
          numero: m.requisicao_numero,
          data_movimento: m.data_movimento,
          solicitante_id: m.solicitante_id,
          solicitante: m.solicitante,
          evento_projeto: m.evento_projeto,
          saida_tipo: m.saida_tipo,
          saida_status: m.saida_status,
          empresa: m.empresa,
          data_prevista_devolucao: m.data_prevista_devolucao,
          observacoes: m.observacoes,
          finalidade: m.finalidade,
          responsavel_retirada: m.responsavel_retirada,
          responsavel_recebimento: m.responsavel_recebimento,
          responsavel_lancamento: m.responsavel_lancamento,
          linhas: [],
          qtd_total: 0,
        });
      }
      const g = map.get(key)!;
      g.linhas.push(m);
      g.qtd_total += Number(m.quantidade);
    }
    const arr = Array.from(map.values());
    return applySort(arr, (g: any, k: string) => {
      if (k === "data_movimento") return g.data_movimento;
      if (k === "solicitante") return g.solicitante?.nome;
      if (k === "quantidade") return g.qtd_total;
      if (k === "numero") return g.numero ?? 0;
      return g[k];
    });
  }, [filteredBaseList, sort]);

  const gruposPeriodo = useMemo(
    () => filterByPeriodo(grupos, periodo, (g: any) => g.data_movimento),
    [grupos, periodo],
  );
  useEffect(() => { setPage(1); }, [q, filterItemQ, filterEvento, filterEmpresa, periodo, sort]);
  const pageCount = Math.max(1, Math.ceil(gruposPeriodo.length / PAGE_SIZE));
  const pageGrupos = useMemo(
    () => gruposPeriodo.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [gruposPeriodo, page],
  );
  const sel = useBulkSelection(pageGrupos);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const SAIDA_BULK_FIELDS: BulkField[] = [
    { key: "solicitante_id", label: "Solicitante", type: "select", allowClear: true,
      options: (solicitantes ?? []).map((s: any) => ({ value: s.id, label: s.nome })) },
    { key: "saida_tipo", label: "Tipo de saída", type: "select",
      options: Object.entries(saidaTipoLabels).map(([v, l]) => ({ value: v, label: l as string })) },
    { key: "empresa", label: "Empresa", type: "select",
      options: EMPRESAS.map((e) => ({ value: e, label: e })) },
    { key: "evento_projeto", label: "Evento/Projeto", type: "text" },
    { key: "finalidade", label: "Finalidade", type: "text" },
    { key: "responsavel_retirada", label: "Responsável retirada", type: "text" },
    { key: "responsavel_recebimento", label: "Responsável recebimento", type: "text" },
    { key: "data_prevista_devolucao", label: "Data prevista devolução", type: "date" },
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
      qc.invalidateQueries({ queryKey: ["saidas"] });
      toast.success("Saídas atualizadas");
      setBulkOpen(false);
      sel.clear();
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

      <Card className="p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por item, código, evento/projeto, solicitante, tipo, status…"
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
              list="saidas-filter-itens-list"
            />
            <datalist id="saidas-filter-itens-list">
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
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas empresas</SelectItem>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterItemQ || filterEvento !== "__all" || filterEmpresa !== "__all" || q) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFilterItemQ(""); setFilterEvento("__all"); setFilterEmpresa("__all"); setQ(""); }}>
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
            ? "Nenhuma saída"
            : `Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, gruposPeriodo.length)} de ${gruposPeriodo.length} saídas`}
        </div>
      </Card>

      {isAdmin && <BulkActionsBar count={sel.count} onEdit={() => setBulkOpen(true)} onClear={sel.clear} />}

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
                <SortableTh sort={sort} onToggle={toggleSort} k="empresa" label="Empresa" />
                <SortableTh sort={sort} onToggle={toggleSort} k="evento_projeto" label="Evento/Projeto" />
                <SortableTh sort={sort} onToggle={toggleSort} k="solicitante" label="Solicitante" />
                <SortableTh sort={sort} onToggle={toggleSort} k="saida_tipo" label="Tipo" />
                <th className="px-4 py-3 font-medium text-right">Itens</th>
                <SortableTh sort={sort} onToggle={toggleSort} k="quantidade" label="Qtd total" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="data_prevista_devolucao" label="Devolver até" />
                <SortableTh sort={sort} onToggle={toggleSort} k="saida_status" label="Status" />
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {pageGrupos.length ? pageGrupos.map((g: any) => {
                const isOpen = !!expandido[g.id];
                const colCount = (isAdmin ? 1 : 0) + 1 + 10 + (isAdmin ? 1 : 0);
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
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatBRT(g.data_movimento)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{g.empresa ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">{g.evento_projeto ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.solicitante?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.saida_tipo ? saidaTipoLabels[g.saida_tipo] : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{g.linhas.length}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-destructive">-{g.qtd_total}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.data_prevista_devolucao ? formatBRT(g.data_prevista_devolucao, { dateStyle: "short" }) : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={g.saida_status} /></td>
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
                                ? `Excluir esta requisição com ${g.linhas.length} itens? O estoque será revertido e devoluções vinculadas serão apagadas.`
                                : "Excluir esta saída? O estoque será revertido e devoluções vinculadas serão apagadas.";
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
                              </tr>
                            </thead>
                            <tbody>
                              {g.linhas.map((l: any) => (
                                <tr key={l.id} className="border-t border-border/40">
                                  <td className="py-1 font-medium">{l.item?.nome}</td>
                                  <td className="py-1 font-mono text-muted-foreground">{l.item?.codigo}</td>
                                  <td className="py-1 text-right tabular-nums">{Number(l.quantidade)}</td>
                                  <td className="py-1 pl-2 text-muted-foreground">{l.item?.unidade}</td>
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
                <tr><td colSpan={isAdmin ? 13 : 11} className="text-center py-10 text-muted-foreground">Nenhuma saída encontrada.</td></tr>
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
        fields={SAIDA_BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(p) => bulkMut.mutate(normalizeBulkPatch(p))}
        title="Editar saídas em massa"
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPrefill(null); }}>
        <DialogContent className="max-w-[min(1500px,98vw)] w-[98vw]">
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
        <DialogContent className="max-w-[min(1500px,98vw)] w-[98vw]">
          <DialogHeader>
            <DialogTitle>
              Editar saída{editing?.numero != null ? ` REQ-${String(editing.numero).padStart(4, "0")}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <SaidaForm
              key={`edit-${editing.id}`}
              prefill={editing}
              isEditing
              itens={itens ?? []}
              solicitantes={solicitantes ?? []}
              onEditSolicitante={(s: any) => setEditingSolicitante(s)}
              eventos={eventosQuery.data?.eventos ?? []}
              eventosError={eventosQuery.data?.error}
              onReloadEventos={() => eventosQuery.refetch()}
              reloadingEventos={eventosQuery.isFetching}
              onSubmit={(meta: any, linhas: any) => editGroupMut.mutate({ grupo: editing, meta, linhas })}
              submitting={editGroupMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSolicitante} onOpenChange={(v) => !v && setEditingSolicitante(null)}>
        <DialogContent className="max-w-[min(1100px,96vw)] w-[96vw]">
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

function SaidaForm({ prefill, isEditing, itens, solicitantes, onEditSolicitante, eventos, eventosError, onReloadEventos, reloadingEventos, onSubmit, submitting }: any) {
  const [meta, setMeta] = useState({
    data_movimento: isEditing && prefill?.data_movimento
      ? toBRTInputDateTime(prefill.data_movimento)
      : toBRTInputDateTime(),
    saida_tipo: prefill?.saida_tipo ?? "evento",
    empresa: prefill?.empresa ?? "",
    solicitante_id: prefill?.solicitante_id ?? "",
    evento_projeto: prefill?.evento_projeto ?? "",
    finalidade: prefill?.finalidade ?? "",
    sera_devolvido: isEditing
      ? ((prefill?.data_prevista_devolucao || prefill?.saida_status !== "finalizada") ? "sim" : "nao")
      : "sim",
    data_prevista_devolucao: isEditing ? (prefill?.data_prevista_devolucao ?? "") : "",
    observacoes: prefill?.observacoes ?? "",
  });
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    if (prefill?.linhas?.length) {
      const base = prefill.linhas.map((l: any) => ({ item_id: l.item_id, quantidade: String(l.quantidade) }));
      return isEditing ? base : [...base, { item_id: "", quantidade: "1" }];
    }
    if (prefill) {
      return [{ item_id: prefill.item_id, quantidade: String(prefill.quantidade) }, { item_id: "", quantidade: "1" }];
    }
    return [{ item_id: "", quantidade: "1" }];
  });

  const isEvento = meta.saida_tipo === "evento";

  // Em edição, garantir que itens da requisição (talvez com estoque 0 agora) apareçam na lista
  const itensList = useMemo(() => {
    if (!isEditing || !prefill?.linhas?.length) return itens;
    const map = new Map<string, any>(itens.map((i: any) => [i.id, i]));
    for (const l of prefill.linhas) {
      if (!map.has(l.item_id) && l.item) {
        map.set(l.item_id, { id: l.item_id, nome: l.item.nome, codigo: l.item.codigo, unidade: l.item.unidade, quantidade_atual: l.item.quantidade_atual ?? 0 });
      }
    }
    return Array.from(map.values());
  }, [itens, isEditing, prefill]);


  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [autoOpenIdx, setAutoOpenIdx] = useState<number | null>(null);

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));
  const setL = (i: number, k: keyof Linha, v: string) => setLinhas((arr) => {
    const novo = [...arr];
    novo[i] = { ...novo[i], [k]: v };
    return novo;
  });
  const focusQty = (i: number) => {
    setTimeout(() => {
      const el = qtyRefs.current[i];
      if (el) { el.focus(); el.select(); }
    }, 30);
  };
  const goNextItem = (i: number) => {
    setLinhas((arr) => {
      if (i === arr.length - 1) return [...arr, { item_id: "", quantidade: "1" }];
      return arr;
    });
    setAutoOpenIdx(i + 1);
  };
  const addLinha = () => setLinhas((a) => [...a, { item_id: "", quantidade: "1" }]);
  const remLinha = (i: number) => setLinhas((a) => (a.length === 1 ? a : a.filter((_, idx) => idx !== i)));

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (isEvento && !meta.evento_projeto) return toast.error("Evento/Projeto é obrigatório");
      if (!meta.empresa) return toast.error("Empresa é obrigatória");
      if (meta.sera_devolvido === "sim" && !meta.data_prevista_devolucao) {
        return toast.error("Informe a data prevista de devolução");
      }
      const validas = linhas.filter((l) => l.item_id && Number(l.quantidade) > 0);
      if (validas.length === 0) return toast.error("Adicione pelo menos um item");
      onSubmit(
        {
          data_movimento: fromBRTInputDateTime(meta.data_movimento),
          saida_tipo: meta.saida_tipo,
          empresa: meta.empresa || null,
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
        <FormField label="Empresa*">
          <Select value={meta.empresa} onValueChange={(v) => setM("empresa", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>


        {isEvento && (
          <FormField label="Evento / Projeto*" wide>
            <EventoSheetCombobox
              value={meta.evento_projeto}
              onChange={(v) => setM("evento_projeto", v ?? "")}
            />
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
            const it = itensList.find((x: any) => x.id === l.item_id);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-8">
                  <div className="flex items-center gap-1.5 h-4">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item</label>
                    {l.item_id && <ItemInfoHover itemId={l.item_id} />}
                  </div>
                  <ItemSearchSelect
                    itens={itensList}
                    value={l.item_id}
                    onChange={(v) => setL(i, "item_id", v)}
                    showStock
                    autoOpen={(!l.item_id && i === linhas.length - 1 && i > 0) || autoOpenIdx === i}
                    onAfterSelect={() => focusQty(i)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 min-h-[14px]">{it ? `Disponível: ${Number(it.quantidade_atual)} ${it.unidade}` : ""}</p>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground h-4 block">Quantidade</label>
                  <QuantidadeInput
                    ref={(el) => { qtyRefs.current[i] = el; }}
                    value={Number(l.quantidade) || 0}
                    onChange={(n) => setL(i, "quantidade", String(n))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (l.item_id && Number(l.quantidade) > 0) goNextItem(i);
                      }
                    }}
                  />
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

      <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : (isEditing ? "Salvar alterações" : "Registrar saída")}</Button></FormActions>
    </form>
  );
}

function SaidaEditForm({ original, itens, solicitantes, onEditSolicitante, eventos, onSubmit, submitting }: any) {
  const [form, setForm] = useState({
    data_movimento: toBRTInputDateTime(original.data_movimento),
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
        data_movimento: fromBRTInputDateTime(form.data_movimento),
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
        <FormField label="Quantidade*"><QuantidadeInput value={Number(form.quantidade) || 0} onChange={(n) => set("quantidade", String(n))} /></FormField>
        {isEvento && (
          <FormField label="Evento / Projeto*" wide>
            <EventoSheetCombobox
              value={form.evento_projeto}
              onChange={(v) => set("evento_projeto", v ?? "")}
            />
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
