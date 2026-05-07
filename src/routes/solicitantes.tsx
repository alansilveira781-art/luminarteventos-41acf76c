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
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Pencil, Upload, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportDialog } from "@/components/ImportDialog";
import { SOLICITANTE_TEMPLATE } from "@/lib/import-utils";
import { SolicitanteForm } from "@/components/forms/SolicitanteForm";
import { toast } from "sonner";

export const Route = createFileRoute("/solicitantes")({
  component: SolicitantesPage,
});

function SolicitantesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const { data } = useQuery({
    queryKey: ["solicitantes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("solicitantes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["solicitantes"] }); toast.success("Salvo"); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solicitantes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["solicitantes"] }); toast.success("Removido"); },
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Setor</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.length ? data.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.setor ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.cargo ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.telefone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remover "${s.nome}"?`)) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum solicitante cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
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
              nome, setor: r.setor || null, cargo: r.cargo || null,
              telefone: r.telefone || null, email: r.email || null, observacoes: r.observacoes || null,
            });
            if (error) { skipped++; errors.push(`Linha ${idx + 2}: ${error.message}`); }
            else { inserted++; setKey.add(key); }
          }
          qc.invalidateQueries({ queryKey: ["solicitantes"] });
          return { inserted, skipped, errors };
        }}
      />
    </>
  );
}

