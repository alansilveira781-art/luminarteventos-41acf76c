import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/operacao/acervo")({ component: AcervoPage });

const sb = supabase as any;

type Acervo = {
  id: string; codigo: string | null; nome: string; descricao: string | null;
  categoria: string | null; dimensoes: string | null; estado: string | null;
  localizacao: string | null; quantidade: number | null; imagem_url: string | null;
  observacoes: string | null; ativo: boolean;
};

function AcervoPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acervo | null>(null);

  const { data: rows = [] } = useQuery<Acervo[]>({
    queryKey: ["op_acervo"],
    queryFn: async () => {
      const { data, error } = await sb.from("op_acervo").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return rows;
    return rows.filter((r) => [r.codigo, r.nome, r.categoria, r.localizacao].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Acervo de Operação"
        description="Peças reaproveitáveis do setor produtivo (separado do patrimônio)"
        actions={
          <div className="flex gap-2">
            <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova peça
            </Button>
          </div>
        }
      />
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                <TableCell>{r.nome}</TableCell>
                <TableCell>{r.categoria ?? "—"}</TableCell>
                <TableCell>{r.localizacao ?? "—"}</TableCell>
                <TableCell className="text-right">{r.quantidade ?? 0}</TableCell>
                <TableCell>{r.estado ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("Excluir esta peça?")) return;
                    const { error } = await sb.from("op_acervo").delete().eq("id", r.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["op_acervo"] });
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem peças cadastradas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {open && <AcervoDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["op_acervo"] })} />}
    </div>
  );
}

function AcervoDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Acervo | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Acervo>>(editing ?? { ativo: true, quantidade: 1 });
  const [saving, setSaving] = useState(false);

  const upd = (k: keyof Acervo, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    if (!form.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload: any = {
      codigo: form.codigo || null,
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      categoria: form.categoria || null,
      dimensoes: form.dimensoes || null,
      estado: form.estado || null,
      localizacao: form.localizacao || null,
      quantidade: form.quantidade ?? null,
      imagem_url: form.imagem_url || null,
      observacoes: form.observacoes || null,
    };
    const { error } = editing
      ? await sb.from("op_acervo").update(payload).eq("id", editing.id)
      : await sb.from("op_acervo").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onOpenChange(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar peça" : "Nova peça"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Código</Label><Input value={form.codigo ?? ""} onChange={(e) => upd("codigo", e.target.value)} /></div>
          <div><Label>Categoria</Label><Input value={form.categoria ?? ""} onChange={(e) => upd("categoria", e.target.value)} /></div>
          <div className="col-span-2"><Label>Nome</Label><Input value={form.nome ?? ""} onChange={(e) => upd("nome", e.target.value)} /></div>
          <div><Label>Dimensões</Label><Input value={form.dimensoes ?? ""} onChange={(e) => upd("dimensoes", e.target.value)} /></div>
          <div><Label>Estado</Label><Input value={form.estado ?? ""} onChange={(e) => upd("estado", e.target.value)} placeholder="novo, bom, avariado…" /></div>
          <div><Label>Localização</Label><Input value={form.localizacao ?? ""} onChange={(e) => upd("localizacao", e.target.value)} /></div>
          <div><Label>Quantidade</Label><Input type="number" value={form.quantidade ?? 0} onChange={(e) => upd("quantidade", Number(e.target.value))} /></div>
          <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => upd("descricao", e.target.value)} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => upd("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
