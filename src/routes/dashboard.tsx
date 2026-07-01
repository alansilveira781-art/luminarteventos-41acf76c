import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormSection } from "@/components/FormSection";
import {
  Package,
  AlertTriangle,
  XCircle,
  Wrench,
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { isAjusteMovimentacao } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

const ALL = "__all__";
const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function Dashboard() {
  const hoje = new Date();
  const [dataIni, setDataIni] = useState(format(startOfMonth(subMonths(hoje, 5)), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [tipoMov, setTipoMov] = useState<"entrada" | "saida">("saida");
  const [pessoaTipo, setPessoaTipo] = useState<"solicitante" | "fornecedor">("solicitante");
  const [pessoaId, setPessoaId] = useState(ALL);
  const [categoriaAbc, setCategoriaAbc] = useState(ALL);

  // Filtro de visão geral (cards): ano e mês
  const [anoVisao, setAnoVisao] = useState<number>(hoje.getFullYear());
  const [mesVisao, setMesVisao] = useState<string>(String(hoje.getMonth() + 1)); // "1".."12" ou ALL

  const visaoRange = useMemo(() => {
    if (mesVisao === ALL) {
      const ini = startOfYear(new Date(anoVisao, 0, 1));
      const fim = endOfYear(new Date(anoVisao, 0, 1));
      return { ini: ini.toISOString(), fim: fim.toISOString(), label: String(anoVisao) };
    }
    const m = Number(mesVisao) - 1;
    const ini = startOfMonth(new Date(anoVisao, m, 1));
    const fim = endOfMonth(new Date(anoVisao, m, 1));
    return { ini: ini.toISOString(), fim: fim.toISOString(), label: `${MESES_PT[m]}/${anoVisao}` };
  }, [anoVisao, mesVisao]);

  const anosDisponiveis = useMemo(() => {
    const atual = hoje.getFullYear();
    const arr: number[] = [];
    for (let y = atual; y >= atual - 5; y--) arr.push(y);
    if (!arr.includes(anoVisao)) arr.push(anoVisao);
    return arr.sort((a, b) => b - a);
  }, [anoVisao, hoje]);

  const { data: itens } = useQuery({
    queryKey: ["dashboard-itens"],
    queryFn: async () => {
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("itens")
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: solicitantes } = useQuery({
    queryKey: ["dashboard-solicitantes"],
    queryFn: async () => (await supabase.from("solicitantes").select("id,nome").order("nome")).data ?? [],
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["dashboard-fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("id,nome").order("nome")).data ?? [],
  });
  const { data: categorias } = useQuery({
    queryKey: ["dashboard-categorias"],
    queryFn: async () => (await supabase.from("categorias").select("nome").order("nome")).data ?? [],
  });

  const { data: movsMes } = useQuery({
    queryKey: ["dashboard-movs", visaoRange.ini, visaoRange.fim],
    queryFn: async () => {
      const all: any[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("movimentacoes")
          .select("*, item:itens(nome,codigo), solicitante:solicitantes(nome), fornecedor:fornecedores(nome)")
          .gte("data_movimento", visaoRange.ini)
          .lte("data_movimento", visaoRange.fim)
          .order("data_movimento", { ascending: false })
          .range(from, from + size - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      return all;
    },
  });

  const { data: recentes } = useQuery({
    queryKey: ["dashboard-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, item:itens(nome,codigo), solicitante:solicitantes(nome), fornecedor:fornecedores(nome)")
        .order("data_movimento", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  // Movimentações no período (para tabela e ABC)
  const { data: movsPeriodo } = useQuery({
    queryKey: ["dashboard-movs-periodo", dataIni, dataFim, tipoMov, pessoaTipo, pessoaId],
    queryFn: async () => {
      const all: any[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        let q = supabase
          .from("movimentacoes")
          .select("id,tipo,quantidade,valor_unitario,data_movimento,item_id,solicitante_id,fornecedor_id,entrada_tipo,saida_tipo,observacoes,finalidade,requisicao_numero, item:itens(nome,codigo,unidade,categoria,valor_unitario,quantidade_atual,quantidade_minima,status)")
          .eq("tipo", tipoMov)
          .gte("data_movimento", new Date(dataIni).toISOString())
          .lte("data_movimento", new Date(`${dataFim}T23:59:59`).toISOString())
          .order("data_movimento", { ascending: false })
          .range(from, from + size - 1);
        if (pessoaId !== ALL) {
          if (pessoaTipo === "solicitante") q = q.eq("solicitante_id", pessoaId);
          else q = q.eq("fornecedor_id", pessoaId);
        }
        const { data, error } = await q;
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      return all;
    },
  });

  // Movimentações dos últimos 12 meses para o gráfico de barras
  const { data: movs12m } = useQuery({
    queryKey: ["dashboard-12m"],
    queryFn: async () => {
      const ini = startOfMonth(subMonths(new Date(), 11));
      const all: any[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("movimentacoes")
          .select("id,tipo,quantidade,data_movimento,entrada_tipo,saida_tipo,observacoes,finalidade,requisicao_numero")
          .gte("data_movimento", ini.toISOString())
          .order("data_movimento", { ascending: false })
          .range(from, from + size - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      return all;
    },
  });


  const total = itens?.length ?? 0;
  const baixo = itens?.filter((i) => i.status === "baixo_estoque").length ?? 0;
  const sem = itens?.filter((i) => i.status === "sem_estoque").length ?? 0;
  const manut = itens?.filter((i) => i.status === "em_manutencao").length ?? 0;
  const disponivel = itens?.filter((i) => i.status === "disponivel").length ?? 0;
  // Conta requisições (grupos) por tipo no período: linhas com mesmo requisicao_numero
  // contam como 1; linhas sem requisicao_numero contam individualmente.
  const countRequisicoes = (tipo: "entrada" | "saida" | "devolucao", aplicarFiltroAjuste: boolean) => {
    const set = new Set<string>();
    for (const m of movsMes ?? []) {
      if (m.tipo !== tipo) continue;
      if (aplicarFiltroAjuste && isAjusteMovimentacao(m)) continue;
      const key = (m as any).requisicao_numero != null
        ? `req-${(m as any).requisicao_numero}`
        : `solo-${m.id}`;
      set.add(key);
    }
    return set.size;
  };
  const entradasMes = countRequisicoes("entrada", true);
  const saidasMes = countRequisicoes("saida", true);
  const devolucoesMes = countRequisicoes("devolucao", false);
  const saidasAbertas = recentes?.filter(
    (m) => m.tipo === "saida" && !isAjusteMovimentacao(m) && (m.saida_status === "aberta" || m.saida_status === "parcialmente_devolvida"),
  ).length ?? 0;


  const baixoItens = itens?.filter((i) => i.status === "baixo_estoque" || i.status === "sem_estoque").slice(0, 6) ?? [];

  // Tabela: agregar por item
  const tabelaItens = useMemo(() => {
    const map = new Map<string, { item: any; qtd: number; valorTotal: number }>();
    for (const m of movsPeriodo ?? []) {
      if (isAjusteMovimentacao(m)) continue;
      const it: any = (m as any).item;
      if (!it) continue;
      const key = m.item_id as string | null;
      if (!key) continue;
      const cur = map.get(key) ?? { item: it, qtd: 0, valorTotal: 0 };
      const q = Number(m.quantidade || 0);
      const vu = Number(m.valor_unitario ?? it.valor_unitario ?? 0);
      cur.qtd += q;
      cur.valorTotal += q * vu;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [movsPeriodo]);

  // Gráfico mensal: entradas vs saídas
  const graficoMensal = useMemo(() => {
    const m = new Map<string, { mes: string; entradas: number; saidas: number }>();
    // garantir 12 meses
    for (let i = 11; i >= 0; i--) {
      const k = format(subMonths(hoje, i), "yyyy-MM");
      m.set(k, { mes: format(subMonths(hoje, i), "MMM/yy"), entradas: 0, saidas: 0 });
    }
    for (const mov of movs12m ?? []) {
      if (isAjusteMovimentacao(mov)) continue;
      const k = format(new Date(mov.data_movimento), "yyyy-MM");
      const cur = m.get(k);
      if (!cur) continue;
      const q = Number(mov.quantidade || 0);
      if (mov.tipo === "entrada") cur.entradas += q;
      else if (mov.tipo === "saida") cur.saidas += q;
    }
    return Array.from(m.values());
  }, [movs12m, hoje]);

  // Curva ABC de saídas por item (filtrável por categoria)
  const { data: saidasAbc } = useQuery({
    queryKey: ["dashboard-abc", dataIni, dataFim, categoriaAbc],
    queryFn: async () => {
      const all: any[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("movimentacoes")
          .select("quantidade,valor_unitario,saida_tipo,observacoes,finalidade,tipo,item:itens(nome,codigo,categoria,valor_unitario)")
          .eq("tipo", "saida")
          .gte("data_movimento", new Date(dataIni).toISOString())
          .lte("data_movimento", new Date(`${dataFim}T23:59:59`).toISOString())
          .order("data_movimento", { ascending: false })
          .range(from, from + size - 1);
        if (error) throw error;
        const rows0 = data ?? [];
        all.push(...rows0);
        if (rows0.length < size) break;
        from += size;
      }
      let rows = all;

      rows = rows.filter((r: any) => !isAjusteMovimentacao(r));
      if (categoriaAbc !== ALL) rows = rows.filter((r: any) => r.item?.categoria === categoriaAbc);
      return rows;
    },
  });

  const abc = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number }>();
    for (const r of saidasAbc ?? []) {
      const it: any = (r as any).item;
      if (!it) continue;
      const vu = Number(r.valor_unitario ?? it.valor_unitario ?? 0);
      const valor = vu * Number(r.quantidade || 0);
      const cur = map.get(it.nome) ?? { nome: it.nome, valor: 0 };
      cur.valor += valor;
      map.set(it.nome, cur);
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 15);
    const total = sorted.reduce((a, b) => a + b.valor, 0) || 1;
    let acc = 0;
    return sorted.map((r) => {
      acc += r.valor;
      const pct = (acc / total) * 100;
      const classe = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return { ...r, acumuladoPct: Number(pct.toFixed(1)), classe };
    });
  }, [saidasAbc]);

  const pessoasOptions = pessoaTipo === "solicitante" ? (solicitantes ?? []) : (fornecedores ?? []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação de estoque · Luminart Eventos"
      />

      <Card className="p-3 mb-4 bg-muted/20">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ano</label>
            <Select value={String(anoVisao)} onValueChange={(v) => setAnoVisao(Number(v))}>
              <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mês</label>
            <Select value={mesVisao} onValueChange={setMesVisao}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os meses</SelectItem>
                {MESES_PT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">Período: {visaoRange.label}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Package} label="Total de itens" value={total} tone="primary" />
        <Kpi icon={AlertTriangle} label="Baixo estoque" value={baixo} tone="warning" />
        <Kpi icon={XCircle} label="Sem estoque" value={sem} tone="destructive" />
        <Kpi icon={Wrench} label="Em manutenção" value={manut} tone="accent" />
        <Kpi icon={ArrowDownToLine} label={`Entradas (${visaoRange.label})`} value={entradasMes} tone="success" />
        <Kpi icon={ArrowUpFromLine} label={`Saídas (${visaoRange.label})`} value={saidasMes} tone="primary" />
        <Kpi icon={Undo2} label={`Devoluções (${visaoRange.label})`} value={devolucoesMes} tone="accent" />
        <Kpi icon={ListChecks} label="Saídas pendentes" value={saidasAbertas} tone="warning" />
      </div>

      {/* Tabela analítica com filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Análise por item</CardTitle>
        </CardHeader>
        <CardContent>
          <Card className="p-3 mb-3 bg-muted/20">
            <FormSection>
              <FormField label="Data inicial"><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></FormField>
              <FormField label="Data final"><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></FormField>
              <FormField label="Tipo">
                <Select value={tipoMov} onValueChange={(v: any) => setTipoMov(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Saídas</SelectItem>
                    <SelectItem value="entrada">Entradas</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={tipoMov === "saida" ? "Solicitante / Fornecedor" : "Solicitante / Fornecedor"}>
                <div className="flex gap-2">
                  <Select value={pessoaTipo} onValueChange={(v: any) => { setPessoaTipo(v); setPessoaId(ALL); }}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solicitante">Solicitante</SelectItem>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={pessoaId} onValueChange={setPessoaId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      {pessoasOptions.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </FormField>
            </FormSection>
          </Card>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium text-right">Valor unitário</th>
                  <th className="py-2 pr-4 font-medium text-right">Qtd</th>
                  <th className="py-2 pr-4 font-medium">UN</th>
                  <th className="py-2 pr-4 font-medium text-right">Valor total</th>
                  <th className="py-2 pr-0 font-medium">Status do estoque</th>
                </tr>
              </thead>
              <tbody>
                {tabelaItens.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem movimentos no período.</td></tr>
                ) : tabelaItens.slice(0, 50).map((r) => {
                  const vu = Number(r.item.valor_unitario ?? 0);
                  return (
                    <tr key={r.item.codigo} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{r.item.nome}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">R$ {vu.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.qtd}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.item.unidade}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">R$ {r.valorTotal.toFixed(2)}</td>
                      <td className="py-2 pr-0"><StatusBadge status={r.item.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Entradas vs Saídas (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="#ffffff" tick={{ fill: "#ffffff" }} fontSize={11} />
                  <YAxis stroke="#ffffff" tick={{ fill: "#ffffff" }} fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" fill="hsl(var(--success))" name="Entradas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill="hsl(var(--destructive))" name="Saídas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Curva ABC — saídas</CardTitle>
              <Select value={categoriaAbc} onValueChange={setCategoriaAbc}>
                <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as categorias</SelectItem>
                  {(categorias ?? []).map((c: any) => <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {abc.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados de saída no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={abc}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" stroke="#ffffff" tick={false} axisLine={false} height={10} />
                    <YAxis yAxisId="left" stroke="#ffffff" tick={{ fill: "#ffffff" }} fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#ffffff" tick={{ fill: "#ffffff" }} fontSize={11} domain={[0, 100]} unit="%" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="valor" fill="hsl(var(--primary))" name="Valor R$" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="acumuladoPct" stroke="hsl(var(--accent))" name="% acumulado" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            {abc.length > 0 && (
              <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
                <span><span className="inline-block w-2 h-2 rounded-full bg-success mr-1"></span>A: até 80%</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-warning mr-1"></span>B: até 95%</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-destructive mr-1"></span>C: até 100%</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Movimentos recentes</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 font-medium">Item</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium text-right">Qtd</th>
                    <th className="py-2 pr-0 font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes?.length ? recentes.map((m: any) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">
                        {format(new Date(m.data_movimento), "dd/MM HH:mm")}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{m.item?.nome ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{m.tipo}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        <span className={m.tipo === "saida" ? "text-destructive" : "text-success"}>
                          {m.tipo === "saida" ? "-" : "+"}{Number(m.quantidade)}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{m.solicitante?.nome ?? m.fornecedor?.nome ?? "—"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum movimento registrado ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alertas de estoque</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {baixoItens.length ? baixoItens.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i.nome}</div>
                  <div className="text-xs text-muted-foreground">{Number(i.quantidade_atual)} {i.unidade} · mín {Number(i.quantidade_minima)}</div>
                </div>
                <StatusBadge status={i.status} />
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Tudo sob controle.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number; tone: "primary" | "warning" | "destructive" | "accent" | "success"; }) {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    accent: "text-accent bg-accent/10",
    success: "text-success bg-success/10",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
