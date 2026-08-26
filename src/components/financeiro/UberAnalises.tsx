import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, BarChart,
} from "recharts";
import { fetchAllRows } from "@/lib/fetch-all";
import { CHART_SERIES, CHART_BASE, CHART_ACCENT } from "@/lib/financeiro/chart-colors";
import { capturarGraficos, gerarUberPdf } from "@/lib/uber/uber-pdf";
import {
  bucketDe, diffDays, escolherGranularidade, faixaHoraria, diaDaSemana,
  granularidadeLabel, granularidadeLabelPlural,
  type Granularidade, type GranularidadeOpt,
} from "@/lib/uber/analises";

type Corrida = {
  id: string;
  data_solicitacao: string;
  hora_solicitacao: string | null;
  nome: string | null;
  sobrenome: string | null;
  servico: string | null;
  cidade: string | null;
  endereco_partida: string | null;
  endereco_destino: string | null;
  valor: number;
  projeto: string | null;
  detalhamento: string | null;
};

const COLORS = CHART_SERIES;
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtN = (n: number) => n.toLocaleString("pt-BR");
const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

function todayIso() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthIso(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}
function firstOfYearIso() { return `${new Date().getFullYear()}-01-01`; }

type Agg = { chave: string; label: string; total: number; corridas: number };

function agrupar(trips: Corrida[], keyOf: (t: Corrida) => string | null): Agg[] {
  const map = new Map<string, Agg>();
  trips.forEach((t) => {
    const k = keyOf(t);
    if (!k) return;
    const cur = map.get(k) ?? { chave: k, label: k, total: 0, corridas: 0 };
    cur.total += t.valor ?? 0;
    cur.corridas += 1;
    map.set(k, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function UberAnalises() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["uber-corridas-all"],
    queryFn: async () => {
      const rows = await fetchAllRows<Corrida>(
        "uber_corridas",
        "id, data_solicitacao, hora_solicitacao, nome, sobrenome, servico, cidade, endereco_partida, endereco_destino, valor, projeto, detalhamento",
        { orderBy: { column: "data_solicitacao", ascending: false } },
      );
      return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
    },
    staleTime: 30 * 1000,
  });

  const allTrips = data ?? [];

  const areaRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState(() => firstOfMonthIso(-2));
  const [dateTo, setDateTo] = useState(() => todayIso());
  const [solicitante, setSolicitante] = useState("__all__");
  const [projeto, setProjeto] = useState("__all__");
  const [granOpt, setGranOpt] = useState<GranularidadeOpt>("auto");

  const nomeDe = (t: Corrida) => [t.nome, t.sobrenome].filter(Boolean).join(" ").trim();

  const solicitantesOptions = useMemo(() => {
    const set = new Set<string>();
    allTrips.forEach((t) => { const n = nomeDe(t); if (n) set.add(n); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allTrips]);

  const projetosOptions = useMemo(() => {
    const set = new Set<string>();
    allTrips.forEach((t) => { const p = (t.projeto || "").trim(); if (p) set.add(p); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allTrips]);

  const trips = useMemo(() => allTrips.filter((t) => {
    if (dateFrom && t.data_solicitacao < dateFrom) return false;
    if (dateTo && t.data_solicitacao > dateTo) return false;
    if (solicitante !== "__all__" && nomeDe(t) !== solicitante) return false;
    if (projeto !== "__all__" && (t.projeto || "").trim() !== projeto) return false;
    return true;
  }), [allTrips, dateFrom, dateTo, solicitante, projeto]);

  const limites = useMemo(() => {
    if (dateFrom && dateTo) return { ini: dateFrom, fim: dateTo };
    const datas = trips.map((t) => t.data_solicitacao).sort();
    if (!datas.length) return { ini: todayIso(), fim: todayIso() };
    return { ini: dateFrom || datas[0], fim: dateTo || datas[datas.length - 1] };
  }, [dateFrom, dateTo, trips]);

  const dias = diffDays(limites.ini, limites.fim);
  const gran: Granularidade = granOpt === "auto" ? escolherGranularidade(dias) : granOpt;

  const evolucao = useMemo(() => {
    const map = new Map<string, { key: string; label: string; valor: number; corridas: number }>();
    trips.forEach((t) => {
      const b = bucketDe(t.data_solicitacao, gran);
      const cur = map.get(b.key) ?? { key: b.key, label: b.label, valor: 0, corridas: 0 };
      cur.valor += t.valor ?? 0;
      cur.corridas += 1;
      map.set(b.key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({ ...b, valor: Math.round(b.valor * 100) / 100 }));
  }, [trips, gran]);

  const kpis = useMemo(() => {
    const total = trips.reduce((s, t) => s + (t.valor ?? 0), 0);
    const count = trips.length;
    const ticket = count ? total / count : 0;
    const pessoas = new Set(trips.map(nomeDe).filter(Boolean)).size;
    const projetos = new Set(trips.map((t) => (t.projeto || "").trim()).filter(Boolean)).size;
    const media = evolucao.length ? total / evolucao.length : 0;
    const ordenado = evolucao.slice().sort((a, b) => b.valor - a.valor);
    const maior = ordenado[0] ?? null;
    const menor = ordenado[ordenado.length - 1] ?? null;
    const ultimo = evolucao[evolucao.length - 1] ?? null;
    const penultimo = evolucao[evolucao.length - 2] ?? null;
    const variacao = ultimo && penultimo && penultimo.valor > 0
      ? ((ultimo.valor - penultimo.valor) / penultimo.valor) * 100
      : null;
    return { total, count, ticket, pessoas, projetos, media, maior, menor, ultimo, penultimo, variacao };
  }, [trips, evolucao]);

  const porPessoa = useMemo(() => agrupar(trips, (t) => nomeDe(t) || "—"), [trips]);
  const porProjeto = useMemo(() => agrupar(trips, (t) => (t.projeto || "").trim() || "Sem projeto"), [trips]);
  const porServico = useMemo(() => agrupar(trips, (t) => (t.servico || "—").trim()), [trips]);
  const porCidade = useMemo(() => agrupar(trips, (t) => (t.cidade || "—").trim()), [trips]);
  const porDestino = useMemo(() => agrupar(trips, (t) => (t.endereco_destino || "").trim() || null), [trips]);
  const porFaixa = useMemo(() => agrupar(trips, (t) => faixaHoraria(t.hora_solicitacao)), [trips]);

  const porDiaSemana = useMemo(() => {
    const arr = Array.from({ length: 7 }, (_, i) => ({ idx: i, label: "", valor: 0, corridas: 0 }));
    trips.forEach((t) => {
      const d = diaDaSemana(t.data_solicitacao);
      arr[d.idx].label = d.label;
      arr[d.idx].valor += t.valor ?? 0;
      arr[d.idx].corridas += 1;
    });
    return arr.filter((a) => a.corridas > 0).map((a) => ({ ...a, valor: Math.round(a.valor * 100) / 100 }));
  }, [trips]);

  const maisSolicita = porPessoa.slice().sort((a, b) => b.corridas - a.corridas)[0] ?? null;
  const menosSolicita = porPessoa.slice().sort((a, b) => a.corridas - b.corridas)[0] ?? null;
  const projetoMais = porProjeto.slice().sort((a, b) => b.corridas - a.corridas)[0] ?? null;
  const projetoMenos = porProjeto.slice().sort((a, b) => a.corridas - b.corridas)[0] ?? null;

  const filtrosLabel = [
    `Período: ${fmtData(limites.ini)} a ${fmtData(limites.fim)}`,
    `Agrupamento: por ${granularidadeLabel[gran]}`,
    solicitante !== "__all__" ? `Solicitante: ${solicitante}` : null,
    projeto !== "__all__" ? `Projeto: ${projeto}` : null,
  ].filter(Boolean).join(" · ");

  if (isLoading) {
    return <Card className="p-12 text-center text-sm text-muted-foreground">Carregando corridas...</Card>;
  }
  if (error) {
    return (
      <Card className="p-8">
        <div className="text-sm font-semibold mb-2 text-destructive">Erro ao carregar corridas</div>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </Card>
    );
  }

  async function exportarPdf() {
    try {
      const imgs = await capturarGraficos(areaRef.current);
      const tabela = (titulo: string, col: string, data: Agg[], limit = 15) => ({
        tipo: "tabela" as const,
        titulo,
        head: [col, "Corridas", "Total", "%"],
        alignRight: [1, 2, 3],
        body: data.slice(0, limit).map((r) => [
          r.label,
          r.corridas,
          fmt(r.total),
          `${kpis.total ? ((r.total / kpis.total) * 100).toFixed(1) : "0.0"}%`,
        ]),
      });
      await gerarUberPdf({
        titulo: "Relatório Uber — Análises",
        subtitulo: filtrosLabel,
        arquivo: `relatorio-uber-analises-${limites.ini}-a-${limites.fim}`,
        kpis: [
          { label: "Gasto total no período", value: fmt(kpis.total) },
          { label: "Corridas", value: fmtN(kpis.count) },
          { label: "Ticket médio", value: fmt(kpis.ticket) },
          { label: `Média por ${granularidadeLabel[gran]}`, value: fmt(kpis.media) },
          { label: "Solicitantes únicos", value: fmtN(kpis.pessoas) },
          { label: "Projetos distintos", value: fmtN(kpis.projetos) },
          { label: `Maior ${granularidadeLabel[gran]}`, value: kpis.maior ? fmt(kpis.maior.valor) : "—", hint: kpis.maior?.label },
          { label: `Menor ${granularidadeLabel[gran]}`, value: kpis.menor ? fmt(kpis.menor.valor) : "—", hint: kpis.menor?.label },
        ],
        secoes: [
          { tipo: "grafico" as const, titulo: `Evolução por ${granularidadeLabel[gran]}`, imagem: imgs["Evolução"] ?? null, altura: 80 },
          tabela("Solicitantes", "Pessoa", porPessoa),
          tabela("Projetos", "Projeto", porProjeto),
          { tipo: "grafico" as const, titulo: "Distribuição por serviço", imagem: imgs["Serviço"] ?? null, altura: 70 },
          { tipo: "grafico" as const, titulo: "Corridas por dia da semana", imagem: imgs["Dia da semana"] ?? null, altura: 70 },
          tabela("Faixa de horário", "Faixa", porFaixa, 6),
          tabela("Top cidades", "Cidade", porCidade, 8),
          tabela("Top destinos", "Destino", porDestino, 8),
          {
            tipo: "lista" as const,
            titulo: "Índices do período",
            itens: [
              ["Maior solicitação (pessoa, em valor)", porPessoa[0] ? `${porPessoa[0].label} — ${fmt(porPessoa[0].total)}` : "—"],
              ["Menor solicitação (pessoa, em valor)", porPessoa.length ? `${porPessoa[porPessoa.length - 1].label} — ${fmt(porPessoa[porPessoa.length - 1].total)}` : "—"],
              ["Projeto mais solicitado (qtd)", projetoMais ? `${projetoMais.label} — ${projetoMais.corridas} corridas` : "—"],
              ["Projeto menos solicitado (qtd)", projetoMenos ? `${projetoMenos.label} — ${projetoMenos.corridas} corridas` : "—"],
              ["Média de corridas por solicitante", kpis.pessoas ? (kpis.count / kpis.pessoas).toFixed(1) : "—"],
              ["Concentração top 3 solicitantes", kpis.total ? `${((porPessoa.slice(0, 3).reduce((s, p) => s + p.total, 0) / kpis.total) * 100).toFixed(1)}% do gasto` : "—"],
            ] as [string, string][],
          },
        ],
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o PDF");
    }
  }

  return (
    <div className="space-y-4" ref={areaRef}>
      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">De</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Até</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Agrupar por</label>
            <Select value={granOpt} onValueChange={(v) => setGranOpt(v as GranularidadeOpt)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="dia">Dia</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Solicitante</label>
            <Select value={solicitante} onValueChange={setSolicitante}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {solicitantesOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Projeto</label>
            <Select value={projeto} onValueChange={setProjeto}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {projetosOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <Button size="sm" variant="outline" onClick={() => { setDateFrom(firstOfMonthIso(0)); setDateTo(todayIso()); }}>Este mês</Button>
            <Button size="sm" variant="outline" onClick={() => { setDateFrom(firstOfMonthIso(-2)); setDateTo(todayIso()); }}>Últimos 3 meses</Button>
            <Button size="sm" variant="outline" onClick={() => { setDateFrom(firstOfYearIso()); setDateTo(todayIso()); }}>Este ano</Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={exportarPdf}>
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          {dias} dias no período · dados distribuídos por {granularidadeLabel[gran]} ({evolucao.length} {granularidadeLabelPlural[gran]})
        </div>
      </Card>

      {trips.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Nenhuma corrida no período selecionado.
        </Card>
      ) : (
        <>
          {/* Cards de totais */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Gasto total no período" value={fmt(kpis.total)} />
            <Stat label="Corridas" value={fmtN(kpis.count)} />
            <Stat label="Ticket médio" value={fmt(kpis.ticket)} />
            <Stat label={`Média por ${granularidadeLabel[gran]}`} value={fmt(kpis.media)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Solicitantes únicos" value={fmtN(kpis.pessoas)} />
            <Stat label="Projetos distintos" value={fmtN(kpis.projetos)} />
            <Stat
              label={`Maior ${granularidadeLabel[gran]}`}
              value={kpis.maior ? fmt(kpis.maior.valor) : "—"}
              hint={kpis.maior?.label}
            />
            <Stat
              label={`Menor ${granularidadeLabel[gran]}`}
              value={kpis.menor ? fmt(kpis.menor.valor) : "—"}
              hint={kpis.menor?.label}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={`Variação último ${granularidadeLabel[gran]}`}
              value={kpis.variacao === null ? "—" : `${kpis.variacao >= 0 ? "▲" : "▼"} ${Math.abs(kpis.variacao).toFixed(1)}%`}
              hint={kpis.ultimo && kpis.penultimo ? `${kpis.penultimo.label} → ${kpis.ultimo.label}` : undefined}
              tone={kpis.variacao === null ? undefined : kpis.variacao >= 0 ? "up" : "down"}
            />
            <Stat label="Quem mais solicita" value={maisSolicita?.label ?? "—"} hint={maisSolicita ? `${maisSolicita.corridas} corridas · ${fmt(maisSolicita.total)}` : undefined} />
            <Stat label="Quem menos solicita" value={menosSolicita?.label ?? "—"} hint={menosSolicita ? `${menosSolicita.corridas} corridas · ${fmt(menosSolicita.total)}` : undefined} />
            <Stat label="Projeto mais solicitado" value={projetoMais?.label ?? "—"} hint={projetoMais ? `${projetoMais.corridas} corridas · ${fmt(projetoMais.total)}` : undefined} />
          </div>

          {/* Evolução */}
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">
              Evolução por {granularidadeLabel[gran]} — valor (R$) e nº de corridas
            </div>
            <div className="h-[300px]" data-pdf-chart="Evolução">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" fontSize={10} angle={-15} textAnchor="end" height={50} />
                  <YAxis yAxisId="left" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" fontSize={10} allowDecimals={false} />
                  <Tooltip formatter={(v: any, n: any) => (n === "valor" ? fmt(Number(v)) : fmtN(Number(v)))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="valor" name="Valor" fill={CHART_BASE} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="corridas" name="Corridas" stroke={CHART_ACCENT} strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Ranks em gráfico */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RankChart title="Rank por pessoa (R$)" data={porPessoa.slice(0, 10)} color={CHART_BASE} />
            <RankChart title="Rank de projetos solicitados (R$)" data={porProjeto.slice(0, 10)} color={CHART_ACCENT} />
          </div>

          {/* Tabelas de rank */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RankTable title="Solicitantes" col="Pessoa" data={porPessoa} total={kpis.total} />
            <RankTable title="Projetos" col="Projeto" data={porProjeto} total={kpis.total} />
          </div>

          {/* Distribuições */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Distribuição por serviço</div>
              <div className="h-[260px]" data-pdf-chart="Serviço">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porServico} dataKey="total" nameKey="label" outerRadius={90} label>
                      {porServico.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Corridas por dia da semana</div>
              <div className="h-[260px]" data-pdf-chart="Dia da semana">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDiaSemana}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} allowDecimals={false} />
                    <Tooltip formatter={(v: any, n: any) => (n === "valor" ? fmt(Number(v)) : fmtN(Number(v)))} />
                    <Bar dataKey="corridas" name="Corridas" fill={CHART_ACCENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RankTable title="Faixa de horário" col="Faixa" data={porFaixa} total={kpis.total} limit={6} />
            <RankTable title="Top cidades" col="Cidade" data={porCidade} total={kpis.total} limit={8} />
            <RankTable title="Top destinos" col="Destino" data={porDestino} total={kpis.total} limit={8} />
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Índices do período</div>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <Indice label="Maior solicitação (pessoa, em valor)" v={porPessoa[0] ? `${porPessoa[0].label} — ${fmt(porPessoa[0].total)}` : "—"} />
              <Indice label="Menor solicitação (pessoa, em valor)" v={porPessoa.length ? `${porPessoa[porPessoa.length - 1].label} — ${fmt(porPessoa[porPessoa.length - 1].total)}` : "—"} />
              <Indice label="Projeto mais solicitado (qtd)" v={projetoMais ? `${projetoMais.label} — ${projetoMais.corridas} corridas` : "—"} />
              <Indice label="Projeto menos solicitado (qtd)" v={projetoMenos ? `${projetoMenos.label} — ${projetoMenos.corridas} corridas` : "—"} />
              <Indice label={`Maior ${granularidadeLabel[gran]}`} v={kpis.maior ? `${kpis.maior.label} — ${fmt(kpis.maior.valor)} (${kpis.maior.corridas} corridas)` : "—"} />
              <Indice label={`Menor ${granularidadeLabel[gran]}`} v={kpis.menor ? `${kpis.menor.label} — ${fmt(kpis.menor.valor)} (${kpis.menor.corridas} corridas)` : "—"} />
              <Indice label="Média de corridas por solicitante" v={kpis.pessoas ? (kpis.count / kpis.pessoas).toFixed(1) : "—"} />
              <Indice label="Concentração top 3 solicitantes" v={kpis.total ? `${((porPessoa.slice(0, 3).reduce((s, p) => s + p.total, 0) / kpis.total) * 100).toFixed(1)}% do gasto` : "—"} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Indice({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${tone === "up" ? "text-emerald-600" : tone === "down" ? "text-red-600" : ""}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function RankChart({ title, data, color }: { title: string; data: Agg[]; color: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div style={{ height: Math.max(220, data.length * 28) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" fontSize={10} />
            <YAxis type="category" dataKey="label" width={140} fontSize={10} />
            <Tooltip formatter={(v: any) => fmt(Number(v))} />
            <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function RankTable({ title, col, data, total, limit = 15 }: { title: string; col: string; data: Agg[]; total: number; limit?: number }) {
  const rows = data.slice(0, limit);
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="text-left py-2">{col}</th>
              <th className="text-right py-2">Corridas</th>
              <th className="text-right py-2">Total</th>
              <th className="text-right py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.chave} className="border-b last:border-0">
                <td className="py-1.5 max-w-[220px] truncate" title={r.label}>{r.label}</td>
                <td className="text-right">{r.corridas}</td>
                <td className="text-right tabular-nums">{fmt(r.total)}</td>
                <td className="text-right tabular-nums">{total ? ((r.total / total) * 100).toFixed(1) : "0.0"}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-xs">Sem dados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
