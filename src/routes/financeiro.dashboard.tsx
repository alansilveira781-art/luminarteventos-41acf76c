import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { DEMANDA_STATUSES, TIPO_DEMANDA_OPTIONS } from "@/lib/demandas";
import { UberDashboard } from "@/components/financeiro/UberDashboard";
import { ContaAzulDashboard } from "@/components/financeiro/ContaAzulDashboard";
import { grupoDoPlanoNome, buildPrefixIndex, DRE_STRUCTURE, type DreGroupId } from "@/lib/conta-azul/dre";
import { useDreEstrutura } from "@/hooks/useDreEstrutura";

const sb = supabase as any;
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

export const Route = createFileRoute("/financeiro/dashboard")({
  component: FinanceiroDashboard,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: ((): "financeiro" | "uber" | "contaazul" => {
      const v = s.tab as string;
      if (v === "uber") return "uber";
      if (v === "contaazul") return "contaazul";
      return "financeiro";
    })(),
  }),
});

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

function FinanceiroDashboard() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5);
    return startOfMonth(d);
  });
  const [to, setTo] = useState(() => today());

  // Default range mais amplo para Uber
  const [uberFrom, setUberFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 23);
    return startOfMonth(d);
  });
  const [uberTo, setUberTo] = useState(() => today());

  const { data: demandas = [] } = useQuery({
    queryKey: ["demandas-dash", from, to],
    queryFn: async () => {
      const { data } = await sb
        .from("demandas")
        .select("id,status,fornecedor,tipo_demanda,condicao_pagamento,valor_total,data_compra,data_solicitacao,created_at,categoria_external_id");
      return ((data ?? []) as any[]).filter((c) => {
        const ref = (c.data_compra || c.data_solicitacao || c.created_at)?.slice(0, 10);
        return ref >= from && ref <= to;
      });
    },
    enabled: tab === "financeiro",
  });

  const { data: planoContas = [] } = useQuery({
    queryKey: ["plano-contas-dash"],
    queryFn: async () => {
      const { data } = await sb.from("ca_plano_contas").select("external_id,nome");
      return (data ?? []) as { external_id: string; nome: string }[];
    },
    enabled: tab === "financeiro",
  });

  const { data: dreEstrutura = DRE_STRUCTURE } = useDreEstrutura();

  const stats = useMemo(() => {
    const total = demandas.reduce((s, c) => s + Number(c.valor_total || 0), 0);
    const finalizadas = demandas.filter((c) => c.status === "finalizado").length;
    const emAndamento = demandas.filter((c) => !["finalizado", "negada"].includes(c.status)).length;
    return { total, count: demandas.length, finalizadas, emAndamento };
  }, [demandas]);

  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    demandas.forEach((c) => {
      const ref = (c.data_compra || c.data_solicitacao || c.created_at) as string;
      if (!ref) return;
      const key = ref.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + Number(c.valor_total || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }));
  }, [demandas]);

  const porFornecedor = useMemo(() => {
    const map = new Map<string, number>();
    demandas.forEach((c) => {
      const k = c.fornecedor || "Sem fornecedor";
      map.set(k, (map.get(k) ?? 0) + Number(c.valor_total || 0));
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [demandas]);

  const porTipo = useMemo(() => {
    const labels = Object.fromEntries(TIPO_DEMANDA_OPTIONS.map((t) => [t.value, t.label]));
    const map = new Map<string, number>();
    demandas.forEach((c) => {
      const k = c.tipo_demanda || "Sem tipo";
      map.set(k, (map.get(k) ?? 0) + Number(c.valor_total || 0));
    });
    return Array.from(map.entries()).map(([nome, valor]) => ({
      nome: labels[nome] ?? TIPO_DEMANDA_LEGACY_LABELS[nome] ?? nome,
      valor: Math.round(valor * 100) / 100,
    }));
  }, [demandas]);

  const porStatus = useMemo(() => {
    const labels = Object.fromEntries(DEMANDA_STATUSES.map((s) => [s.key, s.label]));
    const map = new Map<string, number>();
    demandas.forEach((c) => map.set(c.status, (map.get(c.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([k, v]) => ({ nome: labels[k] ?? k, valor: v }));
  }, [demandas]);

  // DRE: classifica cada demanda pelo prefixo da categoria do plano de contas.
  const dreAgg = useMemo(() => {
    const planoMap = new Map(planoContas.map((p) => [p.external_id, p]));
    const prefixIndex = buildPrefixIndex(dreEstrutura);
    const totalPorGrupo = new Map<DreGroupId, number>();
    const detPorGrupo = new Map<DreGroupId, Map<string, number>>();
    let semCategoria = 0;
    demandas.forEach((c: any) => {
      const v = Number(c.valor_total || 0);
      if (!v) return;
      const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
      const grupo = grupoDoPlanoNome(plano?.nome, prefixIndex);
      if (!grupo) { semCategoria += v; return; }
      totalPorGrupo.set(grupo, (totalPorGrupo.get(grupo) ?? 0) + v);
      const det = detPorGrupo.get(grupo) ?? new Map<string, number>();
      const k = c.categoria_external_id ?? "_";
      det.set(k, (det.get(k) ?? 0) + v);
      detPorGrupo.set(grupo, det);
    });
    const linhas = dreEstrutura
      .filter((l) => l.kind === "sum" && (l.sign === -1))
      .map((l) => ({
        id: l.id,
        label: l.label,
        valor: totalPorGrupo.get(l.id) ?? 0,
        detalhes: Array.from((detPorGrupo.get(l.id) ?? new Map()).entries())
          .map(([catId, val]) => ({ nome: planoMap.get(catId)?.nome ?? "Sem categoria", valor: val as number }))
          .sort((a, b) => b.valor - a.valor),
      }))
      .filter((l) => l.valor > 0);
    const totalClassificado = linhas.reduce((s, l) => s + l.valor, 0);
    return { linhas, semCategoria, totalClassificado };
  }, [demandas, planoContas, dreEstrutura]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as "financeiro" | "uber" | "contaazul" }, replace: true })}
        className="w-full"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="financeiro">Despesas</TabsTrigger>
          <TabsTrigger value="contaazul">Financeiro (Conta Azul)</TabsTrigger>
          <TabsTrigger value="uber">Uber</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-0">
          <PageHeader title="Dashboard de Despesas" description="Indicadores e gráficos do período selecionado" />

          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Stat label="Total demandas" value={String(stats.count)} />
            <Stat label="Valor total" value={fmt(stats.total)} />
            <Stat label="Finalizadas" value={String(stats.finalizadas)} />
            <Stat label="Em andamento" value={String(stats.emAndamento)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Demandas por mês (R$)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="valor" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Demandas por fornecedor (R$)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porFornecedor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="nome" width={120} fontSize={11} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="valor" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Demandas por tipo (R$)">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={porTipo} dataKey="valor" nameKey="nome" outerRadius={90} label>
                    {porTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Demandas por status (qtd)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porStatus}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="nome" fontSize={10} angle={-15} textAnchor="end" height={60} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="valor" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <Card className="p-4 mt-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-sm font-semibold">Demonstrativo de Despesas (DRE)</div>
              <div className="text-xs text-muted-foreground">
                Classificado: <span className="font-medium text-foreground">{fmt(dreAgg.totalClassificado)}</span>
                {dreAgg.semCategoria > 0 && (
                  <> · Sem categoria: <span className="font-medium text-foreground">{fmt(dreAgg.semCategoria)}</span></>
                )}
              </div>
            </div>
            {dreAgg.linhas.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma demanda com categoria do plano de contas no período.
              </div>
            ) : (
              <div className="space-y-1">
                {dreAgg.linhas.map((l) => (
                  <div key={l.id}>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <div className="text-sm font-medium">{l.label}</div>
                      <div className="text-sm font-semibold tabular-nums">{fmt(l.valor)}</div>
                    </div>
                    {l.detalhes.map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-1 pl-6 text-xs text-muted-foreground">
                        <div className="truncate pr-3">{d.nome}</div>
                        <div className="tabular-nums">{fmt(d.valor)}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="uber" className="mt-0">
          <PageHeader title="Dashboard Uber Business" description="Corridas, gastos e padrões da sua organização Uber" />

          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
              <Input type="date" value={uberFrom} onChange={(e) => setUberFrom(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
              <Input type="date" value={uberTo} onChange={(e) => setUberTo(e.target.value)} className="w-44" />
            </div>
          </div>

          <UberDashboard from={uberFrom} to={uberTo} />
        </TabsContent>

        <TabsContent value="contaazul" className="mt-0">
          <PageHeader title="Financeiro (Conta Azul)" description="Painel, análise por evento e fluxo de caixa" />
          <ContaAzulDashboard />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </Card>
  );
}
