import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { FINANCEIRO_STATUSES, type FinanceiroStatus } from "@/lib/financeiro-quadro";

export const Route = createFileRoute("/financeiro-op/quadro")({
  component: QuadroFinanceiro,
});

const sb = supabase as any;

type Origem = "compra" | "demanda";

type Card = {
  id: string;
  origem: Origem;
  numero: number | null;
  titulo: string | null;
  fornecedor: string | null;
  solicitante: string | null;
  valor_total: number | null;
  status_financeiro: FinanceiroStatus;
  financeiro_ordem: number | null;
};

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function QuadroFinanceiro() {
  const { isAdmin, hasModule, loading } = useAuth();
  const podeMover = isAdmin || hasModule("financeiro_op");

  const qc = useQueryClient();
  const [selected, setSelected] = useState<Card | null>(null);

  const { data: compras = [] } = useQuery({
    queryKey: ["fin-quadro", "compras"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select(
          "id,numero,titulo,fornecedor,solicitante,valor_total,status_financeiro,financeiro_ordem",
        )
        .not("status_financeiro", "is", null);
      if (error) throw error;
      return (data ?? []).map(
        (r: any): Card => ({
          id: r.id,
          origem: "compra",
          numero: r.numero,
          titulo: r.titulo,
          fornecedor: r.fornecedor,
          solicitante: r.solicitante,
          valor_total: r.valor_total,
          status_financeiro: r.status_financeiro,
          financeiro_ordem: r.financeiro_ordem,
        }),
      );
    },
  });

  const { data: demandas = [] } = useQuery({
    queryKey: ["fin-quadro", "demandas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select(
          "id,numero,titulo,fornecedor,solicitante,valor_total,status_financeiro,financeiro_ordem",
        )
        .not("status_financeiro", "is", null);
      if (error) throw error;
      return (data ?? []).map(
        (r: any): Card => ({
          id: r.id,
          origem: "demanda",
          numero: r.numero,
          titulo: r.titulo,
          fornecedor: r.fornecedor,
          solicitante: r.solicitante,
          valor_total: r.valor_total,
          status_financeiro: r.status_financeiro,
          financeiro_ordem: r.financeiro_ordem,
        }),
      );
    },
  });

  const cards = useMemo(() => [...compras, ...demandas], [compras, demandas]);

  const grouped = useMemo(() => {
    const g: Record<FinanceiroStatus, Card[]> = {
      caixa_entrada: [],
      analise_financeira: [],
      lancamento: [],
      finalizado_fin: [],
    };
    for (const c of cards) {
      if (g[c.status_financeiro]) g[c.status_financeiro].push(c);
    }
    for (const k of Object.keys(g) as FinanceiroStatus[]) {
      g[k].sort((a, b) => {
        const oa = a.financeiro_ordem ?? Number.MAX_SAFE_INTEGER;
        const ob = b.financeiro_ordem ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return (b.numero ?? 0) - (a.numero ?? 0);
      });
    }
    return g;
  }, [cards]);

  const mover = useMutation({
    mutationFn: async (args: { card: Card; to: FinanceiroStatus }) => {
      const { card, to } = args;
      const table = card.origem === "compra" ? "compras" : "demandas";
      const { error } = await sb
        .from(table)
        .update({ status_financeiro: to, financeiro_ordem: Date.now() })
        .eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-quadro"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao mover card"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!podeMover) return;
    const to = e.over?.id as FinanceiroStatus | undefined;
    const activeId = String(e.active.id);
    if (!to) return;
    const card = cards.find((c) => `${c.origem}:${c.id}` === activeId);
    if (!card || card.status_financeiro === to) return;
    mover.mutate({ card, to });
  };

  if (loading) return null;
  if (!isAdmin && !hasModule("financeiro_op")) return <Navigate to="/" />;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Quadro Financeiro"
        description="Compras e despesas finalizadas seguindo o fluxo financeiro"
      />

      {!podeMover && (
        <div className="text-xs text-muted-foreground">
          Você está no modo somente leitura. Apenas usuários do módulo Financeiro podem mover
          cards.
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {FINANCEIRO_STATUSES.map((s) => (
            <Coluna
              key={s.key}
              status={s.key}
              label={s.label}
              color={s.color}
              cards={grouped[s.key]}
              podeMover={podeMover}
              onOpen={setSelected}
            />
          ))}
        </div>
      </DndContext>

      <CardDetalheDialog card={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Coluna({
  status,
  label,
  color,
  cards,
  podeMover,
  onOpen,
}: {
  status: FinanceiroStatus;
  label: string;
  color: string;
  cards: Card[];
  podeMover: boolean;
  onOpen: (c: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = cards.reduce((s, c) => s + (Number(c.valor_total) || 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-muted/20 p-3 min-h-[300px] transition-colors",
        isOver && "bg-primary/5 border-primary/50",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", color)} />
          <div className="text-sm font-semibold">{label}</div>
          <span className="text-xs text-muted-foreground">({cards.length})</span>
        </div>
        <div className="text-xs text-muted-foreground">{fmtBRL(total)}</div>
      </div>
      <div className="space-y-2">
        {cards.map((c) => (
          <CardItem key={`${c.origem}:${c.id}`} card={c} podeMover={podeMover} onOpen={onOpen} />
        ))}
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">Sem cards</div>
        )}
      </div>
    </div>
  );
}

function CardItem({
  card,
  podeMover,
  onOpen,
}: {
  card: Card;
  podeMover: boolean;
  onOpen: (c: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${card.origem}:${card.id}`,
    disabled: !podeMover,
  });
  return (
    <Card
      ref={setNodeRef}
      {...(podeMover ? { ...listeners, ...attributes } : {})}
      onClick={() => onOpen(card)}
      className={cn(
        "p-3 cursor-pointer hover:border-primary/60 transition-colors bg-background",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-mono text-muted-foreground">#{card.numero ?? "—"}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
            card.origem === "compra"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-accent/10 text-accent border-accent/30",
          )}
        >
          {card.origem === "compra" ? "Compra" : "Despesa"}
        </span>
      </div>
      <div className="text-sm font-semibold truncate">{card.titulo ?? "(sem título)"}</div>
      {card.fornecedor && (
        <div className="text-xs text-muted-foreground truncate mt-0.5">{card.fornecedor}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="text-[11px] text-muted-foreground truncate">{card.solicitante ?? "—"}</div>
        <div className="text-xs font-semibold">{fmtBRL(card.valor_total)}</div>
      </div>
    </Card>
  );
}

function CardDetalheDialog({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const { data: itens = [] } = useQuery({
    enabled: !!card,
    queryKey: ["fin-quadro-itens", card?.origem, card?.id],
    queryFn: async () => {
      if (!card) return [];
      const table = card.origem === "compra" ? "compra_itens" : "demanda_itens";
      const fk = card.origem === "compra" ? "compra_id" : "demanda_id";
      const { data } = await sb
        .from(table)
        .select("id,descricao,quantidade,unidade,valor_unitario")
        .eq(fk, card.id);
      return data ?? [];
    },
  });

  if (!card) return null;

  const total = itens.reduce(
    (s: number, it: any) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0,
  );

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            #{card.numero ?? "—"} — {card.titulo ?? "(sem título)"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Origem" value={card.origem === "compra" ? "Compra" : "Despesa"} />
          <Info label="Fornecedor" value={card.fornecedor ?? "—"} />
          <Info label="Solicitante" value={card.solicitante ?? "—"} />
          <Info label="Valor total" value={fmtBRL(card.valor_total)} />
        </div>

        {itens.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Itens
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead className="text-right">V. Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it: any) => {
                    const sub =
                      (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{it.descricao}</TableCell>
                        <TableCell className="text-right">{it.quantidade}</TableCell>
                        <TableCell>{it.unidade ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmtBRL(it.valor_unitario)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(sub)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtBRL(total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
