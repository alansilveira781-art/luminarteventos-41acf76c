import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Pause, Play, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro/rotinas")({
  component: RotinasPage,
});

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  frequencia: "diaria" | "semanal" | "quinzenal" | "mensal" | "custom";
  dias_semana: number[] | null;
  hora: string;
  data_inicio: string;
  data_fim: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: "ativa" | "pausada";
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FREQ_LABELS: Record<Rotina["frequencia"], string> = {
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  custom: "Personalizada",
};

function RotinasPage() {
  const [editing, setEditing] = useState<Partial<Rotina> | null>(null);

  const { data: rotinas = [] } = useQuery({
    queryKey: ["financeiro-rotinas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_rotinas" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Rotina[];
    },
  });

  return (
    <>
      <PageHeader
        title="Rotinas do Financeiro"
        description="Cadastre as rotinas recorrentes do setor financeiro"
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4 mr-1" /> Nova rotina
          </Button>
        }
      />

      <Tabs defaultValue="tabela" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela">
          <TabelaRotinas rotinas={rotinas} onEdit={setEditing} />
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarioRotinas rotinas={rotinas} onEdit={setEditing} />
        </TabsContent>
      </Tabs>

      {editing && (
        <RotinaDialog
          rotina={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// TABELA
// ============================================================================

function TabelaRotinas({
  rotinas,
  onEdit,
}: {
  rotinas: Rotina[];
  onEdit: (r: Rotina) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all");
  const [freqFilter, setFreqFilter] = useState<string>("__all");

  const filtered = useMemo(() => {
    return rotinas.filter((r) => {
      if (statusFilter !== "__all" && r.status !== statusFilter) return false;
      if (freqFilter !== "__all" && r.frequencia !== freqFilter) return false;
      if (q) {
        const hay = `${r.titulo} ${r.descricao ?? ""} ${r.responsavel_nome ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rotinas, q, statusFilter, freqFilter]);

  const toggleStatus = useMutation({
    mutationFn: async (r: Rotina) => {
      const newStatus = r.status === "ativa" ? "pausada" : "ativa";
      const { error } = await supabase
        .from("financeiro_rotinas" as any)
        .update({ status: newStatus })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-rotinas"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_rotinas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-rotinas"] });
      toast.success("Rotina excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-3 flex flex-wrap gap-2 items-center border-b">
        <Input
          placeholder="Buscar por título, descrição ou responsável…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="pausada">Pausada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Frequência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas frequências</SelectItem>
            {Object.entries(FREQ_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} rotina(s)</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Título</th>
              <th className="px-4 py-2 text-left">Frequência</th>
              <th className="px-4 py-2 text-left">Hora</th>
              <th className="px-4 py-2 text-left">Período</th>
              <th className="px-4 py-2 text-left">Responsável</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma rotina cadastrada</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/20">
                <td className="px-4 py-2">
                  <div className="font-medium">{r.titulo}</div>
                  {r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}
                </td>
                <td className="px-4 py-2">
                  {FREQ_LABELS[r.frequencia]}
                  {(r.frequencia === "semanal" || r.frequencia === "custom") && r.dias_semana && r.dias_semana.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {r.dias_semana.map((d) => DIAS_SEMANA[d]).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums">{r.hora?.slice(0, 5)}</td>
                <td className="px-4 py-2 text-xs">
                  {fmtDate(r.data_inicio)}
                  {r.data_fim && <> → {fmtDate(r.data_fim)}</>}
                </td>
                <td className="px-4 py-2 text-xs">{r.responsavel_nome ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge variant={r.status === "ativa" ? "default" : "secondary"}>
                    {r.status === "ativa" ? "Ativa" : "Pausada"}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => toggleStatus.mutate(r)} title={r.status === "ativa" ? "Pausar" : "Ativar"}>
                      {r.status === "ativa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onEdit(r)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm(`Excluir "${r.titulo}"?`) && deleteMut.mutate(r.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================================
// CALENDÁRIO
// ============================================================================

function CalendarioRotinas({ rotinas, onEdit }: { rotinas: Rotina[]; onEdit: (r: Rotina) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const ativas = useMemo(() => rotinas.filter((r) => r.status === "ativa"), [rotinas]);
  const cells = useMemo(() => buildMonthGrid(cursor, ativas), [cursor, ativas]);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-semibold capitalize">{monthLabel}</div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            const d = new Date();
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="px-2 py-1 text-center font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`min-h-[88px] rounded border p-1 ${
              cell.inMonth ? "bg-background" : "bg-muted/20 opacity-60"
            } ${cell.isToday ? "ring-2 ring-primary" : ""}`}
          >
            <div className="text-[10px] font-medium text-muted-foreground mb-1">{cell.day}</div>
            <div className="space-y-0.5">
              {cell.events.slice(0, 3).map((r) => (
                <button
                  key={r.id}
                  onClick={() => onEdit(r)}
                  className="w-full text-left text-[10px] rounded px-1 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary truncate flex items-center gap-1"
                  title={`${r.titulo} às ${r.hora.slice(0, 5)}`}
                >
                  <Clock className="h-2.5 w-2.5 shrink-0" />
                  <span className="tabular-nums">{r.hora.slice(0, 5)}</span>
                  <span className="truncate">{r.titulo}</span>
                </button>
              ))}
              {cell.events.length > 3 && (
                <div className="text-[10px] text-muted-foreground px-1">+{cell.events.length - 3}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// DIALOG
// ============================================================================

function RotinaDialog({ rotina, onClose }: { rotina: Partial<Rotina>; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!rotina.id;
  const [form, setForm] = useState({
    titulo: rotina.titulo ?? "",
    descricao: rotina.descricao ?? "",
    frequencia: (rotina.frequencia ?? "diaria") as Rotina["frequencia"],
    dias_semana: rotina.dias_semana ?? [],
    hora: (rotina.hora ?? "09:00").slice(0, 5),
    data_inicio: rotina.data_inicio ?? new Date().toISOString().slice(0, 10),
    data_fim: rotina.data_fim ?? "",
    responsavel_nome: rotina.responsavel_nome ?? "",
    status: (rotina.status ?? "ativa") as Rotina["status"],
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => {
    const cur = form.dias_semana ?? [];
    set("dias_semana", cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        frequencia: form.frequencia,
        dias_semana: form.dias_semana,
        hora: form.hora,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        responsavel_nome: form.responsavel_nome || null,
        status: form.status,
      };
      if (isEdit) {
        const { error } = await supabase.from("financeiro_rotinas" as any).update(payload).eq("id", rotina.id!);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("financeiro_rotinas" as any).insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-rotinas"] });
      toast.success(isEdit ? "Rotina atualizada" : "Rotina criada");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? "Editar rotina" : "Nova rotina"}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.titulo.trim()) return toast.error("Título obrigatório");
            saveMut.mutate();
          }}
        >
          <FormSection>
            <FormField label="Título*" wide>
              <Input required value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Verificar pagamentos" />
            </FormField>
            <FormField label="Descrição" wide>
              <Textarea rows={2} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </FormField>
            <FormField label="Frequência*">
              <Select value={form.frequencia} onValueChange={(v) => set("frequencia", v as Rotina["frequencia"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQ_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Hora*">
              <Input required type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} />
            </FormField>
            {(form.frequencia === "semanal" || form.frequencia === "custom") && (
              <FormField label="Dias da semana*" wide>
                <div className="flex gap-1 flex-wrap">
                  {DIAS_SEMANA.map((d, idx) => {
                    const active = form.dias_semana.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            )}
            <FormField label="Data de início*">
              <Input required type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
            </FormField>
            <FormField label="Data de fim (opcional)">
              <Input type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} />
            </FormField>
            <FormField label="Responsável">
              <Input value={form.responsavel_nome} onChange={(e) => set("responsavel_nome", e.target.value)} placeholder="Nome do responsável" />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v as Rotina["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </FormSection>
          <FormActions>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : "Salvar"}</Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildMonthGrid(monthStart: Date, rotinas: Rotina[]) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDayOfWeek = monthStart.getDay();
  const startDate = new Date(year, month, 1 - firstDayOfWeek);
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: {
    date: Date;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    events: Rotina[];
  }[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const events = rotinas
      .filter((r) => occursOn(r, d))
      .sort((a, b) => a.hora.localeCompare(b.hora));
    cells.push({
      date: d,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: key === todayKey,
      events,
    });
  }
  return cells;
}

function occursOn(r: Rotina, date: Date): boolean {
  const key = date.toISOString().slice(0, 10);
  if (key < r.data_inicio) return false;
  if (r.data_fim && key > r.data_fim) return false;

  const start = parseISODate(r.data_inicio);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  switch (r.frequencia) {
    case "diaria":
      return true;
    case "semanal":
      return (r.dias_semana ?? []).includes(date.getDay());
    case "custom":
      return (r.dias_semana ?? []).includes(date.getDay());
    case "quinzenal":
      return diffDays >= 0 && diffDays % 14 === 0;
    case "mensal":
      return date.getDate() === start.getDate();
    default:
      return false;
  }
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
