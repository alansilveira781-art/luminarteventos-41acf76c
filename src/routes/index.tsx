import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  XCircle,
  Wrench,
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
  ListChecks,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { movementKindLabels } from "@/lib/labels";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function startOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function Dashboard() {
  const { data: itens } = useQuery({
    queryKey: ["dashboard-itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("itens").select("*").limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const { data: movs } = useQuery({
    queryKey: ["dashboard-movs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo), solicitante:solicitantes(nome), fornecedor:fornecedores(nome)")
        .gte("data_movimento", startOfMonthIso())
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: recentes } = useQuery({
    queryKey: ["dashboard-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo), solicitante:solicitantes(nome), fornecedor:fornecedores(nome)")
        .order("data_movimento", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const total = itens?.length ?? 0;
  const baixo = itens?.filter((i) => i.status === "baixo_estoque").length ?? 0;
  const sem = itens?.filter((i) => i.status === "sem_estoque").length ?? 0;
  const manut = itens?.filter((i) => i.status === "em_manutencao").length ?? 0;
  const entradasMes = movs?.filter((m) => m.tipo === "entrada").length ?? 0;
  const saidasMes = movs?.filter((m) => m.tipo === "saida").length ?? 0;
  const devolucoesMes = movs?.filter((m) => m.tipo === "devolucao").length ?? 0;
  const saidasAbertas = itens
    ? (recentes?.filter(
        (m) => m.tipo === "saida" && (m.saida_status === "aberta" || m.saida_status === "parcialmente_devolvida"),
      ).length ?? 0)
    : 0;

  const baixoItens = itens?.filter((i) => i.status === "baixo_estoque" || i.status === "sem_estoque").slice(0, 6) ?? [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação de estoque · Luminart Eventos"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Package} label="Total de itens" value={total} tone="primary" />
        <Kpi icon={AlertTriangle} label="Baixo estoque" value={baixo} tone="warning" />
        <Kpi icon={XCircle} label="Sem estoque" value={sem} tone="destructive" />
        <Kpi icon={Wrench} label="Em manutenção" value={manut} tone="accent" />
        <Kpi icon={ArrowDownToLine} label="Entradas no mês" value={entradasMes} tone="success" />
        <Kpi icon={ArrowUpFromLine} label="Saídas no mês" value={saidasMes} tone="primary" />
        <Kpi icon={Undo2} label="Devoluções no mês" value={devolucoesMes} tone="accent" />
        <Kpi icon={ListChecks} label="Saídas pendentes" value={saidasAbertas} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Movimentos recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 font-medium">Item</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium text-right">Qtd</th>
                    <th className="py-2 pr-0 font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes?.length ? (
                    recentes.map((m: any) => (
                      <tr key={m.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">
                          {format(new Date(m.data_movimento), "dd/MM HH:mm")}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{m.item?.nome ?? "—"}</td>
                        <td className="py-2.5 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{movementKindLabels[m.tipo]}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          <span className={m.tipo === "saida" ? "text-destructive" : "text-success"}>
                            {m.tipo === "saida" ? "-" : "+"}
                            {Number(m.quantidade)}
                          </span>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {m.solicitante?.nome ?? m.fornecedor?.nome ?? "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nenhum movimento registrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas de estoque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {baixoItens.length ? (
              baixoItens.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(i.quantidade_atual)} {i.unidade} · mín {Number(i.quantidade_minima)}
                    </div>
                  </div>
                  <StatusBadge status={i.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Tudo sob controle.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "primary" | "warning" | "destructive" | "accent" | "success";
}) {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    accent: "text-accent bg-accent/10",
    success: "text-success bg-success/10",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
