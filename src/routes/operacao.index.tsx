import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, CalendarDays } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GanttOrdens } from "@/components/operacao/GanttOrdens";
import { ChecklistCardDialog, garantirChecklist } from "@/components/operacao/ChecklistCardDialog";
import { ImplementarProjetoDialog } from "@/components/operacao/ImplementarProjetoDialog";
import {
  STATUS_COLORS,
  progressoOrdem,
  type ChecklistItem,
  type Ordem,
  type OrdemSetor,
  type Setor,
} from "@/lib/operacao";

export const Route = createFileRoute("/operacao/")({ component: OperacaoQuadro });

const sb = supabase as any;

function OperacaoQuadro() {
  const qc = useQueryClient();
  const { user, isAdmin, isModuleAdmin } = useAuth();
  const [novoOpen, setNovoOpen] = useState(false);
  const [projetoOpen, setProjetoOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [view, setView] = useState("quadro");

  const { data: setores = [] } = useQuery<Setor[]>({
    queryKey: ["op_setores"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("op_setores")
        .select("id,nome,slug,ordem,responsavel_id,fixo,dias_medios")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const { data: ordens = [] } = useQuery<Ordem[]>({
    queryKey: ["op_ordens"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("op_ordens")
        .select(
          "id,numero,setor_id,titulo,descricao,tipo_unidade,quantidade,evento_ref,origem,status,prazo,data_inicio,responsavel_id,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roteiros = [] } = useQuery<OrdemSetor[]>({
    queryKey: ["op_roteiros"],
    queryFn: async () =>
      (await sb.from("op_ordem_setores").select("*").order("posicao")).data ?? [],
  });

  const { data: checklists = [] } = useQuery<ChecklistItem[]>({
    queryKey: ["op_checklists"],
    queryFn: async () =>
      (await sb.from("op_ordem_checklist").select("*").order("ordem")).data ?? [],
  });

  const ativas = useMemo(
    () => ordens.filter((o) => o.status !== "finalizada" && o.status !== "cancelada"),
    [ordens],
  );
  const finalizadas = useMemo(
    () => ordens.filter((o) => o.status === "finalizada").slice(0, 20),
    [ordens],
  );

  const porSetor = useMemo(() => {
    const m: Record<string, Ordem[]> = {};
    setores.forEach((s) => (m[s.id] = []));
    m["__sem__"] = [];
    ativas.forEach((o) => {
      const k = o.setor_id && m[o.setor_id] ? o.setor_id : "__sem__";
      m[k].push(o);
    });
    return m;
  }, [setores, ativas]);

  function podeMover(ordem: Ordem) {
    if (isAdmin || isModuleAdmin("operacao")) return true;
    const setor = setores.find((s) => s.id === ordem.setor_id);
    return !!setor?.responsavel_id && setor.responsavel_id === user?.id;
  }

  const mover = useMutation({
    mutationFn: async (vars: { ordem: Ordem; setorId: string }) => {
      const { ordem, setorId } = vars;
      const roteiro = roteiros.filter((r) => r.ordem_id === ordem.id);
      const destino = roteiro.find((r) => r.setor_id === setorId);
      if (!destino) throw new Error("Este setor não faz parte do roteiro desta ordem");
      const atual = roteiro.find((r) => r.setor_id === ordem.setor_id);
      const voltando = !!atual && destino.posicao < atual.posicao;
      const agora = new Date().toISOString();

      if (voltando) {
        // volta o setor de destino para "em andamento" e limpa todos os posteriores
        await sb
          .from("op_ordem_setores")
          .update({ status: "em_andamento", iniciado_em: agora, concluido_em: null })
          .eq("id", destino.id);
        const posteriores = roteiro.filter((r) => r.posicao > destino.posicao).map((r) => r.id);
        if (posteriores.length) {
          await sb
            .from("op_ordem_setores")
            .update({ status: "pendente", iniciado_em: null, concluido_em: null })
            .in("id", posteriores);
        }
        await sb
          .from("op_ordem_apontamentos")
          .update({ finalizado_em: agora })
          .eq("ordem_id", ordem.id)
          .is("finalizado_em", null);
        await garantirChecklist(ordem.id, setorId);
        const { error } = await sb
          .from("op_ordens")
          .update({ setor_id: setorId, status: "em_andamento" })
          .eq("id", ordem.id);
        if (error) throw error;
        return;
      }

      if (ordem.setor_id) {
        await sb
          .from("op_ordem_setores")
          .update({ status: "concluido", concluido_em: agora })
          .eq("ordem_id", ordem.id)
          .eq("setor_id", ordem.setor_id);
        await sb
          .from("op_ordem_apontamentos")
          .update({ finalizado_em: agora })
          .eq("ordem_id", ordem.id)
          .is("finalizado_em", null);
      }
      await garantirChecklist(ordem.id, setorId);
      await sb
        .from("op_ordem_setores")
        .update({ status: "em_andamento", iniciado_em: agora })
        .eq("id", destino.id);
      const { error } = await sb
        .from("op_ordens")
        .update({ setor_id: setorId, status: "em_andamento" })
        .eq("id", ordem.id);
      if (error) throw error;
      await sb
        .from("op_ordem_apontamentos")
        .insert({ ordem_id: ordem.id, etapa_id: null, executado_por: user?.id ?? null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op_ordens"] });
      qc.invalidateQueries({ queryKey: ["op_roteiros"] });
      qc.invalidateQueries({ queryKey: ["op_checklists"] });
      qc.invalidateQueries({ queryKey: ["op_roteiro"] });
      qc.invalidateQueries({ queryKey: ["op_checklist"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao mover"),
  });


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId || overId === "__sem__") return;
    const card = ordens.find((r) => r.id === id);
    if (!card || card.setor_id === overId) return;
    if (!podeMover(card)) {
      toast.error("Você não tem permissão para mover esta ordem");
      return;
    }
    const roteiro = roteiros.filter((r) => r.ordem_id === card.id);
    const destino = roteiro.find((r) => r.setor_id === overId);
    const atual = roteiro.find((r) => r.setor_id === card.setor_id);
    const voltando = !!destino && !!atual && destino.posicao < atual.posicao;
    if (voltando && !(isAdmin || isModuleAdmin("operacao"))) {
      toast.error("Somente administradores podem retornar um card para um setor anterior");
      return;
    }
    mover.mutate({ ordem: card, setorId: overId });
  }



  const cardSelecionado = ordens.find((o) => o.id === cardId) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operação"
        description="Passo a passo da produção: cada card percorre os setores do seu roteiro"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setProjetoOpen(true)} disabled={setores.length === 0}>
              <CalendarDays className="h-4 w-4 mr-1" /> Implementar projeto
            </Button>
            <Button onClick={() => setNovoOpen(true)} disabled={setores.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Nova ordem
            </Button>
          </div>
        }
      />

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="quadro">Quadro</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
        </TabsList>

        <TabsContent value="quadro" className="mt-4 space-y-4">
          {setores.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum setor configurado.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {setores.map((s) => (
                  <Column key={s.id} id={s.id} title={s.nome} count={(porSetor[s.id] ?? []).length}>
                    {(porSetor[s.id] ?? []).map((o) => (
                      <CardOrdem
                        key={o.id}
                        ordem={o}
                        setores={setores}
                        roteiro={roteiros.filter((r) => r.ordem_id === o.id)}
                        checklist={checklists.filter((c) => c.ordem_id === o.id)}
                        onClick={() => setCardId(o.id)}
                      />
                    ))}
                  </Column>
                ))}
                {(porSetor["__sem__"] ?? []).length > 0 && (
                  <Column id="__sem__" title="Sem setor" count={porSetor["__sem__"].length}>
                    {porSetor["__sem__"].map((o) => (
                      <CardOrdem
                        key={o.id}
                        ordem={o}
                        setores={setores}
                        roteiro={roteiros.filter((r) => r.ordem_id === o.id)}
                        checklist={checklists.filter((c) => c.ordem_id === o.id)}
                        onClick={() => setCardId(o.id)}
                      />
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
                  <button
                    key={o.id}
                    onClick={() => setCardId(o.id)}
                    className="text-xs rounded border px-2 py-1 hover:bg-accent"
                  >
                    OP-{o.numero} · {o.titulo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <GanttOrdens ordens={ativas} setores={setores} onOpen={setCardId} />
        </TabsContent>
      </Tabs>

      {novoOpen && (
        <NovaOrdemDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          setores={setores}
          userId={user?.id ?? null}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["op_ordens"] });
            qc.invalidateQueries({ queryKey: ["op_roteiros"] });
            qc.invalidateQueries({ queryKey: ["op_checklists"] });
          }}
        />
      )}

      {projetoOpen && (
        <ImplementarProjetoDialog
          open={projetoOpen}
          onOpenChange={setProjetoOpen}
          setores={setores}
          userId={user?.id ?? null}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["op_ordens"] });
            qc.invalidateQueries({ queryKey: ["op_roteiros"] });
            qc.invalidateQueries({ queryKey: ["op_checklists"] });
            qc.invalidateQueries({ queryKey: ["op_ordens_evento_ids"] });
          }}
        />
      )}



      {cardId && cardSelecionado && (
        <ChecklistCardDialog
          ordemId={cardId}
          setores={setores}
          podeEditar={podeMover(cardSelecionado)}
          onClose={() => setCardId(null)}
        />
      )}
    </div>
  );
}

function Column({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] w-[280px] rounded-lg border bg-card ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{count}</div>
      </div>
      <div className="p-2 space-y-2 min-h-[80px]">{children}</div>
    </div>
  );
}

function CardOrdem({
  ordem,
  setores,
  roteiro,
  checklist,
  onClick,
}: {
  ordem: Ordem;
  setores: Setor[];
  roteiro: OrdemSetor[];
  checklist: ChecklistItem[];
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ordem.id });
  const prog = progressoOrdem(roteiro, checklist, ordem.setor_id);
  const nome = (id: string) => setores.find((s) => s.id === id)?.nome ?? "—";
  const prazoSetor = roteiro.find((r) => r.setor_id === ordem.setor_id)?.prazo ?? null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing rounded-md border bg-background p-2 text-sm shadow-sm hover:border-primary ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">OP-{ordem.numero}</span>
        <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[ordem.status] ?? "bg-slate-300"}`} />
      </div>
      <div className="font-medium truncate">{ordem.titulo}</div>
      {ordem.evento_ref && (
        <div className="text-xs text-muted-foreground truncate">{ordem.evento_ref}</div>
      )}
      <div className="text-xs text-muted-foreground">
        {ordem.quantidade ?? "—"} {ordem.tipo_unidade ?? ""}
        {ordem.prazo && <> · prazo {new Date(`${ordem.prazo}T12:00:00`).toLocaleDateString("pt-BR")}</>}
      </div>
      <div className="mt-2">
        <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${prog.pct}%` }} />
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="truncate font-medium text-foreground/80">{nome(ordem.setor_id ?? "")}</span>
          {roteiro.length > 0 && (
            <span className="flex items-center gap-0.5 shrink-0">
              {roteiro.map((r) => (
                <span
                  key={r.id}
                  title={nome(r.setor_id)}
                  className={`h-1.5 w-1.5 rounded-full ${
                    r.status === "concluido"
                      ? "bg-emerald-500"
                      : r.setor_id === ordem.setor_id
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </span>
          )}
          <span className="ml-auto shrink-0 tabular-nums">
            {prog.concluidos}/{prog.total}
            {prazoSetor ? ` · ${new Date(`${prazoSetor}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
          </span>
        </div>
      </div>

    </div>
  );
}

function NovaOrdemDialog({
  open,
  onOpenChange,
  setores,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  setores: Setor[];
  userId: string | null;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoUnidade, setTipoUnidade] = useState<string>("un");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [eventoRef, setEventoRef] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("");
  const [roteiro, setRoteiro] = useState<string[]>([]);
  const [prazosSetor, setPrazosSetor] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);


  const selecionados = setores.filter((s) => s.fixo || roteiro.includes(s.id));

  function toggleSetor(id: string, v: boolean) {
    setRoteiro((prev) => (v ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function salvar() {
    if (!titulo.trim()) return toast.error("Informe um título");
    if (selecionados.length === 0) return toast.error("Selecione ao menos um setor no roteiro");
    const invalido = selecionados.find((s) => prazosSetor[s.id] && prazo && prazosSetor[s.id] > prazo);
    if (invalido) {
      return toast.error(`O prazo de ${invalido.nome} não pode ultrapassar o prazo final da ordem.`);
    }
    setSaving(true);
    try {

      const primeiro = selecionados[0];
      const { data: nova, error } = await sb
        .from("op_ordens")
        .insert({
          setor_id: primeiro.id,
          titulo: titulo.trim(),
          descricao: descricao || null,
          tipo_unidade: tipoUnidade || null,
          quantidade: Number(quantidade) || null,
          evento_ref: eventoRef,
          origem: "avulsa",
          status: "aberta",
          data_inicio: dataInicio || null,
          prazo: prazo || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const agora = new Date().toISOString();
      await sb.from("op_ordem_setores").insert(
        selecionados.map((s, i) => ({
          ordem_id: nova.id,
          setor_id: s.id,
          posicao: i,
          status: i === 0 ? "em_andamento" : "pendente",
          iniciado_em: i === 0 ? agora : null,
          prazo: prazosSetor[s.id] || null,
        })),
      );

      await garantirChecklist(nova.id, primeiro.id);

      toast.success("Ordem criada");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar ordem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ordem de produção</DialogTitle>
          <DialogDescription>Defina o roteiro de setores por onde a ordem vai passar.</DialogDescription>
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Roteiro de setores e prazos</Label>
            <div className="mt-1 space-y-1 rounded border p-2 max-h-56 overflow-y-auto">
              {setores.map((s) => {
                const marcado = s.fixo || roteiro.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={marcado}
                      disabled={s.fixo}
                      onCheckedChange={(v) => toggleSetor(s.id, !!v)}
                    />
                    <span className="flex-1 truncate">
                      {s.nome}
                      {s.fixo && <span className="ml-1 text-[10px] text-muted-foreground">(fixo)</span>}
                    </span>
                    <Input
                      type="date"
                      className="h-7 w-[150px] text-xs"
                      disabled={!marcado}
                      max={prazo || undefined}
                      value={prazosSetor[s.id] ?? ""}
                      onChange={(e) => setPrazosSetor((p) => ({ ...p, [s.id]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>
            {prazo && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Prazos por setor limitados ao prazo final da ordem.
              </p>
            )}
            {selecionados.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Sequência: {selecionados.map((s) => s.nome).join(" → ")}
              </p>
            )}
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            Criar ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
