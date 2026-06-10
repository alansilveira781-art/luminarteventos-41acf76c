import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDashboard } from "./comercial.dashboard";
import { compararAnos } from "@/lib/comercial/vendas-metrics";

export const Route = createFileRoute("/comercial/dashboard/indicadores")({
  component: Indicadores,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} Mi` : v >= 1_000 ? `${(v / 1_000).toFixed(0)} Mil` : `${v.toFixed(0)}`;

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function Indicadores() {
  const { rows, filtros } = useDashboard();
  const yearNow = new Date().getFullYear();
  const [anoA, setAnoA] = useState<number>(yearNow);
  const [anoB, setAnoB] = useState<number>(yearNow - 1);

  const cmp = useMemo(
    () => compararAnos(rows, anoA, anoB, {
      empresa: filtros.empresa,
      mes: filtros.mes,
      trimestre: filtros.trimestre,
      consultor: filtros.consultor,
      classificacao: filtros.classificacao,
    }),
    [rows, anoA, anoB, filtros],
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-4">
        <div className="text-sm font-medium mr-4">Digite nos quadrantes ao lado:</div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">Ano A</Label>
          <Input type="number" className="w-28" value={anoA} onChange={(e) => setAnoA(Number(e.target.value) || yearNow)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">Ano B</Label>
          <Input type="number" className="w-28" value={anoB} onChange={(e) => setAnoB(Number(e.target.value) || yearNow - 1)} />
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Ano A vs Ano B</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cmp.serie}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="trim" />
                <YAxis tickFormatter={brlShort} width={70} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Line type="monotone" dataKey="anoA" name={`Ano A (${anoA})`} stroke="hsl(var(--chart-1))" strokeWidth={2} />
                <Line type="monotone" dataKey="anoB" name={`Ano B (${anoB})`} stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2">Indicador</th>
                  <th className="px-3 py-2 text-right">Ano A</th>
                  <th className="px-3 py-2 text-right">Ano B</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {cmp.tabela.map((r) => (
                  <tr key={r.ind} className="border-t border-border/50">
                    <td className="px-3 py-2">{r.ind}</td>
                    <td className="px-3 py-2 text-right">{r.ind.includes("Qtde") ? r.a.toLocaleString("pt-BR") : brl(r.a)}</td>
                    <td className="px-3 py-2 text-right">{r.ind.includes("Qtde") ? r.b.toLocaleString("pt-BR") : brl(r.b)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.pct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {[
          { titulo: `Ano A (${anoA})`, data: cmp.pizzaA },
          { titulo: `Ano B (${anoB})`, data: cmp.pizzaB },
        ].map((p) => (
          <Card key={p.titulo} className="p-4">
            <div className="text-sm font-medium italic mb-2">{p.titulo}</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={p.data}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(e: any) => `${brlShort(e.value)} (${(e.percent * 100).toFixed(1)}%)`}
                  >
                    {p.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
