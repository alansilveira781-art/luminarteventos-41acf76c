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
import { montarDRE, totaisExtrato, type Visao } from "@/lib/conta-azul/dre";


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
      const { data } = await sb.from("ca_extrato").select("external_id,conta_bancaria,valor,data,descricao,categoria_external_id");
      return (data ?? []) as (Extrato & { data: string | null; descricao: string | null; categoria_external_id: string | null })[];
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
  const { planos, pagar, receber, extrato } = useContaAzulData();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(0);
  const [visao, setVisao] = useState<Visao>("realizado");

  const planosArr = planos.data ?? [];

  const { linhas, totais } = useMemo(
    () => montarDRE(pagar.data ?? [], receber.data ?? [], planosArr, { ano, mes, visao }),
    [pagar.data, receber.data, planosArr, ano, mes, visao],
  );

  const rb = totais.RB ?? 0;
  const rl = totais.RL ?? 0;
  const ro = totais.RO ?? 0;
  const rg = totais.RG ?? 0;
  const lu = totais.LU ?? 0;

  // Reconciliação com extrato (sempre realizado)
  const extratoTot = useMemo(
    () => totaisExtrato(extrato.data ?? [], planosArr, ano, mes),
    [extrato.data, planosArr, ano, mes],
  );
  const dreRealizado = useMemo(() => {
    if (visao === "realizado") return { receitas: rb, despesas: rb - lu };
    const t = montarDRE(pagar.data ?? [], receber.data ?? [], planosArr, { ano, mes, visao: "realizado" }).totais;
    const r = t.RB ?? 0;
    const l = t.LU ?? 0;
    return { receitas: r, despesas: r - l };
  }, [visao, rb, lu, pagar.data, receber.data, planosArr, ano, mes]);

  const diffRec = dreRealizado.receitas - extratoTot.receitas;
  const diffDes = dreRealizado.despesas - extratoTot.despesas;
  const pctRec = extratoTot.receitas ? Math.abs(diffRec) / extratoTot.receitas : 0;
  const pctDes = extratoTot.despesas ? Math.abs(diffDes) / extratoTot.despesas : 0;
  const corDiff = (p: number) => (p <= 0.01 ? "text-green-600" : p <= 0.05 ? "text-yellow-600" : "text-red-600");

  // Movimentos do período (mesma visão do DRE)
  const movimentos = useMemo(() => {
    const passa = (c: any) =>
      visao === "realizado"
        ? c.status === "pago" && inPeriodo(c.data_pagamento, ano, mes)
        : c.status !== "pago" && inPeriodo(c.data_vencimento, ano, mes);
    return [
      ...(receber.data ?? []).filter(passa).map((c: any) => ({
        data: visao === "realizado" ? c.data_pagamento : c.data_vencimento,
        nome: c.cliente_nome, descricao: c.descricao, valor: Number(c.valor || 0),
      })),
      ...(pagar.data ?? []).filter(passa).map((c: any) => ({
        data: visao === "realizado" ? c.data_pagamento : c.data_vencimento,
        nome: c.fornecedor_nome, descricao: c.descricao, valor: -Number(c.valor || 0),
      })),
    ].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  }, [pagar.data, receber.data, visao, ano, mes]);

  const totalMov = movimentos.reduce((s, m) => s + m.valor, 0);


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Visão</label>
          <ToggleGroup type="single" value={visao} onValueChange={(v) => v && setVisao(v as Visao)} size="sm">
            <ToggleGroupItem value="realizado">Realizado</ToggleGroupItem>
            <ToggleGroupItem value="projetado">Projetado</ToggleGroupItem>
          </ToggleGroup>
        </div>

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
        <KpiCard icon={Piggy} label="Receita Bruta" value={fmtMoney(rb)} subLabel="% RB" subValue={fmtPct(1)} subColor="text-green-600" />
        <KpiCard icon={TrendingDown} label="Receita Líquida" value={fmtMoney(rl)} subLabel="% RB" subValue={fmtPct(rb ? rl / rb : 0)} />
        <KpiCard icon={Building2} label="Result. Operação" value={fmtMoney(ro)} subLabel="% RB" subValue={fmtPct(rb ? ro / rb : 0)} subColor={ro >= 0 ? "text-green-600" : "text-red-600"} />
        <KpiCard icon={BarChart3} label="Result. Gerencial" value={fmtMoney(rg)} subLabel="% RB" subValue={fmtPct(rb ? rg / rb : 0)} subColor={rg >= 0 ? "text-green-600" : "text-red-600"} />
        <KpiCard icon={Sprout} label="Lucro" value={fmtMoney(lu)} subLabel="% RB" subValue={fmtPct(rb ? lu / rb : 0)} subColor={lu >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Conferência vs Extrato (caixa)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="border rounded-md p-3">
            <div className="text-xs uppercase text-muted-foreground">Receitas</div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 tabular-nums">
              <div className="text-muted-foreground">DRE</div><div className="text-right">{fmtMoney(dreRealizado.receitas)}</div>
              <div className="text-muted-foreground">Extrato</div><div className="text-right">{fmtMoney(extratoTot.receitas)}</div>
              <div className="font-semibold">Diferença</div>
              <div className={`text-right font-semibold ${corDiff(pctRec)}`}>{fmtMoney(diffRec)} ({fmtPct(pctRec)})</div>
            </div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs uppercase text-muted-foreground">Despesas + Custos</div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 tabular-nums">
              <div className="text-muted-foreground">DRE</div><div className="text-right">{fmtMoney(dreRealizado.despesas)}</div>
              <div className="text-muted-foreground">Extrato</div><div className="text-right">{fmtMoney(extratoTot.despesas)}</div>
              <div className="font-semibold">Diferença</div>
              <div className={`text-right font-semibold ${corDiff(pctDes)}`}>{fmtMoney(diffDes)} ({fmtPct(pctDes)})</div>
            </div>
          </div>
          <div className="border rounded-md p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Como ler</div>
            Verde ≤ 1%, amarelo ≤ 5%, vermelho acima. Diferenças grandes indicam meses sem sincronização — abra a aba <span className="font-semibold">Conta Azul → Meses com falha</span> e reprocesse.
            {extratoTot.receitas === 0 && extratoTot.despesas === 0 && (
              <div className="mt-2 text-red-600">Extrato vazio no período. Confira se a sincronização do recurso <em>extrato</em> rodou.</div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-[1fr,140px,80px] text-xs uppercase text-muted-foreground bg-muted/50 px-3 py-2 font-semibold">
            <div>Demonstrativo</div><div className="text-right">Valores</div><div className="text-right">%</div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {linhas.map((row) => (
              <div
                key={row.id}
                className={`grid grid-cols-[1fr,140px,80px] px-3 py-1.5 text-sm border-t border-border ${
                  row.kind === "calc" ? "font-semibold bg-muted/40" : row.kind === "header" ? "font-semibold" : ""
                }`}
              >
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
          <div className="max-h-[520px] overflow-y-auto">
            {movimentos.slice(0, 300).map((m, i) => (
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
            <div>Total ({movimentos.length} lançamentos)</div>
            <div className={`text-right tabular-nums ${totalMov < 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(totalMov)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}


function AnaliseDetalhada() {
  const { centros, pagar, receber, planos } = useContaAzulData();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(0);
  const [visao, setVisao] = useState<Visao>("realizado");
  const [centroId, setCentroId] = useState<string>("");

  const ccs = centros.data ?? [];
  useMemoSetDefault(centroId, setCentroId, ccs);

  const planosArr = planos.data ?? [];

  const { linhas, totais } = useMemo(
    () =>
      montarDRE(pagar.data ?? [], receber.data ?? [], planosArr, {
        ano, mes, visao, centroCustoId: centroId || undefined,
      }),
    [pagar.data, receber.data, planosArr, ano, mes, visao, centroId],
  );


  const rb = totais.RB ?? 0;
  const rl = totais.RL ?? 0;
  const ro = totais.RO ?? 0;
  const rg = totais.RG ?? 0;
  const lu = totais.LU ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-end">
        <div className="min-w-[280px]">
          <label className="text-xs text-muted-foreground">Evento/Projeto</label>
          <Select value={centroId} onValueChange={setCentroId}>
            <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
            <SelectContent>{ccs.map((c) => <SelectItem key={c.external_id} value={c.external_id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Visão</label>
          <ToggleGroup type="single" value={visao} onValueChange={(v) => v && setVisao(v as Visao)} size="sm">
            <ToggleGroupItem value="realizado">Realizado</ToggleGroupItem>
            <ToggleGroupItem value="projetado">Projetado</ToggleGroupItem>
          </ToggleGroup>
        </div>

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
        <KpiCard icon={Piggy} label="Receita Bruta" value={fmtMoney(rb)} />
        <KpiCard icon={TrendingDown} label="Receita Líquida" value={fmtMoney(rl)} subLabel="% RB" subValue={fmtPct(rb ? rl / rb : 0)} />
        <KpiCard icon={Building2} label="Result. Operação" value={fmtMoney(ro)} subColor={ro >= 0 ? "text-green-600" : "text-red-600"} />
        <KpiCard icon={BarChart3} label="Result. Gerencial" value={fmtMoney(rg)} subColor={rg >= 0 ? "text-green-600" : "text-red-600"} />
        <KpiCard icon={Sprout} label="Lucro" value={fmtMoney(lu)} subLabel="% Lucro" subValue={fmtPct(rb ? lu / rb : 0)} subColor={lu >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr,160px,80px] text-xs uppercase text-muted-foreground bg-muted/50 px-3 py-2 font-semibold">
          <div>Demonstrativo</div><div className="text-right">Valores</div><div className="text-right">%</div>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {linhas.map((row) => (
            <div
              key={row.id}
              className={`grid grid-cols-[1fr,160px,80px] px-3 py-1.5 text-sm border-t border-border ${
                row.kind === "calc" ? "font-semibold bg-muted/40" : row.kind === "header" ? "font-semibold" : ""
              }`}
            >
              <div className="truncate" title={row.label}>{row.label}</div>
              <div className={`text-right tabular-nums ${row.valor < 0 ? "text-red-600" : ""}`}>{fmtMoney(row.valor)}</div>
              <div className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct)}</div>
            </div>
          ))}
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
