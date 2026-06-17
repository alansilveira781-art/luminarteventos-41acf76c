import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, FileText, CheckCircle2, XCircle, Pencil, Eye, Printer, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CARD_STATUSES, type CardStatus, type ComercialCard, TIPOS_EVENTO } from "@/lib/comercial/types";
import { useComercial, moveCard, updateCard } from "@/lib/comercial/store";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Proposta } from "@/lib/comercial/types";
import { CardDialog } from "@/components/comercial/CardDialog";
import { PerdaDialog } from "@/components/comercial/PerdaDialog";
import { EnvioDialog } from "@/components/comercial/EnvioDialog";
import { DetalhesDrawer } from "@/components/comercial/DetalhesDrawer";
import { PropostaWizard } from "@/components/comercial/PropostaWizard";
import { gerarPropostaPDF } from "@/lib/comercial/pdf";
import { AvancarCardDialog } from "@/components/AvancarCardDialog";
import { notifyResponsavel } from "@/lib/notify";
import { toast } from "sonner";

export const Route = createFileRoute("/comercial/")({
  component: QuadroVendas,
});

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};
const fmtPeriodo = (ini: string, fim: string) => {
  if (!ini && !fim) return "";
  if (!fim || ini === fim) return fmt(ini);
  return `${fmt(ini)} – ${fmt(fim)}`;
};

function QuadroVendas() {
  const { cards, propostas, consultores } = useComercial();
  const [editCard, setEditCard] = useState<ComercialCard | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<CardStatus>("lead");
  const [openCard, setOpenCard] = useState(false);
  const [perdaCardId, setPerdaCardId] = useState<string | null>(null);
  const [envioCardId, setEnvioCardId] = useState<string | null>(null);
  const [detalhesCard, setDetalhesCard] = useState<ComercialCard | null>(null);
  const [wizardCardId, setWizardCardId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProposta, setWizardProposta] = useState<Proposta | null>(null);

  const { data: statusDefaults = [] } = useQuery({
    queryKey: ["comercial_status_defaults"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("comercial_status_defaults")
        .select("status, responsavel_id, responsavel_nome");
      return (data ?? []) as { status: CardStatus; responsavel_id: string | null; responsavel_nome: string | null }[];
    },
  });

  // Filtros
  const [fVendedor, setFVendedor] = useState<string>("__all__");
  const [fTipo, setFTipo] = useState<string>("__all__");
  const [fDe, setFDe] = useState<string>("");
  const [fAte, setFAte] = useState<string>("");

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (fVendedor !== "__all__" && c.responsavel !== fVendedor) return false;
      if (fTipo !== "__all__") {
        const prop = c.propostaId ? propostas.find((p) => p.id === c.propostaId) : null;
        const tipo = prop?.evento.tipo || "";
        if (tipo !== fTipo) return false;
      }
      if (fDe && c.eventoDataInicio && c.eventoDataInicio < fDe) return false;
      if (fAte && c.eventoDataInicio && c.eventoDataInicio > fAte) return false;
      return true;
    });
  }, [cards, propostas, fVendedor, fTipo, fDe, fAte]);

  const byStatus = useMemo(() => {
    const m: Record<CardStatus, ComercialCard[]> = {} as any;
    CARD_STATUSES.forEach((s) => (m[s.key] = []));
    filteredCards.forEach((c) => (m[c.status] ??= []).push(c));
    return m;
  }, [filteredCards]);

  const limparFiltros = () => {
    setFVendedor("__all__");
    setFTipo("__all__");
    setFDe("");
    setFAte("");
  };
  const filtrosAtivos =
    fVendedor !== "__all__" || fTipo !== "__all__" || !!fDe || !!fAte;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [pendingMove, setPendingMove] = useState<{ id: string; status: CardStatus } | null>(null);

  // Abre detalhes via ?card=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cardId = new URLSearchParams(window.location.search).get("card");
    if (cardId) {
      const c = cards.find((x) => x.id === cardId);
      if (c) setDetalhesCard(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const status = overId as CardStatus;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    if (status === "perda") { setPerdaCardId(id); return; }
    if (status === "orcamento_enviado") { setEnvioCardId(id); return; }
    const oldIdx = CARD_STATUSES.findIndex((s) => s.key === card.status);
    const newIdx = CARD_STATUSES.findIndex((s) => s.key === status);
    if (newIdx > oldIdx) {
      const def = statusDefaults.find((d) => d.status === status && d.responsavel_id);
      if (def?.responsavel_id) {
        if (def.responsavel_nome) updateCard(id, { responsavel: def.responsavel_nome });
        moveCard(id, status);
        const statusLabel = CARD_STATUSES.find((s) => s.key === status)?.label || status;
        notifyResponsavel({
          userId: def.responsavel_id,
          titulo: `Venda: ${statusLabel}`,
          mensagem: `${card.clienteNome}${card.eventoNome ? ` — ${card.eventoNome}` : ""}`,
          link: `/comercial?card=${id}`,
          tipo: "comercial_responsavel",
        }).catch(() => {});
        toast.success(`Card movido. ${def.responsavel_nome ?? "Responsável"} foi notificado.`);
        return;
      }
      setPendingMove({ id, status });
    } else {
      moveCard(id, status);
    }
  }


  return (
    <>
      <PageHeader
        title="Quadro de Vendas"
        description="Arraste os cards entre as colunas para alterar o status"
        actions={
          <Button onClick={() => { setEditCard(null); setDefaultStatus("lead"); setOpenCard(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo lead
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4 rounded-lg border border-border bg-muted/20 p-3">
        <div className="min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Vendedor</Label>
          <Select value={fVendedor} onValueChange={setFVendedor}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {consultores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Tipo de negócio</Label>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {TIPOS_EVENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data do evento — de</Label>
          <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="h-9 w-44" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">até</Label>
          <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="h-9 w-44" />
        </div>
        {filtrosAtivos && (
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {filteredCards.length} card{filteredCards.length === 1 ? "" : "s"}
        </div>
      </div>

      <TooltipProvider>
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 items-stretch h-[calc(100dvh-230px)] min-h-[420px]">
            {CARD_STATUSES.map((s) => (
              <Column key={s.key} statusKey={s.key} label={s.label} color={s.color} count={byStatus[s.key]?.length ?? 0}>
                {(byStatus[s.key] ?? []).map((c) => {
                  const proposta = c.propostaId ? propostas.find((p) => p.id === c.propostaId) : null;
                  return (
                    <KanbanCard
                      key={c.id}
                      card={c}
                      hasProposta={!!proposta}
                      onEdit={() => { setEditCard(c); setOpenCard(true); }}
                      onDetalhes={() => setDetalhesCard(c)}
                      onVenda={() => moveCard(c.id, "fechamento")}
                      onPerda={() => setPerdaCardId(c.id)}
                      onProposta={() => { setWizardCardId(c.id); setWizardOpen(true); }}
                      onImprimir={() => proposta && gerarPropostaPDF(proposta)}
                    />
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setEditCard(null); setDefaultStatus(s.key); setOpenCard(true); }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-primary"
                >
                  + adicionar
                </button>
              </Column>
            ))}
          </div>
        </DndContext>
      </TooltipProvider>

      <CardDialog open={openCard} onOpenChange={setOpenCard} card={editCard} defaultStatus={defaultStatus} />
      <PerdaDialog
        open={!!perdaCardId}
        onOpenChange={(v) => { if (!v) setPerdaCardId(null); }}
        onConfirm={(motivo) => { if (perdaCardId) moveCard(perdaCardId, "perda", { motivoPerda: motivo }); setPerdaCardId(null); }}
      />
      <EnvioDialog
        open={!!envioCardId}
        onOpenChange={(v) => { if (!v) setEnvioCardId(null); }}
        defaultDate={cards.find((c) => c.id === envioCardId)?.dataEnvio || undefined}
        onConfirm={(data) => { if (envioCardId) moveCard(envioCardId, "orcamento_enviado", { dataEnvio: data }); setEnvioCardId(null); }}
      />
      <DetalhesDrawer
        open={!!detalhesCard}
        onOpenChange={(v) => { if (!v) setDetalhesCard(null); }}
        card={detalhesCard}
        onEditProposta={(p) => {
          setDetalhesCard(null);
          setWizardCardId(p.cardId ?? null);
          setWizardProposta(p);
          setWizardOpen(true);
        }}
      />

      <AvancarCardDialog
        open={!!pendingMove}
        onOpenChange={(v) => { if (!v) setPendingMove(null); }}
        statusLabel={pendingMove ? (CARD_STATUSES.find((s) => s.key === pendingMove.status)?.label || "") : ""}
        onConfirm={async ({ responsavelId, responsavelNome, observacao }) => {
          if (!pendingMove) return;
          const { id, status } = pendingMove;
          const card = cards.find((c) => c.id === id);
          moveCard(id, status);
          const statusLabel = CARD_STATUSES.find((s) => s.key === status)?.label || status;
          await notifyResponsavel({
            userId: responsavelId,
            titulo: `Venda: ${statusLabel}`,
            mensagem: `${card?.clienteNome ?? "Card"}${card?.eventoNome ? ` — ${card.eventoNome}` : ""}${observacao ? ` — ${observacao}` : ""}`,
            link: `/comercial?card=${id}`,
            tipo: "comercial_responsavel",
          });
          toast.success(`Card movido. ${responsavelNome} foi notificado.`);
          setPendingMove(null);
        }}
      />

      <PropostaWizard
        open={wizardOpen}
        onOpenChange={(v) => { setWizardOpen(v); if (!v) setWizardCardId(null); }}
        cardId={wizardCardId}
        defaults={(() => {
          const c = cards.find((x) => x.id === wizardCardId);
          if (!c) return undefined;
          const cli = c.clienteId ? null : null;
          return {
            clienteNome: c.clienteNome,
            eventoNome: c.eventoNome,
            eventoDataInicio: c.eventoDataInicio,
            eventoDataFim: c.eventoDataFim,
            responsavel: c.responsavel,
          };
        })()}
      />
    </>
  );
}

function Column({
  statusKey, label, color, count, children,
}: { statusKey: string; label: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col h-full rounded-lg border bg-muted/30 ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function KanbanCard({
  card, hasProposta, onEdit, onDetalhes, onVenda, onPerda, onProposta, onImprimir,
}: {
  card: ComercialCard;
  hasProposta: boolean;
  onEdit: () => void; onDetalhes: () => void; onVenda: () => void; onPerda: () => void; onProposta: () => void; onImprimir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  const cardBody = (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-card p-2.5 text-xs shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none"
          aria-label="Mover"
        >⋮⋮</button>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-foreground">{card.clienteNome}</div>
          {card.eventoNome && <div className="text-[11px] text-muted-foreground truncate">{card.eventoNome}</div>}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {(card.eventoDataInicio || card.eventoDataFim) && <div>Data: {fmtPeriodo(card.eventoDataInicio, card.eventoDataFim)}</div>}
            {card.responsavel && <div>Consultor(a): {card.responsavel}</div>}
            {card.valorEstimado > 0 && (
              <div className="font-medium text-foreground">{brl(card.valorEstimado)}</div>
            )}
          </div>
          {card.status === "perda" && card.motivoPerda && (
            <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] truncate max-w-full">
              Perda: {card.motivoPerda}
            </span>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            <ActionBtn onClick={onVenda} label="Marcar como venda" icon={<CheckCircle2 className="h-3 w-3" />} className="text-emerald-600 hover:bg-emerald-500/10" />
            <ActionBtn onClick={onPerda} label="Marcar como perda" icon={<XCircle className="h-3 w-3" />} className="text-rose-600 hover:bg-rose-500/10" />
            <ActionBtn onClick={onEdit} label="Editar" icon={<Pencil className="h-3 w-3" />} />
            <ActionBtn onClick={onDetalhes} label="Detalhes" icon={<Eye className="h-3 w-3" />} />
            {hasProposta && (
              <ActionBtn onClick={onImprimir} label="Imprimir proposta (PDF)" icon={<Printer className="h-3 w-3" />} className="text-primary hover:bg-primary/10" />
            )}
            {card.status === "projeto" && (
              <button
                type="button"
                onClick={onProposta}
                className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary text-primary-foreground hover:opacity-90"
              >
                <FileText className="h-3 w-3" /> Criar Proposta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (card.status === "perda" && card.motivoPerda) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><div>{cardBody}</div></TooltipTrigger>
        <TooltipContent side="right">{card.motivoPerda}</TooltipContent>
      </Tooltip>
    );
  }
  return cardBody;
}

function ActionBtn({
  onClick, label, icon, className = "",
}: { onClick: () => void; label: string; icon: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted ${className}`}
    >
      {icon}
    </button>
  );
}
