import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Upload, FileCode2, Trash2, Pencil, Search, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { entradaTipoLabels } from "@/lib/labels";
import { ImportDialog } from "@/components/ImportDialog";
import { ENTRADA_TEMPLATE } from "@/lib/import-utils";
import { parseNfeXml } from "@/lib/nfe-parser";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { FornecedorForm } from "@/components/forms/FornecedorForm";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { useAuth } from "@/contexts/AuthContext";

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
  const [q, setQ] = useState("");
  const { sort, toggleSort, applySort } = useSort();

  const editMut = useMutation({
    mutationFn: async (p: { original: any; patch: any }) => {
      const { original, patch } = p;
      const newItemId = patch.item_id ?? original.item_id;
      const newQtd = Number(patch.quantidade ?? original.quantidade);
      const oldQtd = Number(original.quantidade);
      // Ajustar estoque: reverter antiga e aplicar nova
      if (newItemId === original.item_id) {
        const delta = newQtd - oldQtd;
        if (delta !== 0) {
          const { data: it } = await supabase.from("itens").select("quantidade_atual").eq("id", original.item_id).single();
          if (it) await supabase.from("itens").update({ quantidade_atual: Number(it.quantidade_atual) + delta }).eq("id", original.item_id);
        }
      } else {
        // reverter no antigo
        const { data: itOld } = await supabase.from("itens").select("quantidade_atual").eq("id", original.item_id).single();
        if (itOld) await supabase.from("itens").update({ quantidade_atual: Number(itOld.quantidade_atual) - oldQtd }).eq("id", original.item_id);
        // aplicar no novo
        const { data: itNew } = await supabase.from("itens").select("quantidade_atual").eq("id", newItemId).single();
        if (itNew) await supabase.from("itens").update({ quantidade_atual: Number(itNew.quantidade_atual) + newQtd }).eq("id", newItemId);
      }
      const { error } = await supabase.from("movimentacoes").update(patch).eq("id", original.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Entrada atualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (m: any) => {
      // Reverter estoque (entrada adicionou, então subtrair)
      const { data: it } = await supabase.from("itens").select("quantidade_atual").eq("id", m.item_id).single();
      if (it) {
        await supabase.from("itens").update({ quantidade_atual: Number(it.quantidade_atual) - Number(m.quantidade) }).eq("id", m.item_id);
      }
      const { error } = await supabase.from("movimentacoes").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Entrada excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
    queryFn: async () =>
      await fetchAllRows<any>("itens", "id,nome,codigo,codigo_proprio,unidade,valor_unitario", {
        orderBy: { column: "nome", ascending: true },
        pageSize: 1000,
      }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").eq("status", "ativo").order("nome")).data ?? [],
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

  // Múltiplos itens em uma única entrada: criamos N movimentações compartilhando metadados
  const mut = useMutation({
    mutationFn: async (p: { meta: any; linhas: Array<{ item_id: string; quantidade: number; valor_unitario: number | null }> }) => {
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "entrada" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
        valor_unitario: l.valor_unitario,
      }));
      const { error } = await supabase.from("movimentacoes").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
      toast.success("Entrada registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filtros e seleção em massa
  const sBusca = q.toLowerCase().trim();
  const filteredBaseList = (entradas ?? []).filter((m: any) => {
    if (!sBusca) return true;
    return [
      m.item?.nome, m.item?.codigo, m.fornecedor?.nome,
      m.entrada_tipo, m.nota_fiscal, m.responsavel_lancamento, m.observacoes,
    ].map((x) => String(x ?? "").toLowerCase()).join(" ").includes(sBusca);
  });
  const filteredList = applySort(filteredBaseList, (m: any, k: string) => {
    if (k === "data_movimento") return m.data_movimento;
    if (k === "item") return m.item?.nome;
    if (k === "fornecedor") return m.fornecedor?.nome;
    if (k === "unidade") return m.item?.unidade;
    if (k === "valor_total") return Number(m.valor_unitario ?? 0) * Number(m.quantidade ?? 0);
    if (k === "quantidade") return Number(m.quantidade);
    return m[k];
  });
  const sel = useBulkSelection(filteredList);
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
      const ids = Array.from(sel.selected);
      if (!ids.length) return;
      const { error } = await supabase.from("movimentacoes").update(patch as any).in("id", ids);
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

      <Card className="p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por item, código, fornecedor, NF, responsável…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {filteredList.length} {filteredList.length === 1 ? "entrada" : "entradas"}
          {entradas && filteredList.length !== entradas.length ? ` (de ${entradas.length})` : ""}
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
                <SortableTh sort={sort} onToggle={toggleSort} k="data_movimento" label="Data" />
                <SortableTh sort={sort} onToggle={toggleSort} k="item" label="Item" />
                <SortableTh sort={sort} onToggle={toggleSort} k="entrada_tipo" label="Tipo" />
                <SortableTh sort={sort} onToggle={toggleSort} k="fornecedor" label="Fornecedor" />
                <SortableTh sort={sort} onToggle={toggleSort} k="quantidade" label="Qtd" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="unidade" label="UN" />
                <SortableTh sort={sort} onToggle={toggleSort} k="valor_total" label="Valor total" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="nota_fiscal" label="NF" />
                <SortableTh sort={sort} onToggle={toggleSort} k="responsavel_lancamento" label="Responsável" />
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {filteredList.length ? filteredList.map((m: any) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <Checkbox checked={sel.selected.has(m.id)} onCheckedChange={() => sel.toggle(m.id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{m.item?.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.entrada_tipo ? entradaTipoLabels[m.entrada_tipo] ?? m.entrada_tipo : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.fornecedor?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">+{Number(m.quantidade)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.item?.unidade}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {m.valor_unitario ? `R$ ${(Number(m.valor_unitario) * Number(m.quantidade)).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.nota_fiscal ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.responsavel_lancamento ?? "—"}</td>
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
                          if (confirm("Excluir esta entrada? O estoque será revertido.")) delMut.mutate(m);
                        }} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={isAdmin ? 11 : 9} className="text-center py-10 text-muted-foreground">Nenhuma entrada encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
        <DialogContent className="max-w-4xl">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar entrada</DialogTitle></DialogHeader>
          {editing && (
            <EntradaEditForm
              original={editing}
              itens={itens ?? []}
              fornecedores={fornecedores ?? []}
              onEditFornecedor={(f: any) => setEditingFornecedor(f)}
              onSubmit={(patch: any) => editMut.mutate({ original: editing, patch })}
              submitting={editMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFornecedor} onOpenChange={(v) => !v && setEditingFornecedor(null)}>
        <DialogContent className="max-w-3xl">
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
    </>
  );
}

function NfeImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPreview = async (f: File) => {
    try { setPreview(await parseNfeXml(f)); }
    catch (e: any) { toast.error(e.message); setPreview(null); }
  };

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      let fornecedor_id: string | null = null;
      const nome = preview.fornecedor.nome;
      const { data: existente } = await supabase.from("fornecedores").select("id").ilike("nome", nome).maybeSingle();
      if (existente) fornecedor_id = existente.id;
      else {
        const { data: novo, error } = await supabase.from("fornecedores").insert({
          nome, documento: preview.fornecedor.cnpj ?? null,
        }).select("id").single();
        if (error) throw error;
        fornecedor_id = novo.id;
      }

      let inserted = 0;
      for (const it of preview.itens) {
        let item_id: string | null = null;
        const { data: existenteItem } = await supabase.from("itens").select("id").eq("codigo", it.codigo).maybeSingle();
        if (existenteItem) item_id = existenteItem.id;
        else {
          const { data: novoItem, error: errIt } = await supabase.from("itens").insert({
            codigo: it.codigo, nome: it.nome, unidade: it.unidade || "un",
          }).select("id").single();
          if (errIt) { toast.error(`Item ${it.codigo}: ${errIt.message}`); continue; }
          item_id = novoItem.id;
        }
        const { error: errMov } = await supabase.from("movimentacoes").insert({
          tipo: "entrada", entrada_tipo: "compra", item_id, fornecedor_id,
          quantidade: it.quantidade, valor_unitario: it.valor_unitario,
          nota_fiscal: preview.numero ?? null,
          data_movimento: preview.emissao ? new Date(preview.emissao).toISOString() : new Date().toISOString(),
        });
        if (!errMov) inserted++;
      }
      toast.success(`${inserted} item(ns) importado(s) da NF-e`);
      onDone();
      onOpenChange(false);
      setFile(null); setPreview(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setFile(null); setPreview(null); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Importar NF-e (XML)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="p-4 bg-muted/30 text-sm">
            <div className="font-medium mb-1">Formato esperado</div>
            <div className="text-muted-foreground text-xs">
              XML padrão SEFAZ (NF-e), normalmente disponibilizado pelo fornecedor após a emissão. Contém os dados do emitente, itens, quantidades e valores.
              O sistema vai criar fornecedor e itens automaticamente caso ainda não existam.
            </div>
          </Card>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Arquivo XML</label>
            <Input type="file" accept=".xml" onChange={async (e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f); setPreview(null);
              if (f) await loadPreview(f);
            }} />
          </div>

          {preview && (
            <Card className="p-3 text-sm space-y-2">
              <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{preview.fornecedor.nome}</strong> {preview.fornecedor.cnpj ? `(${preview.fornecedor.cnpj})` : ""}</div>
              <div><span className="text-muted-foreground">NF nº:</span> {preview.numero ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{preview.itens.length} item(ns)</div>
              <div className="max-h-48 overflow-auto text-xs border-t border-border pt-2">
                {preview.itens.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between gap-2 py-0.5 border-b border-border/50 last:border-0">
                    <span className="font-mono text-muted-foreground">{i.codigo}</span>
                    <span className="flex-1 truncate">{i.nome}</span>
                    <span className="tabular-nums">{i.quantidade} {i.unidade}</span>
                    <span className="tabular-nums text-muted-foreground">R$ {i.valor_unitario.toFixed(2)}</span>
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

type Linha = { item_id: string; quantidade: string; valor_unitario: string };

function EntradaForm({ prefill, itens, fornecedores, onEditFornecedor, onSubmit, submitting }: any) {
  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    entrada_tipo: prefill?.entrada_tipo ?? "compra",
    fornecedor_id: prefill?.fornecedor_id ?? "",
    nota_fiscal: prefill?.nota_fiscal ?? "",
    observacoes: prefill?.observacoes ?? "",
  });
  const [linhas, setLinhas] = useState<Linha[]>(
    prefill ? [{ item_id: prefill.item_id, quantidade: String(prefill.quantidade), valor_unitario: prefill.valor_unitario != null ? String(prefill.valor_unitario) : "" }, { item_id: "", quantidade: "1", valor_unitario: "" }]
            : [{ item_id: "", quantidade: "1", valor_unitario: "" }],
  );

  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const valorRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [autoOpenIdx, setAutoOpenIdx] = useState<number | null>(null);

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));
  const setL = (i: number, k: keyof Linha, v: string) => {
    setLinhas((arr) => {
      const novo = [...arr];
      novo[i] = { ...novo[i], [k]: v };
      if (k === "item_id") {
        const it = itens.find((x: any) => x.id === v);
        if (it?.valor_unitario != null && !novo[i].valor_unitario) {
          novo[i].valor_unitario = String(it.valor_unitario);
        }
      }
      return novo;
    });
  };
  const focusQty = (i: number) => {
    setTimeout(() => {
      const el = qtyRefs.current[i];
      if (el) { el.focus(); el.select(); }
    }, 30);
  };
  const focusValor = (i: number) => {
    setTimeout(() => {
      const el = valorRefs.current[i];
      if (el) { el.focus(); el.select(); }
    }, 0);
  };
  const goNextItem = (i: number) => {
    setLinhas((arr) => {
      if (i === arr.length - 1) return [...arr, { item_id: "", quantidade: "1", valor_unitario: "" }];
      return arr;
    });
    setAutoOpenIdx(i + 1);
  };
  const addLinha = () => setLinhas((a) => [...a, { item_id: "", quantidade: "1", valor_unitario: "" }]);
  const remLinha = (i: number) => setLinhas((a) => (a.length === 1 ? a : a.filter((_, idx) => idx !== i)));

  const total = linhas.reduce((acc, l) => acc + (Number(l.valor_unitario || 0) * Number(l.quantidade || 0)), 0);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const validas = linhas.filter((l) => l.item_id && Number(l.quantidade) > 0);
      if (validas.length === 0) return toast.error("Adicione pelo menos um item");
      onSubmit(
        {
          data_movimento: new Date(meta.data_movimento).toISOString(),
          entrada_tipo: meta.entrada_tipo,
          fornecedor_id: meta.fornecedor_id || null,
          nota_fiscal: meta.nota_fiscal || null,
          observacoes: meta.observacoes || null,
        },
        validas.map((l) => ({
          item_id: l.item_id,
          quantidade: Number(l.quantidade),
          valor_unitario: l.valor_unitario === "" ? null : Number(l.valor_unitario),
        })),
      );
    }} onKeyDown={(e) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    }} className="space-y-4">
      <FormSection>
        <FormField label="Data*"><Input required type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></FormField>
        <FormField label="Tipo de entrada*">
          <Select value={meta.entrada_tipo} onValueChange={(v) => setM("entrada_tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(entradaTipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Fornecedor">
          <EntitySearchSelect
            options={fornecedores}
            value={meta.fornecedor_id}
            onChange={(v) => setM("fornecedor_id", v)}
            onEdit={onEditFornecedor}
            placeholder="—"
            searchPlaceholder="Buscar fornecedor…"
          />
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
        <Card className="p-3 space-y-2">
          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item</label>
                <ItemSearchSelect
                  itens={itens}
                  value={l.item_id}
                  onChange={(v) => setL(i, "item_id", v)}
                  autoOpen={(!l.item_id && i === linhas.length - 1 && i > 0) || autoOpenIdx === i}
                  onAfterSelect={() => focusQty(i)}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qtd</label>
                <Input
                  ref={(el) => { qtyRefs.current[i] = el; }}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={l.quantidade}
                  onChange={(e) => setL(i, "quantidade", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (l.item_id && Number(l.quantidade) > 0) focusValor(i);
                    }
                  }}
                />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor unit. (R$)</label>
                <Input
                  ref={(el) => { valorRefs.current[i] = el; }}
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.valor_unitario}
                  onChange={(e) => setL(i, "valor_unitario", e.target.value)}
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
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">{linhas.length} item(ns)</span>
            <span className="font-medium">Total: R$ {total.toFixed(2)}</span>
          </div>
        </Card>
      </div>

      <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Registrando…" : "Registrar entrada"}</Button></FormActions>
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
        <FormField label="Quantidade*"><Input required type="number" min="0.01" step="0.01" value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></FormField>
        <FormField label="Valor unit. (R$)"><Input type="number" min="0" step="0.01" value={form.valor_unitario} onChange={(e) => set("valor_unitario", e.target.value)} /></FormField>
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
