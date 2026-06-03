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
import { PiggyBank as Piggy, TrendingDown, Building2, BarChart3, Sprout, Users, X, ChevronRight, ChevronDown } from "lucide-react";
import { DRE_STRUCTURE, grupoDoPlanoNome, isTransferencia, type DreGroupId } from "@/lib/conta-azul/dre";
import { montarDRE, totaisExtrato, transferenciasNoPeriodo, type Visao } from "@/lib/conta-azul/dre";


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

type LancRow = {
  data: string | null;
  nome: string | null;
  descricao: string | null;
  valor: number;
  categoria_external_id: string | null;
};

const GROUP_LABEL: Record<string, string> = {
  RB: "(+) Receita Bruta",
  DR: "(-) Deduções da Receita",
  RL: "(=) Receita Líquida",
  AC: "(-) Aquisição de Clientes",
  DM: "(-) Despesas com Marketing",
  DC: "(-) Despesas Comerciais",
  RV: "(=) Resultado de Venda",
  CV: "(-) Custos Variáveis",
  CD: "(-) Custos Diretos",
  CI: "(-) Custos Indiretos",
  RO: "(=) Resultado da Operação",
  DS: "(-) Despesas com Sócio",
  DA: "(-) Despesas Administrativas",
  DT: "(-) Despesas Tributárias",
  RG: "(=) Resultado Gerencial",
  RF_REC: "(+) Receitas Financeiras",
  DF: "(-) Despesas Financeiras",
  RF_TOT: "(=) Resultado Financeiro",
  OE: "(+) Outras Entradas",
  OS: "(-) Outras Saídas",
  RNO: "(=) Resultado Não Operacional",
  RN: "(=) Resultado do Negócio",
  IN: "(-) Investimentos",
  LU: "(=) Lucro",
  SC: "(?) Sem classificação",
};

function PainelFinanceiro() {
  const { planos, pagar, receber } = useContaAzulData();

  const anoDefault = useMemo(() => {
    const all = [
      ...(receber.data ?? []).map((c: any) => c.data_pagamento || c.data_vencimento),
      ...(pagar.data ?? []).map((c: any) => c.data_pagamento || c.data_vencimento),
    ].filter(Boolean) as string[];
    if (!all.length) return new Date().getFullYear();
    return Math.max(...all.map((d) => Number(d.slice(0, 4))));
  }, [receber.data, pagar.data]);

  const [ano, setAno] = useState<number | null>(null);
  const anoEfetivo = ano ?? anoDefault;
  const [mes, setMes] = useState(0);
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const planosArr = planos.data ?? [];
  const planoMap = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    planosArr.forEach((p) => m.set(p.external_id, { nome: p.nome }));
    return m;
  }, [planosArr]);

  // DRE ano corrente (caixa = realizado)
  const { totais, grupos } = useMemo(
    () => calcularDRECaixa(pagar.data ?? [], receber.data ?? [], planoMap, anoEfetivo, mes),
    [pagar.data, receber.data, planoMap, anoEfetivo, mes],
  );
  // DRE ano anterior (mesmo mês) para comparativo de Receita LY
  const totaisAnt = useMemo(
    () => calcularDRECaixa(pagar.data ?? [], receber.data ?? [], planoMap, anoEfetivo - 1, mes).totais,
    [pagar.data, receber.data, planoMap, anoEfetivo, mes],
  );

  const rb = totais.RB ?? 0;
  const pv = (totais.AC ?? 0) + (totais.DM ?? 0) + (totais.DC ?? 0); // já negativo
  const desp = (totais.DS ?? 0) + (totais.DA ?? 0) + (totais.DT ?? 0);
  const custos = (totais.CV ?? 0) + (totais.CD ?? 0) + (totais.CI ?? 0);
  const lucro = totais.LU ?? 0;
  const rbAnt = totaisAnt.RB ?? 0;
  const yoyRb = rbAnt > 0 ? (rb - rbAnt) / rbAnt : null;

  // Lançamentos do período (regime de caixa, sem transferências)
  const lancamentos = useMemo<LancRow[]>(() => {
    const list: LancRow[] = [];
    const push = (rows: any[], isReceber: boolean) => {
      rows.forEach((c) => {
        if (c.status !== "pago") return;
        if (!inPeriodo(c.data_pagamento, anoEfetivo, mes)) return;
        const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
        if (isTransferencia(plano?.nome, c.descricao)) return;
        const v = Number(c.valor || 0);
        list.push({
          data: c.data_pagamento,
          nome: isReceber ? c.cliente_nome : c.fornecedor_nome,
          descricao: c.descricao,
          valor: isReceber ? v : -v,
          categoria_external_id: c.categoria_external_id,
        });
      });
    };
    push(receber.data ?? [], true);
    push(pagar.data ?? [], false);
    return list.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  }, [pagar.data, receber.data, planoMap, anoEfetivo, mes]);

  const lancFiltrados = useMemo(
    () => (categoriaSel ? lancamentos.filter((l) => l.categoria_external_id === categoriaSel) : lancamentos),
    [lancamentos, categoriaSel],
  );
  const totalLanc = lancFiltrados.reduce((s, l) => s + l.valor, 0);
  const categoriaSelNome = categoriaSel ? planoMap.get(categoriaSel)?.nome ?? "" : "";

  // Linhas do Demonstrativo (estrutura oficial, com categorias expansíveis)
  const linhasDre = useMemo(() => {
    const out: { kind: "header" | "calc" | "detail"; id: string; label: string; valor: number; pct: number; catId?: string; groupId?: DreGroupId }[] = [];
    const pct = (v: number) => (rb > 0 ? v / rb : 0);
    for (const line of DRE_STRUCTURE) {
      const v = totais[line.id] ?? 0;
      if (line.kind === "sum") {
        out.push({ kind: "header", id: line.id, label: GROUP_LABEL[line.id] ?? line.label, valor: v, pct: pct(v), groupId: line.id });
        if (!collapsed[line.id]) {
          const det = grupos.get(line.id);
          if (det) {
            Array.from(det.entries())
              .sort((a, b) => (planoMap.get(a[0])?.nome ?? "").localeCompare(planoMap.get(b[0])?.nome ?? "", "pt-BR"))
              .forEach(([catId, valor]) => {
                const signed = valor * line.sign;
                out.push({
                  kind: "detail",
                  id: `${line.id}:${catId}`,
                  label: planoMap.get(catId)?.nome ?? "Sem categoria",
                  valor: signed,
                  pct: pct(signed),
                  catId,
                });
              });
          }
        }
      } else {
        out.push({ kind: "calc", id: line.id, label: GROUP_LABEL[line.id] ?? line.label, valor: v, pct: pct(v) });
      }
    }
    // Sem classificação
    const sc = grupos.get("SC");
    if (sc && sc.size > 0) {
      const total = Array.from(sc.values()).reduce((s, v) => s + v, 0);
      out.push({ kind: "header", id: "SC", label: GROUP_LABEL.SC, valor: total, pct: pct(total), groupId: "SC" });
      if (!collapsed.SC) {
        Array.from(sc.entries())
          .sort((a, b) => (planoMap.get(a[0])?.nome ?? "").localeCompare(planoMap.get(b[0])?.nome ?? "", "pt-BR"))
          .forEach(([catId, valor]) => {
            out.push({ kind: "detail", id: `SC:${catId}`, label: planoMap.get(catId)?.nome ?? "Sem categoria", valor, pct: pct(valor), catId });
          });
      }
    }
    return out;
  }, [totais, grupos, collapsed, planoMap, rb]);

  const toggleGroup = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const onClickCategoria = (catId: string) =>
    setCategoriaSel((cur) => (cur === catId ? null : catId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <h2 className="text-xl font-bold">Painel Financeiro</h2>
        <div className="flex gap-3">
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Ano</label>
            <Select value={String(anoEfetivo)} onValueChange={(v) => setAno(Number(v))}>
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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Piggy} label="Receita Bruta" value={fmtMoney(rb)}
          subLabel="% Receita LY"
          subValue={yoyRb === null ? "—" : fmtPct(yoyRb)}
          subColor={yoyRb === null ? "text-muted-foreground" : yoyRb >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <KpiCard
          icon={Users} label="Pot. de Vendas" value={fmtMoney(pv)}
          subLabel="% PV" subValue={fmtPct(rb ? pv / rb : 0)}
          subColor={pv >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <KpiCard
          icon={Building2} label="Despesas" value={fmtMoney(desp)}
          subLabel="% Despesa" subValue={fmtPct(rb ? desp / rb : 0)}
          subColor="text-rose-600"
        />
        <KpiCard
          icon={BarChart3} label="Custos" value={fmtMoney(custos)}
          subLabel="% Custos" subValue={fmtPct(rb ? custos / rb : 0)}
          subColor="text-rose-600"
        />
        <KpiCard
          icon={Sprout} label="Lucro" value={fmtMoney(lucro)}
          subLabel="% Lucro" subValue={fmtPct(rb ? lucro / rb : 0)}
          subColor={lucro >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* DRE */}
        <Card className="p-0 overflow-hidden lg:col-span-2">
          <div className="grid grid-cols-[1fr,140px,70px] text-xs uppercase text-muted-foreground bg-muted/60 px-3 py-2 font-semibold">
            <div>Demonstrativo</div>
            <div className="text-right">Valores</div>
            <div className="text-right">%</div>
          </div>
          <div>
            {linhasDre.map((row) => {
              if (row.kind === "header") {
                const isOpen = !collapsed[row.id];
                return (
                  <button
                    key={row.id}
                    onClick={() => toggleGroup(row.id)}
                    className="grid grid-cols-[1fr,140px,70px] w-full px-3 py-1.5 border-t border-border font-semibold text-sm hover:bg-muted/40 text-left"
                  >
                    <div className="flex items-center gap-1 truncate">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{row.label}</span>
                    </div>
                    <div className={`text-right tabular-nums ${row.valor < 0 ? "text-rose-600" : ""}`}>{fmtMoney(row.valor)}</div>
                    <div className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct)}</div>
                  </button>
                );
              }
              if (row.kind === "calc") {
                return (
                  <div key={row.id} className="grid grid-cols-[1fr,140px,70px] px-3 py-1.5 border-t border-border font-bold bg-muted/30 text-sm">
                    <div className="truncate">{row.label}</div>
                    <div className={`text-right tabular-nums ${row.valor < 0 ? "text-rose-600" : ""}`}>{fmtMoney(row.valor)}</div>
                    <div className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct)}</div>
                  </div>
                );
              }
              const isSel = row.catId === categoriaSel;
              return (
                <button
                  key={row.id}
                  onClick={() => row.catId && onClickCategoria(row.catId)}
                  className={`grid grid-cols-[1fr,140px,70px] w-full px-3 py-1 border-t border-border text-xs text-left hover:bg-accent ${isSel ? "bg-accent" : ""}`}
                >
                  <div className="pl-7 truncate" title={row.label}>{row.label}</div>
                  <div className={`text-right tabular-nums ${row.valor < 0 ? "text-rose-600" : ""}`}>{fmtMoney(row.valor)}</div>
                  <div className="text-right tabular-nums text-muted-foreground">{fmtPct(row.pct)}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Lançamentos */}
        <Card className="p-0 overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between bg-muted/60 px-3 py-2">
            <div className="text-xs uppercase text-muted-foreground font-semibold">
              Lançamentos {categoriaSel ? <>· filtro: <span className="text-foreground normal-case">{categoriaSelNome}</span></> : <span className="normal-case">· todos do período</span>}
            </div>
            {categoriaSel && (
              <button onClick={() => setCategoriaSel(null)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-[110px,1fr,1.4fr,130px] text-xs uppercase text-muted-foreground bg-muted/30 px-3 py-2 font-semibold">
            <div>Data movimento</div>
            <div>Nome do fornecedor/cliente</div>
            <div>Descrição</div>
            <div className="text-right">Valor Total</div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {lancFiltrados.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum lançamento no período.</div>
            )}
            {lancFiltrados.slice(0, 1000).map((l, i) => (
              <div key={i} className="grid grid-cols-[110px,1fr,1.4fr,130px] px-3 py-1.5 text-sm border-t border-border">
                <div className="text-muted-foreground">{l.data?.slice(0, 10) ?? "—"}</div>
                <div className="truncate">{l.nome ?? "—"}</div>
                <div className="truncate text-muted-foreground" title={l.descricao ?? ""}>{l.descricao ?? "—"}</div>
                <div className={`text-right tabular-nums ${l.valor < 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtMoney(l.valor)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr,130px] px-3 py-2 text-sm font-bold bg-muted/40 border-t">
            <div>Total ({lancFiltrados.length})</div>
            <div className={`text-right tabular-nums ${totalLanc < 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtMoney(totalLanc)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** DRE em regime de caixa (status='pago', por data_pagamento), excluindo transferências.
 * Retorna totais por grupo (já com sinal aplicado) e detalhamento por categoria (valor absoluto). */
function calcularDRECaixa(
  pagar: any[],
  receber: any[],
  planoMap: Map<string, { nome: string }>,
  ano: number,
  mes: number,
): { totais: Partial<Record<DreGroupId, number>>; grupos: Map<DreGroupId, Map<string, number>> } {
  const grupos = new Map<DreGroupId, Map<string, number>>();
  const totalSum = new Map<DreGroupId, number>();
  const acumula = (rows: any[]) => {
    rows.forEach((c) => {
      if (c.status !== "pago") return;
      if (!inPeriodo(c.data_pagamento, ano, mes)) return;
      const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
      if (isTransferencia(plano?.nome, c.descricao)) return;
      const g = grupoDoPlanoNome(plano?.nome);
      const v = Math.abs(Number(c.valor || 0));
      const k = c.categoria_external_id ?? "_";
      const det = grupos.get(g) ?? new Map<string, number>();
      det.set(k, (det.get(k) ?? 0) + v);
      grupos.set(g, det);
      totalSum.set(g, (totalSum.get(g) ?? 0) + v);
    });
  };
  acumula(pagar);
  acumula(receber);

  const totais: Partial<Record<DreGroupId, number>> = {};
  const getVal = (id: DreGroupId): number => {
    if (totais[id] !== undefined) return totais[id]!;
    const line = DRE_STRUCTURE.find((l) => l.id === id)!;
    let v = 0;
    if (line.kind === "sum") v = (totalSum.get(id) ?? 0) * line.sign;
    else if (line.formula) v = line.formula.reduce((s, f) => s + getVal(f), 0);
    totais[id] = v;
    return v;
  };
  DRE_STRUCTURE.forEach((l) => getVal(l.id));
  return { totais, grupos };
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
