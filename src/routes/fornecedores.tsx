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
import { Plus, Pencil, Upload, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportDialog } from "@/components/ImportDialog";
import { FORNECEDOR_TEMPLATE } from "@/lib/import-utils";
import { FornecedorForm } from "@/components/forms/FornecedorForm";
import { toast } from "sonner";

export const Route = createFileRoute("/fornecedores")({
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); toast.success("Salvo"); setOpen(false); setEditing(null); },
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">CNPJ/CPF</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.length ? data.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{s.documento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contato_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.telefone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.tipo_fornecimento ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          <FornecedorForm initial={editing} onSubmit={(p: any) => mut.mutate(editing ? { ...p, id: editing.id } : p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>

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
              nome, documento: r.documento || null, tipo_fornecimento: r.tipo_fornecimento || null,
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

