import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/fornecedores")({
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

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
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo fornecedor</Button>}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} fornecedor</DialogTitle></DialogHeader>
          <FornecedorForm initial={editing} onSubmit={(p: any) => mut.mutate(editing ? { ...p, id: editing.id } : p)} submitting={mut.isPending} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function FornecedorForm({ initial, onSubmit, submitting }: any) {
  const [f, setF] = useState({
    nome: initial?.nome ?? "", documento: initial?.documento ?? "",
    contato_nome: initial?.contato_nome ?? "", telefone: initial?.telefone ?? "",
    email: initial?.email ?? "", endereco: initial?.endereco ?? "",
    tipo_fornecimento: initial?.tipo_fornecimento ?? "",
    status: initial?.status ?? "ativo", observacoes: initial?.observacoes ?? "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><Label className="text-xs">Nome*</Label><Input required value={f.nome} onChange={(e) => set("nome", e.target.value)} /></div>
      <div><Label className="text-xs">CNPJ/CPF</Label><Input value={f.documento} onChange={(e) => set("documento", e.target.value)} /></div>
      <div><Label className="text-xs">Tipo de fornecimento</Label><Input value={f.tipo_fornecimento} onChange={(e) => set("tipo_fornecimento", e.target.value)} /></div>
      <div><Label className="text-xs">Contato</Label><Input value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} /></div>
      <div><Label className="text-xs">Telefone</Label><Input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} /></div>
      <div><Label className="text-xs">E-mail</Label><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
      <div><Label className="text-xs">Status</Label>
        <Select value={f.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2"><Label className="text-xs">Endereço</Label><Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
      <div className="md:col-span-2"><Label className="text-xs">Observações</Label><Textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
      <div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={submitting}>Salvar</Button></div>
    </form>
  );
}
