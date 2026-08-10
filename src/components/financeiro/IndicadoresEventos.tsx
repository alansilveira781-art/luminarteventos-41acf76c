// Indicadores por evento/categoria — Receita Bruta, Custos, Despesas e Lucro Líquido
// com linha do tempo mensal e comparativo de até 3 eventos.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2, Printer, ChevronsUpDown } from "lucide-react";
import { normalize } from "@/lib/utils";
import { buildPrefixIndex, grupoDoPlanoNome, isTransferencia, DRE_STRUCTURE, type DreGroupId } from "@/lib/conta-azul/dre";
import { useDreEstrutura } from "@/hooks/useDreEstrutura";

const sb = supabase as any;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlFull = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (parte: number, base: number) =>
  base ? `${((parte / base) * 100).toFixed(1).replace(".", ",")}%` : "—";

const GRUPOS_CUSTO: DreGroupId[] = ["CV", "CD", "CI"];
const GRUPOS_DESPESA: DreGroupId[] = ["AC", "DM", "DC", "DS", "DA", "DT", "DF", "OS"];
const GRUPOS_OUTRAS_ENTRADAS: DreGroupId[] = ["OE", "RF_REC"];

async function fetchPaged<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return out;
}

type Fatia = {
  centro: string;
  categoria_external_id: string | null;
  valor: number;
  data: string | null; // vencimento (competência)
  descricao: string | null;
};

async function carregarFatias(centroIds: string[]): Promise<Fatia[]> {
  if (!centroIds.length) return [];
  const rateios: any[] = [];
  for (let i = 0; i < centroIds.length; i += 50) {
    const chunk = centroIds.slice(i, i + 50);
    const rows = await fetchPaged<any>((from, to) =>
      sb
        .from("ca_lancamento_rateios")
        .select("lancamento_external_id,tipo,categoria_external_id,valor,centro_custo_external_id")
        .in("centro_custo_external_id", chunk)
        .range(from, to),
    );
    rateios.push(...rows);
  }
  if (!rateios.length) return [];

  const ids = { pagar: new Set<string>(), receber: new Set<string>() };
  rateios.forEach((r) => ids[r.tipo as "pagar" | "receber"]?.add(r.lancamento_external_id));

  const parentMap = new Map<string, { data: string | null; descricao: string | null }>();
  const carregarParents = async (tabela: string, lista: string[]) => {
    for (let i = 0; i < lista.length; i += 300) {
      const chunk = lista.slice(i, i + 300);
      const rows = await fetchPaged<any>((from, to) =>
        sb.from(tabela).select("external_id,descricao,data_vencimento").in("external_id", chunk).range(from, to),
      );
      rows.forEach((p) =>
        parentMap.set(`${tabela}:${p.external_id}`, { data: p.data_vencimento ?? null, descricao: p.descricao ?? null }),
      );
    }
  };
  await carregarParents("ca_contas_pagar", [...ids.pagar]);
  await carregarParents("ca_contas_receber", [...ids.receber]);

  return rateios.map((r) => {
    const tabela = r.tipo === "pagar" ? "ca_contas_pagar" : "ca_contas_receber";
    const p = parentMap.get(`${tabela}:${r.lancamento_external_id}`);
    return {
      centro: r.centro_custo_external_id as string,
      categoria_external_id: r.categoria_external_id ?? null,
      valor: Math.abs(Number(r.valor || 0)),
      data: p?.data ?? null,
      descricao: p?.descricao ?? null,
    };
  });
}

type Totais = { receita: number; deducoes: number; custos: number; despesas: number; outras: number; lucro: number };
const zero = (): Totais => ({ receita: 0, deducoes: 0, custos: 0, despesas: 0, outras: 0, lucro: 0 });
const fecharLucro = (t: Totais): Totais => ({
  ...t,
  lucro: t.receita - t.deducoes - t.custos - t.despesas + t.outras,
});

export function IndicadoresEventos() {
  const hoje = new Date();
  const [ano, setAno] = useState<number>(2026);
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1); // 0 = ano inteiro
  const [categoria, setCategoria] = useState<string>("Todas");
  const [eventoSel, setEventoSel] = useState<string>("");
  const [comparar, setComparar] = useState<string[]>([]);

  const dreEstrutura = useDreEstrutura().data ?? DRE_STRUCTURE;
  const prefixIndex = useMemo(() => buildPrefixIndex(dreEstrutura), [dreEstrutura]);

  const planos = useQuery({
    queryKey: ["ca-plano"],
    queryFn: async () => {
      const { data } = await sb.from("ca_plano_contas").select("external_id,nome");
      return (data ?? []) as { external_id: string; nome: string }[];
    },
  });
  const planoMap = useMemo(
    () => new Map((planos.data ?? []).map((p) => [p.external_id, p.nome])),
    [planos.data],
  );

  const centros = useQuery({
    queryKey: ["ca-centros"],
    queryFn: async () => {
      const { data } = await sb.from("ca_centros_custo").select("external_id,nome").eq("ativo", true);
      return (data ?? []) as { external_id: string; nome: string }[];
    },
  });

  // Categoria do evento: comercial_vendas.tipo_evento (por nome) com fallback em eventos.tipo.
  const catalogoCategorias = useQuery({
    queryKey: ["indicadores-categorias-eventos"],
    queryFn: async () => {
      const [{ data: vendas }, { data: eventos }] = await Promise.all([
        sb.from("comercial_vendas").select("nome_evento,tipo_evento"),
        sb.from("eventos").select("nome,tipo"),
      ]);
      const map = new Map<string, string>();
      ((eventos ?? []) as any[]).forEach((e) => {
        const k = normalize(e.nome ?? "");
        if (k && e.tipo) map.set(k, String(e.tipo));
      });
      ((vendas ?? []) as any[]).forEach((v) => {
        const k = normalize(v.nome_evento ?? "");
        if (k && v.tipo_evento) map.set(k, String(v.tipo_evento));
      });
      return map;
    },
  });

  const categoriaDoCentro = (nome: string): string | null => {
    const map = catalogoCategorias.data;
    if (!map) return null;
    const k = normalize(nome ?? "");
    if (!k) return null;
    if (map.has(k)) return map.get(k)!;
    for (const [nomeEvento, cat] of map) {
      if (nomeEvento.length >= 4 && (k.includes(nomeEvento) || nomeEvento.includes(k))) return cat;
    }
    return null;
  };

  const centrosComCategoria = useMemo(
    () =>
      (centros.data ?? []).map((c) => ({ ...c, categoria: categoriaDoCentro(c.nome) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [centros.data, catalogoCategorias.data],
  );

  const categoriasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    centrosComCategoria.forEach((c) => { if (c.categoria) s.add(c.categoria); });
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [centrosComCategoria]);

  const centrosFiltrados = useMemo(
    () => (categoria === "Todas" ? centrosComCategoria : centrosComCategoria.filter((c) => c.categoria === categoria)),
    [centrosComCategoria, categoria],
  );

  // Escopo principal: evento selecionado ou todos os eventos da categoria.
  const escopoIds = useMemo(() => {
    if (eventoSel) return [eventoSel];
    return centrosFiltrados.slice(0, 60).map((c) => c.external_id);
  }, [eventoSel, centrosFiltrados]);

  const idsChave = useMemo(() => [...escopoIds].sort().join(","), [escopoIds]);

  const fatias = useQuery({
    queryKey: ["indicadores-fatias", idsChave],
    enabled: escopoIds.length > 0 && !!planos.data,
    queryFn: () => carregarFatias(escopoIds),
  });

  const comparativoIds = useMemo(() => comparar.slice(0, 3), [comparar]);
  const compChave = useMemo(() => [...comparativoIds].sort().join(","), [comparativoIds]);
  const fatiasComp = useQuery({
    queryKey: ["indicadores-fatias-comp", compChave],
    enabled: comparativoIds.length > 0 && !!planos.data,
    queryFn: () => carregarFatias(comparativoIds),
  });

  function classificar(f: Fatia): { grupo: DreGroupId | null } {
    const nome = f.categoria_external_id ? planoMap.get(f.categoria_external_id) : undefined;
    if (isTransferencia(nome, f.descricao)) return { grupo: null };
    return { grupo: grupoDoPlanoNome(nome, prefixIndex) };
  }

  function acumular(lista: Fatia[], filtro: (f: Fatia) => boolean): Totais {
    const t = zero();
    lista.forEach((f) => {
      if (!filtro(f)) return;
      const { grupo } = classificar(f);
      if (!grupo) return;
      if (grupo === "RB") t.receita += f.valor;
      else if (grupo === "DR") t.deducoes += f.valor;
      else if (GRUPOS_CUSTO.includes(grupo)) t.custos += f.valor;
      else if (GRUPOS_DESPESA.includes(grupo)) t.despesas += f.valor;
      else if (GRUPOS_OUTRAS_ENTRADAS.includes(grupo)) t.outras += f.valor;
    });
    return fecharLucro(t);
  }

  const noPeriodo = (f: Fatia) => {
    if (!f.data) return false;
    if (Number(f.data.slice(0, 4)) !== ano) return false;
    if (mes > 0 && Number(f.data.slice(5, 7)) !== mes) return false;
    return true;
  };

  const dados = fatias.data ?? [];
  const totais = useMemo(() => acumular(dados, noPeriodo), [dados, ano, mes, planoMap, prefixIndex]);

  const anterior = useMemo(() => {
    const filtro = (f: Fatia) => {
      if (!f.data) return false;
      const y = Number(f.data.slice(0, 4));
      const m = Number(f.data.slice(5, 7));
      if (mes > 0) {
        const anoAnt = mes === 1 ? ano - 1 : ano;
        const mesAnt = mes === 1 ? 12 : mes - 1;
        return y === anoAnt && m === mesAnt;
      }
      return y === ano - 1;
    };
    return acumular(dados, filtro);
  }, [dados, ano, mes, planoMap, prefixIndex]);

  const timeline = useMemo(() => {
    return MESES.map((nome, i) => {
      const t = acumular(dados, (f) => !!f.data && Number(f.data.slice(0, 4)) === ano && Number(f.data.slice(5, 7)) === i + 1);
      return {
        mes: nome.slice(0, 3),
        Receita: Math.round(t.receita),
        Custos: Math.round(t.custos),
        Despesas: Math.round(t.despesas),
        Lucro: Math.round(t.lucro),
      };
    });
  }, [dados, ano, planoMap, prefixIndex]);

  const comparativo = useMemo(() => {
    const lista = fatiasComp.data ?? [];
    return comparativoIds.map((id) => {
      const nome = centrosComCategoria.find((c) => c.external_id === id)?.nome ?? id;
      const t = acumular(lista, (f) => f.centro === id && noPeriodo(f));
      return { id, nome, ...t };
    });
  }, [fatiasComp.data, comparativoIds, centrosComCategoria, ano, mes, planoMap, prefixIndex]);

  const carregando = fatias.isFetching || planos.isLoading || centros.isLoading;

  const variacao = (atual: number, ant: number) =>
    ant ? `${(((atual - ant) / Math.abs(ant)) * 100).toFixed(1).replace(".", ",")}%` : "—";

  const eventoNome = eventoSel
    ? eventosCalendarioOpcoes.find((e) => e.external_id === eventoSel)?.nome
      ?? centrosComCategoria.find((c) => c.external_id === eventoSel)?.nome ?? ""
    : "";
  const eventoCategoria = eventoSel
    ? eventosCalendarioOpcoes.find((e) => e.external_id === eventoSel)?.categoria
      ?? centrosComCategoria.find((c) => c.external_id === eventoSel)?.categoria ?? "Sem categoria"
    : "";


  const anos = [2024, 2025, 2026, 2027];

  return (
    <div className="space-y-4 print:space-y-3">
      <Card className="p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ano inteiro</SelectItem>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase">Categoria</Label>
            <Select
              value={categoria}
              disabled={!!eventoSel}
              onValueChange={(v) => { setCategoria(v); setEventoSel(""); setComparar([]); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas</SelectItem>
                {categoriasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase">Evento (calendário)</Label>
            <Popover open={eventoOpen} onOpenChange={setEventoOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate text-left">{eventoNome || "Todos da categoria"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[360px] p-2">
                <Input
                  autoFocus
                  value={eventoBusca}
                  onChange={(e) => setEventoBusca(e.target.value)}
                  placeholder="Buscar evento do calendário…"
                  className="mb-2 h-9"
                />
                <div className="max-h-72 overflow-auto">
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => { setEventoSel(""); setEventoOpen(false); setEventoBusca(""); }}
                  >
                    Todos da categoria
                  </button>
                  {eventosFiltrados.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">Nenhum evento encontrado.</div>
                  )}
                  {eventosFiltrados.map((e) => (
                    <button
                      key={e.external_id}
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setEventoSel(e.external_id);
                        setCategoria(e.categoria ?? "Todas");
                        setComparar([]);
                        setEventoOpen(false);
                        setEventoBusca("");
                      }}
                    >
                      <div className="truncate font-medium">{e.nome}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[e.categoria ?? "Sem categoria", e.local, e.data].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-between">
                  Comparar ({comparativoIds.length}/3)
                  <ChevronsUpDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-h-80 overflow-auto p-2">
                {centrosFiltrados.length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">Nenhum evento nesta categoria.</div>
                )}
                {centrosFiltrados.map((c) => {
                  const marcado = comparar.includes(c.external_id);
                  const bloqueado = !marcado && comparar.length >= 3;
                  return (
                    <label
                      key={c.external_id}
                      className={`flex items-start gap-2 rounded px-2 py-1.5 text-sm ${bloqueado ? "opacity-40" : "hover:bg-muted cursor-pointer"}`}
                    >
                      <Checkbox
                        checked={marcado}
                        disabled={bloqueado}
                        onCheckedChange={(v) =>
                          setComparar((prev) =>
                            v ? [...prev, c.external_id].slice(0, 3) : prev.filter((x) => x !== c.external_id),
                          )
                        }
                      />
                      <span className="leading-tight">{c.nome}</span>
                    </label>
                  );
                })}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => window.print()} title="Imprimir">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        {eventoSel
          ? <>Evento: <span className="text-foreground font-medium">{eventoNome}</span> · Categoria: <span className="text-foreground font-medium">{eventoCategoria || "—"}</span></>
          : <>Categoria: <span className="text-foreground font-medium">{categoria}</span> · {centrosFiltrados.length} evento(s)</>}
        {" · "}{mes > 0 ? `${MESES[mes - 1]}/${ano}` : ano}
        {carregando && <Loader2 className="inline h-3.5 w-3.5 ml-2 animate-spin" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita Bruta" valor={totais.receita} base={totais.receita} variacao={variacao(totais.receita, anterior.receita)} />
        <Kpi label="Custos" valor={totais.custos} base={totais.receita} variacao={variacao(totais.custos, anterior.custos)} negativo />
        <Kpi label="Despesas" valor={totais.despesas} base={totais.receita} variacao={variacao(totais.despesas, anterior.despesas)} negativo />
        <Kpi label="Lucro Líquido" valor={totais.lucro} base={totais.receita} variacao={variacao(totais.lucro, anterior.lucro)} destaque />
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Linha do tempo — {ano}</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="mes" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => brl(Number(v))} width={90} />
            <Tooltip formatter={(v: any) => brlFull(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Custos" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Lucro" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-sm font-semibold">Comparativo de eventos {categoria !== "Todas" ? `· ${categoria}` : ""}</div>
          <div className="text-xs text-muted-foreground">
            {comparativoIds.length ? `${comparativoIds.length} evento(s)` : "Selecione até 3 eventos em “Comparar”"}
            {fatiasComp.isFetching && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
          </div>
        </div>

        {comparativo.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum evento selecionado para comparação.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left py-2">Indicador</th>
                    {comparativo.map((c) => (
                      <th key={c.id} className="text-right py-2 px-2 min-w-[150px]">{c.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <LinhaComp titulo="Receita Bruta" itens={comparativo} pick={(c) => c.receita} />
                  <LinhaComp titulo="Custos" itens={comparativo} pick={(c) => c.custos} percentual />
                  <LinhaComp titulo="Despesas" itens={comparativo} pick={(c) => c.despesas} percentual />
                  <LinhaComp titulo="Lucro Líquido" itens={comparativo} pick={(c) => c.lucro} percentual destaque />
                </tbody>
              </table>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={comparativo.map((c) => ({
                  nome: c.nome.length > 22 ? `${c.nome.slice(0, 22)}…` : c.nome,
                  Receita: Math.round(c.receita),
                  Custos: Math.round(c.custos),
                  Despesas: Math.round(c.despesas),
                  Lucro: Math.round(c.lucro),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="nome" fontSize={10} />
                <YAxis fontSize={11} tickFormatter={(v) => brl(Number(v))} width={90} />
                <Tooltip formatter={(v: any) => brlFull(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Custos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  label, valor, base, variacao, negativo, destaque,
}: { label: string; valor: number; base: number; variacao: string; negativo?: boolean; destaque?: boolean }) {
  const cor = destaque ? (valor >= 0 ? "text-emerald-600" : "text-rose-600") : negativo ? "text-rose-600" : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${cor}`}>{brlFull(valor)}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {pct(valor, base)} da receita · vs. período anterior: {variacao}
      </div>
    </Card>
  );
}

function LinhaComp({
  titulo, itens, pick, percentual, destaque,
}: {
  titulo: string;
  itens: { id: string; receita: number }[] & any[];
  pick: (c: any) => number;
  percentual?: boolean;
  destaque?: boolean;
}) {
  return (
    <tr className={`border-b last:border-0 ${destaque ? "font-semibold" : ""}`}>
      <td className="py-2">{titulo}</td>
      {itens.map((c) => (
        <td key={c.id} className="text-right py-2 px-2 tabular-nums">
          {brlFull(pick(c))}
          {percentual && (
            <span className="block text-[11px] text-muted-foreground">{pct(pick(c), c.receita)}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
