import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, History, Pencil, Upload, Trash2, ArrowUp, ArrowDown, ArrowUpDown, EyeOff, Eye, Copy } from "lucide-react";
import { ItemForm } from "@/components/forms/ItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportDialog } from "@/components/ImportDialog";
import { ConferenciaEgestorDialog } from "@/components/estoque/ConferenciaEgestorDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, FileCheck2 } from "lucide-react";
import { normalize, matchTokens } from "@/lib/utils";
import { ITEM_TEMPLATE } from "@/lib/import-utils";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { PeriodoFilter, filterByPeriodo, periodoFromPreset, type Periodo, type PeriodoPreset } from "@/components/PeriodoFilter";
import { TablePagination } from "@/components/TablePagination";
import { toast } from "sonner";

const ITEM_BULK_FIELDS: BulkField[] = [
  { key: "categoria", label: "Categoria", type: "text" },
  { key: "subcategoria", label: "Subcategoria", type: "text" },
  { key: "unidade", label: "Unidade", type: "text" },
  { key: "localizacao", label: "Localização", type: "text" },
  { key: "status", label: "Status", type: "select", options: [
    { value: "disponivel", label: "Disponível" },
    { value: "baixo_estoque", label: "Baixo estoque" },
    { value: "sem_estoque", label: "Sem estoque" },
    { value: "em_manutencao", label: "Em manutenção" },
    { value: "inativo", label: "Inativo" },
  ]},
  { key: "quantidade_minima", label: "Quantidade mínima", type: "number" },
  { key: "valor_unitario", label: "Valor unitário (R$)", type: "money" },
  { key: "observacoes", label: "Observações", type: "textarea" },
];

export const Route = createFileRoute("/estoque/")({
  component: EstoquePage,
});

function EstoquePage() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth(); const isAdmin = isModuleAdmin("estoque");
  const [q, setQ] = useState<string>("");
  const qd = useDebouncedValue(q, 300);
  const [editing, setEditing] = useState<any | null>(null);
  const [duplicating, setDuplicating] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [hideZero, setHideZero] = useState<boolean>(false);
  const [sort, setSort] = useState<{ key: string; dir: "desc" | "asc" } | null>(null);
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("todos");
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoFromPreset("todos"));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { data: itens, isLoading } = useQuery({
    queryKey: ["itens"],
    queryFn: async () => {
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      const cols = "id,codigo,codigo_proprio,nome,descricao,categoria,subcategoria,unidade,quantidade_atual,quantidade_minima,status,valor_unitario,localizacao,foto_url,observacoes,created_at,updated_at";
      while (true) {
        const { data, error } = await supabase
          .from("itens")
          .select(cols)
          .order("nome")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("itens").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("itens").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      qc.invalidateQueries({ queryKey: ["itens-busca"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      toast.success(editing ? "Alterações salvas" : "Item registrado");
      setEditing(null);
      setCreating(false);
      setDuplicating(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      // remove dependent movements first to avoid FK/constraint surprises
      await supabase.from("movimentacao_itens").delete().eq("item_id", id);
      await supabase.from("movimentacoes").delete().eq("item_id", id);
      const { error } = await supabase.from("itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Item excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelMut = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await supabase.from("movimentacao_itens").delete().eq("item_id", id);
        await supabase.from("movimentacoes").delete().eq("item_id", id);
        const { error } = await supabase.from("itens").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Itens excluídos");
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleBulkDelete() {
    const ids = Array.from(sel.selected);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} item(ns)? Todas as movimentações vinculadas serão apagadas. Esta ação não pode ser desfeita.`)) return;
    bulkDelMut.mutate(ids);
  }


  const filtered = useMemo(() => {
    if (!itens) return [];
    let arr = itens as any[];
    if (qd.trim()) {
      arr = arr.filter((i) =>
        matchTokens([i.nome, i.codigo, i.categoria, i.localizacao, i.status].join(" "), qd),
      );
    }
    if (hideZero) arr = arr.filter((i) => Number(i.quantidade_atual) > 0);
    arr = filterByPeriodo(arr, periodo, (i: any) => i.created_at);
    if (sort) {
      const { key, dir } = sort;
      arr = [...arr].sort((a, b) => {
        const va = a[key]; const vb = b[key];
        const na = typeof va === "number" ? va : Number(va);
        const nb = typeof vb === "number" ? vb : Number(vb);
        let cmp: number;
        if (!isNaN(na) && !isNaN(nb) && (typeof va !== "string" || typeof vb !== "string")) {
          cmp = na - nb;
        } else {
          cmp = String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true });
        }
        return dir === "desc" ? -cmp : cmp;
      });
    }
    return arr;
  }, [itens, q, hideZero, sort, periodo]);

  useEffect(() => { setPage(1); }, [q, hideZero, sort, periodo]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const sel = useBulkSelection(pageItems);
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const ids = Array.from(sel.selected);
      if (!ids.length) return;
      const { error } = await supabase.from("itens").update(patch as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Itens atualizados");
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggleSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }
  function SortIcon({ k }: { k: string }) {
    if (!sort || sort.key !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sort.dir === "desc" ? <ArrowDown className="h-3 w-3 text-primary" /> : <ArrowUp className="h-3 w-3 text-primary" />;
  }
  const Th = ({ k, label, align = "left" }: { k: string; label: string; align?: "left" | "right" }) => (
    <th className={`px-4 py-3 font-medium text-${align} cursor-pointer select-none`} onClick={() => toggleSort(k)}>
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""}`}>
        {label} <SortIcon k={k} />
      </span>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Cadastro e consulta de itens"
        actions={
          <>
            <Button type="button" size="lg" variant="outline" onClick={() => setHideZero((v) => !v)}>
              {hideZero ? <><Eye className="h-4 w-4 mr-1" /> Mostrar zerados</> : <><EyeOff className="h-4 w-4 mr-1" /> Ocultar zerados</>}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="lg" variant="outline">
                  <Upload className="h-4 w-4 mr-1" /> Nova importação
                  <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setImporting(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Importar itens
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConferindo(true)}>
                  <FileCheck2 className="h-4 w-4 mr-2" /> Conferir estoque (Egestor)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" size="lg" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo item
            </Button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código, categoria, localização, status…"
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
          {filtered.length === 0
            ? "Nenhum item"
            : `Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} de ${filtered.length}${itens && filtered.length !== itens.length ? ` (total ${itens.length})` : ""}`}
        </div>
      </Card>

      <BulkActionsBar count={sel.count} onEdit={() => setBulkOpen(true)} onClear={sel.clear} />

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
                <Th k="codigo" label="Código" />
                <Th k="nome" label="Item" />
                <Th k="categoria" label="Categoria" />
                <Th k="localizacao" label="Localização" />
                <Th k="quantidade_atual" label="Qtd" align="right" />
                <Th k="unidade" label="UN" />
                <Th k="quantidade_minima" label="Mín" align="right" />
                <Th k="status" label="Status" />
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-10 text-muted-foreground">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-10 text-muted-foreground">Nenhum item encontrado.</td></tr>
              ) : (
                pageItems.map((i) => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <Checkbox checked={sel.selected.has(i.id)} onCheckedChange={() => sel.toggle(i.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">{i.codigo}</td>
                    <td className="px-4 py-3 font-medium">{i.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.localizacao ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(i.quantidade_atual)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.unidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(i.quantidade_minima)}</td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/estoque/$itemId" params={{ itemId: i.id }}>
                            <History className="h-4 w-4" />
                          </Link>
                        </Button>
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(i)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDuplicating(i)} title="Duplicar">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Excluir o item "${i.nome}"? Esta ação não pode ser desfeita.`)) {
                                  delMut.mutate(i.id);
                                }
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <Dialog open={creating || !!editing || !!duplicating} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); setDuplicating(null); } }}>
        <DialogContent className="max-w-[min(1100px,96vw)] w-[96vw]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : duplicating ? `Duplicar “${duplicating.nome}”` : "Novo item"}</DialogTitle>
          </DialogHeader>
          <ItemForm
            key={editing?.id ?? (duplicating ? `dup-${duplicating.id}` : "new")}
            initial={editing}
            seed={duplicating ? { ...duplicating, id: undefined, codigo: "", quantidade_atual: 0 } : undefined}
            allowEditCodigo={isAdmin}
            onSubmit={(payload) => mut.mutate(editing ? { ...payload, id: editing.id } : payload)}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        title="Importar itens"
        description="Envie uma planilha (.xlsx, .xls ou .csv) com os itens a serem cadastrados. Itens com código já existente serão ignorados."
        templateFilename="modelo_itens.xlsx"
        templateHeaders={ITEM_TEMPLATE.headers}
        templateExample={ITEM_TEMPLATE.example}
        onImport={async (rows) => {
          const errors: string[] = [];
          let inserted = 0, skipped = 0;
          const { data: existentes } = await supabase.from("itens").select("codigo");
          const setCodigos = new Set((existentes ?? []).map((i: any) => String(i.codigo).toLowerCase()));
          for (const [idx, r] of rows.entries()) {
            const codigo = String(r.codigo ?? "").trim();
            const nome = String(r.nome ?? "").trim();
            if (!codigo || !nome) { skipped++; errors.push(`Linha ${idx + 2}: código e nome obrigatórios`); continue; }
            if (setCodigos.has(codigo.toLowerCase())) { skipped++; continue; }
            const payload = {
              codigo, nome,
              codigo_proprio: r.codigo_proprio || null,
              categoria: r.categoria || null,
              subcategoria: r.subcategoria || null,
              unidade: String(r.unidade || "Unidade"),
              valor_unitario: r.valor_unitario ? Number(r.valor_unitario) : null,
              quantidade_atual: Number(r.quantidade_atual || 0),
              quantidade_minima: Number(r.quantidade_minima || 0),
              localizacao: r.localizacao || null,
              descricao: r.descricao || null,
              observacoes: r.observacoes || null,
              foto_url: r.foto_url || null,
            };
            const { error } = await supabase.from("itens").insert(payload);
            if (error) { skipped++; errors.push(`Linha ${idx + 2}: ${error.message}`); }
            else { inserted++; setCodigos.add(codigo.toLowerCase()); }
          }
          qc.invalidateQueries({ queryKey: ["itens"] });
          return { inserted, skipped, errors };
        }}
      />

      <ConferenciaEgestorDialog open={conferindo} onOpenChange={setConferindo} />



      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={sel.count}
        fields={ITEM_BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(p) => bulkMut.mutate(normalizeBulkPatch(p))}
        title="Editar itens em massa"
      />
    </>
  );
}
