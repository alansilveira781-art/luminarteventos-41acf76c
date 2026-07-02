import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Download, Printer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import type { VendaRow } from "@/lib/comercial/vendas.functions";
import {
  rankingConsultor,
  rankingCerimonial,
  rankingDecorador,
  valorPorClassificacao,
} from "@/lib/comercial/vendas-metrics";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtAbrev = (v: number) => {
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Mi`;
  if (v >= 1_000)
    return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mil`;
  return fmtBRL(v);
};

function dataVenda(r: VendaRow): string | null {
  return r.dataRegistro || r.dataEvento || null;
}

function noIntervalo(r: VendaRow, ini: string, fim: string): boolean {
  const d = dataVenda(r);
  if (!d) return false;
  const dia = d.slice(0, 10);
  return dia >= ini && dia <= fim;
}

type RankItem = { nome: string; A: number; B: number };

export function RelatorioVendasPeriodo({
  rows,
  isLoading,
  error,
}: {
  rows: VendaRow[];
  isLoading?: boolean;
  error?: unknown;
}) {
  const anoAtual = new Date().getFullYear();
  const [aIni, setAIni] = useState(`${anoAtual}-01-01`);
  const [aFim, setAFim] = useState(`${anoAtual}-06-30`);
  const [bIni, setBIni] = useState(`${anoAtual - 1}-01-01`);
  const [bFim, setBFim] = useState(`${anoAtual - 1}-06-30`);

  const rowsA = useMemo(
    () => rows.filter((r) => noIntervalo(r, aIni, aFim)),
    [rows, aIni, aFim],
  );
  const rowsB = useMemo(
    () => rows.filter((r) => noIntervalo(r, bIni, bFim)),
    [rows, bIni, bFim],
  );

  const resumo = (rs: VendaRow[]) => {
    const total = rs.reduce((s, r) => s + (r.valorFinal || 0), 0);
    const qtd = rs.length;
    const ticket = qtd ? total / qtd : 0;
    return { total, qtd, ticket };
  };
  const resA = useMemo(() => resumo(rowsA), [rowsA]);
  const resB = useMemo(() => resumo(rowsB), [rowsB]);

  const labelA = `${aIni.slice(0, 7)} a ${aFim.slice(0, 7)}`;
  const labelB = `${bIni.slice(0, 7)} a ${bFim.slice(0, 7)}`;

  const chartTotais = [
    { nome: "Valor final", A: resA.total, B: resB.total },
    { nome: "Ticket médio", A: resA.ticket, B: resB.ticket },
  ];

  const combinaRanking = (
    listaA: { nome: string; valor: number }[],
    listaB: { nome: string; valor: number }[],
  ): RankItem[] => {
    const map = new Map<string, RankItem>();
    for (const x of listaA) map.set(x.nome, { nome: x.nome, A: x.valor, B: 0 });
    for (const x of listaB) {
      const cur = map.get(x.nome) ?? { nome: x.nome, A: 0, B: 0 };
      cur.B = x.valor;
      map.set(x.nome, cur);
    }
    return [...map.values()].sort((a, b) => b.A + b.B - (a.A + a.B));
  };

  const rkCategoria = useMemo(
    () => combinaRanking(valorPorClassificacao(rowsA), valorPorClassificacao(rowsB)),
    [rowsA, rowsB],
  );
  const rkVendedor = useMemo(
    () => combinaRanking(rankingConsultor(rowsA), rankingConsultor(rowsB)),
    [rowsA, rowsB],
  );
  const rkCerimonial = useMemo(
    () =>
      combinaRanking(
        rankingCerimonial(rowsA).map((x) => ({ nome: x.nome, valor: x.valor })),
        rankingCerimonial(rowsB).map((x) => ({ nome: x.nome, valor: x.valor })),
      ),
    [rowsA, rowsB],
  );
  const rkDecorador = useMemo(
    () => combinaRanking(rankingDecorador(rowsA), rankingDecorador(rowsB)),
    [rowsA, rowsB],
  );

  const exportarCSV = () => {
    const linhas: string[] = [];
    const secao = (titulo: string, dados: RankItem[]) => {
      linhas.push(`${titulo};${labelA};${labelB}`);
      for (const d of dados) linhas.push(`${d.nome};${d.A.toFixed(2)};${d.B.toFixed(2)}`);
      linhas.push("");
    };
    linhas.push(`Resumo;${labelA};${labelB}`);
    linhas.push(`Qtd vendas;${resA.qtd};${resB.qtd}`);
    linhas.push(`Valor final;${resA.total.toFixed(2)};${resB.total.toFixed(2)}`);
    linhas.push(`Ticket médio;${resA.ticket.toFixed(2)};${resB.ticket.toFixed(2)}`);
    linhas.push("");
    secao("Categoria", rkCategoria);
    secao("Vendedores", rkVendedor);
    secao("Cerimonial", rkCerimonial);
    secao("Decorador", rkDecorador);
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vendas-por-periodo.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando vendas…
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="p-6 flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 mt-0.5" />
        <span>Não foi possível carregar os dados.</span>
      </Card>
    );
  }

  return (
    <div className="space-y-6 print-area">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; padding: 0; }
        }
      `}</style>
      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold">Relatório de Vendas por Período</h1>
        <p className="text-sm text-muted-foreground">
          Período A: {labelA} &nbsp;·&nbsp; Período B: {labelB}
        </p>
        <p className="text-xs text-muted-foreground">
          Gerado em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>
      <Card className="p-4 print:hidden">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Período A</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input
                  type="date"
                  value={aIni}
                  onChange={(e) => setAIni(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={aFim}
                  onChange={(e) => setAFim(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Período B</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input
                  type="date"
                  value={bIni}
                  onChange={(e) => setBIni(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={bFim}
                  onChange={(e) => setBFim(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportarCSV}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3 print:break-inside-avoid">
        <KpiComparativo
          titulo="Qtd de vendas"
          a={resA.qtd}
          b={resB.qtd}
          labelA={labelA}
          labelB={labelB}
          formato="int"
        />
        <KpiComparativo
          titulo="Valor final"
          a={resA.total}
          b={resB.total}
          labelA={labelA}
          labelB={labelB}
          formato="brl"
        />
        <KpiComparativo
          titulo="Ticket médio"
          a={resA.ticket}
          b={resB.ticket}
          labelA={labelA}
          labelB={labelB}
          formato="brl"
        />
      </div>

      <Card className="p-4 print:break-inside-avoid">
        <p className="text-sm font-semibold mb-3">
          Comparativo — {labelA} vs {labelB}
        </p>
        <div className="h-72 w-full print:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartTotais}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="nome" />
              <YAxis tickFormatter={(v) => fmtAbrev(Number(v))} />
              <Tooltip formatter={(v) => fmtBRL(Number(v))} />
              <Legend />
              <Bar dataKey="A" name={labelA} fill="#000000">
                <LabelList
                  dataKey="A"
                  position="top"
                  formatter={(v: number) => fmtAbrev(v)}
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={600}
                />
              </Bar>
              <Bar dataKey="B" name={labelB} fill="#4B5563">
                <LabelList
                  dataKey="B"
                  position="top"
                  formatter={(v: number) => fmtAbrev(v)}
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 [&>*]:print:break-inside-avoid">
        <RankingComparativo
          titulo="Categoria"
          dados={rkCategoria}
          labelA={labelA}
          labelB={labelB}
        />
        <RankingComparativo
          titulo="Vendedores"
          dados={rkVendedor}
          labelA={labelA}
          labelB={labelB}
        />
        <RankingComparativo
          titulo="Cerimonial"
          dados={rkCerimonial}
          labelA={labelA}
          labelB={labelB}
        />
        <RankingComparativo
          titulo="Decorador"
          dados={rkDecorador}
          labelA={labelA}
          labelB={labelB}
        />
      </div>
    </div>
  );
}

function KpiComparativo({
  titulo,
  a,
  b,
  labelA,
  labelB,
  formato,
}: {
  titulo: string;
  a: number;
  b: number;
  labelA: string;
  labelB: string;
  formato: "brl" | "int";
}) {
  const fmt = (v: number) =>
    formato === "brl" ? fmtBRL(v) : v.toLocaleString("pt-BR");
  const delta = b !== 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
  const positivo = delta >= 0;
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <div className="mt-2 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">{labelA}</span>
          <span className="text-lg font-semibold tabular-nums">{fmt(a)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">{labelB}</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {fmt(b)}
          </span>
        </div>
      </div>
      <p
        className={`mt-2 text-xs font-medium ${
          positivo ? "text-emerald-600" : "text-destructive"
        }`}
      >
        {positivo ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs Período B
      </p>
    </Card>
  );
}

function RankingComparativo({
  titulo,
  dados,
  labelA,
  labelB,
}: {
  titulo: string;
  dados: RankItem[];
  labelA: string;
  labelB: string;
}) {
  const top = dados.slice(0, 10);
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold mb-3">{titulo}</p>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-1 pr-2">#</th>
                <th className="text-left py-1 pr-2">Nome</th>
                <th className="text-right py-1 pr-2">{labelA}</th>
                <th className="text-right py-1">{labelB}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((d, i) => (
                <tr key={d.nome} className="border-t border-border/50">
                  <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1 pr-2">{d.nome}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {fmtAbrev(d.A)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {fmtAbrev(d.B)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
