import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { gerarFichaEpiPdf } from "@/lib/rh/ficha-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/rh/epis")({ component: EpisPage });

type Colab = {
  id: string;
  nome: string;
  funcao: string | null;
  tipo_contratacao: "diarista" | "clt" | "pj";
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  ativo: boolean;
};

type Entrega = {
  id: number;
  colaborador_id: string;
  tipo_contratacao: string;
  epi_descricao: string;
  quantidade: number;
  motivo: string;
  ca: string | null;
  data: string;
  observacoes: string | null;
};

const MOTIVOS = [
  { v: "entrega", label: "1 - Entrega" },
  { v: "devolucao_desgaste_normal", label: "2.1 - Devolução (desgaste normal)" },
  { v: "devolucao_desgaste_anormal", label: "2.2 - Devolução (desgaste anormal)" },
  { v: "perda", label: "3 - Perda" },
  { v: "desligamento", label: "4 - Desligamento" },
];

function EpisPage() {
  const { user } = useAuth();
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [rows, setRows] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fColab, setFColab] = useState("__todos");
  const [fMotivo, setFMotivo] = useState("__todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [empresas, setEmpresas] = useState<{ id: string; razao_social: string; cnpj: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [fichaColab, setFichaColab] = useState<string>("");
  const [fichaEmpresaId, setFichaEmpresaId] = useState<string>("");
  const [fichaMatricula, setFichaMatricula] = useState<string>("");

  async function load() {
    setLoading(true);
    const [{ data: cs }, { data: es, error }, { data: emp }] = await Promise.all([
      supabase.from("rh_colaboradores").select("*").order("nome"),
      supabase.from("rh_epi_entregas").select("*").order("data", { ascending: false }),
      supabase.from("admin_empresas").select("id,razao_social,cnpj").eq("ativo", true).order("razao_social"),
    ]);
    if (error) toast.error(error.message);
    setColabs((cs as any) ?? []);
    setRows((es as any) ?? []);
    const list = (emp as any) ?? [];
    setEmpresas(list);
    setFichaEmpresaId((prev) => prev || list[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const colabById = useMemo(() => new Map(colabs.map((c) => [c.id, c])), [colabs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fColab !== "__todos" && r.colaborador_id !== fColab) return false;
      if (fMotivo !== "__todos" && r.motivo !== fMotivo) return false;
      if (de && r.data < de) return false;
      if (ate && r.data > ate) return false;
      if (q) {
        const c = colabById.get(r.colaborador_id);
        const hay = `${c?.nome ?? ""} ${r.epi_descricao} ${r.ca ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, fColab, fMotivo, de, ate, busca, colabById]);

  async function remover(id: number) {
    if (!confirm("Remover este movimento?")) return;
    const { error } = await supabase.from("rh_epi_entregas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function gerarFicha() {
    const c = colabs.find((x) => x.id === fichaColab);
    if (!c) return toast.error("Selecione um colaborador");
    const entregas = rows.filter((r) => r.colaborador_id === c.id);
    if (entregas.length === 0) return toast.error("Este colaborador não tem entregas registradas");
    const emp = empresas.find((x) => x.id === fichaEmpresaId);
    if (!emp) return toast.error("Selecione a empresa");
    try {
      await gerarFichaEpiPdf({
        empresa: { razao_social: emp.razao_social, cnpj: emp.cnpj },
        colaborador: {
          nome: c.nome,
          funcao: c.funcao,
          matricula: fichaMatricula || null,
          documento: c.documento,
          tipo_documento: c.tipo_documento,
        },
        entregas: entregas.map((e) => ({
          data: e.data,
          epi_descricao: e.epi_descricao,
          quantidade: Number(e.quantidade),
          ca: e.ca,
          motivo: e.motivo,
        })),
      });
      setFichaOpen(false);
    } catch (err: any) {
      toast.error("Falha ao gerar PDF: " + (err?.message ?? String(err)));
    }
  }

  return (
    <>
      <PageHeader
        title="EPIs"
        description="Controle de entrega, devolução e perda de equipamentos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFichaOpen(true)}>
              <FileText className="h-4 w-4 mr-1" /> Gerar ficha
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo movimento
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-7 h-9" placeholder="Buscar EPI ou CA" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={fColab} onValueChange={setFColab}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos">Todos colaboradores</SelectItem>
            {colabs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fMotivo} onValueChange={setFMotivo}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos">Todos os motivos</SelectItem>
            {MOTIVOS.map((m) => (
              <SelectItem key={m.v} value={m.v}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-[150px] h-9" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input type="date" className="w-[150px] h-9" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>

      <div className="rounded-md border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>EPI</TableHead>
              <TableHead>CA</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum movimento encontrado.</TableCell>
              </TableRow>
            ) : (
              filtrados.map((r) => {
                const c = colabById.get(r.colaborador_id);
                const motivoLabel = MOTIVOS.find((m) => m.v === r.motivo)?.label ?? r.motivo;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.data.split("-").reverse().join("/")}</TableCell>
                    <TableCell className="font-medium">{c?.nome ?? "—"}</TableCell>
                    <TableCell>{r.epi_descricao}</TableCell>
                    <TableCell className="font-mono text-xs">{r.ca ?? "—"}</TableCell>
                    <TableCell>{r.quantidade}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{motivoLabel}</Badge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remover(r.id)} className="text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <NovoMovimentoDialog
        open={open}
        onOpenChange={setOpen}
        colabs={colabs}
        userId={user?.id ?? null}
        onSaved={load}
      />

      <Dialog open={fichaOpen} onOpenChange={setFichaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar ficha individual</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={fichaColab} onValueChange={setFichaColab}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {colabs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa (cabeçalho)</Label>
              <Select value={fichaEmpresaId} onValueChange={setFichaEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matrícula (opcional)</Label>
              <Input value={fichaMatricula} onChange={(e) => setFichaMatricula(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFichaOpen(false)}>Cancelar</Button>
            <Button onClick={gerarFicha}>Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NovoMovimentoDialog({
  open,
  onOpenChange,
  colabs,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colabs: Colab[];
  userId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      setForm({
        motivo: "entrega",
        quantidade: 1,
        data: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open]);

  async function save() {
    if (!form.colaborador_id) return toast.error("Selecione o colaborador");
    if (!form.epi_descricao?.trim()) return toast.error("Informe o EPI");
    if (!form.data) return toast.error("Informe a data");
    const c = colabs.find((x) => x.id === form.colaborador_id);
    if (!c) return toast.error("Colaborador inválido");

    const payload = {
      colaborador_id: form.colaborador_id,
      tipo_contratacao: c.tipo_contratacao,
      epi_descricao: form.epi_descricao.trim(),
      quantidade: Number(form.quantidade) || 1,
      motivo: form.motivo,
      ca: form.ca || null,
      data: form.data,
      observacoes: form.observacoes || null,
      created_by: userId,
    };
    const { error } = await supabase.from("rh_epi_entregas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Movimento registrado");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo movimento de EPI</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Colaborador *</Label>
            <Select value={form.colaborador_id ?? ""} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {colabs.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>EPI *</Label>
            <Input value={form.epi_descricao ?? ""} onChange={(e) => setForm({ ...form, epi_descricao: e.target.value })} placeholder="Ex.: Capacete, Luva de raspa..." />
          </div>
          <div>
            <Label>Quantidade *</Label>
            <Input type="number" min={1} step={1} value={form.quantidade ?? 1} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
          </div>
          <div>
            <Label>CA</Label>
            <Input value={form.ca ?? ""} onChange={(e) => setForm({ ...form, ca: e.target.value })} />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div>
            <Label>Motivo *</Label>
            <Select value={form.motivo ?? "entrega"} onValueChange={(v) => setForm({ ...form, motivo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
