import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { CompraDialog } from "@/components/CompraDialog";
import { COMPRA_STATUSES, type CompraStatus } from "@/lib/compras";
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
import { AvancarCardDialog } from "@/components/AvancarCardDialog";
import { notifyResponsavel } from "@/lib/notify";

const sb = supabase as any;

export const Route = createFileRoute("/compras/")({
  component: ComprasKanban,
});

type Compra = {
  id: string;
  numero: number | null;
  status: CompraStatus;
  titulo: string | null;
  solicitante: string | null;
  fornecedor: string | null;
  comprador: string | null;
  data_solicitacao: string | null;
  data_compra: string | null;
  valor_total: number | null;
};

function ComprasKanban() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<CompraStatus>("solicitacao");
  const [q, setQ] = useState(""); const qd = useDebouncedValue(q, 300);

  const { data: compras = [] } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select("id,numero,status,titulo,solicitante,fornecedor,comprador,data_solicitacao,data_compra,valor_total")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Compra[];
    },
  });

  const filteredCompras = useMemo(() => {
    const s = qd.toLowerCase().trim();
    if (!s) return compras;
    return compras.filter((c) => {
      const num = c.numero != null ? `compra-${c.numero}` : "";
      return [num, String(c.numero ?? ""), c.titulo, c.solicitante, c.fornecedor, c.comprador]
        .some((v) => String(v ?? "").toLowerCase().includes(s));
    });
  }, [compras, qd]);

  const byStatus = useMemo(() => {
    const m: Record<CompraStatus, Compra[]> = {} as any;
    COMPRA_STATUSES.forEach((s) => (m[s.key] = []));
    filteredCompras.forEach((c) => {
      (m[c.status] ??= []).push(c);
    });
    return m;
  }, [filteredCompras]);

  const [pendingMove, setPendingMove] = useState<{ id: string; status: CompraStatus; titulo: string } | null>(null);

  const moveStatus = useMutation({
    mutationFn: async (vars: { id: string; status: CompraStatus; responsavelId?: string; responsavelNome?: string }) => {
      const patch: any = { status: vars.status };
      if (vars.responsavelId) {
        patch.responsavel_id = vars.responsavelId;
        patch.responsavel_nome = vars.responsavelNome;
      }
      const { error } = await sb.from("compras").update(patch).eq("id", vars.id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["compras"] });
      const prev = qc.getQueryData<Compra[]>(["compras"]);
      qc.setQueryData<Compra[]>(["compras"], (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, status } : c)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["compras"], ctx.prev);
      toast.error("Não foi possível mover o card");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const status = overId as CompraStatus;
    const compra = compras.find((c) => c.id === id);
    if (!compra || compra.status === status) return;
    const oldIdx = COMPRA_STATUSES.findIndex((s) => s.key === compra.status);
    const newIdx = COMPRA_STATUSES.findIndex((s) => s.key === status);
    // Avanço (ou status especial): pede responsável. Retorno: muda direto.
    if (newIdx > oldIdx) {
      setPendingMove({ id, status, titulo: compra.titulo || compra.fornecedor || `Compra ${compra.numero ?? ""}` });
    } else {
      moveStatus.mutate({ id, status });
    }
  }


  return (
    <>
      <PageHeader
        title="Compras"
        description="Arraste os cards entre as colunas para alterar o status"
        actions={
          <Button onClick={() => { setEditId(null); setDefaultStatus("solicitacao"); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova compra
          </Button>
        }
      />

      <div className="mb-3 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código (ex: 12), título, fornecedor, solicitante…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {q.trim() ? (
        <div className="rounded-lg border border-border bg-card divide-y divide-border max-h-[calc(100vh-180px)] overflow-auto">
          {filteredCompras.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">Nenhum card encontrado.</div>
          )}
          {filteredCompras.map((c) => {
            const statusInfo = COMPRA_STATUSES.find((s) => s.key === c.status);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setEditId(c.id); setOpen(true); }}
                className="w-full text-left p-3 hover:bg-muted/50 flex items-center gap-3 text-sm"
              >
                <span className="text-[11px] font-mono text-muted-foreground w-24 shrink-0">
                  {c.numero != null ? `COMPRA-${c.numero}` : "—"}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">
                  {c.titulo || c.fornecedor || "Compra sem título"}
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground truncate w-32">
                  {c.fornecedor || "—"}
                </span>
                <span className="hidden md:block text-xs text-muted-foreground truncate w-32">
                  {c.solicitante || "—"}
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
        <div className="flex gap-3 overflow-auto pb-4 max-h-[calc(100vh-140px)] items-start">
          {COMPRA_STATUSES.map((s) => (
            <Column key={s.key} statusKey={s.key} label={s.label} color={s.color} count={byStatus[s.key]?.length ?? 0}>
              {(byStatus[s.key] ?? []).map((c) => (
                <Card key={c.id} compra={c} onOpen={() => { setEditId(c.id); setOpen(true); }} />
              ))}
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

      <CompraDialog open={open} onOpenChange={setOpen} compraId={editId} defaultStatus={defaultStatus} />

      <AvancarCardDialog
        open={!!pendingMove}
        onOpenChange={(v) => { if (!v) setPendingMove(null); }}
        statusLabel={pendingMove ? (COMPRA_STATUSES.find((s) => s.key === pendingMove.status)?.label || "") : ""}
        onConfirm={async ({ responsavelId, responsavelNome, observacao }) => {
          if (!pendingMove) return;
          const { id, status, titulo } = pendingMove;
          const statusLabel = COMPRA_STATUSES.find((s) => s.key === status)?.label || status;
          moveStatus.mutate({ id, status, responsavelId, responsavelNome });
          await notifyResponsavel({
            userId: responsavelId,
            titulo: `Compra: ${statusLabel}`,
            mensagem: `${titulo}${observacao ? ` — ${observacao}` : ""}`,
            link: `/compras?id=${id}`,
            tipo: "compra_responsavel",
          });
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

function Card({ compra, onOpen }: { compra: Compra; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: compra.id });
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
              {compra.titulo || compra.fornecedor || "Compra sem título"}
            </div>
            {compra.numero != null && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                COMPRA-{compra.numero}
              </span>
            )}
          </div>
          {compra.fornecedor && compra.titulo && (
            <div className="text-[11px] text-muted-foreground truncate">{compra.fornecedor}</div>
          )}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {compra.solicitante && <div>Solic.: {compra.solicitante}</div>}
            {compra.comprador && <div>Comprador: {compra.comprador}</div>}
            <div>{compra.data_compra ? `Comprada: ${formatDate(compra.data_compra)}` : "Não comprado"}</div>
            {compra.valor_total != null && (
              <div className="font-medium text-foreground">
                {Number(compra.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function formatDate(d: string) {
  // datas vêm como "YYYY-MM-DD" (tipo date no banco). Evita conversão UTC -> local que muda o dia.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}
