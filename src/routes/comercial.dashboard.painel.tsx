import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useDashboard } from "@/lib/comercial/dashboard-context";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { GaugeRealVsMeta } from "@/components/comercial/dashboard/GaugeRealVsMeta";
import {
  kpis, evolucaoTrimestre, evolucaoTicketTrimestre,
  rankingConsultor, valorPorClassificacao,
} from "@/lib/comercial/vendas-metrics";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, ShoppingCart, Percent, Receipt } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
  BarChart, Bar, Legend,
} from "recharts";

export const Route = createFileRoute("/comercial/dashboard/painel")({
  component: PainelPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const brlAbrev = (v: number) => {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Mi`;
  if (n >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mil`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

type MetaRow = { ano: number; mes: number; classificacao: string; valor_meta: number };

function PainelPage() {
  const { rows, filtered, previous, filtros, setFiltros } = useDashboard();

  // O Painel só expõe Empresa/Ano/Mês. Reseta filtros invisíveis sempre que
  // estiverem ativos (inclusive após hidratação tardia do localStorage),
  // evitando "tudo zerado" por filtro escondido vindo de outra aba.
  useEffect(() => {
    if (
      filtros.consultor !== "Todos" ||
      filtros.classificacao !== "Todos" ||
      filtros.trimestre !== "Todos"
    ) {
      setFiltros({
        ...filtros,
        consultor: "Todos",
        classificacao: "Todos",
        trimestre: "Todos",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.consultor, filtros.classificacao, filtros.trimestre]);

  // Garante um ano válido com dados. Se "Todos", seleciona o ano corrente
  // quando houver dados; senão cai para o ano mais recente com vendas.
  useEffect(() => {
    if (!rows.length) return;
    const anosComDados = new Set<number>();
    for (const r of rows) {
      const a =
        (r.anoEvento && r.anoEvento > 1900 ? r.anoEvento : null) ??
        (r.ano && r.ano > 1900 ? r.ano : null);
      if (a) anosComDados.add(a);
    }
    if (anosComDados.size === 0) return;
    const anoAtual = new Date().getFullYear();
    const ultimo = [...anosComDados].sort((a, b) => b - a)[0];
    if (filtros.ano === "Todos") {
      const alvo = anosComDados.has(anoAtual) ? anoAtual : ultimo;
      setFiltros({ ...filtros, ano: alvo });
    } else if (!anosComDados.has(filtros.ano as number)) {
      setFiltros({ ...filtros, ano: ultimo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, filtros.ano]);

  const k = useMemo(() => kpis(filtered, previous), [filtered, previous]);

  const evolVendas = useMemo(() => evolucaoTrimestre(filtered), [filtered]);
  const evolTicket = useMemo(() => evolucaoTicketTrimestre(filtered), [filtered]);
  const ranking = useMemo(() => rankingConsultor(filtered).slice(0, 8), [filtered]);
  const porClass = useMemo(() => valorPorClassificacao(filtered), [filtered]);

  // Metas: ano selecionado (ou todos)
  const metaAno = filtros.ano === "Todos" ? null : (filtros.ano as number);
  const { data: metas = [] } = useQuery({
    queryKey: ["comercial-metas", metaAno ?? "all"],
    queryFn: async () => {
      let q = supabase.from("comercial_metas").select("ano,mes,classificacao,valor_meta");
      if (metaAno) q = q.eq("ano", metaAno);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  const metaPeriodo = useMemo(() => {
    const mesIdx = filtros.mes === "Todos" ? null : MESES.indexOf(String(filtros.mes)) + 1;
    return metas.reduce((s, m) => {
      if (mesIdx && m.mes !== mesIdx) return s;
      return s + (Number(m.valor_meta) || 0);
    }, 0);
  }, [metas, filtros.mes]);

  const realizado = k.vendasTotais;

  const semDadosFiltrados = rows.length > 0 && filtered.length === 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <FiltrosBar
          rows={rows}
          filtros={filtros}
          onChange={setFiltros}
          fields={["empresa", "ano", "mes"]}
        />
        <div className="mt-2 text-xs text-muted-foreground">
          {rows.length.toLocaleString("pt-BR")} vendas carregadas
          {" · "}
          {filtered.length.toLocaleString("pt-BR")} no filtro atual
        </div>
      </Card>

      {semDadosFiltrados && (
        <Card className="p-4 text-sm border-amber-500/40 bg-amber-500/5">
          Nenhuma venda atende aos filtros selecionados. Ajuste Empresa, Ano ou Mês para visualizar os dados.
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Vendas Totais" Icon={DollarSign}
          valor={k.vendasTotais} anterior={k.vendasAnterior} pct={k.pctVendas} />
        <KpiCard titulo="Quantidade de Vendas" Icon={ShoppingCart} isMoney={false}
          valor={k.quantidade} anterior={k.quantidadeAnterior} pct={k.pctQuantidade} />
        <KpiCard titulo="Desconto" Icon={Percent}
          valor={k.desconto} anterior={k.descontoAnterior} pct={k.pctDesconto} />
        <KpiCard titulo="Ticket Médio" Icon={Receipt}
          valor={k.ticketMedio} anterior={k.ticketAnterior} pct={k.pctTicket} />
      </div>


      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">
              Evolução de Vendas [Trimestre]
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolVendas} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="trim" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis tickFormatter={brlAbrev} stroke="hsl(var(--muted-foreground))" fontSize={11} width={70} />
                  <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }}>
                    <LabelList dataKey="valor" position="top" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">
              Evolução do Ticket Médio [Trimestre]
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolTicket} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="trim" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" tickFormatter={brlAbrev} stroke="hsl(var(--muted-foreground))" fontSize={11} width={70} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} width={40} />
                  <Tooltip
                    formatter={(v: number, name) => name === "Ticket Médio" ? brlAbrev(v) : v.toLocaleString("pt-BR")}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="ticket" name="Ticket Médio"
                    stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="qtde" name="Qtde de Vendas"
                    stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Ranking Consultores</div>
            <div style={{ height: Math.max(180, ranking.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nome" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                    <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Valor Final por Classificação</div>
            <div style={{ height: Math.max(180, porClass.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porClass} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nome" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                    <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <GaugeRealVsMeta valor={realizado} meta={metaPeriodo} />
        </div>
      </div>
    </div>
  );
}
