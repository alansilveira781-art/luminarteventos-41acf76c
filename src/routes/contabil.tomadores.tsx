import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { SortableTh, useSort } from "@/components/SortableTh";
import { toast } from "sonner";
import { normalize } from "@/lib/utils";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/tomadores")({
  component: TomadoresPage,
});

export type Tomador = {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  inscricao_municipal: string | null;
  observacoes: string | null;
};

function TomadoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tomador | null>(null);
  const [q, setQ] = useState("");
  const { sort, toggleSort, applySort } = useSort();

  const { data: tomadores } = useQuery({
    queryKey: ["contabil-tomadores"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_tomadores")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tomador[];
    },
  });

  const filtered = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean);
    let rows = (tomadores ?? []).filter((t) => {
      if (!terms.length) return true;
      const h = normalize([t.nome, t.documento, t.email, t.telefone].filter(Boolean).join(" "));
      return terms.every((x) => h.includes(x));
    });
    return applySort(rows as any, (t: any, k) => t[k]);
  }, [tomadores, q, sort, applySort]);

  const saveMut = useMutation({
    mutationFn: async (p: Partial<Tomador> & { id?: string }) => {
      if (p.id) {
        const { error } = await sb.from("contabil_tomadores").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("contabil_tomadores").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-tomadores"] });
      toast.success(editing ? "Tomador atualizado" : "Tomador cadastrado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contabil_tomadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-tomadores"] });
      toast.success("Tomador excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Tomadores"
        description="Cadastro de tomadores para vincular rapidamente às notas fiscais."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo tomador
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, documento, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <SortableTh sort={sort} onToggle={toggleSort} k="nome" label="Nome" />
              <SortableTh sort={sort} onToggle={toggleSort} k="documento" label="CNPJ/CPF" />
              <SortableTh sort={sort} onToggle={toggleSort} k="email" label="E-mail" />
              <SortableTh sort={sort} onToggle={toggleSort} k="telefone" label="Telefone" />
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">Nenhum tomador cadastrado.</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2">{t.nome}</td>
                <td className="px-4 py-2 font-mono text-xs">{t.documento ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{t.email ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{t.telefone ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir tomador?")) delMut.mutate(t.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tomador" : "Novo tomador"}</DialogTitle>
          </DialogHeader>
          <TomadorForm
            initial={editing}
            onSubmit={(p) => saveMut.mutate({ ...p, id: editing?.id })}
            saving={saveMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function TomadorForm({
  initial,
  onSubmit,
  saving,
}: {
  initial: Tomador | null;
  onSubmit: (p: Partial<Tomador>) => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [documento, setDocumento] = useState(initial?.documento ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [endereco, setEndereco] = useState(initial?.endereco ?? "");
  const [im, setIm] = useState(initial?.inscricao_municipal ?? "");
  const [obs, setObs] = useState(initial?.observacoes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Informe o nome");
    onSubmit({
      nome: nome.trim(),
      documento: documento.trim() || null,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      endereco: endereco.trim() || null,
      inscricao_municipal: im.trim() || null,
      observacoes: obs.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormSection>
        <FormField label="Nome*" wide>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </FormField>
        <FormField label="CNPJ/CPF">
          <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </FormField>
        <FormField label="Inscrição municipal">
          <Input value={im} onChange={(e) => setIm(e.target.value)} />
        </FormField>
        <FormField label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Telefone">
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </FormField>
        <FormField label="Endereço" wide>
          <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </FormField>
      </FormSection>
      <FormField label="Observações" wide>
        <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </FormField>
      <FormActions>
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </FormActions>
    </form>
  );
}
