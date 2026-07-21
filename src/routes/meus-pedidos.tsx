import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { COMPRA_STATUSES, type CompraStatus } from "@/lib/compras";
import { DEMANDA_STATUSES } from "@/lib/demandas";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/meus-pedidos")({
  component: MeusPedidos,
});

const sb = supabase as any;

const STEPS: CompraStatus[] = [
  "solicitacao",
  "analise",
  "pendente_aprovacao",
  "aprovada",
  "em_andamento",
  "a_receber",
  "finalizado",
];

type Pedido = {
  id: string;
  tipo: "compra" | "demanda";
  numero: number | null;
  status: CompraStatus;
  titulo: string | null;
  solicitante: string | null;
  fornecedor: string | null;
  valor_total: number | null;
  data_solicitacao: string | null;
  updated_at: string | null;
  categoria: string | null;
  observacoes: string | null;
  motivo_negacao: string | null;
};

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR");
}

function labelFor(tipo: "compra" | "demanda", status: CompraStatus) {
  const src = tipo === "compra" ? COMPRA_STATUSES : DEMANDA_STATUSES;
  return src.find((s) => s.key === status)?.label ?? status;
}
function colorFor(tipo: "compra" | "demanda", status: CompraStatus) {
  const src = tipo === "compra" ? COMPRA_STATUSES : DEMANDA_STATUSES;
  return src.find((s) => s.key === status)?.color ?? "bg-muted";
}

function MeusPedidos() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [hideFinalizados, setHideFinalizados] = useState(false);

  const email = (user?.email ?? "").trim().toLowerCase();
  const uid = user?.id ?? "";
  const emailLocal = email.includes("@") ? email.split("@")[0] : "";

  const { data: perfil } = useQuery({
    enabled: !!user,
    queryKey: ["meus-pedidos-perfil", uid],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("display_name")
        .eq("id", uid)
        .maybeSingle();
      return data as { display_name: string | null } | null;
    },
  });
  const displayName = (perfil?.display_name ?? "").trim();

  const orParts: string[] = [];
  if (uid) {
    orParts.push(`solicitante_id.eq.${uid}`, `created_by.eq.${uid}`);
  }
  if (email) {
    orParts.push(`solicitante.ilike.%${email}%`, `observacoes.ilike.%${email}%`);
  }
  if (emailLocal && emailLocal !== email) {
    orParts.push(`solicitante.ilike.%${emailLocal}%`);
  }
  if (displayName) {
    orParts.push(`solicitante.ilike.%${displayName}%`);
  }
  const orFilter = orParts.join(",");

  const { data: compras = [] } = useQuery({
    enabled: !!user && !!orFilter,
    queryKey: ["meus-pedidos", "compras", uid, email, displayName],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select(
          "id,numero,status,titulo,solicitante,fornecedor,valor_total,data_solicitacao,updated_at,tipo_compra,observacoes,motivo_negacao",
        )
        .or(orFilter)
        .order("data_solicitacao", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (r: any): Pedido => ({
          id: r.id,
          tipo: "compra",
          numero: r.numero,
          status: r.status,
          titulo: r.titulo,
          solicitante: r.solicitante,
          fornecedor: r.fornecedor,
          valor_total: r.valor_total,
          data_solicitacao: r.data_solicitacao,
          updated_at: r.updated_at,
          categoria: r.tipo_compra,
          observacoes: r.observacoes,
          motivo_negacao: r.motivo_negacao,
        }),
      );
    },
  });

  const { data: demandas = [] } = useQuery({
    enabled: !!user && !!orFilter,
    queryKey: ["meus-pedidos", "demandas", uid, email, displayName],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select(
          "id,numero,status,titulo,solicitante,fornecedor,valor_total,data_solicitacao,updated_at,tipo_demanda,observacoes,motivo_negacao,descritivo",
        )
        .or(orFilter)
        .order("data_solicitacao", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (r: any): Pedido => ({
          id: r.id,
          tipo: "demanda",
          numero: r.numero,
          status: r.status,
          titulo: r.titulo,
          solicitante: r.solicitante,
          fornecedor: r.fornecedor,
          valor_total: r.valor_total,
          data_solicitacao: r.data_solicitacao,
          updated_at: r.updated_at,
          categoria: r.tipo_demanda,
          observacoes: r.observacoes ?? r.descritivo,
          motivo_negacao: r.motivo_negacao,
        }),
      );
    },
  });

  const pedidos = useMemo(() => {
    const all = [...compras, ...demandas].sort((a, b) => {
      const da = a.data_solicitacao ?? "";
      const db = b.data_solicitacao ?? "";
      return db.localeCompare(da);
    });
    return hideFinalizados ? all.filter((p) => p.status !== "finalizado") : all;
  }, [compras, demandas, hideFinalizados]);

  if (!user) {
    return (
      <>
        <PageHeader title="Meus Pedidos" description="Acompanhamento das suas solicitações" />
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Faça login para ver seus pedidos.
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Meus Pedidos"
        description="Acompanhe o andamento das suas solicitações"
      />

      <div className="flex items-center gap-2 mb-3">
        <input
          id="hide-finalizados"
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={hideFinalizados}
          onChange={(e) => setHideFinalizados(e.target.checked)}
        />
        <label htmlFor="hide-finalizados" className="text-sm cursor-pointer select-none">
          Ocultar Finalizados
        </label>
      </div>

      {pedidos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Você ainda não tem pedidos.
        </Card>
      ) : (
        <div className="grid gap-4">
          {pedidos.map((p) => (
            <PedidoCard key={`${p.tipo}-${p.id}`} pedido={p} onOpen={() => setSelected(p)} />
          ))}
        </div>
      )}

      <PedidoDetalheDialog pedido={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function PedidoCard({ pedido, onOpen }: { pedido: Pedido; onOpen: () => void }) {
  const statusLabel = labelFor(pedido.tipo, pedido.status);
  const statusColor = colorFor(pedido.tipo, pedido.status);
  const isNegada = pedido.status === "negada";

  return (
    <Card
      className="p-4 cursor-pointer hover:border-primary/60 transition-colors"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">
              #{pedido.numero ?? "—"}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
                pedido.tipo === "compra"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-accent/10 text-accent border-accent/30",
              )}
            >
              {pedido.tipo === "compra" ? "Compra" : "Despesa"}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white",
                statusColor,
              )}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold truncate">
            {pedido.titulo ?? "(sem título)"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {pedido.fornecedor ? `${pedido.fornecedor} • ` : ""}
            {fmtBRL(pedido.valor_total)}
          </div>
        </div>
      </div>

      <StatusStepper status={pedido.status} tipo={pedido.tipo} negada={isNegada} />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Solicitado em {fmtDate(pedido.data_solicitacao)}</span>
        <span>Última atualização {fmtDateTime(pedido.updated_at)}</span>
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-1">
        Datas intermediárias são aproximadas.
      </div>
    </Card>
  );
}

function StatusStepper({
  status,
  tipo,
  negada,
}: {
  status: CompraStatus;
  tipo: "compra" | "demanda";
  negada: boolean;
}) {
  const currentIdx = negada ? STEPS.indexOf("pendente_aprovacao") : STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const current = !negada && i === currentIdx;
        const future = i > currentIdx;
        const color = colorFor(tipo, s);
        return (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all",
                  done && color,
                  current && cn(color, "ring-2 ring-offset-2 ring-offset-background ring-primary"),
                  future && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div
                className={cn(
                  "text-[9px] whitespace-nowrap max-w-[70px] text-center leading-tight",
                  current ? "font-bold text-foreground" : "text-muted-foreground",
                )}
              >
                {labelFor(tipo, s)}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-4 sm:w-6 mb-4",
                  i < currentIdx ? "bg-primary/60" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
      {negada && (
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <div className="h-0.5 w-4 sm:w-6 bg-destructive/60 mb-4" />
          <div className="flex flex-col items-center gap-1">
            <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center text-white">
              <X className="h-3 w-3" />
            </div>
            <div className="text-[9px] font-bold text-destructive leading-tight">Negada</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PedidoDetalheDialog({
  pedido,
  onClose,
}: {
  pedido: Pedido | null;
  onClose: () => void;
}) {
  const { data: itens = [] } = useQuery({
    enabled: !!pedido,
    queryKey: ["meus-pedidos-itens", pedido?.tipo, pedido?.id],
    queryFn: async () => {
      if (!pedido) return [];
      const table = pedido.tipo === "compra" ? "compra_itens" : "demanda_itens";
      const fk = pedido.tipo === "compra" ? "compra_id" : "demanda_id";
      const { data, error } = await sb
        .from(table)
        .select("id,descricao,quantidade,unidade,valor_unitario")
        .eq(fk, pedido.id);
      if (error) return [];
      return data ?? [];
    },
  });

  if (!pedido) return null;

  const total = itens.reduce(
    (s: number, it: any) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0,
  );

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            #{pedido.numero ?? "—"} — {pedido.titulo ?? "(sem título)"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Tipo" value={pedido.tipo === "compra" ? "Compra" : "Despesa"} />
            <Info label="Categoria" value={pedido.categoria ?? "—"} />
            <Info label="Fornecedor" value={pedido.fornecedor ?? "—"} />
            <Info label="Solicitante" value={pedido.solicitante ?? "—"} />
            <Info label="Valor total" value={fmtBRL(pedido.valor_total)} />
            <Info label="Status" value={labelFor(pedido.tipo, pedido.status)} />
            <Info label="Solicitado em" value={fmtDate(pedido.data_solicitacao)} />
            <Info label="Última atualização" value={fmtDateTime(pedido.updated_at)} />
          </div>

          {pedido.status === "negada" && pedido.motivo_negacao && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <div className="text-xs font-semibold text-destructive mb-1">Motivo da negação</div>
              <div className="text-sm">{pedido.motivo_negacao}</div>
            </div>
          )}

          {itens.length > 0 ? (
            <div>
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
                      const sub = (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0);
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
          ) : (
            pedido.observacoes && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Descritivo / Observações
                </div>
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {pedido.observacoes}
                </div>
              </div>
            )
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
