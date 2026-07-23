import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, FileIcon, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnexoViewer, baixarAnexo } from "@/components/AnexoViewer";
import { MentionInput, renderCommentText } from "@/components/MentionInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EMPRESAS } from "@/lib/empresas";
import { toast } from "sonner";

export const Route = createFileRoute("/juridico/")({ component: QuadroContratos });

const sb = supabase as any;

const STATUSES = [
  { key: "entrada", label: "Entrada", color: "bg-slate-400" },
  { key: "criacao", label: "Criação", color: "bg-blue-500" },
  { key: "validacao", label: "Validação", color: "bg-amber-500" },
  { key: "assinatura", label: "Assinatura", color: "bg-violet-500" },
  { key: "concluido", label: "Concluído", color: "bg-emerald-500" },
] as const;
type Status = typeof STATUSES[number]["key"];
const STATUS_LABELS: Record<string, string> = STATUSES.reduce((a, s) => ({ ...a, [s.key]: s.label }), {});

type Contrato = {
  id: string;
  titulo: string;
  empresa: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  responsavel: string | null;
  valor: number | null;
  status: Status;
  ordem: number;
  data_fechamento: string | null;
  data_assinatura: string | null;
  observacoes: string | null;
  proposta_numero: number | null;
  proposta_ref: string | null;
  modelo_id: string | null;
  corpo_html: string | null;
};

const brl = (v: number | null) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function QuadroContratos() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<Status>("entrada");

  const load = async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("juridico_contratos")
      .select("*")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const byStatus = useMemo(() => {
    const m: Record<Status, Contrato[]> = {} as any;
    STATUSES.forEach((s) => (m[s.key] = []));
    rows.forEach((r) => (m[r.status] ??= []).push(r));
    return m;
  }, [rows]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const status = overId as Status;
    const card = rows.find((r) => r.id === id);
    if (!card || card.status === status) return;
    const patch: any = { status };
    if (status === "assinatura" && !card.data_assinatura) patch.data_assinatura = new Date().toISOString().slice(0, 10);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await sb.from("juridico_contratos").update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  }

  async function onDelete(id: string) {
    if (!confirm("Remover este contrato?")) return;
    const { error } = await sb.from("juridico_contratos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Arraste entre as colunas: Entrada → Criação → Validação → Assinatura → Concluído"
        actions={
          <Button onClick={() => { setDefaultStatus("entrada"); setNovoOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo contrato
          </Button>
        }
      />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-auto pb-4 max-h-[calc(100vh-180px)] items-start">
          {STATUSES.map((s) => (
            <Column key={s.key} statusKey={s.key} label={s.label} color={s.color} count={byStatus[s.key]?.length ?? 0}>
              {(byStatus[s.key] ?? []).map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  onOpen={() => setEditing(c)}
                  onDelete={() => onDelete(c.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => { setDefaultStatus(s.key); setNovoOpen(true); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-primary"
              >
                + adicionar
              </button>
            </Column>
          ))}
        </div>
      </DndContext>

      {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      <NovoContratoWizard
        open={novoOpen}
        onOpenChange={setNovoOpen}
        defaultStatus={defaultStatus}
        userId={user?.id ?? null}
        onSaved={(created) => { load(); setEditing(created); }}
      />

      <ContratoDetalhesDialog
        contrato={editing}
        onClose={() => setEditing(null)}
        userId={user?.id ?? null}
        onSaved={load}
      />
    </>
  );
}

function Column({ statusKey, label, color, count, children }: {
  statusKey: string; label: string; color: string; count: number; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-lg border bg-muted/30 ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">{children}</div>
    </div>
  );
}

function Card({ card, onOpen, onDelete }: { card: Contrato; onOpen: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`rounded-md border border-border bg-card p-2.5 text-xs shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-muted-foreground select-none">⋮⋮</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-foreground">{card.titulo}</div>
          {card.cliente_nome && <div className="text-[11px] text-muted-foreground truncate">{card.cliente_nome}</div>}
          <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {card.empresa && <div>{card.empresa}</div>}
            {card.responsavel && <div>Resp.: {card.responsavel}</div>}
            {!!card.valor && <div className="font-medium text-foreground">{brl(card.valor)}</div>}
            {card.proposta_numero && <div>Proposta #{card.proposta_numero}</div>}
          </div>
          <div className="flex gap-1 mt-2">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              title="Editar"
              className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Remover"
              className="inline-flex items-center justify-center h-6 w-6 rounded text-rose-600 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*                 Novo contrato — wizard rápido                 */
/* ============================================================ */

type NovoModo = "modelo" | "anexo";

function NovoContratoWizard({
  open, onOpenChange, defaultStatus, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultStatus: Status;
  userId: string | null;
  onSaved: (created: Contrato) => void;
}) {
  const [modo, setModo] = useState<NovoModo | null>(null);
  const [titulo, setTitulo] = useState("");
  const [empresa, setEmpresa] = useState<string>(EMPRESAS[0]);
  const [clienteNome, setClienteNome] = useState("");
  const [modeloId, setModeloId] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: modelos = [] } = useQuery({
    queryKey: ["juridico_modelos_list"],
    queryFn: async () => {
      const { data } = await sb.from("juridico_modelos").select("id,nome,tipo,corpo_html").eq("ativo", true).order("tipo").order("nome");
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setModo(null);
      setTitulo(""); setEmpresa(EMPRESAS[0]); setClienteNome("");
      setModeloId(""); setPendingFile(null);
    }
  }, [open]);

  async function criar() {
    if (!titulo.trim()) { toast.error("Informe o título"); return; }
    if (modo === "modelo" && !modeloId) { toast.error("Escolha um modelo"); return; }
    if (modo === "anexo" && !pendingFile) { toast.error("Anexe o arquivo do contrato"); return; }
    setSaving(true);
    try {
      const modelo = modelos.find((m: any) => m.id === modeloId);
      const payload: any = {
        titulo: titulo.trim(),
        empresa: empresa || null,
        cliente_nome: clienteNome || null,
        status: defaultStatus,
        modelo_id: modo === "modelo" ? modeloId : null,
        corpo_html: modo === "modelo" ? (modelo?.corpo_html ?? null) : null,
        created_by: userId,
      };
      const { data: created, error } = await sb
        .from("juridico_contratos")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;

      if (modo === "anexo" && pendingFile) {
        const safe = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${created.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await sb.storage.from("juridico-anexos").upload(path, pendingFile, {
          contentType: pendingFile.type || undefined,
        });
        if (upErr) throw upErr;
        await sb.from("juridico_anexos").insert({
          contrato_id: created.id,
          nome: pendingFile.name,
          path,
          mime_type: pendingFile.type || null,
          tamanho: pendingFile.size,
          tipo: "contrato",
          uploaded_by: userId,
        });
      }

      toast.success("Contrato criado");
      onOpenChange(false);
      onSaved(created as Contrato);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar contrato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>

        {!modo && (
          <div className="grid grid-cols-1 gap-3 py-2">
            <button
              type="button"
              onClick={() => setModo("modelo")}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left hover:border-primary transition"
            >
              <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Criar a partir de um modelo</div>
                <div className="text-xs text-muted-foreground">
                  Usa um modelo cadastrado. O contrato final ainda deve ser anexado depois.
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModo("anexo")}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left hover:border-primary transition"
            >
              <Upload className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Anexar contrato pronto</div>
                <div className="text-xs text-muted-foreground">
                  Envie o PDF/Word já preenchido (por você ou pelo cliente).
                </div>
              </div>
            </button>
          </div>
        )}

        {modo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Contrato ABERTURA COCAL" />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
            </div>

            {modo === "modelo" && (
              <div className="md:col-span-2">
                <Label>Modelo *</Label>
                <Select value={modeloId} onValueChange={setModeloId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                  <SelectContent>
                    {modelos.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        [{m.tipo}] {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  O corpo do modelo é copiado para o contrato. Você pode editar depois.
                </p>
              </div>
            )}

            {modo === "anexo" && (
              <div className="md:col-span-2">
                <Label>Arquivo do contrato *</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
                {pendingFile && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {pendingFile.name} · {(pendingFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {modo ? (
            <>
              <Button variant="outline" onClick={() => setModo(null)} disabled={saving}>Voltar</Button>
              <Button onClick={criar} disabled={saving}>{saving ? "Criando…" : "Criar contrato"}</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */
/*             Detalhes do contrato — tabs completas             */
/* ============================================================ */

function ContratoDetalhesDialog({
  contrato, onClose, userId, onSaved,
}: {
  contrato: Contrato | null;
  onClose: () => void;
  userId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Contrato>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contrato) setForm(contrato);
    else setForm({});
  }, [contrato?.id]);

  if (!contrato) return null;

  async function salvar() {
    setSaving(true);
    const payload: any = {
      titulo: form.titulo,
      empresa: form.empresa || null,
      cliente_nome: form.cliente_nome || null,
      cliente_documento: form.cliente_documento || null,
      cliente_email: form.cliente_email || null,
      cliente_telefone: form.cliente_telefone || null,
      responsavel: form.responsavel || null,
      valor: form.valor ? Number(form.valor) : null,
      status: form.status ?? contrato!.status,
      observacoes: form.observacoes || null,
      data_fechamento: form.data_fechamento || null,
      data_assinatura: form.data_assinatura || null,
    };
    const { error } = await sb.from("juridico_contratos").update(payload).eq("id", contrato!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contrato atualizado");
    onSaved();
  }

  return (
    <Dialog open={!!contrato} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Contrato — {contrato.titulo}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="comentarios">Comentários</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="overflow-y-auto pr-1 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={form.empresa ?? ""} onValueChange={(v) => setForm({ ...form, empresa: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status ?? contrato.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={form.cliente_nome ?? ""} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input value={form.cliente_documento ?? ""} onChange={(e) => setForm({ ...form, cliente_documento: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.cliente_email ?? ""} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.cliente_telefone ?? ""} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel ?? ""} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: e.target.value as any })} />
              </div>
              <div>
                <Label>Data de fechamento</Label>
                <Input type="date" value={form.data_fechamento ?? ""} onChange={(e) => setForm({ ...form, data_fechamento: e.target.value })} />
              </div>
              <div>
                <Label>Data de assinatura</Label>
                <Input type="date" value={form.data_assinatura ?? ""} onChange={(e) => setForm({ ...form, data_assinatura: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="anexos" className="overflow-y-auto pr-1 pt-3">
            <Anexos contratoId={contrato.id} userId={userId ?? undefined} />
          </TabsContent>

          <TabsContent value="comentarios" className="overflow-y-auto pr-1 pt-3">
            <Comentarios contratoId={contrato.id} userId={userId ?? undefined} />
          </TabsContent>

          <TabsContent value="historico" className="overflow-y-auto pr-1 pt-3">
            <Historico contratoId={contrato.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar dados"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */
/*                          Anexos                              */
/* ============================================================ */

function Anexos({ contratoId, userId }: { contratoId: string; userId?: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [tipoUpload, setTipoUpload] = useState<"proposta" | "contrato" | "outro">("contrato");
  const [preview, setPreview] = useState<any | null>(null);

  const { data: anexos = [] } = useQuery({
    queryKey: ["juridico-anexos", contratoId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("juridico_anexos")
        .select("*")
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${contratoId}/${Date.now()}_${safe}`;
        const { error: upErr } = await sb.storage.from("juridico-anexos").upload(path, file, {
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await sb.from("juridico_anexos").insert({
          contrato_id: contratoId,
          nome: file.name,
          path,
          mime_type: file.type || null,
          tamanho: file.size,
          tipo: tipoUpload,
          uploaded_by: userId ?? null,
        });
        if (insErr) throw insErr;
      }
      toast.success("Anexo enviado");
      qc.invalidateQueries({ queryKey: ["juridico-anexos", contratoId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(a: any) {
    if (!confirm(`Remover anexo "${a.nome}"?`)) return;
    try {
      await sb.storage.from("juridico-anexos").remove([a.path]);
      const { error } = await sb.from("juridico_anexos").delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["juridico-anexos", contratoId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    }
  }

  const tipoBadge = (t: string) => {
    if (t === "proposta") return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    if (t === "contrato") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Tipo do próximo upload:</Label>
        <Select value={tipoUpload} onValueChange={(v) => setTipoUpload(v as any)}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="proposta">Proposta</SelectItem>
            <SelectItem value="contrato">Contrato</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {uploading ? "Enviando…" : "Clique para anexar (PDF, Word, imagens…)"}
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
        />
      </label>

      {anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum anexo.</p>
      ) : (
        <div className="space-y-1.5">
          {anexos.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                type="button"
                className="flex-1 min-w-0 text-left hover:underline"
                onClick={() => setPreview(a)}
              >
                <div className="truncate font-medium">{a.nome}</div>
                <div className="text-[11px] text-muted-foreground">
                  {(a.tamanho ? (a.tamanho / 1024).toFixed(1) + " KB" : "—")} · {new Date(a.created_at).toLocaleString("pt-BR")}
                </div>
              </button>
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${tipoBadge(a.tipo)}`}>{a.tipo}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => baixarAnexo("juridico-anexos", a.path, a.nome)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(a)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AnexoViewer
        bucket="juridico-anexos"
        anexo={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
    </div>
  );
}

/* ============================================================ */
/*                       Comentários                             */
/* ============================================================ */

function Comentarios({ contratoId, userId }: { contratoId: string; userId?: string }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<string[]>([]);

  const { data: comentarios = [] } = useQuery({
    queryKey: ["juridico-coments", contratoId],
    queryFn: async () => {
      const { data } = await sb.from("juridico_comentarios").select("*").eq("contrato_id", contratoId).order("created_at");
      return (data ?? []) as any[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("id,display_name,email");
      return (data ?? []).map((u: any) => ({ id: u.id, nome: u.display_name || u.email || "Usuário" }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!texto.trim()) return;
      const meName = (users.find((u: any) => u.id === userId) as any)?.nome ?? null;
      const { error } = await sb.from("juridico_comentarios").insert({
        contrato_id: contratoId, user_id: userId, user_nome: meName, texto: texto.trim(), mencoes,
      });
      if (error) throw error;
      if (mencoes.length) {
        const rows = mencoes.map((uid) => ({
          user_id: uid,
          tipo: "mencao",
          titulo: "Você foi mencionado em um contrato",
          mensagem: texto.slice(0, 140),
          link: `/juridico?id=${contratoId}`,
        }));
        await sb.rpc("enqueue_notificacoes", { rows });
      }
      setTexto(""); setMencoes([]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["juridico-coments", contratoId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
        {comentarios.map((c) => (
          <div key={c.id} className="rounded-md border border-border p-2.5 bg-muted/30">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-medium">{c.user_nome ?? "—"}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{renderCommentText(c.texto)}</div>
          </div>
        ))}
      </div>
      <MentionInput value={texto} onChange={(v, m) => { setTexto(v); setMencoes(m); }} users={users as any} onSubmit={() => post.mutate()} />
      <div className="flex justify-end">
        <Button size="sm" disabled={!texto.trim() || post.isPending} onClick={() => post.mutate()}>Comentar</Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*                        Histórico                              */
/* ============================================================ */

function Historico({ contratoId }: { contratoId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["juridico-hist", contratoId],
    queryFn: async () => {
      const { data } = await sb.from("juridico_historico").select("*").eq("contrato_id", contratoId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {data.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico.</p>}
      {data.map((h) => (
        <div key={h.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
          <div className="font-medium">
            {h.user_nome ?? "Sistema"}{" "}
            {h.acao === "criou" && <span>criou o contrato como <b>{STATUS_LABELS[h.status_novo] ?? h.status_novo}</b></span>}
            {h.acao === "mudou_status" && (
              <span>
                mudou status de <b>{STATUS_LABELS[h.status_anterior] ?? h.status_anterior}</b> para{" "}
                <b>{STATUS_LABELS[h.status_novo] ?? h.status_novo}</b>
              </span>
            )}
            {h.acao !== "criou" && h.acao !== "mudou_status" && <span>{h.acao}</span>}
          </div>
          {h.detalhe && <div className="text-muted-foreground">{h.detalhe}</div>}
          <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
        </div>
      ))}
    </div>
  );
}
