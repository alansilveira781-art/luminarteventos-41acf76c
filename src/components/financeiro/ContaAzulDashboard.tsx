import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Line, Legend,
} from "recharts";
import { PiggyBank as Piggy, TrendingDown, Building2, BarChart3, Sprout } from "lucide-react";
import { montarDRE, totaisExtrato, type Regime } from "@/lib/conta-azul/dre";


const sb = supabase as any;

type ContaPagar = {
  external_id: string;
  descricao: string | null;
  fornecedor_nome: string | null;
  categoria_external_id: string | null;
  centro_custo_external_id: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
};
type ContaReceber = ContaPagar & { cliente_nome: string | null };
type PlanoConta = { external_id: string; nome: string; tipo: string | null; codigo: string | null; pai_external_id: string | null };
type CentroCusto = { external_id: string; nome: string };
type Extrato = { external_id: string; conta_bancaria: string | null; valor: number };

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtPct = (n: number) =>
  `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const YEARS = Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => 2023 + i);
const MESES = [
  "Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function inPeriodo(date: string | null, ano: number, mes: number) {
  if (!date) return false;
  const d = new Date(date);
  if (d.getFullYear() !== ano) return false;
  if (mes > 0 && d.getMonth() + 1 !== mes) return false;
  return true;
}

export function ContaAzulDashboard() {
  return (
    <Tabs defaultValue="painel" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="painel">Painel Financeiro</TabsTrigger>
        <TabsTrigger value="analise">Análise Detalhada</TabsTrigger>
        <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
      </TabsList>
      <TabsContent value="painel"><PainelFinanceiro /></TabsContent>
      <TabsContent value="analise"><AnaliseDetalhada /></TabsContent>
      <TabsContent value="fluxo"><FluxoCaixa /></TabsContent>
    </Tabs>
  );
}

function useContaAzulData() {
  const planos = useQuery({
    queryKey: ["ca-plano"],
    queryFn: async () => {
      const { data } = await sb.from("ca_plano_contas").select("external_id,nome,tipo,codigo,pai_external_id");
      return (data ?? []) as PlanoConta[];
    },
  });
  const centros = useQuery({
    queryKey: ["ca-centros"],
    queryFn: async () => {
      const { data } = await sb.from("ca_centros_custo").select("external_id,nome").eq("ativo", true);
      return (data ?? []) as CentroCusto[];
    },
  });
  const pagar = useQuery({
    queryKey: ["ca-pagar"],
    queryFn: async () => {
      const { data } = await sb.from("ca_contas_pagar").select("*");
      return (data ?? []) as ContaPagar[];
    },
  });
  const receber = useQuery({
    queryKey: ["ca-receber"],
    queryFn: async () => {
      const { data } = await sb.from("ca_contas_receber").select("*");
      return (data ?? []) as ContaReceber[];
    },
  });
  const extrato = useQuery({
    queryKey: ["ca-extrato"],
    queryFn: async () => {
      const { data } = await sb.from("ca_extrato").select("external_id,conta_bancaria,valor");
      return (data ?? []) as Extrato[];
    },
  });
  return { planos, centros, pagar, receber, extrato };
}

function KpiCard({
  icon: Icon, label, value, subLabel, subValue, subColor,
}: { icon: any; label: string; value: string; subLabel?: string; subValue?: string; subColor?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="text-sm font-semibold text-muted-foreground">{label}</div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
      {subLabel && (
        <div className="mt-3 text-xs text-muted-foreground border-t pt-2">
          {subLabel}: <span className={subColor ?? "text-foreground"}>{subValue}</span>
        </div>
      )}
    </Card>
  );
}

function PainelFinanceiro() {
  const { planos, pagar, receber } = useContaAzulData();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(0);

  const planoMap = useMemo(() => {
    const m = new Map<string, PlanoConta>();
    (planos.data ?? []).forEach((p) => m.set(p.external_id, p));
    return m;
  }, [planos.data]);

  const { receitas, despesas, custos, deducoes, lucro, dre, movimentos, totalRec } = useMemo(() => {
    const r = (receber.data ?? []).filter((c) => inPeriodo(c.data_vencimento, ano, mes));
    const p = (pagar.data ?? []).filter((c) => inPeriodo(c.data_vencimento, ano, mes));

    const sumByCat = (rows: any[]) => {
      const map = new Map<string, number>();
      rows.forEach((c) => {
        const k = c.categoria_external_id || "_sem_categoria";
        map.set(k, (map.get(k) ?? 0) + Number(c.valor || 0));
      });
      return map;
    };
    const recByCat = sumByCat(r);
    const payByCat = sumByCat(p);

    const totalRec = r.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalPay = p.reduce((s, c) => s + Number(c.valor || 0), 0);

    // Simplificação: trata todas as contas a pagar como despesas/custos
    const despesas = totalPay * 0.2;
    const custos = totalPay * 0.8;
    const deducoes = totalRec * 0.1;
    const lucro = totalRec - deducoes - despesas - custos;

    // DRE: agrupa por categoria
    type DRERow = { label: string; valor: number; pct: number; bold?: boolean };
    const dre: DRERow[] = [];
    dre.push({ label: "(+) Receita Bruta", valor: totalRec, pct: 1, bold: true });
    Array.from(recByCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => {
        const nome = planoMap.get(k)?.nome ?? "Sem categoria";
        dre.push({ label: `   ${nome}`, valor: v, pct: totalRec ? v / totalRec : 0 });
      });
    dre.push({ label: "(-) Deduções", valor: -deducoes, pct: totalRec ? -deducoes / totalRec : 0, bold: true });
    dre.push({ label: "(=) Receita Líquida", valor: totalRec - deducoes, pct: totalRec ? (totalRec - deducoes) / totalRec : 0, bold: true });
    dre.push({ label: "(-) Custos", valor: -custos, pct: totalRec ? -custos / totalRec : 0, bold: true });
    Array.from(payByCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => {
        const nome = planoMap.get(k)?.nome ?? "Sem categoria";
        dre.push({ label: `   ${nome}`, valor: -v * 0.8, pct: totalRec ? -(v * 0.8) / totalRec : 0 });
      });
    dre.push({ label: "(-) Despesas", valor: -despesas, pct: totalRec ? -despesas / totalRec : 0, bold: true });
    dre.push({ label: "(=) Lucro", valor: lucro, pct: totalRec ? lucro / totalRec : 0, bold: true });

    // Movimentos: combinação
    const movimentos = [
      ...r.map((c) => ({ data: c.data_vencimento, nome: c.cliente_nome, descricao: c.descricao, valor: Number(c.valor || 0) })),
      ...p.map((c) => ({ data: c.data_vencimento, nome: c.fornecedor_nome, descricao: c.descricao, valor: -Number(c.valor || 0) })),
    ].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

    return {
      receitas: totalRec,
      despesas,
      custos,
      deducoes,
      lucro,
      dre,
      movimentos,
      totalRec,
    };
  }, [pagar.data, receber.data, planoMap, ano, mes]);

  const totalMov = movimentos.reduce((s, m) => s + m.valor, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-end">
        <div className="w-32">
          <label className="text-xs text-muted-foreground">Ano</label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-xs text-muted-foreground">Mês</label>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Piggy} label="Receita Bruta" value={fmtMoney(receitas)} subLabel="% Receita" subValue={fmtPct(1)} subColor="text-green-600" />
        <KpiCard icon={TrendingDown} label="Pot. de Vendas" value={fmtMoney(0)} subLabel="% PV" subValue="—" />
        <KpiCard icon={Building2} label="Despesas" value={fmtMoney(-despesas)} subLabel="% Despesa" subValue={fmtPct(receitas ? -despesas / receitas : 0)} subColor="text-red-600" />
        <KpiCard icon={BarChart3} label="Custos" value={fmtMoney(-custos)} subLabel="% Custos" subValue={fmtPct(receitas ? -custos / receitas : 0)} subColor="text-red-600" />
        <KpiCard icon={Sprout} label="Lucro" value={fmtMoney(lucro)} subLabel="% Lucro" subValue={fmtPct(receitas ? lucro / receitas : 0)} subColor={lucro >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-[1fr,140px,80px] text-xs uppercase text-muted-foreground bg-muted/50 px-3 py-2 font-semibold">
            <div>Demonstrativo</div><div className="text-right">Valores</div><div className="text-right">%</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {dre.map((row, i) => (
              <div key={i} className={`grid grid-cols-[1fr,140px,80px] px-3 py-1.5 text-sm border-t border-border ${row.bold ? "font-semibold bg-muted/30" : ""}`}>
                <div className="truncate" title={row.label}>{row.label}</div>
                <div className={`text-right tabular-nums ${row.valor < 0 ? "text-red-600" : ""}`}>{fmtMoney(row.valor)}</div>
                <div className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-[110px,1fr,140px] text-xs uppercase text-muted-foreground bg-muted/50 px-3 py-2 font-semibold">
            <div>Data</div><div>Fornecedor/Cliente · Descrição</div><div className="text-right">Valor</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {movimentos.slice(0, 200).map((m, i) => (
              <div key={i} className="grid grid-cols-[110px,1fr,140px] px-3 py-1.5 text-sm border-t border-border">
                <div className="text-muted-foreground">{m.data?.slice(0, 10) ?? "—"}</div>
                <div className="truncate">
                  <span className="font-medium">{m.nome ?? "—"}</span>
                  {m.descricao && <span className="text-muted-foreground"> · {m.descricao}</span>}
                </div>
                <div className={`text-right tabular-nums ${m.valor < 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(m.valor)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr,140px] px-3 py-2 text-sm font-semibold bg-muted/40 border-t">
            <div>Total</div>
            <div className={`text-right tabular-nums ${totalMov < 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(totalMov)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AnaliseDetalhada() {
  const { centros, pagar, receber } = useContaAzulData();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [centroId, setCentroId] = useState<string>("");

  const ccs = centros.data ?? [];
  useMemoSetDefault(centroId, setCentroId, ccs);

  const filtered = useMemo(() => {
    const r = (receber.data ?? []).filter((c) => c.centro_custo_external_id === centroId && inPeriodo(c.data_vencimento, ano, 0));
    const p = (pagar.data ?? []).filter((c) => c.centro_custo_external_id === centroId && inPeriodo(c.data_vencimento, ano, 0));
    const totalR = r.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalP = p.reduce((s, c) => s + Number(c.valor || 0), 0);
    return { r, p, totalR, totalP, lucro: totalR - totalP };
  }, [pagar.data, receber.data, centroId, ano]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-end">
        <div className="min-w-[280px]">
          <label className="text-xs text-muted-foreground">Evento/Projeto</label>
          <Select value={centroId} onValueChange={setCentroId}>
            <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
            <SelectContent>{ccs.map((c) => <SelectItem key={c.external_id} value={c.external_id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground">Ano</label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Piggy} label="Receita Bruta" value={fmtMoney(filtered.totalR)} />
        <KpiCard icon={TrendingDown} label="Pot. de Vendas" value="—" />
        <KpiCard icon={Building2} label="Despesas" value="—" />
        <KpiCard icon={BarChart3} label="Custos" value={fmtMoney(-filtered.totalP)} subLabel="% Custos" subValue={fmtPct(filtered.totalR ? -filtered.totalP / filtered.totalR : 0)} subColor="text-red-600" />
        <KpiCard icon={Sprout} label="Lucro" value={fmtMoney(filtered.lucro)} subLabel="% Lucro" subValue={fmtPct(filtered.totalR ? filtered.lucro / filtered.totalR : 0)} subColor={filtered.lucro >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-[110px,1fr,1fr,160px] text-xs uppercase text-muted-foreground bg-muted/50 px-3 py-2 font-semibold">
          <div>Data</div><div>Fornecedor/Cliente</div><div>Descrição</div><div className="text-right">Resultados</div>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {[
            ...filtered.r.map((c) => ({ data: c.data_vencimento, nome: c.cliente_nome, descricao: c.descricao, valor: Number(c.valor || 0) })),
            ...filtered.p.map((c) => ({ data: c.data_vencimento, nome: c.fornecedor_nome, descricao: c.descricao, valor: -Number(c.valor || 0) })),
          ].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "")).map((m, i) => (
            <div key={i} className="grid grid-cols-[110px,1fr,1fr,160px] px-3 py-1.5 text-sm border-t border-border">
              <div className="text-muted-foreground">{m.data?.slice(0, 10) ?? "—"}</div>
              <div className="truncate font-medium">{m.nome ?? "—"}</div>
              <div className="truncate text-muted-foreground">{m.descricao ?? "—"}</div>
              <div className={`text-right tabular-nums ${m.valor < 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(m.valor)}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr,160px] px-3 py-2 text-sm font-semibold bg-muted/40 border-t">
          <div>Total</div>
          <div className={`text-right tabular-nums ${filtered.lucro < 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(filtered.lucro)}</div>
        </div>
      </Card>
    </div>
  );
}

function useMemoSetDefault(current: string, setter: (v: string) => void, items: CentroCusto[]) {
  useMemo(() => {
    if (!current && items.length > 0) setter(items[0].external_id);
  }, [current, items, setter]);
}

function FluxoCaixa() {
  const { pagar, receber, extrato, planos } = useContaAzulData();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(0);
  const [aba, setAba] = useState<"receber" | "pagar">("receber");

  const planoMap = useMemo(() => {
    const m = new Map<string, string>();
    (planos.data ?? []).forEach((p) => m.set(p.external_id, p.nome));
    return m;
  }, [planos.data]);

  const r = useMemo(() => (receber.data ?? []).filter((c) => inPeriodo(c.data_vencimento, ano, mes) && c.status !== "pago"), [receber.data, ano, mes]);
  const p = useMemo(() => (pagar.data ?? []).filter((c) => inPeriodo(c.data_vencimento, ano, mes) && c.status !== "pago"), [pagar.data, ano, mes]);
  const totalR = r.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalP = p.reduce((s, c) => s + Number(c.valor || 0), 0);

  // Fluxo por semana (acumulado)
  const fluxo = useMemo(() => {
    const map = new Map<string, { semana: string; receber: number; pagar: number }>();
    const add = (date: string | null, key: "receber" | "pagar", v: number) => {
      if (!date) return;
      const d = new Date(date);
      const wk = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + 6 - d.getDay()) / 7)).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(wk) ?? { semana: wk, receber: 0, pagar: 0 };
      cur[key] += v;
      map.set(wk, cur);
    };
    (receber.data ?? []).filter((c) => inPeriodo(c.data_vencimento, ano, 0)).forEach((c) => add(c.data_vencimento, "receber", Number(c.valor || 0)));
    (pagar.data ?? []).filter((c) => inPeriodo(c.data_vencimento, ano, 0)).forEach((c) => add(c.data_vencimento, "pagar", -Number(c.valor || 0)));
    const arr = Array.from(map.values()).sort((a, b) => a.semana.localeCompare(b.semana));
    let acc = 0;
    return arr.map((x) => ({ ...x, acumulado: (acc += x.receber + x.pagar) }));
  }, [receber.data, pagar.data, ano]);

  const saldos = useMemo(() => {
    return (extrato.data ?? [])
      .map((e) => ({ nome: e.conta_bancaria ?? "—", valor: Number(e.valor || 0) }))
      .sort((a, b) => b.valor - a.valor);
  }, [extrato.data]);

  const linhas = aba === "receber" ? r : p;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-end">
        <div className="w-32">
          <label className="text-xs text-muted-foreground">Ano</label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-xs text-muted-foreground">Mês</label>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <KpiCard icon={Piggy} label="Receber" value={fmtMoney(totalR)} />
        <KpiCard icon={Sprout} label="Pagar" value={fmtMoney(-totalP)} />
        <KpiCard icon={Building2} label="Geração de Caixa" value={fmtMoney(totalR - totalP)} subColor={totalR - totalP >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
            <div className="text-xs uppercase text-muted-foreground font-semibold">Contas a</div>
            <Select value={aba} onValueChange={(v: any) => setAba(v)}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receber">Receber</SelectItem>
                <SelectItem value="pagar">Pagar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[100px,1fr,1fr] text-xs uppercase text-muted-foreground bg-muted/30 px-3 py-2 font-semibold">
            <div>Data</div><div>Fornecedor/Cliente</div><div>Categoria</div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {linhas.slice(0, 100).map((c: any, i: number) => (
              <div key={i} className="grid grid-cols-[100px,1fr,1fr] px-3 py-1.5 text-sm border-t border-border">
                <div className="text-muted-foreground">{c.data_vencimento?.slice(0, 10) ?? "—"}</div>
                <div className="truncate font-medium">{c.cliente_nome ?? c.fornecedor_nome ?? "—"}</div>
                <div className="truncate text-muted-foreground">{planoMap.get(c.categoria_external_id ?? "") ?? "—"}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Fluxo de Caixa</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={fluxo}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="semana" fontSize={9} />
              <YAxis fontSize={10} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
              <Legend />
              <Bar dataKey="receber" fill="#10b981" name="Receber" />
              <Bar dataKey="pagar" fill="#ef4444" name="Pagar" />
              <Line type="monotone" dataKey="acumulado" stroke="#3b82f6" name="Acumulado" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Saldo Bancos</div>
        <ResponsiveContainer width="100%" height={Math.max(180, saldos.length * 28)}>
          <BarChart data={saldos} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" fontSize={10} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
            <YAxis type="category" dataKey="nome" width={160} fontSize={10} />
            <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
            <Bar dataKey="valor" fill="#10b981">
              {saldos.map((s, i) => (
                <rect key={i} fill={s.valor >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
