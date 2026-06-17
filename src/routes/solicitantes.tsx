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
import { Plus, Pencil, Upload, Trash2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportDialog } from "@/components/ImportDialog";
import { SOLICITANTE_TEMPLATE } from "@/lib/import-utils";
import { SolicitanteForm } from "@/components/forms/SolicitanteForm";
import { normalize } from "@/lib/utils";
import { SortableTh, useSort } from "@/components/SortableTh";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDialog, normalizeBulkPatch, type BulkField } from "@/components/BulkEditDialog";
import { toast } from "sonner";

const SOL_BULK_FIELDS: BulkField[] = [
  { key: "status", label: "Status", type: "select", options: [{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }] },
  { key: "setor", label: "Setor", type: "text" },
  { key: "cargo", label: "Cargo", type: "text" },
  { key: "observacoes", label: "Observações", type: "textarea" },
];

export const Route = createFileRoute("/solicitantes")({
  component: SolicitantesPage,
});

function SolicitantesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState(""); const qd = useDebouncedValue(q, 300);
  const { sort, toggleSort, applySort } = useSort();

  const { data } = useQuery({
    queryKey: ["solicitantes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("solicitantes").select("id,nome,apelido,setor,cargo,telefone,email,status,observacoes").order("nome");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const mut = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("solicitantes").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("solicitantes").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars: any) => { qc.invalidateQueries({ queryKey: ["solicitantes"] }); qc.invalidateQueries({ queryKey: ["solicitantes-select"] }); toast.success(vars?.id ? "Solicitante atualizado" : "Solicitante cadastrado"); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solicitantes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["solicitantes"] }); qc.invalidateQueries({ queryKey: ["solicitantes-select"] }); toast.success("Solicitante removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const s = normalize(qd);
  const filteredBase = (data ?? []).filter((it: any) => {
    if (!s) return true;
    return normalize([it.nome, it.apelido, it.setor, it.cargo, it.telefone, it.email].join(" ")).includes(s);
  });
  const filtered = applySort(filteredBase);

  const sel = useBulkSelection(filtered);
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const ids = Array.from(sel.selected);
      if (!ids.length) return;
      const { error } = await supabase.from("solicitantes").update(patch as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitantes"] });
      qc.invalidateQueries({ queryKey: ["solicitantes-select"] });
      toast.success("Solicitantes atualizados");
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Solicitantes"
        description="Pessoas e setores que solicitam itens"
        actions={
          <>
            <Button type="button" size="lg" variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4 mr-1" />Nova importação</Button>
            <Button type="button" size="lg" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo solicitante</Button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, apelido, setor, cargo, telefone, e-mail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {filtered.length} {filtered.length === 1 ? "solicitante" : "solicitantes"}
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
                  <Checkbox checked={sel.allSelected} onCheckedChange={() => sel.toggleAll()} />
                </th>
                <SortableTh sort={sort} onToggle={toggleSort} k="nome" label="Nome" />
                <SortableTh sort={sort} onToggle={toggleSort} k="setor" label="Setor" />
                <SortableTh sort={sort} onToggle={toggleSort} k="cargo" label="Cargo" />
                <SortableTh sort={sort} onToggle={toggleSort} k="telefone" label="Telefone" />
                <SortableTh sort={sort} onToggle={toggleSort} k="email" label="E-mail" />
                <SortableTh sort={sort} onToggle={toggleSort} k="status" label="Status" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((it: any) => (
                <tr key={it.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <Checkbox checked={sel.selected.has(it.id)} onCheckedChange={() => sel.toggle(it.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium">{it.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{it.setor ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{it.cargo ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{it.telefone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{it.email ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={it.status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remover "${it.nome}"?`)) del.mutate(it.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum solicitante encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={sel.count}
        fields={SOL_BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(p) => bulkMut.mutate(normalizeBulkPatch(p))}
        title="Editar solicitantes em massa"
      />


      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setEditing(null); }}>
        <DialogContent className="max-w-[min(1100px,96vw)] w-[96vw]">
          <DialogHeader><DialogTitle>{editing ? "Editar solicitante" : "Novo solicitante"}</DialogTitle></DialogHeader>
          <SolicitanteForm initial={editing} onSubmit={(p: any) => mut.mutate(editing ? { ...p, id: editing.id } : p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        title="Importar solicitantes"
        description="Envie uma planilha com os solicitantes. Solicitantes com mesmo nome ou email já cadastrados serão ignorados."
        templateFilename="modelo_solicitantes.xlsx"
        templateHeaders={SOLICITANTE_TEMPLATE.headers}
        templateExample={SOLICITANTE_TEMPLATE.example}
        onImport={async (rows) => {
          const errors: string[] = []; let inserted = 0, skipped = 0;
          const { data: existentes } = await supabase.from("solicitantes").select("nome,email");
          const setKey = new Set((existentes ?? []).map((s: any) => `${(s.nome ?? "").toLowerCase()}|${(s.email ?? "").toLowerCase()}`));
          for (const [idx, r] of rows.entries()) {
            const nome = String(r.nome ?? "").trim();
            if (!nome) { skipped++; errors.push(`Linha ${idx + 2}: nome obrigatório`); continue; }
            const key = `${nome.toLowerCase()}|${String(r.email ?? "").toLowerCase()}`;
            if (setKey.has(key)) { skipped++; continue; }
            const { error } = await supabase.from("solicitantes").insert({
              nome, apelido: r.apelido || null, setor: r.setor || null, cargo: r.cargo || null,
              telefone: r.telefone || null, email: r.email || null, observacoes: r.observacoes || null,
            });
            if (error) { skipped++; errors.push(`Linha ${idx + 2}: ${error.message}`); }
            else { inserted++; setKey.add(key); }
          }
          qc.invalidateQueries({ queryKey: ["solicitantes"] });
          qc.invalidateQueries({ queryKey: ["solicitantes-select"] });
          return { inserted, skipped, errors };
        }}
      />
    </>
  );
}

