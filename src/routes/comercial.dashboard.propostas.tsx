import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import { FileText, Send, MessageSquare, CheckCircle2, XCircle, Percent, Target } from "lucide-react";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { useDashboard } from "./comercial.dashboard";
import { useComercial } from "@/lib/comercial/store";
import {
  aplicarFiltrosPropostas, kpisPropostas, evolucaoMensalPropostas, rankingConsultorPropostas,
} from "@/lib/comercial/propostas-metrics";
import { propostaTotal, PROPOSTA_STATUS_LABEL } from "@/lib/comercial/types";

export const Route = createFileRoute("/comercial/dashboard/propostas")({
  component: PropostasDashboard,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(2)} Mi` : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)} Mil` : `R$ ${v.toFixed(0)}`;

function PropostasDashboard() {
  const { rows, filtros, setFiltros } = useDashboard();
  const { propostas } = useComercial();

  const filtered = useMemo(() => aplicarFiltrosPropostas(propostas, filtros), [propostas, filtros]);
  const k = useMemo(() => kpisPropostas(filtered), [filtered]);
  const evol = useMemo(() => evolucaoMensalPropostas(filtered), [filtered]);
  const ranking = useMemo(() => rankingConsultorPropostas(filtered).slice(0, 10), [filtered]);

  const topFechadas = useMemo(
    () => filtered
      .filter((p) => p.status === "fechado")
      .map((p) => ({ p, total: propostaTotal(p) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <FiltrosBar rows={rows} filtros={filtros} onChange={setFiltros} fields={["empresa", "ano", "mes"]} />
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard titulo="Criadas" valor={k.criadas} Icon={FileText} isMoney={false} />
        <KpiCard titulo="Enviadas" valor={k.enviadas} Icon={Send} isMoney={false} />
        <KpiCard titulo="Em Negociação" valor={k.emNegociacao} Icon={MessageSquare} isMoney={false} />
        <KpiCard titulo="Fechadas" valor={k.fechadas} Icon={CheckCircle2} isMoney={false} />
        <KpiCard titulo="Perdidas" valor={k.perdidas} Icon={XCircle} isMoney={false} />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard titulo="Taxa de Conversão" valor={k.taxaConversao} Icon={Percent} isMoney={false} />
        <KpiCard titulo="Ticket Médio (Fechadas)" valor={k.ticketMedio} Icon={Target} />
        <KpiCard titulo="Valor Fechado" valor={k.valorFechado} Icon={CheckCircle2} />
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-2">Evolução Mensal — Criadas vs Fechadas</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evol}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="criadas" name="Criadas" stroke="hsl(var(--chart-1))" strokeWidth={2} />
              <Line type="monotone" dataKey="fechadas" name="Fechadas" stroke="hsl(var(--chart-2))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Ranking por Consultor (Valor Fechado)</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={110} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Top Propostas Fechadas</div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-2 py-1.5">Nº</th>
                  <th className="px-2 py-1.5">Cliente</th>
                  <th className="px-2 py-1.5">Consultor</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {topFechadas.map(({ p, total }) => (
                  <tr key={p.id} className="border-t border-border/50">
                    <td className="px-2 py-1.5">#{p.numero}</td>
                    <td className="px-2 py-1.5">{p.cliente?.nome ?? "—"}</td>
                    <td className="px-2 py-1.5">{p.responsavel || "—"}</td>
                    <td className="px-2 py-1.5">{PROPOSTA_STATUS_LABEL[p.status]}</td>
                    <td className="px-2 py-1.5 text-right">{brl(total)}</td>
                  </tr>
                ))}
                {topFechadas.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">Nenhuma proposta fechada no período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
