import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useDashboard } from "@/lib/comercial/dashboard-context";
import { FiltrosBar } from "@/components/comercial/dashboard/FiltrosBar";
import { KpiCard } from "@/components/comercial/dashboard/KpiCard";
import { GaugeRealVsMeta } from "@/components/comercial/dashboard/GaugeRealVsMeta";
import {
  kpis, evolucaoTrimestre, evolucaoTicketTrimestre,
  rankingConsultor, valorPorClassificacao,
  comissoesPorVendedor, rankingCerimonial, rankingDecorador,
  vendasPorTipoEvento, cleanText, compararAnos,
} from "@/lib/comercial/vendas-metrics";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, ShoppingCart, Percent, Receipt } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const Route = createFileRoute("/comercial/dashboard/")({
  component: DashboardHome,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const brlAbrev = (v: number) => {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `R$\u00A0${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}\u00A0Mi`;
  if (n >= 1_000) return `R$\u00A0${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}\u00A0Mil`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).replace(/\s/g, "\u00A0");
};


type MetaRow = { ano: number; mes: number; classificacao: string; valor_meta: number };

type Secao = "painel" | "relatorio" | "vendedores" | "indicadores";

function DashboardHome() {
  const { rows, filtered, previous, filtros, setFiltros } = useDashboard();
  const [secao, setSecao] = useState<Secao>("painel");
  const [consultorSel, setConsultorSel] = useState<string | "Todos">("Todos");

  const consultoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of filtered) {
      const c = cleanText(r.consultor);
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [filtered]);

  const vendedoresRows = useMemo(() => {
    if (consultorSel === "Todos") return filtered;
    return filtered.filter((r) => cleanText(r.consultor) === consultorSel);
  }, [filtered, consultorSel]);

  const vendedoresPrev = useMemo(() => {
    if (consultorSel === "Todos") return previous;
    return previous.filter((r) => cleanText(r.consultor) === consultorSel);
  }, [previous, consultorSel]);

  const kVend = useMemo(() => kpis(vendedoresRows, vendedoresPrev), [vendedoresRows, vendedoresPrev]);
  const evolVend = useMemo(() => evolucaoTrimestre(vendedoresRows), [vendedoresRows]);
  const tipoEvento = useMemo(() => vendasPorTipoEvento(vendedoresRows), [vendedoresRows]);
  const cerimVend = useMemo(() => rankingCerimonial(vendedoresRows), [vendedoresRows]);
  const decorVend = useMemo(() => rankingDecorador(vendedoresRows), [vendedoresRows]);

  // --- Indicadores (Ano A vs Ano B) ---
  const anoAtual = new Date().getFullYear();
  const [indAnoA, setIndAnoA] = useState<number>(anoAtual);
  const [indAnoB, setIndAnoB] = useState<number>(anoAtual - 1);
  const [indEmpresa, setIndEmpresa] = useState<string>("Todos");
  const [indTrimestre, setIndTrimestre] = useState<string>("Todos");
  const [indConsultor, setIndConsultor] = useState<string>("Todos");
  const [indClassificacao, setIndClassificacao] = useState<string>("Todos");

  const empresasAll = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) { const v = cleanText(r.empresa); if (v) s.add(v); }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);
  const consultoresAll = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) { const v = cleanText(r.consultor); if (v) s.add(v); }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);
  const classificacoesAll = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) { const v = cleanText(r.classificacao); if (v) s.add(v); }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const indicadores = useMemo(() => {
    return compararAnos(rows, indAnoA, indAnoB, {
      empresa: indEmpresa === "Todos" ? "Todos" : indEmpresa,
      mes: "Todos",
      trimestre: indTrimestre === "Todos" ? "Todos" : (Number(indTrimestre) as 1 | 2 | 3 | 4),
      consultor: indConsultor === "Todos" ? "Todos" : indConsultor,
      classificacao: indClassificacao === "Todos" ? "Todos" : indClassificacao,
    });
  }, [rows, indAnoA, indAnoB, indEmpresa, indTrimestre, indConsultor, indClassificacao]);

  const pizzaColors = ["#0ea5e9", "#1e3a8a", "#f97316", "#7c3aed", "#ec4899", "#10b981", "#eab308"];

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
  const comissoes = useMemo(() => comissoesPorVendedor(filtered), [filtered]);
  const rankCerim = useMemo(() => rankingCerimonial(filtered), [filtered]);
  const rankDecor = useMemo(() => rankingDecorador(filtered), [filtered]);

  const linhasRelatorio = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = a.dataEvento || a.dataRegistro || "";
      const db = b.dataEvento || b.dataRegistro || "";
      return db.localeCompare(da);
    });
  }, [filtered]);
  const totalRelatorio = useMemo(
    () => linhasRelatorio.reduce((s, r) => s + (r.valorFinal || 0), 0),
    [linhasRelatorio],
  );
  const fmtDataBR = (iso: string | null | undefined) => {
    if (!iso) return "-";
    const [y, m, d] = iso.slice(0, 10).split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };
  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

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
      {secao !== "indicadores" ? (
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
      ) : (
        <Card className="p-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Ano A</div>
              <Input type="number" value={indAnoA} onChange={(e) => setIndAnoA(Number(e.target.value) || anoAtual)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Ano B</div>
              <Input type="number" value={indAnoB} onChange={(e) => setIndAnoB(Number(e.target.value) || anoAtual - 1)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Empresa</div>
              <Select value={indEmpresa} onValueChange={setIndEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {empresasAll.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Trimestre</div>
              <Select value={indTrimestre} onValueChange={setIndTrimestre}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="1">1º Trim</SelectItem>
                  <SelectItem value="2">2º Trim</SelectItem>
                  <SelectItem value="3">3º Trim</SelectItem>
                  <SelectItem value="4">4º Trim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Consultor</div>
              <Select value={indConsultor} onValueChange={setIndConsultor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {consultoresAll.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Classificação</div>
              <Select value={indClassificacao} onValueChange={setIndClassificacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {classificacoesAll.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}


      {semDadosFiltrados && (
        <Card className="p-4 text-sm border-amber-500/40 bg-amber-500/5">
          Nenhuma venda atende aos filtros selecionados. Ajuste Empresa, Ano ou Mês para visualizar os dados.
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={secao === "painel" ? "default" : "outline"}
          size="sm"
          onClick={() => setSecao("painel")}
        >
          Painel de Vendas
        </Button>
        <Button
          type="button"
          variant={secao === "relatorio" ? "default" : "outline"}
          size="sm"
          onClick={() => setSecao("relatorio")}
        >
          Relatório de Vendas
        </Button>
        <Button
          type="button"
          variant={secao === "vendedores" ? "default" : "outline"}
          size="sm"
          onClick={() => setSecao("vendedores")}
        >
          Vendedores
        </Button>
        <Button
          type="button"
          variant={secao === "indicadores" ? "default" : "outline"}
          size="sm"
          onClick={() => setSecao("indicadores")}
        >
          Indicadores
        </Button>
      </div>

      {secao === "painel" && (
      <>
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
            <div className="text-sm font-medium text-foreground/80 mb-4">
              Evolução de Vendas [Trimestre]
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolVendas} margin={{ top: 32, right: 32, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="trim" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis hide domain={["dataMin - 100000", "dataMax + 100000"]} />
                  <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="valor" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="valor" position="top" dy={-6} formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-4">
              Evolução do Ticket Médio [Trimestre]
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolTicket} margin={{ top: 32, right: 32, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="trim" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" hide domain={["dataMin - 1000", "dataMax + 1000"]} />
                  <YAxis yAxisId="right" orientation="right" hide domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip
                    formatter={(v: number, name) => name === "Ticket Médio" ? brlAbrev(v) : v.toLocaleString("pt-BR")}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="ticket" name="Ticket Médio"
                    stroke="#2563eb" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="ticket" position="top" dy={-6} formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Line>
                  <Line yAxisId="right" type="monotone" dataKey="qtde" name="Qtde de Vendas"
                    stroke="#0f172a" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="qtde" position="bottom" dy={6} fontSize={11} />
                  </Line>
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
      </>
      )}

      {secao === "relatorio" && (
      <div>


        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4">
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
          <Card className="p-4 lg:col-span-2">
            <div className="text-sm font-medium text-foreground/80 mb-3">Detalhamento de Vendas</div>
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="whitespace-nowrap">Nome do Evento</TableHead>
                    <TableHead className="whitespace-nowrap">Local</TableHead>
                    <TableHead className="whitespace-nowrap">Consultor</TableHead>
                    <TableHead className="whitespace-nowrap">Decorador</TableHead>
                    <TableHead className="whitespace-nowrap">Cerimonial</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Valor Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasRelatorio.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma venda no filtro atual.
                      </TableCell>
                    </TableRow>
                  ) : linhasRelatorio.map((r, i) => (
                    <TableRow key={r.id ?? i}>
                      <TableCell className="whitespace-nowrap">{fmtDataBR(r.dataEvento || r.dataRegistro)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.nomeEvento || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.local || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.consultor || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.decorador || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.cerimonial || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{fmtBRL(r.valorFinal || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-background">
                  <TableRow>
                    <TableCell colSpan={6} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtBRL(totalRelatorio)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Comissões vendedores</div>
            <div style={{ height: Math.max(180, comissoes.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comissoes} layout="vertical" margin={{ top: 4, right: 80, left: 10, bottom: 0 }}>
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
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mt-4">
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Ranking Cerimonial/Agência</div>
            <div className="max-h-[260px] overflow-y-auto pr-2">
              <div style={{ height: Math.max(180, rankCerim.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankCerim} layout="vertical" margin={{ top: 4, right: 70, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} />
                    <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                      <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Ranking Decorador</div>
            <div className="max-h-[260px] overflow-y-auto pr-2">
              <div style={{ height: Math.max(180, rankDecor.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankDecor} layout="vertical" margin={{ top: 4, right: 70, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} />
                    <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                      <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>


          <GaugeRealVsMeta valor={realizado} meta={metaPeriodo} />
        </div>
      </div>
      )}

      {secao === "vendedores" && (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <KpiCard titulo="Vendas Totais" Icon={DollarSign}
              valor={kVend.vendasTotais} anterior={kVend.vendasAnterior} pct={kVend.pctVendas} />
            <KpiCard titulo="Quantidade de Vendas" Icon={ShoppingCart} isMoney={false}
              valor={kVend.quantidade} anterior={kVend.quantidadeAnterior} pct={kVend.pctQuantidade} />
            <KpiCard titulo="Ticket Médio" Icon={Receipt}
              valor={kVend.ticketMedio} anterior={kVend.ticketAnterior} pct={kVend.pctTicket} />
          </div>

          <Card className="p-3">
            <div className="text-xs font-medium text-foreground/70 mb-2">Consultores</div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={consultorSel === "Todos" ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setConsultorSel("Todos")}
              >
                Todos
              </Button>
              {consultoresDisponiveis.map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={consultorSel === c ? "default" : "outline"}
                  size="sm"
                  className="w-full truncate"
                  onClick={() => setConsultorSel(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="text-sm font-medium text-foreground/80 mb-4">
            Evolução de Vendas [Trimestre]{consultorSel !== "Todos" ? ` — ${consultorSel}` : ""}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolVend} margin={{ top: 32, right: 32, left: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="trim" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis hide domain={["dataMin - 100000", "dataMax + 100000"]} />
                <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="valor" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }}>
                  <LabelList dataKey="valor" position="top" dy={-6} formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Vendas por tipo de evento</div>
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <div style={{ height: Math.max(180, tipoEvento.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tipoEvento} layout="vertical" margin={{ top: 4, right: 70, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} />
                    <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                      <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Vendas por Cerimonial/Agência</div>
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <div style={{ height: Math.max(180, cerimVend.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cerimVend} layout="vertical" margin={{ top: 4, right: 70, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} />
                    <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                      <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Vendas por Decorador</div>
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <div style={{ height: Math.max(180, decorVend.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={decorVend} layout="vertical" margin={{ top: 4, right: 70, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} />
                    <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]}>
                      <LabelList dataKey="valor" position="right" formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>
      </div>
      )}

      {secao === "indicadores" && (
      <div className="space-y-4">

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Ano A vs Ano B</div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={indicadores.serie} margin={{ top: 32, right: 40, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="trim" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis hide domain={["dataMin - 100000", "dataMax + 100000"]} />
                  <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="anoA" name={`Ano A (${indAnoA})`} stroke="#0ea5e9" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="anoA" position="top" dy={-6} formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Line>
                  <Line type="monotone" dataKey="anoB" name={`Ano B (${indAnoB})`} stroke="#1e3a8a" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="anoB" position="bottom" dy={12} formatter={(v: number) => brlAbrev(v)} fontSize={11} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium text-foreground/80 mb-3">Comparativo</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead className="text-right">Ano A ({indAnoA})</TableHead>
                  <TableHead className="text-right">Ano B ({indAnoB})</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicadores.tabela.map((r) => {
                  const isMoney = r.ind !== "Qtde de vendas";
                  const fmt = (n: number) => isMoney
                    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })
                    : n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
                  const pctColor = r.pct >= 0 ? "text-emerald-600" : "text-red-600";
                  return (
                    <TableRow key={r.ind}>
                      <TableCell className="font-medium">{r.ind}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.a)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.b)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${pctColor}`}>
                        {r.pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[
            { title: `Ano A — ${indAnoA}`, data: indicadores.pizzaA },
            { title: `Ano B — ${indAnoB}`, data: indicadores.pizzaB },
          ].map(({ title, data }) => {
            const clean = data.filter((d) => d.valor > 0);
            const total = clean.reduce((s, d) => s + d.valor, 0);
            return (
              <Card key={title} className="p-4">
                <div className="text-sm font-medium text-foreground/80 mb-3 italic">{title}</div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 24, right: 32, bottom: 24, left: 24 }}>
                      <Tooltip formatter={(v: number) => brlAbrev(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: 12, maxWidth: "40%", lineHeight: "18px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      />
                      <Pie
                        data={clean}
                        dataKey="valor"
                        nameKey="nome"
                        cx="35%"
                        cy="50%"
                        outerRadius={78}
                        paddingAngle={2}
                        minAngle={4}
                        labelLine
                        label={({ value }: { value: number }) => {
                          const p = total ? (value / total) * 100 : 0;
                          return `${brlAbrev(value)}\u00A0·\u00A0${p.toFixed(0)}%`;
                        }}
                      >
                        {clean.map((_, i) => (
                          <Cell key={i} fill={pizzaColors[i % pizzaColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            );
          })}
        </div>

      </div>
      )}
    </div>
  );
}
