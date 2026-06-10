import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList, Cell,
} from "recharts";
import { DollarSign, BarChart2, Tag, Target, Download } from "lucide-react";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { GaugeRealVsMeta } from "@/components/comercial/dashboard/GaugeRealVsMeta";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { useDashboard } from "./comercial.dashboard";
import {
  comissoesPorVendedor,
  kpis,
  rankingCerimonial,
  rankingDecorador,
} from "@/lib/comercial/vendas-metrics";

export const Route = createFileRoute("/comercial/dashboard/relatorios")({
  component: RelatoriosVendas,
});

const META_DEFAULT = 12_000_000;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(2)} Mi` : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)} Mil` : `R$ ${v.toFixed(0)}`;

function RelatoriosVendas() {
  const { rows, filtered, previous, filtros, setFiltros } = useDashboard();
  const [busca, setBusca] = useState("");

  const k = useMemo(() => kpis(filtered, previous), [filtered, previous]);
  const comissoes = useMemo(() => comissoesPorVendedor(filtered).slice(0, 8), [filtered]);
  const cerimonial = useMemo(() => rankingCerimonial(filtered).slice(0, 8), [filtered]);
  const decorador = useMemo(() => rankingDecorador(filtered).slice(0, 8), [filtered]);

  const tabela = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const linhas = filtered
      .filter((r) => {
        if (!q) return true;
        return [r.nomeEvento, r.local, r.consultor, r.decorador, r.cerimonial]
          .some((x) => (x ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => (b.dataEvento ?? "").localeCompare(a.dataEvento ?? ""));
    return linhas;
  }, [filtered, busca]);

  const total = useMemo(() => tabela.reduce((s, r) => s + (r.valorFinal || 0), 0), [tabela]);

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const data = tabela.map((r) => ({
      Data: r.dataEvento,
      "Nome do Evento": r.nomeEvento,
      Local: r.local,
      Consultor: r.consultor,
      Decorador: r.decorador,
      Cerimonial: r.cerimonial,
      "Valor Final": r.valorFinal,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, "relatorio-vendas.xlsx");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <FiltrosBar rows={rows} filtros={filtros} onChange={setFiltros} fields={["empresa", "ano", "mes"]} />
      </Card>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Vendas Totais" valor={k.vendasTotais} Icon={DollarSign} anterior={k.vendasAnterior} pct={k.pctVendas} />
        <KpiCard titulo="Quantidade de Vendas" valor={k.quantidade} Icon={BarChart2} isMoney={false} anterior={k.quantidadeAnterior} pct={k.pctQuantidade} />
        <KpiCard titulo="Desconto" valor={k.desconto} Icon={Tag} anterior={k.descontoAnterior} pct={k.pctDesconto} />
        <KpiCard titulo="Ticket Médio" valor={k.ticketMedio} Icon={Target} anterior={k.ticketAnterior} pct={k.pctTicket} />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-sm font-medium">Detalhamento de Vendas</div>
            <div className="flex gap-2">
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="h-8 w-48" />
              <Button size="sm" variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-2" />Exportar</Button>
            </div>
          </div>
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-2 py-1.5">Data</th>
                  <th className="px-2 py-1.5">Nome do Evento</th>
                  <th className="px-2 py-1.5">Local</th>
                  <th className="px-2 py-1.5">Consultor</th>
                  <th className="px-2 py-1.5">Decorador</th>
                  <th className="px-2 py-1.5">Cerimonial</th>
                  <th className="px-2 py-1.5 text-right">Valor Final</th>
                </tr>
              </thead>
              <tbody>
                {tabela.map((r, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.dataEvento ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.nomeEvento ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.local ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.consultor ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.decorador ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.cerimonial ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">{brl(r.valorFinal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-foreground text-background sticky bottom-0">
                <tr>
                  <td colSpan={6} className="px-2 py-1.5 font-medium">Total</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{brl(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Comissões vendedores</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comissoes} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={80} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Ranking Cerimonial/Agência</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cerimonial} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={100} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Ranking Decorador</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decorador} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={brlShort} hide />
                <YAxis dataKey="nome" type="category" width={100} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="valor" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => brlShort(v)} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <GaugeRealVsMeta valor={k.vendasTotais} meta={META_DEFAULT} />
      </div>
    </div>
  );
}
