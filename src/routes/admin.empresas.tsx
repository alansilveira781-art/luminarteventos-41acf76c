import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/empresas")({ component: AdminEmpresas });

export type Empresa = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  endereco: string | null;
  ativo: boolean;
};

function fmtCnpj(cnpj: string) {
  const d = (cnpj || "").replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function AdminEmpresas() {
  const [rows, setRows] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("admin_empresas").select("*").order("razao_social");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.razao_social} ${r.nome_fantasia ?? ""} ${r.cnpj}`.toLowerCase().includes(q),
    );
  }, [rows, busca]);

  async function toggleAtivo(e: Empresa) {
    const { error } = await supabase.from("admin_empresas").update({ ativo: !e.ativo }).eq("id", e.id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((x) => (x.id === e.id ? { ...x, ativo: !e.ativo } : x)));
  }

  async function remover(id: string) {
    if (!confirm("Remover esta empresa? Documentos já emitidos que a referenciam continuarão íntegros.")) return;
    const { error } = await supabase.from("admin_empresas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            className="pl-7 h-9"
            placeholder="Buscar razão social, nome fantasia ou CNPJ"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Nova empresa
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão social</TableHead>
              <TableHead>Nome fantasia</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>IE</TableHead>
              <TableHead>IM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.razao_social}</TableCell>
                  <TableCell>{e.nome_fantasia ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{fmtCnpj(e.cnpj)}</TableCell>
                  <TableCell className="text-xs">{e.inscricao_estadual ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.inscricao_municipal ?? "—"}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => toggleAtivo(e)} className="cursor-pointer">
                      <Badge variant={e.ativo ? "default" : "outline"} className="text-[10px]">
                        {e.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(e);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remover(e.id)} className="text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmpresaDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={load} />
    </>
  );
}

function EmpresaDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Empresa | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Empresa>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) setForm(editing);
    else setForm({ ativo: true });
  }, [editing, open]);

  async function save() {
    if (!form.razao_social?.trim()) return toast.error("Informe a razão social");
    const cnpj = (form.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) return toast.error("CNPJ inválido (14 dígitos)");

    const payload = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia?.trim() || null,
      cnpj,
      inscricao_municipal: form.inscricao_municipal?.trim() || null,
      inscricao_estadual: form.inscricao_estadual?.trim() || null,
      endereco: form.endereco?.trim() || null,
      ativo: form.ativo ?? true,
    };

    if (editing) {
      const { error } = await supabase.from("admin_empresas").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Empresa atualizada");
    } else {
      const { error } = await supabase.from("admin_empresas").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Empresa cadastrada");
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Razão social *</Label>
            <Input value={form.razao_social ?? ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
          </div>
          <div>
            <Label>Nome fantasia</Label>
            <Input value={form.nome_fantasia ?? ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
          </div>
          <div>
            <Label>CNPJ *</Label>
            <Input
              value={form.cnpj ?? ""}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div>
            <Label>Inscrição Estadual</Label>
            <Input
              value={form.inscricao_estadual ?? ""}
              onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
            />
          </div>
          <div>
            <Label>Inscrição Municipal</Label>
            <Input
              value={form.inscricao_municipal ?? ""}
              onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label>Endereço</Label>
            <Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch
              checked={form.ativo ?? true}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              id="ativo"
            />
            <Label htmlFor="ativo">Empresa ativa (aparece nos dropdowns)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
