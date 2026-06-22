import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Boxes, DollarSign, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/patrimonio/dashboard")({ component: PatrimonioDashboard });

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

function PatrimonioDashboard() {
  const [catSelecionada, setCatSelecionada] = useState<string>("__all");

  const { data: itens } = useQuery({
    queryKey: ["pat_itens_dash"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from("pat_itens")
          .select("id,cod,id_item,categoria,subcategoria,nome,quantidade,valor,estado,localizacao")
          .order("cod").range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: movs } = useQuery({
    queryKey: ["pat_movs_dash"],
    queryFn: async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 11); since.setDate(1);
      const { data, error } = await supabase.from("pat_movimentacoes")
        .select("tipo,quantidade,data_movimento")
        .gte("data_movimento", since.toISOString())
        .order("data_movimento");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Empréstimos em aberto com previsão de devolução
  const { data: saidasAbertas } = useQuery({
    queryKey: ["pat_saidas_abertas_alertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes")
        .select("id,item_id,quantidade,saida_status,data_prevista_devolucao,responsavel,evento_projeto")
        .eq("tipo", "saida")
        .in("saida_status", ["aberta", "parcialmente_devolvida"])
        .not("data_prevista_devolucao", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: devolvidoPorOrigem } = useQuery({
    queryKey: ["pat_devolvido_por_origem_alertas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pat_movimentacoes")
        .select("saida_origem_id,quantidade")
        .eq("tipo", "devolucao")
        .not("saida_origem_id", "is", null);
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        m.set(r.saida_origem_id, (m.get(r.saida_origem_id) ?? 0) + Number(r.quantidade));
      });
      return m;
    },
  });


  const stats = useMemo(() => {
    const list = itens ?? [];
    const totalItens = list.length;
    const totalQtd = list.reduce((s, i) => s + Number(i.quantidade || 0), 0);
    const totalValor = list.reduce((s, i) => s + Number(i.valor || 0) * Number(i.quantidade || 1), 0);
    const danificados = list.filter((i) => ["DANIFICADO", "EM MANUTENCAO"].includes(i.estado)).length;
    return { totalItens, totalQtd, totalValor, danificados };
  }, [itens]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, { qtd: number; valor: number; count: number }>();
    (itens ?? []).forEach((i) => {
      const k = i.categoria || "Sem categoria";
      const prev = m.get(k) ?? { qtd: 0, valor: 0, count: 0 };
      prev.qtd += Number(i.quantidade || 0);
      prev.valor += Number(i.valor || 0) * Number(i.quantidade || 1);
      prev.count += 1;
      m.set(k, prev);
    });
    return Array.from(m, ([name, v]) => ({ name, ...v })).sort((a, b) => b.valor - a.valor);
  }, [itens]);

  const porEstado = useMemo(() => {
    const m = new Map<string, number>();
    (itens ?? []).forEach((i) => m.set(i.estado, (m.get(i.estado) ?? 0) + 1));
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, [itens]);

  const movPorMes = useMemo(() => {
    const m = new Map<string, { mes: string; entrada: number; saida: number }>();
    const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(k, { mes: fmt.format(d), entrada: 0, saida: 0 });
    }
    (movs ?? []).forEach((mv: any) => {
      const d = new Date(mv.data_movimento);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = m.get(k); if (!row) return;
      const q = Number(mv.quantidade || 0);
      if (mv.tipo === "entrada") row.entrada += q;
      else if (mv.tipo === "saida") row.saida += q;
    });
    return Array.from(m.values());
  }, [movs]);

  const categorias = useMemo(() => Array.from(new Set((itens ?? []).map((i) => i.categoria).filter(Boolean))).sort(), [itens]);
  const itensFiltrados = useMemo(() => {
    if (catSelecionada === "__all") return [];
    return (itens ?? []).filter((i) => i.categoria === catSelecionada);
  }, [itens, catSelecionada]);

  const alertas = useMemo(() => {
    const itemMap = new Map<string, any>();
    (itens ?? []).forEach((i: any) => itemMap.set(i.id, i));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const lista: Array<{
      id: string; nome: string; cod: string | null; qtd: number;
      responsavel: string | null; evento: string | null;
      previsao: string; previsaoDate: Date; diffDias: number;
      bucket: "vencido" | "ate3" | "ate7";
    }> = [];
    (saidasAbertas ?? []).forEach((s: any) => {
      const jaDev = devolvidoPorOrigem?.get(s.id) ?? 0;
      const restante = Math.max(0, Number(s.quantidade) - jaDev);
      if (restante <= 0) return;
      const prev = new Date(String(s.data_prevista_devolucao) + "T00:00");
      const diffDias = Math.round((prev.getTime() - hoje.getTime()) / 86400000);
      let bucket: "vencido" | "ate3" | "ate7" | null = null;
      if (diffDias < 0) bucket = "vencido";
      else if (diffDias <= 3) bucket = "ate3";
      else if (diffDias <= 7) bucket = "ate7";
      if (!bucket) return;
      const it = s.item_id ? itemMap.get(s.item_id) : null;
      lista.push({
        id: s.id,
        nome: it?.nome ?? "(item removido)",
        cod: it?.cod ?? it?.id_item ?? null,
        qtd: restante,
        responsavel: s.responsavel ?? null,
        evento: s.evento_projeto ?? null,
        previsao: s.data_prevista_devolucao,
        previsaoDate: prev,
        diffDias,
        bucket,
      });
    });
    lista.sort((a, b) => a.previsaoDate.getTime() - b.previsaoDate.getTime());
    const cont = {
      vencido: lista.filter((l) => l.bucket === "vencido").length,
      ate3: lista.filter((l) => l.bucket === "ate3").length,
      ate7: lista.filter((l) => l.bucket === "ate7").length,
    };
    return { lista, cont };
  }, [saidasAbertas, devolvidoPorOrigem, itens]);

  return (
    <>
      <PageHeader title="Dashboard do Patrimônio" description="Visão geral do inventário e movimentações" />

      {alertas.lista.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold text-sm">Alertas de devolução</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <AlertaCount label="Vencidos" value={alertas.cont.vencido} className="border-destructive/40 bg-destructive/10 text-destructive" />
            <AlertaCount label="Vence em ≤3 dias" value={alertas.cont.ate3} className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" />
            <AlertaCount label="Vence em ≤7 dias" value={alertas.cont.ate7} className="border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" />
          </div>
          <div className="overflow-auto max-h-[360px] border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr className="text-left">
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2 text-right w-24">Qtd em aberto</th>
                  <th className="px-2 py-2">Responsável</th>
                  <th className="px-2 py-2">Evento/Projeto</th>
                  <th className="px-2 py-2 w-32">Previsão</th>
                  <th className="px-2 py-2 w-40">Status</th>
                </tr>
              </thead>
              <tbody>
                {alertas.lista.map((l) => {
                  const prevFmt = l.previsaoDate.toLocaleDateString("pt-BR");
                  let badgeClass = "";
                  let statusTxt = "";
                  if (l.bucket === "vencido") {
                    badgeClass = "bg-destructive text-destructive-foreground hover:bg-destructive";
                    const dias = Math.abs(l.diffDias);
                    statusTxt = `Venceu há ${dias} dia${dias === 1 ? "" : "s"}`;
                  } else if (l.bucket === "ate3") {
                    badgeClass = "bg-amber-500 text-white hover:bg-amber-500";
                    statusTxt = l.diffDias === 0 ? "Vence hoje" : `Vence em ${l.diffDias} dia${l.diffDias === 1 ? "" : "s"}`;
                  } else {
                    badgeClass = "bg-yellow-500 text-white hover:bg-yellow-500";
                    statusTxt = `Vence em ${l.diffDias} dias`;
                  }
                  return (
                    <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium">
                        {l.nome}
                        {l.cod && <span className="ml-1 text-muted-foreground font-mono text-[11px]">({l.cod})</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">{l.qtd}</td>
                      <td className="px-2 py-1.5">{l.responsavel ?? "—"}</td>
                      <td className="px-2 py-1.5">{l.evento ?? "—"}</td>
                      <td className="px-2 py-1.5">{prevFmt}</td>
                      <td className="px-2 py-1.5"><Badge className={badgeClass}>{statusTxt}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Boxes} label="Itens cadastrados" value={stats.totalItens.toLocaleString("pt-BR")} color="text-blue-600" />
        <StatCard icon={Boxes} label="Quantidade total" value={stats.totalQtd.toLocaleString("pt-BR")} color="text-emerald-600" />
        <StatCard icon={DollarSign} label="Valor do patrimônio" value={brl(stats.totalValor)} color="text-violet-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">Entradas nos últimos 12 meses</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="entrada" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpFromLine className="h-4 w-4 text-rose-600" />
            <h3 className="font-semibold text-sm">Saídas nos últimos 12 meses</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="saida" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Valor por categoria</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCategoria} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => brl(Number(v))} />
                <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Itens por estado de conservação</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 11 }}>
                  {porEstado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h3 className="font-semibold text-sm">Itens por categoria</h3>
          <div className="w-full sm:w-72">
            <Select value={catSelecionada} onValueChange={setCatSelecionada}>
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Selecione uma categoria…</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {catSelecionada === "__all" ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Escolha uma categoria acima para visualizar os itens correspondentes.</p>
        ) : (
          <div className="overflow-auto max-h-[500px] border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr className="text-left">
                  <th className="px-2 py-2 w-24">ID</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Subcategoria</th>
                  <th className="px-2 py-2 text-right w-16">Qtde</th>
                  <th className="px-2 py-2 text-right w-28">Valor unit.</th>
                  <th className="px-2 py-2 text-right w-28">Total</th>
                  <th className="px-2 py-2 w-32">Estado</th>
                  <th className="px-2 py-2">Local</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((i) => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-2 py-1.5 font-mono text-[11px]">{i.id_item}</td>
                    <td className="px-2 py-1.5 font-medium">{i.nome}</td>
                    <td className="px-2 py-1.5">{i.subcategoria}</td>
                    <td className="px-2 py-1.5 text-right">{i.quantidade}</td>
                    <td className="px-2 py-1.5 text-right">{brl(i.valor)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(Number(i.valor || 0) * Number(i.quantidade || 1))}</td>
                    <td className="px-2 py-1.5">{i.estado}</td>
                    <td className="px-2 py-1.5">{i.localizacao}</td>
                  </tr>
                ))}
                {itensFiltrados.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhum item nesta categoria.</td></tr>
                )}
              </tbody>
              {itensFiltrados.length > 0 && (
                <tfoot className="bg-muted/30 font-medium">
                  <tr>
                    <td className="px-2 py-2" colSpan={3}>{itensFiltrados.length} itens</td>
                    <td className="px-2 py-2 text-right">{itensFiltrados.reduce((s, i) => s + Number(i.quantidade || 0), 0)}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right">{brl(itensFiltrados.reduce((s, i) => s + Number(i.valor || 0) * Number(i.quantidade || 1), 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`shrink-0 p-2 rounded-lg bg-muted ${color}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold leading-tight break-words" title={value}>{value}</p>
        </div>
      </div>
    </Card>
  );
}
