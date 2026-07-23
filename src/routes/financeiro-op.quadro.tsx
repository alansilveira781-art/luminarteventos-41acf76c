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
      const k = c.status_financeiro as FinanceiroStatus;
      if (g[k]) g[k].push(c);
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
        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 items-stretch h-[calc(100dvh-200px)] min-h-[420px]">
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
        "flex-shrink-0 w-72 flex flex-col h-full rounded-lg border bg-muted/30 transition-colors",
        isOver ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-2 w-2 rounded-full", color)} />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{cards.length}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
        {cards.map((c) => (
          <CardItem key={`${c.origem}:${c.id}`} card={c} podeMover={podeMover} onOpen={onOpen} />
        ))}
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">Sem cards</div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-border shrink-0 text-[10px] text-muted-foreground text-right">
        {fmtBRL(total)}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${card.origem}:${card.id}`,
    disabled: !podeMover,
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={() => onOpen(card)}
      {...(podeMover ? { ...listeners, ...attributes } : {})}
      className={cn(
        "rounded-md border border-border bg-card p-2.5 text-xs shadow-sm hover:border-primary/60 transition-colors",
        podeMover ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={cn(
            "text-muted-foreground select-none shrink-0",
            !podeMover && "opacity-40",
          )}
        >
          ⋮⋮
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm truncate text-foreground flex-1 min-w-0">
              {card.titulo ?? "(sem título)"}
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border shrink-0",
                card.origem === "compra"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-accent/10 text-accent border-accent/30",
              )}
            >
              {card.origem === "compra" ? "Compra" : "Despesa"}
            </span>
          </div>
          {card.fornecedor && card.titulo && (
            <div className="text-[11px] text-muted-foreground truncate">{card.fornecedor}</div>
          )}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {card.numero != null && (
              <div className="font-mono text-muted-foreground">
                {card.origem === "compra" ? `COMPRA-${card.numero}` : `DESPESA-${card.numero}`}
              </div>
            )}
            {card.solicitante && <div>Solic.: {card.solicitante}</div>}
            {card.valor_total != null && (
              <div className="font-medium text-foreground">{fmtBRL(card.valor_total)}</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CardDetalheDialog({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const { data: full } = useQuery({
    enabled: !!card,
    queryKey: ["fin-quadro-full", card?.origem, card?.id],
    queryFn: async () => {
      if (!card) return null;
      const table = card.origem === "compra" ? "compras" : "demandas";
      const { data } = await sb.from(table).select("*").eq("id", card.id).maybeSingle();
      return data;
    },
  });

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

  const { data: anexos = [] } = useQuery({
    enabled: !!card,
    queryKey: ["fin-quadro-anexos", card?.origem, card?.id],
    queryFn: async () => {
      if (!card) return [];
      const table = card.origem === "compra" ? "compra_anexos" : "demanda_anexos";
      const fk = card.origem === "compra" ? "compra_id" : "demanda_id";
      const { data } = await sb
        .from(table)
        .select("id,nome,path,mime_type,tamanho")
        .eq(fk, card.id);
      return data ?? [];
    },
  });

  if (!card) return null;

  const total = itens.reduce(
    (s: number, it: any) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0,
  );

  const bucket = card.origem === "compra" ? "compra-anexos" : "demanda-anexos";
  const observacoes =
    (full?.observacoes as string | null) ??
    (card.origem === "demanda" ? (full?.descritivo as string | null) : null) ??
    null;

  const fmtDate = (v: string | null | undefined) => {
    if (!v) return null;
    try {
      return new Date(v).toLocaleDateString("pt-BR");
    } catch {
      return v;
    }
  };
  const fmtSize = (n: number | null | undefined) => {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  };

  const abrirAnexo = async (path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  // Monta lista de campos "Dados" — só os com valor
  const nfCampo = full?.numeros_nf ?? full?.numero_nf ?? null;
  const nfStr = Array.isArray(nfCampo) ? nfCampo.filter(Boolean).join(", ") : nfCampo;
  const dados: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: any) => {
    if (value == null || value === "") return;
    dados.push({ label, value: String(value) });
  };
  push("Origem", card.origem === "compra" ? "Compra" : "Despesa");
  push("Número", full?.numero ?? card.numero);
  push("Título", full?.titulo ?? card.titulo);
  push("Status", full?.status);
  push("Status financeiro", full?.status_financeiro);
  push("Fornecedor", full?.fornecedor ?? card.fornecedor);
  push("Solicitante", full?.solicitante ?? card.solicitante);
  push("Comprador", full?.comprador);
  push("Responsável", full?.responsavel_nome);
  push("Data de solicitação", fmtDate(full?.data_solicitacao));
  push("Data da compra", fmtDate(full?.data_compra));
  push("Data do serviço", fmtDate(full?.data_servico));
  push("Forma de pagamento", full?.parcelamento ?? full?.condicao_pagamento);
  push("Documento", full?.documento);
  push("Notas fiscais", nfStr);
  if (card.origem === "compra") {
    push("Tipo de compra", full?.tipo_compra);
    push("Empresa faturada", full?.empresa_faturada);
  } else {
    push("Tipo de despesa", full?.tipo_demanda);
    push("Evento / Projeto", full?.evento_projeto);
  }
  push("Valor total", fmtBRL(full?.valor_total ?? card.valor_total));

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            #{card.numero ?? "—"} — {card.titulo ?? "(sem título)"}
          </DialogTitle>
        </DialogHeader>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Dados
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {dados.map((d) => (
              <Info key={d.label} label={d.label} value={d.value} />
            ))}
          </div>
        </div>

        {observacoes && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Observações
            </div>
            <div className="text-sm whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
              {observacoes}
            </div>
          </div>
        )}

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

        <div className="mt-3">
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Anexos
          </div>
          {anexos.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum anexo</div>
          ) : (
            <ul className="space-y-1.5">
              {anexos.map((a: any) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.nome}</div>
                    {a.tamanho ? (
                      <div className="text-xs text-muted-foreground">{fmtSize(a.tamanho)}</div>
                    ) : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => abrirAnexo(a.path)}>
                    Abrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
