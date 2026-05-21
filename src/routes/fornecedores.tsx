import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Pencil, Upload, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportDialog } from "@/components/ImportDialog";
import { FORNECEDOR_TEMPLATE } from "@/lib/import-utils";
import { FornecedorForm } from "@/components/forms/FornecedorForm";
import { normalize } from "@/lib/utils";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/fornecedores")({
  component: FornecedoresPage,
});

const FORN_BULK_FIELDS: BulkField[] = [
  { key: "status", label: "Status", type: "select", options: [{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }] },
  { key: "tipo_fornecimento", label: "Tipo de fornecimento", type: "text" },
  { key: "endereco", label: "Endereço", type: "text" },
  { key: "observacoes", label: "Observações", type: "textarea" },
];

function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [q, setQ] = useState(""); const qd = useDebouncedValue(q, 300);
  const { sort, toggleSort, applySort } = useSort();

  const { data } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("fornecedores").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); qc.invalidateQueries({ queryKey: ["fornecedores-select"] }); toast.success("Salvo"); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); qc.invalidateQueries({ queryKey: ["fornecedores-select"] }); toast.success("Fornecedor removido"); },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.toLowerCase().includes("foreign") || msg.includes("violates") || msg.includes("23503")) {
        toast.error("Não é possível excluir: este fornecedor possui movimentações vinculadas. Inative-o em vez de excluir.");
      } else {
        toast.error(msg || "Erro ao excluir");
      }
    },
  });

  const s = normalize(qd);
  const filteredBase = (data ?? []).filter((f: any) => {
    if (!s) return true;
    return normalize([f.nome, f.nome_fantasia, f.documento, f.contato_nome, f.telefone, f.email, f.tipo_fornecimento].join(" ")).includes(s);
  });
  const filtered = applySort(filteredBase);

  const sel = useBulkSelection(filtered);

  const bulkMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const ids = Array.from(sel.selected);
      if (!ids.length) return;
      const { error } = await supabase.from("fornecedores").update(patch as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      qc.invalidateQueries({ queryKey: ["fornecedores-select"] });
      toast.success("Fornecedores atualizados");
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Fornecedores" description="Empresas e parceiros de fornecimento"
        actions={
          <>
            <Button type="button" size="lg" variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4 mr-1" />Nova importação</Button>
            <Button type="button" size="lg" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo fornecedor</Button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, nome fantasia, CNPJ/CPF, contato, telefone, e-mail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {filtered.length} {filtered.length === 1 ? "fornecedor" : "fornecedores"}
          {data && filtered.length !== data.length ? ` (de ${data.length})` : ""}
        </div>
      </Card>

      <BulkActionsBar count={sel.count} onEdit={() => setBulkOpen(true)} onClear={sel.clear} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-3 w-8">
                  <Checkbox checked={sel.allSelected} onCheckedChange={() => sel.toggleAll()} aria-label="Selecionar todos" />
                </th>
                <SortableTh sort={sort} onToggle={toggleSort} k="nome" label="Nome" />
                <SortableTh sort={sort} onToggle={toggleSort} k="nome_fantasia" label="Nome fantasia" />
                <SortableTh sort={sort} onToggle={toggleSort} k="documento" label="CNPJ/CPF" />
                <SortableTh sort={sort} onToggle={toggleSort} k="contato_nome" label="Contato" />
                <SortableTh sort={sort} onToggle={toggleSort} k="telefone" label="Telefone" />
                <SortableTh sort={sort} onToggle={toggleSort} k="tipo_fornecimento" label="Tipo" />
                <SortableTh sort={sort} onToggle={toggleSort} k="status" label="Status" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((f: any) => (
                <tr key={f.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <Checkbox checked={sel.selected.has(f.id)} onCheckedChange={() => sel.toggle(f.id)} aria-label={`Selecionar ${f.nome}`} />
                  </td>
                  <td className="px-4 py-3 font-medium">{f.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.nome_fantasia ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{f.documento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.contato_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.telefone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.tipo_fornecimento ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(f); setOpen(true); }} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" title="Excluir"
                      onClick={() => { if (confirm(`Excluir o fornecedor "${f.nome}"?`)) del.mutate(f.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum fornecedor encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setEditing(null); }}>
        <DialogContent className="max-w-[min(1100px,96vw)] w-[96vw]">
          <DialogHeader><DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          <FornecedorForm initial={editing} onSubmit={(p: any) => mut.mutate(editing ? { ...p, id: editing.id } : p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>

      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={sel.count}
        fields={FORN_BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(p) => bulkMut.mutate(normalizeBulkPatch(p))}
        title="Editar fornecedores em massa"
      />

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        title="Importar fornecedores"
        description="Envie uma planilha com os fornecedores. Fornecedores com mesmo nome ou documento já cadastrados serão ignorados."
        templateFilename="modelo_fornecedores.xlsx"
        templateHeaders={FORNECEDOR_TEMPLATE.headers}
        templateExample={FORNECEDOR_TEMPLATE.example}
        onImport={async (rows) => {
          const errors: string[] = []; let inserted = 0, skipped = 0;
          const { data: existentes } = await supabase.from("fornecedores").select("nome,documento");
          const setKey = new Set((existentes ?? []).map((s: any) => `${(s.nome ?? "").toLowerCase()}|${(s.documento ?? "").toLowerCase()}`));
          for (const [idx, r] of rows.entries()) {
            const nome = String(r.nome ?? "").trim();
            if (!nome) { skipped++; errors.push(`Linha ${idx + 2}: nome obrigatório`); continue; }
            const key = `${nome.toLowerCase()}|${String(r.documento ?? "").toLowerCase()}`;
            if (setKey.has(key)) { skipped++; continue; }
            const { error } = await supabase.from("fornecedores").insert({
              nome, nome_fantasia: r.nome_fantasia || null,
              documento: r.documento || null, tipo_fornecimento: r.tipo_fornecimento || null,
              contato_nome: r.contato_nome || null, telefone: r.telefone || null,
              email: r.email || null, endereco: r.endereco || null, observacoes: r.observacoes || null,
            });
            if (error) { skipped++; errors.push(`Linha ${idx + 2}: ${error.message}`); }
            else { inserted++; setKey.add(key); }
          }
          qc.invalidateQueries({ queryKey: ["fornecedores"] });
          return { inserted, skipped, errors };
        }}
      />
    </>
  );
}
