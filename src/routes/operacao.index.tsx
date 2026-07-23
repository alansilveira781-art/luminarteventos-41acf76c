import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Play, CheckCircle2, ArrowRight, StickyNote } from "lucide-react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent,
} from "@dnd-kit/core";

export const Route = createFileRoute("/operacao/")({ component: OperacaoQuadro });

const sb = supabase as any;

type Setor = { id: string; nome: string; slug: string; ordem: number; responsavel_id: string | null };
type Etapa = { id: string; setor_id: string; nome: string; ordem: number };
type Ordem = {
  id: string; numero: number; setor_id: string; titulo: string; descricao: string | null;
  tipo_unidade: string | null; quantidade: number | null; evento_ref: string | null;
  origem: string; etapa_atual_id: string | null; status: string; prazo: string | null;
  responsavel_id: string | null; created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  aberta: "bg-slate-400",
  em_andamento: "bg-blue-500",
  bloqueada: "bg-rose-500",
  finalizada: "bg-emerald-500",
  cancelada: "bg-zinc-400",
};

function OperacaoQuadro() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [setorId, setSetorId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);

  const { data: setores = [] } = useQuery<Setor[]>({
    queryKey: ["op_setores"],
    queryFn: async () => {
      const { data, error } = await sb.from("op_setores").select("id,nome,slug,ordem,responsavel_id").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const setorAtivo = setorId ?? setores[0]?.id ?? null;

  const { data: etapas = [] } = useQuery<Etapa[]>({
    enabled: !!setorAtivo,
    queryKey: ["op_etapas", setorAtivo],
    queryFn: async () => {
      const { data, error } = await sb.from("op_setor_etapas").select("id,setor_id,nome,ordem").eq("setor_id", setorAtivo).eq("ativo", true).order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const { data: ordens = [] } = useQuery<Ordem[]>({
    enabled: !!setorAtivo,
    queryKey: ["op_ordens", setorAtivo],
    queryFn: async () => {
      const { data, error } = await sb.from("op_ordens")
        .select("id,numero,setor_id,titulo,descricao,tipo_unidade,quantidade,evento_ref,origem,etapa_atual_id,status,prazo,responsavel_id,created_at")
        .eq("setor_id", setorAtivo).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const byEtapa = useMemo(() => {
    const m: Record<string, Ordem[]> = {};
    etapas.forEach((e) => (m[e.id] = []));
    m["__sem__"] = [];
    ordens.forEach((o) => {
      if (o.status === "finalizada" || o.status === "cancelada") return;
      const k = o.etapa_atual_id ?? "__sem__";
      (m[k] ??= []).push(o);
    });
    return m;
  }, [etapas, ordens]);

  const finalizadas = useMemo(() => ordens.filter((o) => o.status === "finalizada").slice(0, 20), [ordens]);

  const moveEtapa = useMutation({
    mutationFn: async (vars: { id: string; etapa_id: string | null; ordemAtual: Ordem }) => {
      const { ordemAtual, etapa_id } = vars;
      // Se etapa atual existe e diferente, fecha apontamento aberto
      if (ordemAtual.etapa_atual_id && ordemAtual.etapa_atual_id !== etapa_id) {
        await sb.from("op_ordem_apontamentos")
          .update({ finalizado_em: new Date().toISOString() })
          .eq("ordem_id", vars.id).eq("etapa_id", ordemAtual.etapa_atual_id).is("finalizado_em", null);
      }
      const { error } = await sb.from("op_ordens")
        .update({ etapa_atual_id: etapa_id, status: "em_andamento" })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["op_ordens", setorAtivo] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao mover"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const card = ordens.find((r) => r.id === id);
    if (!card) return;
    const targetEtapa = overId === "__sem__" ? null : overId;
    if (card.etapa_atual_id === targetEtapa) return;
    moveEtapa.mutate({ id, etapa_id: targetEtapa, ordemAtual: card });
  }

  const setor = setores.find((s) => s.id === setorAtivo);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operação"
        description="Quadro de produção por setor"
        actions={
          <div className="flex items-center gap-2">
            <Select value={setorAtivo ?? undefined} onValueChange={(v) => setSetorId(v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setNovoOpen(true)} disabled={!setorAtivo}>
              <Plus className="h-4 w-4 mr-1" /> Nova ordem
            </Button>
          </div>
        }
      />

      {!setorAtivo ? (
        <div className="text-sm text-muted-foreground">Nenhum setor configurado.</div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {etapas.map((et) => (
              <Column key={et.id} id={et.id} title={et.nome} count={(byEtapa[et.id] ?? []).length}>
                {(byEtapa[et.id] ?? []).map((o) => (
                  <Card key={o.id} ordem={o} onClick={() => setCardId(o.id)} />
                ))}
              </Column>
            ))}
            {(byEtapa["__sem__"] ?? []).length > 0 && (
              <Column id="__sem__" title="Sem etapa" count={byEtapa["__sem__"].length}>
                {byEtapa["__sem__"].map((o) => (
                  <Card key={o.id} ordem={o} onClick={() => setCardId(o.id)} />
                ))}
              </Column>
            )}
          </div>
        </DndContext>
      )}

      {finalizadas.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="text-sm font-medium mb-2">Últimas finalizadas</div>
          <div className="flex flex-wrap gap-2">
            {finalizadas.map((o) => (
              <button key={o.id} onClick={() => setCardId(o.id)}
                className="text-xs rounded border px-2 py-1 hover:bg-accent">
                OP-{o.numero} · {o.titulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {novoOpen && setorAtivo && (
        <NovaOrdemDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          setorId={setorAtivo}
          etapas={etapas}
          userId={user?.id ?? null}
          onCreated={() => qc.invalidateQueries({ queryKey: ["op_ordens", setorAtivo] })}
        />
      )}

      {cardId && (
        <CardDialog
          id={cardId}
          onClose={() => setCardId(null)}
          etapas={etapas}
          setor={setor ?? null}
          canManage={isAdmin || (!!setor?.responsavel_id && setor.responsavel_id === user?.id)}
        />
      )}
    </div>
  );
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-w-[280px] w-[280px] rounded-lg border bg-card ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{count}</div>
      </div>
      <div className="p-2 space-y-2 min-h-[80px]">{children}</div>
    </div>
  );
}

function Card({ ordem, onClick }: { ordem: Ordem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ordem.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing rounded-md border bg-background p-2 text-sm shadow-sm hover:border-primary ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">OP-{ordem.numero}</span>
        <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[ordem.status] ?? "bg-slate-300"}`} />
      </div>
      <div className="font-medium truncate">{ordem.titulo}</div>
      {ordem.evento_ref && <div className="text-xs text-muted-foreground truncate">{ordem.evento_ref}</div>}
      <div className="text-xs text-muted-foreground">
        {ordem.quantidade ?? "—"} {ordem.tipo_unidade ?? ""}
        {ordem.prazo && <> · prazo {new Date(ordem.prazo).toLocaleDateString("pt-BR")}</>}
      </div>
    </div>
  );
}

function NovaOrdemDialog({
  open, onOpenChange, setorId, etapas, userId, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; setorId: string;
  etapas: Etapa[]; userId: string | null; onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoUnidade, setTipoUnidade] = useState<string>("un");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [eventoRef, setEventoRef] = useState<string | null>(null);
  const [prazo, setPrazo] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) { toast.error("Informe um título"); return; }
    setSaving(true);
    const primeira = etapas[0]?.id ?? null;
    const { error } = await sb.from("op_ordens").insert({
      setor_id: setorId,
      titulo: titulo.trim(),
      descricao: descricao || null,
      tipo_unidade: tipoUnidade || null,
      quantidade: Number(quantidade) || null,
      evento_ref: eventoRef,
      origem: "avulsa",
      etapa_atual_id: primeira,
      status: "aberta",
      prazo: prazo || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ordem criada");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova ordem de produção</DialogTitle>
          <DialogDescription>Cadastre uma ordem avulsa para este setor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Passadeira 40x60" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={tipoUnidade} onChange={(e) => setTipoUnidade(e.target.value)} placeholder="un, m, kg…" />
            </div>
          </div>
          <div>
            <Label>Evento</Label>
            <EventoSheetCombobox value={eventoRef} onChange={setEventoRef} />
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Criar ordem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardDialog({ id, onClose, etapas, setor, canManage }: {
  id: string; onClose: () => void; etapas: Etapa[]; setor: Setor | null; canManage: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [obs, setObs] = useState("");

  const { data: ordem } = useQuery<Ordem | null>({
    queryKey: ["op_ordem", id],
    queryFn: async () => {
      const { data, error } = await sb.from("op_ordens").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: aponts = [] } = useQuery({
    queryKey: ["op_apontamentos", id],
    queryFn: async () => {
      const { data, error } = await sb.from("op_ordem_apontamentos")
        .select("id,etapa_id,iniciado_em,finalizado_em,observacoes,executado_por")
        .eq("ordem_id", id).order("iniciado_em");
      if (error) throw error;
      return data as any[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["op_ordem", id] });
    qc.invalidateQueries({ queryKey: ["op_apontamentos", id] });
    qc.invalidateQueries({ queryKey: ["op_ordens", setor?.id] });
  };

  const etapaAtual = etapas.find((e) => e.id === ordem?.etapa_atual_id);
  const idx = etapaAtual ? etapas.findIndex((e) => e.id === etapaAtual.id) : -1;
  const proxima = idx >= 0 && idx < etapas.length - 1 ? etapas[idx + 1] : null;
  const aberto = aponts.find((a) => a.etapa_id === ordem?.etapa_atual_id && !a.finalizado_em);

  async function iniciar() {
    if (!ordem?.etapa_atual_id) return;
    const { error } = await sb.from("op_ordem_apontamentos").insert({
      ordem_id: id, etapa_id: ordem.etapa_atual_id, executado_por: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    await sb.from("op_ordens").update({ status: "em_andamento" }).eq("id", id);
    setObs(""); invalidar();
  }

  async function finalizar(avancar: boolean) {
    if (!aberto) return;
    await sb.from("op_ordem_apontamentos")
      .update({ finalizado_em: new Date().toISOString(), observacoes: obs || null })
      .eq("id", aberto.id);
    if (avancar) {
      if (proxima) {
        await sb.from("op_ordens").update({ etapa_atual_id: proxima.id, status: "em_andamento" }).eq("id", id);
      } else {
        await sb.from("op_ordens").update({ status: "finalizada" }).eq("id", id);
      }
    }
    setObs(""); invalidar();
  }

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {ordem ? (
          <>
            <DialogHeader>
              <DialogTitle>OP-{ordem.numero} · {ordem.titulo}</DialogTitle>
              <DialogDescription>
                {setor?.nome} · {ordem.quantidade ?? "—"} {ordem.tipo_unidade ?? ""}
                {ordem.evento_ref && <> · {ordem.evento_ref}</>}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {ordem.descricao && (
                <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-2">{ordem.descricao}</div>
              )}

              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Etapa atual</div>
                <div className="flex items-center gap-2">
                  <div className="rounded bg-primary/10 text-primary px-2 py-1 text-sm">
                    {etapaAtual?.nome ?? "—"}
                  </div>
                  {proxima && <><ArrowRight className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">{proxima.nome}</span></>}
                </div>
              </div>

              {ordem.status !== "finalizada" && ordem.status !== "cancelada" && (
                <div className="space-y-2">
                  <Label>Observação do apontamento</Label>
                  <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
                  <div className="flex flex-wrap gap-2">
                    {!aberto ? (
                      <Button size="sm" onClick={iniciar} disabled={!ordem.etapa_atual_id}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Iniciar etapa
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => finalizar(false)}>
                          <StickyNote className="h-3.5 w-3.5 mr-1" /> Finalizar (permanece)
                        </Button>
                        <Button size="sm" onClick={() => finalizar(true)}>
                          {proxima ? (<><ArrowRight className="h-3.5 w-3.5 mr-1" /> Avançar</>) : (<><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir OP</>)}
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <Button size="sm" variant="destructive" onClick={async () => {
                        if (!confirm("Cancelar esta ordem?")) return;
                        await sb.from("op_ordens").update({ status: "cancelada" }).eq("id", id);
                        invalidar(); onClose();
                      }}>Cancelar OP</Button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Histórico de apontamentos</div>
                {aponts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sem apontamentos.</div>
                ) : (
                  <ul className="space-y-1 text-sm max-h-56 overflow-auto">
                    {aponts.map((a) => {
                      const et = etapas.find((e) => e.id === a.etapa_id);
                      const fim = a.finalizado_em ? new Date(a.finalizado_em) : null;
                      const ini = new Date(a.iniciado_em);
                      const dur = fim ? Math.round((fim.getTime() - ini.getTime()) / 60000) : null;
                      return (
                        <li key={a.id} className="border rounded p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{et?.nome ?? "?"}</span>
                            <span className="text-xs text-muted-foreground">
                              {ini.toLocaleString("pt-BR")} {fim ? `→ ${fim.toLocaleTimeString("pt-BR")}` : "· em andamento"}
                              {dur != null && <> · {dur} min</>}
                            </span>
                          </div>
                          {a.observacoes && <div className="text-xs text-muted-foreground mt-1">{a.observacoes}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
