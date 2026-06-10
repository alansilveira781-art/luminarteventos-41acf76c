import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, LabelList, Cell,
} from "recharts";
import { DollarSign, BarChart2, Tag, Target } from "lucide-react";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { GaugeRealVsMeta } from "@/components/comercial/dashboard/GaugeRealVsMeta";
import { useDashboard } from "./comercial.dashboard";
import {
  evolucaoTrimestre,
  kpis,
  rankingConsultor,
  valorPorClassificacao,
} from "@/lib/comercial/vendas-metrics";

export const Route = createFileRoute("/comercial/dashboard/painel")({
  component: PainelVendas,
});

const META_DEFAULT = 12_000_000;

const brlShort = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)} Mi` : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)} Mil` : `R$ ${v.toFixed(0)}`;

function PainelVendas() {
  const { filtered, previous } = useDashboard();
  const k = useMemo(() => kpis(filtered, previous), [filtered, previous]);
  const evol = useMemo(() => evolucaoTrimestre(filtered), [filtered]);
  const consultores = useMemo(() => rankingConsultor(filtered).slice(0, 8), [filtered]);
  const classific = useMemo(() => valorPorClassificacao(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Vendas Totais" valor={k.vendasTotais} Icon={DollarSign} anterior={k.vendasAnterior} pct={k.pctVendas} />
        <KpiCard titulo="Quantidade de Vendas" valor={k.quantidade} Icon={BarChart2} isMoney={false} anterior={k.quantidadeAnterior} pct={k.pctQuantidade} />
        <KpiCard titulo="Desconto" valor={k.desconto} Icon={Tag} anterior={k.descontoAnterior} pct={k.pctDesconto} />
        <KpiCard titulo="Ticket Médio" valor={k.ticketMedio} Icon={Target} anterior={k.ticketAnterior} pct={k.pctTicket} />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-2">Evolução de Vendas [Trimestre]</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evol}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="trim" />
                <YAxis tickFormatter={brlShort} width={70} />
                <Tooltip formatter={(v: number) => brlShort(v)} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }}>
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Ranking Consultores</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consultores} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={80} />
                <Tooltip formatter={(v: number) => brlShort(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-2">Evolução do Ticket Médio [Trimestre]</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evol}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="trim" />
                <YAxis yAxisId="left" tickFormatter={brlShort} width={70} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="ticket" name="Ticket Médio" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="qtde" name="Qtde de Vendas" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Valor Final por Classificação</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classific} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={90} />
                <Tooltip formatter={(v: number) => brlShort(v)} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {classific.map((_, i) => <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />)}
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2" />
        <GaugeRealVsMeta valor={k.vendasTotais} meta={META_DEFAULT} />
      </div>
    </div>
  );
}
