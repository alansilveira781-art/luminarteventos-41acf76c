import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/rh/colaboradores")({ component: ColaboradoresPage });

type TipoContratacao = "diarista" | "clt" | "pj";
type TipoDocumento = "cpf" | "cnpj";

type Colab = {
  id: string;
  nome: string;
  departamento: string | null;
  funcao: string | null;
  tipo_contratacao: TipoContratacao;
  tipo_documento: TipoDocumento;
  documento: string;
  user_id: string | null;
  ativo: boolean;
};

type Profile = { id: string; display_name: string | null; email: string | null };

const TIPO_LABEL: Record<TipoContratacao, string> = { diarista: "Diarista", clt: "CLT", pj: "PJ" };

function maskDoc(v: string, tipo: TipoDocumento) {
  const d = v.replace(/\D/g, "").slice(0, tipo === "cpf" ? 11 : 14);
  if (tipo === "cpf") {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function ColaboradoresPage() {
  const [rows, setRows] = useState<Colab[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fDep, setFDep] = useState<string>("__todos");
  const [fTipo, setFTipo] = useState<string>("__todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Colab | null>(null);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: ps }] = await Promise.all([
      supabase.from("rh_colaboradores").select("*").order("nome"),
      supabase.from("profiles").select("id,display_name,email").order("display_name"),
    ]);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setProfiles((ps as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const departamentos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.departamento).filter(Boolean))) as string[],
    [rows],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fDep !== "__todos" && r.departamento !== fDep) return false;
      if (fTipo !== "__todos" && r.tipo_contratacao !== fTipo) return false;
      if (q && !r.nome.toLowerCase().includes(q) && !r.documento.includes(q)) return false;
      return true;
    });
  }, [rows, fDep, fTipo, busca]);

  async function toggleAtivo(c: Colab) {
    const { error } = await supabase.from("rh_colaboradores").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.id === c.id ? { ...r, ativo: !c.ativo } : r)));
  }

  async function remover(c: Colab) {
    if (!confirm(`Remover ${c.nome}?`)) return;
    const { error } = await supabase.from("rh_colaboradores").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== c.id));
  }

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Cadastro de pessoal (LGPD — dados sensíveis restritos ao módulo RH)"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            className="pl-7 h-9"
            placeholder="Buscar por nome ou documento"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={fDep} onValueChange={setFDep}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos">Todos departamentos</SelectItem>
            {departamentos.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos">Todos os tipos</SelectItem>
            <SelectItem value="diarista">Diarista</SelectItem>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="pj">PJ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[130px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum colaborador cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.departamento ?? "—"}</TableCell>
                  <TableCell>{c.funcao ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_LABEL[c.tipo_contratacao]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {maskDoc(c.documento, c.tipo_documento)}
                  </TableCell>
                  <TableCell>
                    {c.ativo ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleAtivo(c)} title={c.ativo ? "Desativar" : "Ativar"}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remover(c)} title="Remover" className="text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ColabDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        profiles={profiles}
        onSaved={load}
      />
    </>
  );
}

function ColabDialog({
  open,
  onOpenChange,
  editing,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Colab | null;
  profiles: Profile[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Colab>>({});

  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ tipo_contratacao: "clt", tipo_documento: "cpf", ativo: true });
  }, [editing, open]);

  async function save() {
    if (!form.nome?.trim()) return toast.error("Informe o nome");
    if (!form.documento || form.documento.replace(/\D/g, "").length < 11)
      return toast.error("Documento inválido");

    const payload: any = {
      nome: form.nome.trim(),
      departamento: form.departamento || null,
      funcao: form.funcao || null,
      tipo_contratacao: form.tipo_contratacao,
      tipo_documento: form.tipo_documento,
      documento: (form.documento ?? "").replace(/\D/g, ""),
      user_id: form.user_id || null,
      ativo: form.ativo ?? true,
    };

    if (editing) {
      const { error } = await supabase.from("rh_colaboradores").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Colaborador atualizado");
    } else {
      const { error } = await supabase.from("rh_colaboradores").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Colaborador criado");
    }
    onOpenChange(false);
    onSaved();
  }

  const tipoDoc = (form.tipo_documento ?? "cpf") as TipoDocumento;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Departamento</Label>
            <Input value={form.departamento ?? ""} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
          </div>
          <div>
            <Label>Função</Label>
            <Input value={form.funcao ?? ""} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
          </div>
          <div>
            <Label>Tipo de contratação *</Label>
            <Select
              value={form.tipo_contratacao ?? "clt"}
              onValueChange={(v) => setForm({ ...form, tipo_contratacao: v as TipoContratacao })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diarista">Diarista</SelectItem>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo documento *</Label>
            <Select
              value={tipoDoc}
              onValueChange={(v) => setForm({ ...form, tipo_documento: v as TipoDocumento, documento: "" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{tipoDoc.toUpperCase()} *</Label>
            <Input
              value={maskDoc(form.documento ?? "", tipoDoc)}
              onChange={(e) => setForm({ ...form, documento: e.target.value.replace(/\D/g, "") })}
              placeholder={tipoDoc === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
            />
          </div>
          <div className="col-span-2">
            <Label>Usuário do sistema (opcional)</Label>
            <Select
              value={form.user_id ?? "__none"}
              onValueChange={(v) => setForm({ ...form, user_id: v === "__none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name ?? p.email ?? p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
