import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Line, Legend,
} from "recharts";
import { PiggyBank as Piggy, Building2, BarChart3, Sprout, Users, X, ChevronRight, ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DRE_STRUCTURE, grupoDoPlanoNome, isTransferencia, buildPrefixIndex, type DreGroupId, type DreLine } from "@/lib/conta-azul/dre";
import { useDreEstrutura } from "@/hooks/useDreEstrutura";
import { agruparParcelamentos, type GroupedLancRow } from "@/lib/conta-azul/agrupar-parcelas";


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
  observacoes?: string | null;
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
  if (!ano) return true;
  const d = new Date(date);
  if (d.getFullYear() !== ano) return false;
  if (mes > 0 && d.getMonth() + 1 !== mes) return false;
  return true;
}

function normTxt(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Remove prefixos como "01/2025 - ", "108/2025 - ", "2026.03.03 - " do nome do centro. */
function centroNeedle(nome: string | null | undefined): string {
  let s = (nome ?? "").trim();
  // remove "YYYY.MM.DD - " ou "YYYY-MM-DD - "
  s = s.replace(/^\s*\d{2,4}[.\-/]\d{2}[.\-/]\d{2}\s*[-–—]\s*/, "");
  // remove "NN/YYYY - " ou "NNN/YYYY - "
  s = s.replace(/^\s*\d{1,4}\/\d{2,4}\s*[-–—]\s*/, "");
  return normTxt(s);
}

/** Tokens significativos (len>=3, sem números puros) para casamento robusto. */
function needleTokens(needle: string): string[] {
  return needle
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

function rowMatchesText(c: any, needle: string): boolean {
  if (!needle) return true;
  const hay = normTxt(
    [c.descricao, c.observacoes, c.fornecedor_nome, c.cliente_nome].filter(Boolean).join(" | "),
  );
  if (hay.includes(needle)) return true;
  const tokens = needleTokens(needle);
  if (tokens.length === 0) return false;
  return tokens.every((t) => hay.includes(t));
}

export function ContaAzulDashboard() {
  return (
    <Tabs defaultValue="painel" className="w-full">
      <TabsList className="mb-4 print:hidden">
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

function buildPeriodo(ano: number, mes: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const inicio = mes > 0 ? `${ano}-${pad(mes)}-01` : `${ano}-01-01`;
  const fim =
    mes > 0
      ? `${ano}-${pad(mes)}-${pad(new Date(ano, mes, 0).getDate())}`
      : `${ano}-12-31`;
  return { inicio, fim };
}

async function fetchPaged<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return all;
}

function useContaAzulData(ano?: number, mes?: number) {
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

  const hasPeriodo = typeof ano === "number";
  const a = ano ?? new Date().getFullYear();
  const m = mes ?? 0;
  const { inicio, fim } = buildPeriodo(a, m);
  const orFilter = `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`;

  const pagarCols = "external_id,descricao,fornecedor_nome,categoria_external_id,centro_custo_external_id,valor,data_vencimento,data_pagamento,status,observacoes";
  const receberCols = "external_id,descricao,cliente_nome,categoria_external_id,centro_custo_external_id,valor,data_vencimento,data_pagamento,status,observacoes";

  const pagar = useQuery({
    queryKey: ["ca-pagar", hasPeriodo ? a : "all", hasPeriodo ? m : "all"],
    queryFn: () =>
      fetchPaged<ContaPagar>((from, to) => {
        let q = sb.from("ca_contas_pagar").select(pagarCols);
        if (hasPeriodo) q = q.or(orFilter);
        return q.range(from, to);
      }),
  });
  const receber = useQuery({
    queryKey: ["ca-receber", hasPeriodo ? a : "all", hasPeriodo ? m : "all"],
    queryFn: () =>
      fetchPaged<ContaReceber>((from, to) => {
        let q = sb.from("ca_contas_receber").select(receberCols);
        if (hasPeriodo) q = q.or(orFilter);
        return q.range(from, to);
      }),
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
      <div className="text-xl font-bold mt-2 tabular-nums">{value}</div>
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
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState(0);
  const anoEfetivo = ano;
  const { planos, pagar, receber } = useContaAzulData(anoEfetivo, mes);

  const [categoriaSel, setCategoriaSel] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const planosArr = planos.data ?? [];
  const planoMap = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    planosArr.forEach((p) => m.set(p.external_id, { nome: p.nome }));
    return m;
  }, [planosArr]);

  const dreEstrutura = useDreEstrutura().data ?? DRE_STRUCTURE;

  // DRE ano corrente (caixa = realizado)
  const { totais, grupos } = useMemo(
    () => calcularDRECaixa(pagar.data ?? [], receber.data ?? [], planoMap, anoEfetivo, mes, dreEstrutura),
    [pagar.data, receber.data, planoMap, anoEfetivo, mes, dreEstrutura],
  );
  // DRE ano anterior (mesmo mês) para comparativo de Receita LY
  const totaisAnt = useMemo(
    () => calcularDRECaixa(pagar.data ?? [], receber.data ?? [], planoMap, anoEfetivo - 1, mes, dreEstrutura).totais,
    [pagar.data, receber.data, planoMap, anoEfetivo, mes, dreEstrutura],
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
        // TEMP: regime de caixa exige data_pagamento; fallback p/ data_vencimento
        // enquanto o sync do Conta Azul não popula data_pagamento.
        const dataRef = c.data_pagamento ?? c.data_vencimento;
        if (!inPeriodo(dataRef, anoEfetivo, mes)) return;
        const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
        if (isTransferencia(plano?.nome, c.descricao)) return;
        const v = Number(c.valor || 0);
        list.push({
          data: dataRef,
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
    for (const line of dreEstrutura) {
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
    return out;
  }, [totais, grupos, collapsed, planoMap, rb, dreEstrutura]);

  const linhaLucro = useMemo(() => linhasDre.find((r) => r.id === "LU"), [linhasDre]);
  const linhasDreSemLucro = useMemo(() => linhasDre.filter((r) => r.id !== "LU"), [linhasDre]);

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
          <div className="max-h-[600px] overflow-y-auto">
            {linhasDreSemLucro.map((row) => {
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
          {linhaLucro && (
            <div className="grid grid-cols-[1fr,140px,70px] px-3 py-1.5 border-t border-border font-bold bg-muted/60 text-sm">
              <div className="truncate">{linhaLucro.label}</div>
              <div className={`text-right tabular-nums ${linhaLucro.valor < 0 ? "text-rose-600" : ""}`}>{fmtMoney(linhaLucro.valor)}</div>
              <div className="text-right tabular-nums text-muted-foreground">{fmtPct(linhaLucro.pct)}</div>
            </div>
          )}
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

/** DRE por regime configurável, excluindo transferências.
 * - "caixa": só lançamentos pagos, período por data_pagamento (fallback vencimento).
 * - "competencia": todos os lançamentos, período por data_vencimento.
 * Retorna totais por grupo (já com sinal aplicado) e detalhamento por categoria (valor absoluto). */
function calcularDRECaixa(
  pagar: any[],
  receber: any[],
  planoMap: Map<string, { nome: string }>,
  ano: number,
  mes: number,
  estrutura: DreLine[] = DRE_STRUCTURE,
  centroCustoId?: string,
  idsPermitidos?: Set<string>,
  regime: "caixa" | "competencia" = "caixa",
): { totais: Partial<Record<DreGroupId, number>>; grupos: Map<DreGroupId, Map<string, number>> } {
  const grupos = new Map<DreGroupId, Map<string, number>>();
  const totalSum = new Map<DreGroupId, number>();
  const prefixIndex = buildPrefixIndex(estrutura);
  const acumula = (rows: any[]) => {
    rows.forEach((c) => {
      if (regime === "caixa") {
        if (c.status !== "pago") return;
        if (!inPeriodo(c.data_pagamento ?? c.data_vencimento, ano, mes)) return;
      } else {
        if (!inPeriodo(c.data_vencimento, ano, mes)) return;
      }
      if (centroCustoId && c.centro_custo_external_id && c.centro_custo_external_id !== centroCustoId) return;
      if (idsPermitidos && !(c.centro_custo_external_id && idsPermitidos.has(c.centro_custo_external_id))) return;
      const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
      if (isTransferencia(plano?.nome, c.descricao)) return;
      const g = grupoDoPlanoNome(plano?.nome, prefixIndex);
      if (!g) return;
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
    const line = estrutura.find((l) => l.id === id);
    if (!line) { totais[id] = 0; return 0; }
    let v = 0;
    if (line.kind === "sum") v = (totalSum.get(id) ?? 0) * line.sign;
    else if (line.formula) v = line.formula.reduce((s, f) => s + getVal(f), 0);
    totais[id] = v;
    return v;
  };
  estrutura.forEach((l) => getVal(l.id));
  return { totais, grupos };
}



function AnaliseDetalhada() {
  const [centroId, setCentroId] = useState<string>("");
  const [centroSearch, setCentroSearch] = useState("");
  const [centroOpen, setCentroOpen] = useState(false);
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Planos e centros são pequenos — carrega sempre.
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

  const ccs = centros.data ?? [];
  const planosArr = planos.data ?? [];
  const planoMap = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    planosArr.forEach((p) => m.set(p.external_id, { nome: p.nome }));
    return m;
  }, [planosArr]);

  const dreEstrutura = useDreEstrutura().data ?? DRE_STRUCTURE;

  // Filtro exato pelo external_id do centro selecionado — sem agrupamento por nome.
  const enabled = !!centroId;

  // 1. Carrega rateios desse centro (1 linha por fatia).
  const rateios = useQuery({
    queryKey: ["ca-rateios-cc", centroId],
    enabled,
    queryFn: async () => {
      const cols = "lancamento_external_id,tipo,categoria_external_id,valor,ordem";
      return fetchPaged<{
        lancamento_external_id: string;
        tipo: "pagar" | "receber";
        categoria_external_id: string | null;
        valor: number;
        ordem: number;
      }>((from, to) =>
        sb
          .from("ca_lancamento_rateios")
          .select(cols)
          .eq("centro_custo_external_id", centroId)
          .range(from, to),
      );
    },
  });

  const rateiosData = rateios.data ?? [];
  const lancPagarIds = useMemo(
    () => Array.from(new Set(rateiosData.filter((r) => r.tipo === "pagar").map((r) => r.lancamento_external_id))),
    [rateiosData],
  );
  const lancReceberIds = useMemo(
    () => Array.from(new Set(rateiosData.filter((r) => r.tipo === "receber").map((r) => r.lancamento_external_id))),
    [rateiosData],
  );
  const pagarKey = useMemo(() => [...lancPagarIds].sort().join(","), [lancPagarIds]);
  const receberKey = useMemo(() => [...lancReceberIds].sort().join(","), [lancReceberIds]);

  const pagarCols = "external_id,descricao,fornecedor_nome,data_vencimento,data_pagamento,status,observacoes";
  const receberCols = "external_id,descricao,cliente_nome,data_vencimento,data_pagamento,status,observacoes";

  // 2. Enriquece com campos descritivos dos lançamentos-pai (em chunks pra .in() não estourar).
  const pagarParents = useQuery({
    queryKey: ["ca-pagar-parents", pagarKey],
    enabled: enabled && lancPagarIds.length > 0,
    queryFn: async () => {
      const out: any[] = [];
      for (let i = 0; i < lancPagarIds.length; i += 300) {
        const chunk = lancPagarIds.slice(i, i + 300);
        const rows = await fetchPaged<any>((from, to) =>
          sb.from("ca_contas_pagar").select(pagarCols).in("external_id", chunk).range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  });
  const receberParents = useQuery({
    queryKey: ["ca-receber-parents", receberKey],
    enabled: enabled && lancReceberIds.length > 0,
    queryFn: async () => {
      const out: any[] = [];
      for (let i = 0; i < lancReceberIds.length; i += 300) {
        const chunk = lancReceberIds.slice(i, i + 300);
        const rows = await fetchPaged<any>((from, to) =>
          sb.from("ca_contas_receber").select(receberCols).in("external_id", chunk).range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  });

  // Saídas de estoque do evento (movimentacoes tipo=saida). Sem filtro de data — evento inteiro.
  // valor_total nas saídas é sempre NULL na base; calculamos custo = quantidade × itens.valor_unitario.
  const saidasEstoque = useQuery({
    queryKey: ["mov-saidas-evento", centroId],
    enabled,
    queryFn: async () => {
      // (a) saídas simples com item_id direto.
      const simples = await fetchPaged<{
        id: string;
        quantidade: number | null;
        evento_projeto: string | null;
        item_id: string | null;
        itens: { categoria: string | null; valor_unitario: number | null } | null;
      }>((from, to) =>
        sb
          .from("movimentacoes")
          .select("id, quantidade, evento_projeto, item_id, itens(categoria, valor_unitario)")
          .eq("tipo", "saida")
          .range(from, to),
      );

      // (b) saídas compostas (movimentacao_itens) — raras; buscamos linhas cujo pai é saida.
      const composites = await fetchPaged<{
        quantidade: number | null;
        itens: { categoria: string | null; valor_unitario: number | null } | null;
        movimentacoes: { evento_projeto: string | null; tipo: string | null; item_id: string | null } | null;
      }>((from, to) =>
        sb
          .from("movimentacao_itens")
          .select("quantidade, itens(categoria, valor_unitario), movimentacoes!inner(evento_projeto, tipo, item_id)")
          .eq("movimentacoes.tipo", "saida")
          .range(from, to),
      );

      const rows: { valor_total: number; evento_projeto: string | null; itens: { categoria: string | null } | null }[] = [];
      simples.forEach((m) => {
        if (!m.item_id) return; // composite: valor virá em (b)
        const q = Number(m.quantidade || 0);
        const vu = Number(m.itens?.valor_unitario || 0);
        rows.push({ valor_total: q * vu, evento_projeto: m.evento_projeto, itens: m.itens });
      });
      composites.forEach((mi) => {
        const q = Number(mi.quantidade || 0);
        const vu = Number(mi.itens?.valor_unitario || 0);
        rows.push({
          valor_total: q * vu,
          evento_projeto: mi.movimentacoes?.evento_projeto ?? null,
          itens: mi.itens,
        });
      });
      return rows;
    },
  });


  // 3. Monta linhas sintéticas (1 por fatia): herdam descrição/datas/status do pai
  //    e usam valor + categoria da fatia. Quantidade de rateios por lancamento_external_id
  //    determina o badge "Rateado".
  const { pagarRows, receberRows } = useMemo(() => {
    const pPar = new Map<string, any>();
    (pagarParents.data ?? []).forEach((p: any) => pPar.set(p.external_id, p));
    const rPar = new Map<string, any>();
    (receberParents.data ?? []).forEach((p: any) => rPar.set(p.external_id, p));
    const counts = new Map<string, number>();
    rateiosData.forEach((r) => {
      const k = `${r.tipo}|${r.lancamento_external_id}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const pagarRows: any[] = [];
    const receberRows: any[] = [];
    rateiosData.forEach((r) => {
      const par = r.tipo === "pagar" ? pPar.get(r.lancamento_external_id) : rPar.get(r.lancamento_external_id);
      if (!par) return;
      const row = {
        external_id: `${r.lancamento_external_id}#${r.ordem}`,
        descricao: par.descricao,
        fornecedor_nome: par.fornecedor_nome ?? null,
        cliente_nome: par.cliente_nome ?? null,
        categoria_external_id: r.categoria_external_id,
        centro_custo_external_id: centroId,
        valor: r.valor,
        data_vencimento: par.data_vencimento,
        data_pagamento: par.data_pagamento,
        status: par.status,
        observacoes: par.observacoes,
        _rateado: (counts.get(`${r.tipo}|${r.lancamento_external_id}`) ?? 1) > 1,
      };
      if (r.tipo === "pagar") pagarRows.push(row);
      else receberRows.push(row);
    });
    return { pagarRows, receberRows };
  }, [rateiosData, pagarParents.data, receberParents.data, centroId]);

  // Nome do centro selecionado — usado no casamento de saídas de estoque.
  const centroSelNomeEarly = centroId ? (ccs.find((c) => c.external_id === centroId)?.nome ?? "") : "";

  // Índice nome-do-plano (normalizado) -> { external_id, grupo }.
  // Casamento por nome é o critério pedido: itens.categoria == ca_plano_contas.nome.
  const planoPorNome = useMemo(() => {
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const prefixIndex = buildPrefixIndex(dreEstrutura);
    const m = new Map<string, { external_id: string; grupo: DreGroupId | null }>();
    planosArr.forEach((p) => {
      if (!p?.nome) return;
      m.set(norm(p.nome), {
        external_id: p.external_id,
        grupo: grupoDoPlanoNome(p.nome, prefixIndex),
      });
    });
    return m;
  }, [planosArr, dreEstrutura]);

  // Agrega saídas de estoque do evento; mescla direto na linha do plano de contas
  // (mesmo detail key usado pelos rateios do Conta Azul), sem criar linha "(estoque)".
  const stockAgg = useMemo(() => {
    const agg = new Map<DreGroupId, Map<string, number>>();
    const catNames = new Map<string, string>(); // só para fallback SC
    if (!enabled) return { agg, catNames };
    const needle = centroNeedle(centroSelNomeEarly);
    if (!needle) return { agg, catNames };
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    (saidasEstoque.data ?? []).forEach((m) => {
      if (!rowMatchesText({ descricao: m.evento_projeto }, needle)) return;
      const valor = Number(m.valor_total || 0);
      if (!valor) return;
      const catNome = m.itens?.categoria?.trim() || "";
      const hit = catNome ? planoPorNome.get(norm(catNome)) : undefined;
      let g: DreGroupId;
      let key: string;
      if (hit && hit.grupo) {
        g = hit.grupo;
        key = hit.external_id; // mescla com o rateio do Conta Azul da mesma categoria
      } else {
        g = "SC";
        const label = catNome || "Sem categoria";
        key = `stock:${label}`;
        catNames.set(key, label);
      }
      const det = agg.get(g) ?? new Map<string, number>();
      det.set(key, (det.get(key) ?? 0) + valor);
      agg.set(g, det);
    });
    return { agg, catNames };
  }, [saidasEstoque.data, enabled, centroSelNomeEarly, planoPorNome]);

  // Estrutura efetiva do DRE: se houver saídas em SC, adiciona a linha SC (sum, sign -1).
  const estruturaEfetiva = useMemo<DreLine[]>(() => {
    if (!stockAgg.agg.has("SC")) return dreEstrutura;
    if (dreEstrutura.some((l) => l.id === "SC")) return dreEstrutura;
    return [...dreEstrutura, { id: "SC", label: "(?) Sem classificação", kind: "sum", sign: -1, prefixes: [] }];
  }, [dreEstrutura, stockAgg.agg]);

  // Servidor já fatiou pelo centro de custo — sem filtro client-side adicional.
  // Depois, soma por cima as saídas de estoque (não altera lógica do Conta Azul).
  const { totais, grupos } = useMemo(() => {
    const base = calcularDRECaixa(pagarRows, receberRows, planoMap, 0, 0, estruturaEfetiva, undefined, undefined, "competencia");
    if (stockAgg.agg.size === 0) return base;
    const grupos = new Map(base.grupos);
    const totais: Partial<Record<DreGroupId, number>> = { ...base.totais };
    // Merge dos detalhes em grupos.
    stockAgg.agg.forEach((det, g) => {
      const cur = grupos.get(g) ?? new Map<string, number>();
      det.forEach((v, k) => cur.set(k, (cur.get(k) ?? 0) + v));
      grupos.set(g, cur);
    });
    // Recalcula totais do zero a partir de grupos + estruturaEfetiva para propagar nas linhas calc.
    const sumByGroup = new Map<DreGroupId, number>();
    grupos.forEach((det, g) => {
      let s = 0;
      det.forEach((v) => (s += v));
      sumByGroup.set(g, s);
    });
    const getVal = (id: DreGroupId): number => {
      if (totais[id] !== undefined) return totais[id]!;
      const line = estruturaEfetiva.find((l) => l.id === id);
      if (!line) { totais[id] = 0; return 0; }
      let v = 0;
      if (line.kind === "sum") v = (sumByGroup.get(id) ?? 0) * line.sign;
      else if (line.formula) v = line.formula.reduce((s, f) => s + getVal(f), 0);
      totais[id] = v;
      return v;
    };
    // Reset e recompute.
    (Object.keys(totais) as DreGroupId[]).forEach((k) => delete totais[k]);
    estruturaEfetiva.forEach((l) => getVal(l.id));
    return { totais, grupos };
  }, [pagarRows, receberRows, planoMap, estruturaEfetiva, stockAgg]);

  // planoMap estendido com nomes das categorias de estoque, para o rótulo em linhasDre.
  const planoMapExt = useMemo(() => {
    const m = new Map(planoMap);
    stockAgg.catNames.forEach((nome, key) => m.set(key, { nome }));
    return m;
  }, [planoMap, stockAgg.catNames]);

  const rb = totais.RB ?? 0;
  const pv = (totais.AC ?? 0) + (totais.DM ?? 0) + (totais.DC ?? 0);
  const desp = (totais.DS ?? 0) + (totais.DA ?? 0) + (totais.DT ?? 0);
  const custos = (totais.CV ?? 0) + (totais.CD ?? 0) + (totais.CI ?? 0);
  const lucro = totais.LU ?? 0;

  const isLoadingLanc = enabled && (rateios.isLoading || pagarParents.isLoading || receberParents.isLoading);

  const lancamentos = useMemo<LancRow[]>(() => {
    const list: LancRow[] = [];
    const push = (rows: any[], isReceber: boolean) => {
      rows.forEach((c) => {
        const dataRef = c.data_vencimento;
        const plano = c.categoria_external_id ? planoMap.get(c.categoria_external_id) : undefined;
        if (isTransferencia(plano?.nome, c.descricao)) return;
        const v = Number(c.valor || 0);
        list.push({
          data: dataRef,
          nome: isReceber ? c.cliente_nome : c.fornecedor_nome,
          descricao: (c._rateado ? "[Rateado] " : "") + (c.descricao ?? ""),
          valor: isReceber ? v : -v,
          categoria_external_id: c.categoria_external_id,
        });
      });
    };
    push(receberRows, true);
    push(pagarRows, false);
    return list.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  }, [pagarRows, receberRows, planoMap]);





  const lancFiltrados = useMemo(
    () => (categoriaSel ? lancamentos.filter((l) => l.categoria_external_id === categoriaSel) : lancamentos),
    [lancamentos, categoriaSel],
  );
  const totalLanc = lancFiltrados.reduce((s, l) => s + l.valor, 0);
  const categoriaSelNome = categoriaSel ? planoMap.get(categoriaSel)?.nome ?? "" : "";

  // Agrupa parcelamentos (N/M - ... N/M) em uma linha única, expansível.
  // Só ativa quando uma rubrica está selecionada (evita agrupar globalmente).
  const lancAgrupados = useMemo<GroupedLancRow[]>(
    () => (categoriaSel ? agruparParcelamentos(lancFiltrados) : lancFiltrados.map((l) => ({ kind: "single" as const, ...l }))),
    [lancFiltrados, categoriaSel],
  );
  const toggleGroupExpanded = (chave: string) =>
    setExpandedGroups((s) => ({ ...s, [chave]: !s[chave] }));

  const linhasDre = useMemo(() => {
    const out: { kind: "header" | "calc" | "detail"; id: string; label: string; valor: number; pct: number; catId?: string; groupId?: DreGroupId }[] = [];
    const pct = (v: number) => (rb > 0 ? v / rb : 0);
    for (const line of estruturaEfetiva) {
      const v = totais[line.id] ?? 0;
      if (line.kind === "sum") {
        out.push({ kind: "header", id: line.id, label: GROUP_LABEL[line.id] ?? line.label, valor: v, pct: pct(v), groupId: line.id });
        if (!collapsed[line.id]) {
          const det = grupos.get(line.id);
          if (det) {
            Array.from(det.entries())
              .sort((a, b) => (planoMapExt.get(a[0])?.nome ?? "").localeCompare(planoMapExt.get(b[0])?.nome ?? "", "pt-BR"))
              .forEach(([catId, valor]) => {
                const signed = valor * line.sign;
                out.push({
                  kind: "detail",
                  id: `${line.id}:${catId}`,
                  label: planoMapExt.get(catId)?.nome ?? "Sem categoria",
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
    return out;
  }, [totais, grupos, collapsed, planoMapExt, rb, estruturaEfetiva]);

  const linhaLucro = useMemo(() => linhasDre.find((r) => r.id === "LU"), [linhasDre]);
  const linhasDreSemLucro = useMemo(() => linhasDre.filter((r) => r.id !== "LU"), [linhasDre]);

  const toggleGroup = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const onClickCategoria = (catId: string) =>
    setCategoriaSel((cur) => (cur === catId ? null : catId));

  const centroSelNome = centroId ? ccs.find((c) => c.external_id === centroId)?.nome ?? "" : "";
  const ccsFiltrados = useMemo(() => {
    const q = centroSearch.trim().toLowerCase();
    if (!q) return ccs;
    return ccs.filter((c) => c.nome.toLowerCase().includes(q));
  }, [ccs, centroSearch]);

  return (
    <div className="space-y-4 analise-print-root">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; }
          .analise-print-root .max-h-\\[600px\\] { max-height: none !important; overflow: visible !important; }
        }
      `}</style>
      <div className="flex flex-wrap gap-3 items-end justify-between print:hidden">
        <h2 className="text-xl font-bold">Análise Detalhada</h2>
        <div className="flex items-end gap-2">
          <div className="relative w-[360px]">
            <label className="text-xs text-muted-foreground">Evento/Projeto</label>
            <button
              type="button"
              onClick={() => setCentroOpen((o) => !o)}
              className="w-full h-9 px-3 rounded-md border bg-transparent text-sm text-left flex items-center justify-between"
            >
              <span className={centroId ? "" : "text-muted-foreground"}>
                {centroSelNome || "Selecione um projeto…"}
              </span>
              <span className="text-muted-foreground text-xs">▾</span>
            </button>
            {centroOpen && (
              <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md">
                <div className="p-2 border-b">
                  <input
                    autoFocus
                    value={centroSearch}
                    onChange={(e) => setCentroSearch(e.target.value)}
                    placeholder="Buscar evento/projeto…"
                    className="w-full h-8 px-2 text-sm bg-transparent outline-none border rounded"
                  />
                </div>
                <div className="max-h-[280px] overflow-y-auto p-1">
                  {centroId && (
                    <button
                      className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded-sm"
                      onClick={() => { setCentroId(""); setCentroOpen(false); }}
                    >— Limpar seleção —</button>
                  )}
                  {ccsFiltrados.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">Nenhum encontrado.</div>
                  ) : ccsFiltrados.map((c) => (
                    <button
                      key={c.external_id}
                      className={`w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm ${c.external_id === centroId ? "bg-accent" : ""}`}
                      onClick={() => { setCentroId(c.external_id); setCentroOpen(false); setCentroSearch(""); }}
                    >{c.nome}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!centroId}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Luminarte Eventos</h1>
        <div className="text-sm">Demonstrativo por Evento/Projeto — {centroSelNome || "—"}</div>
        <div className="text-xs text-muted-foreground">
          Regime de competência · Emitido em {new Date().toLocaleDateString("pt-BR")}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">


        <KpiCard
          icon={Piggy} label="Receita Bruta" value={fmtMoney(rb)}
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
        <Card className="p-0 overflow-hidden lg:col-span-2">
          <div className="grid grid-cols-[1fr,140px,70px] text-xs uppercase text-muted-foreground bg-muted/60 px-3 py-2 font-semibold">
            <div>Demonstrativo</div>
            <div className="text-right">Valores</div>
            <div className="text-right">%</div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {linhasDreSemLucro.map((row) => {
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
          {linhaLucro && (
            <div className="grid grid-cols-[1fr,140px,70px] px-3 py-1.5 border-t border-border font-bold bg-muted/60 text-sm">
              <div className="truncate">{linhaLucro.label}</div>
              <div className={`text-right tabular-nums ${linhaLucro.valor < 0 ? "text-rose-600" : ""}`}>{fmtMoney(linhaLucro.valor)}</div>
              <div className="text-right tabular-nums text-muted-foreground">{fmtPct(linhaLucro.pct)}</div>
            </div>
          )}
        </Card>

        <Card className="p-0 overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between bg-muted/60 px-3 py-2">
            <div className="text-xs uppercase text-muted-foreground font-semibold">
              Lançamentos {categoriaSel ? <>· filtro: <span className="text-foreground normal-case">{categoriaSelNome}</span></> : <span className="normal-case">· todos do projeto</span>}
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
            {isLoadingLanc ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando lançamentos…</div>
            ) : lancFiltrados.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {centroId ? "Nenhum lançamento neste projeto." : "Selecione um evento/projeto para ver os lançamentos."}
              </div>
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

function FluxoCaixa() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(0);
  const { pagar, receber, extrato, planos } = useContaAzulData(ano, mes);
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
