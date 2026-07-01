import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight } from "lucide-react";
import { DemandaDialog } from "@/components/DemandaDialog";
import { AvancarCardDialog } from "@/components/AvancarCardDialog";
import { notifyResponsavel } from "@/lib/notify";
import { DEMANDA_STATUSES, type DemandaStatus } from "@/lib/demandas";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

const sb = supabase as any;

export const Route = createFileRoute("/financeiro/")({
  component: DemandasKanban,
});

type Demanda = {
  id: string;
  numero: number | null;
  status: DemandaStatus;
  titulo: string | null;
  solicitante: string | null;
  fornecedor: string | null;
  comprador: string | null;
  data_solicitacao: string | null;
  data_compra: string | null;
  valor_total: number | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
};

function DemandasKanban() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<DemandaStatus>("solicitacao");
  const [q, setQ] = useState("");
  const [pendingMove, setPendingMove] = useState<{ id: string; status: DemandaStatus; titulo: string } | null>(null);

  // Abre o card automaticamente quando a URL tem ?id=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) { setEditId(id); setOpen(true); }
  }, []);

  function abrirCard(id: string) {
    setEditId(id);
    setOpen(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id);
      window.history.replaceState({}, "", url.toString());
    }
  }
  function limparUrlCard() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  }


  const { data: demandas = [] } = useQuery({
    queryKey: ["demandas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select("id,numero,status,titulo,solicitante,fornecedor,comprador,data_solicitacao,data_compra,valor_total,responsavel_id,responsavel_nome")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demanda[];
    },
  });

  const { data: statusDefaults = [] } = useQuery({
    queryKey: ["financeiro_status_defaults"],
    queryFn: async () => {
      const { data } = await sb
        .from("financeiro_status_defaults")
        .select("status, responsavel_id, responsavel_nome");
      return (data ?? []) as { status: DemandaStatus; responsavel_id: string | null; responsavel_nome: string | null }[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return demandas;
    return demandas.filter((c) => {
      const num = c.numero != null ? `demanda-${c.numero}` : "";
      return [num, String(c.numero ?? ""), c.titulo, c.solicitante, c.fornecedor, c.comprador]
        .some((v) => String(v ?? "").toLowerCase().includes(s));
    });
  }, [demandas, q]);

  const byStatus = useMemo(() => {
    const m: Record<DemandaStatus, Demanda[]> = {} as any;
    DEMANDA_STATUSES.forEach((s) => (m[s.key] = []));
    filtered.forEach((c) => {
      (m[c.status] ??= []).push(c);
    });
    return m;
  }, [filtered]);

  const moveStatus = useMutation({
    mutationFn: async (vars: { id: string; status: DemandaStatus; responsavelId?: string | null; responsavelNome?: string | null }) => {
      const patch: any = { status: vars.status };
      if (vars.responsavelId) {
        patch.responsavel_id = vars.responsavelId;
        patch.responsavel_nome = vars.responsavelNome ?? null;
      }
      const { error } = await sb.from("demandas").update(patch).eq("id", vars.id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["demandas"] });
      const prev = qc.getQueryData<Demanda[]>(["demandas"]);
      qc.setQueryData<Demanda[]>(["demandas"], (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, status } : c)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["demandas"], ctx.prev);
      toast.error("Não foi possível mover o card");
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function nextStatus(s: DemandaStatus): DemandaStatus | null {
    const idx = DEMANDA_STATUSES.findIndex((x) => x.key === s);
    if (idx < 0) return null;
    for (let i = idx + 1; i < DEMANDA_STATUSES.length; i++) {
      const k = DEMANDA_STATUSES[i].key;
      if (k === "negada") continue;
      return k;
    }
    return null;
  }

  async function advanceToStatus(
    demanda: Demanda,
    status: DemandaStatus,
    opts?: { force?: boolean; toastMsg?: string },
  ) {
    if (demanda.status === status) return;
    const id = demanda.id;
    const statusLabel = DEMANDA_STATUSES.find((s) => s.key === status)?.label || status;
    const titulo = demanda.titulo || demanda.fornecedor || `Demanda ${demanda.numero ?? ""}`;

    const def = statusDefaults.find((d) => d.status === status && d.responsavel_id);
    if (def?.responsavel_id) {
      moveStatus.mutate({
        id,
        status,
        responsavelId: def.responsavel_id,
        responsavelNome: def.responsavel_nome,
      });
      notifyResponsavel({
        userId: def.responsavel_id,
        titulo: `Despesa: ${statusLabel}`,
        mensagem: titulo,
        link: `/financeiro?id=${id}`,
        tipo: "compra_responsavel",
      }).catch(() => {});
      toast.success(opts?.toastMsg ?? `Card movido. ${def.responsavel_nome ?? "Responsável"} foi notificado.`);
      return;
    }
    if (opts?.force) {
      moveStatus.mutate({ id, status });
      toast.success(opts.toastMsg ?? "Card movido.");
      return;
    }
    setPendingMove({ id, status, titulo });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    let status: DemandaStatus | undefined;
    if (DEMANDA_STATUSES.some((s) => s.key === overId)) {
      status = overId as DemandaStatus;
    } else {
      const overDemanda = demandas.find((c) => c.id === overId);
      status = overDemanda?.status;
    }
    if (!status) return;
    const d = demandas.find((c) => c.id === id);
    if (!d || d.status === status) return;
    advanceToStatus(d, status);
  }

  return (
    <>
      <PageHeader
        title="Quadro de Despesas"
        description="Arraste os cards entre as colunas para alterar o status"
        actions={
          <Button onClick={() => { setEditId(null); setDefaultStatus("solicitacao"); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova demanda
          </Button>
        }
      />

      <div className="mb-3 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, título, fornecedor, solicitante…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {q.trim() ? (
        <div className="rounded-lg border border-border bg-card divide-y divide-border max-h-[calc(100vh-180px)] overflow-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">Nenhum card encontrado.</div>
          )}
          {filtered.map((c) => {
            const statusInfo = DEMANDA_STATUSES.find((s) => s.key === c.status);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setEditId(c.id); setOpen(true); }}
                className="w-full text-left p-3 hover:bg-muted/50 flex items-center gap-3 text-sm"
              >
                <span className="text-[11px] font-mono text-muted-foreground w-24 shrink-0">
                  {c.numero != null ? `DEMANDA-${c.numero}` : "—"}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">
                  {c.titulo || c.fornecedor || "Demanda sem título"}
                </span>
                {statusInfo && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <span className={`h-2 w-2 rounded-full ${statusInfo.color}`} />
                    <span className="hidden sm:inline">{statusInfo.label}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 items-stretch h-[calc(100dvh-200px)] min-h-[420px]">
          {DEMANDA_STATUSES.map((s) => (
            <Column key={s.key} statusKey={s.key} label={s.label} color={s.color} count={byStatus[s.key]?.length ?? 0}>
              {(byStatus[s.key] ?? []).map((c) => {
                const next = nextStatus(c.status);
                return (
                  <Card
                    key={c.id}
                    demanda={c}
                    onOpen={() => { setEditId(c.id); setOpen(true); }}
                    nextStatusLabel={next ? (DEMANDA_STATUSES.find((x) => x.key === next)?.label ?? null) : null}
                    onAdvance={next ? () => advanceToStatus(c, next) : undefined}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => { setEditId(null); setDefaultStatus(s.key); setOpen(true); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-primary"
              >
                + adicionar
              </button>
            </Column>
          ))}
        </div>
      </DndContext>
      )}

      <DemandaDialog
        open={open}
        onOpenChange={setOpen}
        demandaId={editId}
        defaultStatus={defaultStatus}
        onAdvance={async (demandaData, opts) => {
          const target = opts?.deny
            ? "negada"
            : opts?.approve
            ? "aprovada"
            : nextStatus(demandaData.status as DemandaStatus);
          if (!target) return;
          await advanceToStatus(demandaData as unknown as Demanda, target as DemandaStatus, {
            force: !!(opts?.approve || opts?.deny),
            toastMsg: opts?.approve
              ? "Demanda aprovada."
              : opts?.deny
              ? "Demanda reprovada."
              : undefined,
          });
          setOpen(false);
        }}
      />

      <AvancarCardDialog
        open={!!pendingMove}
        onOpenChange={(v) => { if (!v) setPendingMove(null); }}
        statusLabel={pendingMove ? (DEMANDA_STATUSES.find((s) => s.key === pendingMove.status)?.label || "") : ""}
        onConfirm={async ({ responsavelId, responsavelNome, observacao }) => {
          if (!pendingMove) return;
          const { id, status, titulo } = pendingMove;
          const statusLabel = DEMANDA_STATUSES.find((s) => s.key === status)?.label || status;
          moveStatus.mutate({ id, status, responsavelId, responsavelNome });
          notifyResponsavel({
            userId: responsavelId,
            titulo: `Despesa: ${statusLabel}`,
            mensagem: `${titulo}${observacao ? ` — ${observacao}` : ""}`,
            link: `/financeiro?id=${id}`,
            tipo: "compra_responsavel",
          }).catch(() => {});
          toast.success(`Card movido. ${responsavelNome} foi notificado.`);
          setPendingMove(null);
        }}
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
      className={`flex-shrink-0 w-72 rounded-lg border bg-muted/30 flex flex-col ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto min-h-[120px]">{children}</div>
    </div>
  );
}

function Card({
  demanda, onOpen, onAdvance, nextStatusLabel,
}: {
  demanda: Demanda;
  onOpen: () => void;
  onAdvance?: () => void;
  nextStatusLabel?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: demanda.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
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
        <button type="button" onClick={onOpen} className="flex-1 text-left min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm truncate text-foreground flex-1 min-w-0">
              {demanda.titulo || demanda.fornecedor || "Demanda sem título"}
            </div>
            {demanda.numero != null && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                DEMANDA-{demanda.numero}
              </span>
            )}
          </div>
          {demanda.fornecedor && demanda.titulo && (
            <div className="text-[11px] text-muted-foreground truncate">{demanda.fornecedor}</div>
          )}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {demanda.solicitante && <div>Solic.: {demanda.solicitante}</div>}
            {demanda.comprador && <div>Comprador: {demanda.comprador}</div>}
            {demanda.responsavel_nome && <div>Resp.: {demanda.responsavel_nome}</div>}
            <div>{demanda.data_compra ? `Compra/Serviço: ${formatDate(demanda.data_compra)}` : "Não comprado"}</div>
            {demanda.valor_total != null && (
              <div className="font-medium text-foreground">
                {Number(demanda.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            )}
          </div>
        </button>
        {onAdvance && nextStatusLabel && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdvance(); }}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-primary transition-colors"
            title={`Avançar para "${nextStatusLabel}"`}
            aria-label={`Avançar para ${nextStatusLabel}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(d: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}
