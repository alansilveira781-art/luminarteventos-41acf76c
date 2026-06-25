import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Pause, Play, Clock, CheckCircle2, Paperclip, ShieldCheck, X, Share2 } from "lucide-react";
import { AnexoViewer } from "@/components/AnexoViewer";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro-op/rotinas")({
  component: RotinasPage,
});

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  frequencia: "diaria" | "semanal" | "quinzenal" | "mensal" | "custom";
  dias_semana: number[] | null;
  hora: string | null;
  data_inicio: string;
  data_fim: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: "ativa" | "pausada";
  exige_validacao: boolean;
  max_ocorrencias: number | null;
  ocorrencias_realizadas: number | null;
  proxima_data: string | null;
  encerrada: boolean;
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
  const { isAdmin, modulos } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro" && m.is_admin);
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

  const { data: pendentesCount = 0 } = useQuery({
    queryKey: ["financeiro-rotinas-validacoes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("financeiro_rotina_execucoes" as any)
        .select("id", { count: "exact", head: true })
        .eq("validacao_status", "pendente");
      return count ?? 0;
    },
    enabled: isFinAdmin,
  });

  return (
    <>
      <PageHeader
        title="Rotinas Financeiras"
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
          <TabsTrigger value="execucao">Execução</TabsTrigger>
          {isFinAdmin && (
            <TabsTrigger value="validacoes">
              Validações{pendentesCount > 0 ? ` (${pendentesCount})` : ""}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tabela">
          <TabelaRotinas rotinas={rotinas} onEdit={setEditing} />
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarioRotinas rotinas={rotinas} onEdit={setEditing} />
        </TabsContent>

        <TabsContent value="execucao">
          <ExecucaoRotinas rotinas={rotinas.filter((r) => r.status === "ativa" && !r.encerrada)} />
        </TabsContent>

        {isFinAdmin && (
          <TabsContent value="validacoes">
            <ValidacoesPanel />
          </TabsContent>
        )}
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
                  <div className="font-medium flex items-center gap-2">
                    {r.titulo}
                    {r.exige_validacao && (
                      <Badge variant="secondary" className="text-[10px]">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Requer validação
                      </Badge>
                    )}
                  </div>
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
                  <div className="flex items-center gap-1">
                    <Badge variant={r.status === "ativa" ? "default" : "secondary"}>
                      {r.status === "ativa" ? "Ativa" : "Pausada"}
                    </Badge>
                    {r.encerrada && <Badge variant="outline" className="text-[10px]">Encerrada</Badge>}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => shareWithMaicon(r)} title="Compartilhar com Maicon">
                      <Share2 className="h-4 w-4" />
                    </Button>
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

  const ativas = useMemo(() => rotinas.filter((r) => r.status === "ativa" && !r.encerrada), [rotinas]);
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
              {cell.events.slice(0, 3).map((r) => {
                const horaFmt = r.hora?.slice(0, 5) ?? "—";
                return (
                  <button
                    key={r.id}
                    onClick={() => onEdit(r)}
                    className="w-full text-left text-[10px] rounded px-1 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary truncate flex items-center gap-1"
                    title={`${r.titulo} às ${horaFmt}`}
                  >
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    <span className="tabular-nums">{horaFmt}</span>
                    <span className="truncate">{r.titulo}</span>
                  </button>
                );
              })}
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

const MAICON_USER_ID = "7df29f9f-beb0-4710-9036-17996e9cbd82";

async function shareWithMaicon(rotina: Rotina) {
  const url = `${window.location.origin}/financeiro/rotinas?rotina=${rotina.id}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência");
  } catch {
    toast.warning("Não foi possível copiar o link automaticamente");
  }
  try {
    const { error } = await supabase.from("notificacoes").insert({
      user_id: MAICON_USER_ID,
      tipo: "rotina_compartilhada",
      titulo: "Rotina compartilhada",
      mensagem: rotina.titulo,
      link: `/financeiro/rotinas?rotina=${rotina.id}`,
    });
    if (error) throw error;
    toast.success("Maicon foi notificado");
  } catch (e: any) {
    toast.error(`Falha ao notificar: ${e.message ?? e}`);
  }
}

function RotinaDialog({ rotina, onClose }: { rotina: Partial<Rotina>; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!rotina.id;
  const [form, setForm] = useState({
    titulo: rotina.titulo ?? "",
    descricao: rotina.descricao ?? "",
    frequencia: (rotina.frequencia ?? "diaria") as Rotina["frequencia"],
    dias_semana: rotina.dias_semana ?? [],
    hora: ((rotina.hora ?? "09:00") as string).slice(0, 5),
    data_inicio: rotina.data_inicio ?? new Date().toISOString().slice(0, 10),
    data_fim: rotina.data_fim ?? "",
    responsavel_nome: rotina.responsavel_nome ?? "",
    status: (rotina.status ?? "ativa") as Rotina["status"],
    exige_validacao: rotina.exige_validacao ?? false,
    max_ocorrencias: rotina.max_ocorrencias != null ? String(rotina.max_ocorrencias) : "",
  });
  const [files, setFiles] = useState<File[]>([]);

  const { data: existingAnexos = [] } = useQuery({
    queryKey: ["rotina-anexos", rotina.id],
    queryFn: async () => {
      if (!rotina.id) return [] as any[];
      const { data } = await supabase
        .from("financeiro_rotina_anexos" as any)
        .select("*")
        .eq("rotina_id", rotina.id)
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: !!rotina.id,
  });
  const [previewAnexo, setPreviewAnexo] = useState<any | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => {
    const cur = form.dias_semana ?? [];
    set("dias_semana", cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  async function uploadRotinaAnexos(rotinaId: string, userId: string | null, filesToUpload: File[]) {
    for (const file of filesToUpload) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `rotinas/${rotinaId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("rotina-anexos").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("financeiro_rotina_anexos" as any).insert({
        rotina_id: rotinaId,
        nome: file.name,
        path,
        mime_type: file.type || null,
        tamanho: file.size,
        uploaded_by: userId,
      });
      if (insErr) throw insErr;
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const maxOcorr = form.max_ocorrencias.trim()
        ? Math.max(1, parseInt(form.max_ocorrencias, 10) || 0) || null
        : null;
      const payload: any = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        frequencia: form.frequencia,
        dias_semana: form.dias_semana,
        hora: form.hora,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        responsavel_nome: form.responsavel_nome || null,
        status: form.status,
        exige_validacao: form.exige_validacao,
        max_ocorrencias: maxOcorr,
      };
      const { data: { user } } = await supabase.auth.getUser();
      let savedId = rotina.id as string | undefined;
      if (isEdit) {
        const { error } = await supabase.from("financeiro_rotinas" as any).update(payload).eq("id", rotina.id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("financeiro_rotinas" as any).insert({
          ...payload,
          created_by: user?.id ?? null,
          proxima_data: form.data_inicio,
          ocorrencias_realizadas: 0,
          encerrada: false,
        }).select("id").single();
        if (error) throw error;
        savedId = (data as any).id;
      }
      if (savedId && files.length > 0) {
        await uploadRotinaAnexos(savedId, user?.id ?? null, files);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-rotinas"] });
      qc.invalidateQueries({ queryKey: ["rotina-anexos"] });
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
            <FormField label="Repetir até (data de término)">
              <Input type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} />
            </FormField>
            <FormField label="Nº máximo de ocorrências">
              <Input
                type="number"
                min={1}
                value={form.max_ocorrencias}
                onChange={(e) => set("max_ocorrencias", e.target.value)}
                placeholder="Sem limite"
              />
            </FormField>
            <FormField label="" wide>
              <p className="text-xs text-muted-foreground">
                A rotina encerra quando atingir a data de término OU o nº de ocorrências, o que vier primeiro. Deixe ambos em branco para recorrência sem fim.
              </p>
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
            <FormField label="Validação" wide>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.exige_validacao}
                  onCheckedChange={(v) => set("exige_validacao", !!v)}
                />
                Exige validação do gestor
              </label>
            </FormField>
            <FormField label="Anexos" wide>
              {existingAnexos.length > 0 && (
                <ul className="text-xs mb-2 space-y-0.5">
                  {existingAnexos.map((a: any) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setPreviewAnexo(a)}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Paperclip className="h-3 w-3" /> {a.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-3 cursor-pointer hover:bg-muted/40 transition text-sm">
                <Paperclip className="h-4 w-4" />
                <span>{files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Clique para anexar arquivos"}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              {files.length > 0 && (
                <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FormField>
          </FormSection>
          <FormActions>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : "Salvar"}</Button>
          </FormActions>
        </form>
        <AnexoViewer
          bucket="rotina-anexos"
          anexo={previewAnexo}
          open={!!previewAnexo}
          onOpenChange={(o) => !o && setPreviewAnexo(null)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function fmtDate(iso: string | null | undefined) {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
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
      .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
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

// ============================================================================
// EXECUÇÃO
// ============================================================================

type Execucao = {
  id: string;
  rotina_id: string;
  data_referencia: string;
  executada: boolean;
  executada_em: string;
  executada_por_nome: string | null;
  observacoes: string | null;
  validacao_status: "nao_requer" | "pendente" | "aprovada" | "rejeitada";
  validado_por_nome: string | null;
  validado_em: string | null;
  validacao_observacao: string | null;
};

type PeriodoKey = "hoje" | "amanha" | "semana" | "mes" | "custom";

function ExecucaoRotinas({ rotinas }: { rotinas: Rotina[] }) {
  const [registrar, setRegistrar] = useState<{ rotina: Rotina; date: string } | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoKey>("hoje");
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const [respFilter, setRespFilter] = useState<string>("__all");

  const { data: execucoes = [] } = useQuery({
    queryKey: ["rotina-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_rotina_execucoes" as any)
        .select("*")
        .order("executada_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Execucao[];
    },
  });

  const hojeISO = new Date().toISOString().slice(0, 10);

  // Janela de período
  const { from, to } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startISO = (d: Date) => d.toISOString().slice(0, 10);
    if (periodo === "hoje") return { from: startISO(today), to: startISO(today) };
    if (periodo === "amanha") {
      const t = new Date(today); t.setDate(t.getDate() + 1);
      return { from: startISO(t), to: startISO(t) };
    }
    if (periodo === "semana") {
      const t = new Date(today); t.setDate(t.getDate() + 7);
      return { from: startISO(today), to: startISO(t) };
    }
    if (periodo === "mes") {
      const t = new Date(today); t.setDate(t.getDate() + 30);
      return { from: startISO(today), to: startISO(t) };
    }
    return { from: customFrom, to: customTo };
  }, [periodo, customFrom, customTo]);

  // Map: rotina_id → set de datas com execução registrada
  const execDatasByRotina = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    execucoes.forEach((e) => {
      (m[e.rotina_id] ??= new Set()).add(e.data_referencia);
    });
    return m;
  }, [execucoes]);

  // Responsáveis disponíveis (apenas das rotinas ativas)
  const responsaveis = useMemo(() => {
    const s = new Set<string>();
    rotinas.forEach((r) => r.responsavel_nome && s.add(r.responsavel_nome));
    return Array.from(s).sort();
  }, [rotinas]);

  // Projeta ocorrências dentro do intervalo
  type Ocorrencia = { rotina: Rotina; date: string; isFeita: boolean; atrasada: boolean };
  const ocorrencias = useMemo<Ocorrencia[]>(() => {
    const out: Ocorrencia[] = [];
    if (!from || !to || from > to) return out;
    const startD = new Date(from + "T00:00:00");
    const endD = new Date(to + "T00:00:00");
    for (const r of rotinas) {
      if (respFilter !== "__all" && (r.responsavel_nome ?? "") !== respFilter) continue;
      // Inclui também a proxima_data se < from (rotina atrasada) e dentro de hoje
      const pData = r.proxima_data;
      if (pData && pData < from && pData >= r.data_inicio && (!r.data_fim || pData <= r.data_fim)) {
        const feita = execDatasByRotina[r.id]?.has(pData) ?? false;
        if (!feita) out.push({ rotina: r, date: pData, isFeita: false, atrasada: true });
      }
      const d = new Date(startD);
      while (d <= endD) {
        const key = d.toISOString().slice(0, 10);
        if (occursOn(r, d)) {
          const feita = execDatasByRotina[r.id]?.has(key) ?? false;
          out.push({ rotina: r, date: key, isFeita: feita, atrasada: key < hojeISO && !feita });
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return out.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.rotina.hora ?? "").localeCompare(b.rotina.hora ?? "");
    });
  }, [rotinas, from, to, execDatasByRotina, respFilter, hojeISO]);

  // Agrupa por data
  const grupos = useMemo(() => {
    const map = new Map<string, Ocorrencia[]>();
    ocorrencias.forEach((o) => {
      if (!map.has(o.date)) map.set(o.date, []);
      map.get(o.date)!.push(o);
    });
    return Array.from(map.entries());
  }, [ocorrencias]);

  return (
    <>
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="amanha">Amanhã</SelectItem>
            <SelectItem value="semana">Próximos 7 dias</SelectItem>
            <SelectItem value="mes">Próximos 30 dias</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {periodo === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
          </>
        )}
        {responsaveis.length > 0 && (
          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos responsáveis</SelectItem>
              {responsaveis.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto text-xs text-muted-foreground">{ocorrencias.length} ocorrência(s)</div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {grupos.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            Nenhuma rotina prevista no período.
          </div>
        ) : (
          <div className="divide-y">
            {grupos.map(([data, items]) => (
              <div key={data} className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {fmtDate(data)} {data === hojeISO && <Badge variant="default" className="ml-1">Hoje</Badge>}
                </div>
                <div className="space-y-1.5">
                  {items.map((o, idx) => {
                    const r = o.rotina;
                    const hora = r.hora?.slice(0, 5) ?? "—";
                    return (
                      <div key={`${r.id}-${o.date}-${idx}`} className="flex items-center gap-3 p-2 rounded border bg-background">
                        <div className="text-xs tabular-nums text-muted-foreground w-12">{hora}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                            {r.titulo}
                            {r.exige_validacao && (
                              <Badge variant="secondary" className="text-[10px]">
                                <ShieldCheck className="h-3 w-3 mr-1" /> Validação
                              </Badge>
                            )}
                            {o.atrasada && <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>}
                            {o.isFeita && <Badge variant="default" className="text-[10px]">Feita</Badge>}
                            {!o.isFeita && !o.atrasada && o.date === hojeISO && (
                              <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                            )}
                            {!o.isFeita && o.date > hojeISO && (
                              <Badge variant="outline" className="text-[10px]">Prevista</Badge>
                            )}
                          </div>
                          {r.responsavel_nome && (
                            <div className="text-xs text-muted-foreground">Resp.: {r.responsavel_nome}</div>
                          )}
                        </div>
                        {!o.isFeita && o.date <= hojeISO && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={execDatasByRotina[r.id]?.has(o.date) ?? false}
                            onClick={() => setRegistrar({ rotina: r, date: o.date })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar feita
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>


      <div className="mt-6">
        <div className="text-sm font-semibold mb-2">Histórico recente</div>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Rotina</th>
                  <th className="px-4 py-2 text-left">Data ref.</th>
                  <th className="px-4 py-2 text-left">Executada por</th>
                  <th className="px-4 py-2 text-left">Anexos</th>
                  <th className="px-4 py-2 text-left">Validação</th>
                  <th className="px-4 py-2 text-left">Observações</th>
                </tr>
              </thead>
              <tbody>
                {execucoes.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma execução registrada</td></tr>
                )}
                {execucoes.slice(0, 50).map((e) => {
                  const r = rotinas.find((x) => x.id === e.rotina_id);
                  return (
                    <tr key={e.id} className="border-t hover:bg-muted/20 align-top">
                      <td className="px-4 py-2">{r?.titulo ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{fmtDate(e.data_referencia)}</td>
                      <td className="px-4 py-2 text-xs">{e.executada_por_nome ?? "—"}</td>
                      <td className="px-4 py-2"><AnexosLinks execucaoId={e.id} /></td>
                      <td className="px-4 py-2"><ValidacaoBadge status={e.validacao_status} /></td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{e.observacoes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {registrar && (
        <RegistrarExecucaoDialog rotina={registrar.rotina} dataInicial={registrar.date} onClose={() => setRegistrar(null)} />
      )}
    </>
  );
}

function ValidacaoBadge({ status }: { status: Execucao["validacao_status"] }) {
  if (status === "nao_requer") return <span className="text-xs text-muted-foreground">—</span>;
  if (status === "pendente") return <Badge variant="outline">Aguardando validação</Badge>;
  if (status === "aprovada") return <Badge variant="default">Aprovada</Badge>;
  return <Badge variant="destructive">Rejeitada</Badge>;
}

function AnexosLinks({ execucaoId }: { execucaoId: string }) {
  const [preview, setPreview] = useState<any | null>(null);
  const { data: anexos = [] } = useQuery({
    queryKey: ["rotina-exec-anexos", execucaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_rotina_execucao_anexos" as any)
        .select("*")
        .eq("execucao_id", execucaoId);
      return (data ?? []) as any[];
    },
  });
  if (anexos.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {anexos.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => setPreview(a)}
          className="text-xs text-primary hover:underline flex items-center gap-1 text-left"
        >
          <Paperclip className="h-3 w-3" /> {a.nome}
        </button>
      ))}
      <AnexoViewer
        bucket="rotina-anexos"
        anexo={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
    </div>
  );
}

function RegistrarExecucaoDialog({ rotina, dataInicial, onClose }: { rotina: Rotina; dataInicial?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [dataRef, setDataRef] = useState(dataInicial ?? new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);


  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    // Verificação local de duplicidade
    const cache = qc.getQueryData<Execucao[]>(["rotina-execucoes"]) ?? [];
    if (cache.some((x) => x.rotina_id === rotina.id && x.data_referencia === dataRef)) {
      toast.warning("Esta rotina já foi marcada como feita nesta data.");
      onClose();
      return;
    }

    setSaving(true);

    // Optimistic update: insere execução no cache imediatamente
    const tempId = `temp-${Date.now()}`;
    const validacaoStatus: Execucao["validacao_status"] = rotina.exige_validacao ? "pendente" : "nao_requer";
    const optimistic: Execucao = {
      id: tempId,
      rotina_id: rotina.id,
      data_referencia: dataRef,
      executada: true,
      executada_em: new Date().toISOString(),
      executada_por_nome: null,
      observacoes: obs || null,
      validacao_status: validacaoStatus,
      validado_por_nome: null,
      validado_em: null,
      validacao_observacao: null,
    };
    const prev = cache;
    qc.setQueryData<Execucao[]>(["rotina-execucoes"], [optimistic, ...prev]);

    // Fecha o dialog imediatamente
    onClose();
    toast.success(rotina.exige_validacao ? "Execução registrada — aguardando validação" : "Execução registrada");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let nome: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle();
        nome = prof?.display_name || prof?.email || user.email || null;
      }
      const { data: exec, error } = await supabase
        .from("financeiro_rotina_execucoes" as any)
        .insert({
          rotina_id: rotina.id,
          data_referencia: dataRef,
          executada: true,
          executada_por: user?.id ?? null,
          executada_por_nome: nome,
          observacoes: obs || null,
          validacao_status: validacaoStatus,
        })
        .select("id")
        .single();
      if (error) throw error;
      const execId = (exec as any).id as string;

      // Reconcilia
      qc.invalidateQueries({ queryKey: ["rotina-execucoes"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rotinas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rotinas-validacoes-count"] });
    } catch (err: any) {
      // Reverte cache otimista
      qc.setQueryData<Execucao[]>(["rotina-execucoes"], prev);
      const msg = String(err?.message ?? "");
      if (err?.code === "23505" || msg.includes("uq_rotina_execucao_data") || msg.toLowerCase().includes("duplicate")) {
        toast.error("Esta rotina já foi registrada para esta data.");
      } else {
        toast.error(msg || "Erro ao registrar");
      }
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar execução — {rotina.titulo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <FormSection>
            <FormField label="Observações" wide>
              <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
            </FormField>
          </FormSection>
          {rotina.exige_validacao && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 mt-2">
              <ShieldCheck className="h-3 w-3 inline mr-1" />
              Esta rotina exige validação do gestor após a execução.
            </div>
          )}
          <FormActions>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// VALIDAÇÕES (painel do gestor)
// ============================================================================

function ValidacoesPanel() {
  const qc = useQueryClient();
  const [acting, setActing] = useState<{ exec: Execucao; action: "aprovar" | "rejeitar" } | null>(null);

  const { data: pendentes = [] } = useQuery({
    queryKey: ["rotina-execucoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_rotina_execucoes" as any)
        .select("*")
        .eq("validacao_status", "pendente")
        .order("executada_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Execucao[];
    },
  });

  const { data: rotinas = [] } = useQuery({
    queryKey: ["financeiro-rotinas"],
    queryFn: async () => {
      const { data } = await supabase.from("financeiro_rotinas" as any).select("id,titulo");
      return (data ?? []) as unknown as { id: string; titulo: string }[];
    },
  });

  return (
    <>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Rotina</th>
                <th className="px-4 py-2 text-left">Data ref.</th>
                <th className="px-4 py-2 text-left">Executada por</th>
                <th className="px-4 py-2 text-left">Anexos</th>
                <th className="px-4 py-2 text-left">Observações</th>
                <th className="px-4 py-2 w-48"></th>
              </tr>
            </thead>
            <tbody>
              {pendentes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma execução aguardando validação</td></tr>
              )}
              {pendentes.map((e) => {
                const r = rotinas.find((x) => x.id === e.rotina_id);
                return (
                  <tr key={e.id} className="border-t hover:bg-muted/20 align-top">
                    <td className="px-4 py-2 font-medium">{r?.titulo ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{fmtDate(e.data_referencia)}</td>
                    <td className="px-4 py-2 text-xs">{e.executada_por_nome ?? "—"}</td>
                    <td className="px-4 py-2"><AnexosLinks execucaoId={e.id} /></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{e.observacoes ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setActing({ exec: e, action: "aprovar" })}>
                          Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setActing({ exec: e, action: "rejeitar" })}>
                          Rejeitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {acting && (
        <ValidarDialog
          exec={acting.exec}
          action={acting.action}
          onClose={() => setActing(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["rotina-execucoes-pendentes"] });
            qc.invalidateQueries({ queryKey: ["rotina-execucoes"] });
            qc.invalidateQueries({ queryKey: ["financeiro-rotinas-validacoes-count"] });
            setActing(null);
          }}
        />
      )}
    </>
  );
}

function ValidarDialog({
  exec, action, onClose, onDone,
}: {
  exec: Execucao;
  action: "aprovar" | "rejeitar";
  onClose: () => void;
  onDone: () => void;
}) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const isReject = action === "rejeitar";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isReject && !obs.trim()) {
      toast.error("Observação obrigatória ao rejeitar");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let nome: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle();
        nome = prof?.display_name || prof?.email || user.email || null;
      }
      const { error } = await supabase.from("financeiro_rotina_execucoes" as any).update({
        validacao_status: isReject ? "rejeitada" : "aprovada",
        validado_por: user?.id ?? null,
        validado_por_nome: nome,
        validado_em: new Date().toISOString(),
        validacao_observacao: obs || null,
      }).eq("id", exec.id);
      if (error) throw error;
      toast.success(isReject ? "Execução rejeitada" : "Execução aprovada");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao validar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isReject ? "Rejeitar execução" : "Aprovar execução"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <FormSection>
            <FormField label={isReject ? "Motivo*" : "Observação (opcional)"} wide>
              <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} required={isReject} />
            </FormField>
          </FormSection>
          <FormActions>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant={isReject ? "destructive" : "default"} disabled={saving}>
              {saving ? "Salvando…" : isReject ? "Rejeitar" : "Aprovar"}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

