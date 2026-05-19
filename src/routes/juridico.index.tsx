import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EMPRESAS } from "@/lib/empresas";
import { toast } from "sonner";

export const Route = createFileRoute("/juridico/")({ component: QuadroContratos });

const STATUSES = [
  { key: "entrada", label: "Entrada", color: "bg-slate-400" },
  { key: "criacao", label: "Criação", color: "bg-blue-500" },
  { key: "validacao", label: "Validação", color: "bg-amber-500" },
  { key: "assinatura", label: "Assinatura", color: "bg-violet-500" },
  { key: "concluido", label: "Concluído", color: "bg-emerald-500" },
] as const;
type Status = typeof STATUSES[number]["key"];

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
};

const brl = (v: number | null) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function QuadroContratos() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Status>("entrada");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
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
    const { error } = await supabase.from("juridico_contratos").update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  }

  async function onDelete(id: string) {
    if (!confirm("Remover este contrato?")) return;
    const { error } = await supabase.from("juridico_contratos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Arraste entre as colunas: Entrada → Criação → Validação → Assinatura → Concluído"
        actions={
          <Button onClick={() => { setEditing(null); setDefaultStatus("entrada"); setOpen(true); }}>
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
                  onEdit={() => { setEditing(c); setOpen(true); }}
                  onDelete={() => onDelete(c.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => { setEditing(null); setDefaultStatus(s.key); setOpen(true); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-primary"
              >
                + adicionar
              </button>
            </Column>
          ))}
        </div>
      </DndContext>

      {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      <ContratoDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        defaultStatus={defaultStatus}
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

function Card({ card, onEdit, onDelete }: { card: Contrato; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={`rounded-md border border-border bg-card p-2.5 text-xs shadow-sm ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <button type="button" {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none" aria-label="Mover">⋮⋮</button>
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
            <button type="button" onClick={onEdit} title="Editar" className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={onDelete} title="Remover" className="inline-flex items-center justify-center h-6 w-6 rounded text-rose-600 hover:bg-rose-500/10">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContratoDialog({ open, onOpenChange, editing, defaultStatus, userId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Contrato | null;
  defaultStatus: Status; userId: string | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Contrato>>({});
  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ status: defaultStatus, empresa: EMPRESAS[0] });
  }, [editing, defaultStatus, open]);

  async function save() {
    if (!form.titulo) return toast.error("Informe o título");
    const payload: any = {
      titulo: form.titulo,
      empresa: form.empresa || null,
      cliente_nome: form.cliente_nome || null,
      cliente_documento: form.cliente_documento || null,
      cliente_email: form.cliente_email || null,
      cliente_telefone: form.cliente_telefone || null,
      responsavel: form.responsavel || null,
      valor: form.valor ? Number(form.valor) : null,
      status: form.status || defaultStatus,
      observacoes: form.observacoes || null,
      data_fechamento: form.data_fechamento || null,
      data_assinatura: form.data_assinatura || null,
      proposta_ref: form.proposta_ref || null,
    };
    if (editing) {
      const { error } = await supabase.from("juridico_contratos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Contrato atualizado");
    } else {
      payload.created_by = userId;
      const { error } = await supabase.from("juridico_contratos").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Contrato criado");
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contrato" : "Novo contrato"}</DialogTitle>
        </DialogHeader>
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
            <Select value={form.status ?? defaultStatus} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
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
            <Label>Ref. proposta</Label>
            <Input value={form.proposta_ref ?? ""} onChange={(e) => setForm({ ...form, proposta_ref: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
