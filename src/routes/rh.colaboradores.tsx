import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, Search, Printer, PencilLine, X } from "lucide-react";
import logoUrl from "@/assets/luminart-logo.png";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EdicaoLoteDialog } from "@/components/rh/EdicaoLoteDialog";

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}


function ColaboradoresPage() {
  const [rows, setRows] = useState<Colab[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fDep, setFDep] = useState<string>("__todos");
  const [fTipo, setFTipo] = useState<string>("__todos");
  const [fStatus, setFStatus] = useState<"ativos" | "desligados" | "__todos">("ativos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Colab | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loteOpen, setLoteOpen] = useState(false);

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
    setSelected(new Set());
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
      if (fStatus === "ativos" && !r.ativo) return false;
      if (fStatus === "desligados" && r.ativo) return false;
      if (fDep !== "__todos" && r.departamento !== fDep) return false;
      if (fTipo !== "__todos" && r.tipo_contratacao !== fTipo) return false;
      if (q && !r.nome.toLowerCase().includes(q) && !r.documento.includes(q)) return false;
      return true;
    });
  }, [rows, fDep, fTipo, fStatus, busca]);

  const allVisibleSelected = filtrados.length > 0 && filtrados.every((r) => selected.has(r.id));
  function toggleAll(v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) filtrados.forEach((r) => next.add(r.id));
      else filtrados.forEach((r) => next.delete(r.id));
      return next;
    });
  }
  function toggleOne(id: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

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

  function imprimirRelatorio() {
    const filtros: string[] = [];
    if (busca.trim()) filtros.push(`Busca: "${busca.trim()}"`);
    if (fDep !== "__todos") filtros.push(`Departamento: ${fDep}`);
    if (fTipo !== "__todos") filtros.push(`Vínculo: ${TIPO_LABEL[fTipo as TipoContratacao] ?? fTipo}`);
    const filtrosLabel = filtros.length ? filtros.join(" · ") : "Todos os colaboradores";
    const hoje = new Date().toLocaleString("pt-BR");
    const rowsHtml = filtrados
      .map(
        (c) => `
        <tr>
          <td>${escapeHtml(c.nome)}</td>
          <td>${escapeHtml(c.departamento ?? "—")}</td>
          <td>${escapeHtml(c.funcao ?? "—")}</td>
          <td>${TIPO_LABEL[c.tipo_contratacao]}</td>
          <td class="mono">${escapeHtml(maskDoc(c.documento, c.tipo_documento))}</td>
          <td>${c.ativo ? '<span class="badge on">Ativo</span>' : '<span class="badge off">Inativo</span>'}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
      <title>Relatório de Colaboradores — Grupo Luminart</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
        header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #d4a574; padding-bottom: 12px; margin-bottom: 16px; }
        header img { height: 48px; object-fit: contain; }
        .meta { text-align: right; font-size: 11px; color: #475569; }
        h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: .3px; }
        .subtitle { font-size: 12px; color: #475569; margin-bottom: 14px; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .chip { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px; font-size: 10.5px; padding: 3px 10px; color: #334155; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        thead th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: .4px; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
        tbody tr:nth-child(even) td { background: #f8fafc; }
        .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 10.5px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
        .badge.on { background: #dcfce7; color: #166534; }
        .badge.off { background: #e2e8f0; color: #475569; }
        footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style></head><body>
      <header>
        <img src="${logoUrl}" alt="Luminart" />
        <div class="meta">
          <div><strong>Grupo Luminart</strong></div>
          <div>Emitido em ${escapeHtml(hoje)}</div>
        </div>
      </header>
      <h1>Relatório de Colaboradores</h1>
      <div class="subtitle">Recursos Humanos · ${filtrados.length} registro(s)</div>
      <div class="chips"><span class="chip">${escapeHtml(filtrosLabel)}</span></div>
      <table>
        <thead><tr><th>Nome</th><th>Departamento</th><th>Função</th><th>Vínculo</th><th>Documento</th><th>Status</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748b">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>'}</tbody>
      </table>
      <footer>
        <span>Documento confidencial · uso interno RH · LGPD</span>
        <span>Grupo Luminart</span>
      </footer>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=1024,height=768");
    if (!w) return toast.error("Bloqueado pelo navegador. Permita pop-ups.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Cadastro de pessoal (LGPD — dados sensíveis restritos ao módulo RH)"
        actions={
          <>
            <Button variant="outline" onClick={imprimirRelatorio}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </>
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
