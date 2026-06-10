import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, LabelList, Cell,
} from "recharts";
import { DollarSign, BarChart2, Target } from "lucide-react";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { useDashboard } from "./comercial.dashboard";
import {
  applyFilters,
  evolucaoTrimestre,
  kpis,
  rankingCerimonial,
  rankingDecorador,
  uniqueValues,
  valorPorClassificacao,
} from "@/lib/comercial/vendas-metrics";

export const Route = createFileRoute("/comercial/dashboard/vendedores")({
  component: Vendedores,
});

const brlShort = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(2)} Mi` : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)} Mil` : `R$ ${v.toFixed(0)}`;

function Vendedores() {
  const { rows, filtered, previous, filtros, setFiltros } = useDashboard();
  const k = useMemo(() => kpis(filtered, previous), [filtered, previous]);
  const evol = useMemo(() => evolucaoTrimestre(filtered), [filtered]);
  const porTipo = useMemo(() => valorPorClassificacao(filtered), [filtered]);
  const cerimonial = useMemo(() => rankingCerimonial(filtered).slice(0, 8), [filtered]);
  const decorador = useMemo(() => rankingDecorador(filtered).slice(0, 8), [filtered]);

  // Consultores disponíveis no recorte atual (ignorando o filtro de consultor)
  const consultoresList = useMemo(() => {
    const semConsultor = applyFilters(rows, { ...filtros, consultor: "Todos" });
    return (uniqueValues(semConsultor, (r) => r.consultor) as string[]).filter(Boolean).sort();
  }, [rows, filtros]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <FiltrosBar rows={rows} filtros={filtros} onChange={setFiltros} fields={["empresa", "ano", "mes"]} />
      </Card>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard titulo="Vendas Totais" valor={k.vendasTotais} Icon={DollarSign} anterior={k.vendasAnterior} pct={k.pctVendas} />
        <KpiCard titulo="Quantidade de Vendas" valor={k.quantidade} Icon={BarChart2} isMoney={false} anterior={k.quantidadeAnterior} pct={k.pctQuantidade} />
        <KpiCard titulo="Ticket Médio" valor={k.ticketMedio} Icon={Target} anterior={k.ticketAnterior} pct={k.pctTicket} />
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Consultores</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltros({ ...filtros, consultor: "Todos" })}
              className={`px-2.5 py-1 rounded-md text-xs border ${filtros.consultor === "Todos" ? "bg-foreground text-background" : "bg-background"}`}
            >
              Todos
            </button>
            {consultoresList.map((c) => (
              <button
                key={c}
                onClick={() => setFiltros({ ...filtros, consultor: c })}
                className={`px-2.5 py-1 rounded-md text-xs border ${filtros.consultor === c ? "bg-foreground text-background" : "bg-background"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </Card>
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
          <div className="text-sm font-medium mb-2">Vendas por tipo de evento</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porTipo} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={90} />
                <Tooltip formatter={(v: number) => brlShort(v)} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {porTipo.map((_, i) => <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />)}
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Vendas por Cerimonial/Agência</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cerimonial} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={100} />
                <Tooltip formatter={(v: number) => brlShort(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Vendas por Decorador</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decorador} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={100} />
                <Tooltip formatter={(v: number) => brlShort(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
