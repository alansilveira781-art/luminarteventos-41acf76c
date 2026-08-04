import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, CartesianGrid, LabelList,
} from "recharts";
import { COMPRA_STATUSES } from "@/lib/compras";
import { EMPRESAS } from "@/lib/empresas";
import { AlertaEstoqueCard } from "@/components/compras/AlertaEstoqueCard";

const sb = supabase as any;
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

/** Cores dos status do quadro (mesma leitura visual do kanban). */
const STATUS_HEX: Record<string, string> = {
  solicitacao: "#64748b",
  analise: "#3b82f6",
  pendente_aprovacao: "#f59e0b",
  aprovada: "#10b981",
  em_andamento: "#6366f1",
  a_receber: "#06b6d4",
  finalizado: "#16a34a",
  negada: "#ef4444",
};

function truncate(s: string, n = 28) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Mantém os N maiores e agrupa o restante em "Outros". */
function topN(rows: { nome: string; valor: number }[], n = 12) {
  const sorted = [...rows].sort((a, b) => b.valor - a.valor);
  if (sorted.length <= n) return sorted;
  const resto = sorted.slice(n).reduce((s, r) => s + r.valor, 0);
  return [...sorted.slice(0, n), { nome: "Outros", valor: Math.round(resto * 100) / 100 }];
}

const barHeight = (len: number, min = 220) => Math.max(min, len * 28 + 40);


export const Route = createFileRoute("/compras/dashboard")({
  component: ComprasDashboard,
});

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

/** A cotação é texto livre no banco: extrai o valor numérico (formato BR ou US). */
function parseCotacao(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const raw = String(v).replace(/[^\d.,-]/g, "").trim();
  if (!raw) return null;
  const temVirgula = raw.includes(",");
  const normal = temVirgula ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ComprasDashboard() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5);
    return startOfMonth(d);
  });
  const [to, setTo] = useState(() => today());
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");

  const { data: compras = [] } = useQuery({
    queryKey: ["compras-dash", from, to, empresaFilter],
    queryFn: async () => {
      const { data } = await sb
        .from("compras")
        .select("id,status,fornecedor,condicao_pagamento,valor_total,data_compra,data_solicitacao,created_at,empresa_faturada");
      return ((data ?? []) as any[]).filter((c) => {
        const ref = (c.data_compra || c.data_solicitacao || c.created_at)?.slice(0, 10);
        if (!(ref >= from && ref <= to)) return false;
        if (empresaFilter !== "all" && c.empresa_faturada !== empresaFilter) return false;
        return true;
      });
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["compra-pagamentos-dash"],
    queryFn: async () => {
      const { data } = await sb.from("compra_pagamentos").select("compra_id,forma,valor");
      return (data ?? []) as any[];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["compra-itens-dash"],
    queryFn: async () => {
      const { data } = await sb
        .from("compra_itens")
        .select("compra_id,item_id,quantidade,valor_unitario,descricao,cotacao");
      return (data ?? []) as any[];
    },
  });

  const { data: estoque = [] } = useQuery({
    queryKey: ["itens-cat"],
    queryFn: async () => {
      const { data } = await supabase.from("itens").select("id,categoria");
      return (data ?? []) as any[];
    },
  });

  const stats = useMemo(() => {
    const total = compras.reduce((s, c) => s + Number(c.valor_total || 0), 0);
    const finalizadas = compras.filter((c) => c.status === "finalizado").length;
    const emAndamento = compras.filter((c) => !["finalizado", "negada"].includes(c.status)).length;
    return { total, count: compras.length, finalizadas, emAndamento };
  }, [compras]);

  // ===== Saving de compras: cotação (referência) x valor final negociado =====
  const saving = useMemo(() => {
    const comprasMap = new Map(compras.map((c: any) => [c.id, c]));
    type Ag = { cotado: number; final: number; itens: number };
    const porCompra = new Map<string, Ag>();
    for (const it of itens) {
      const c = comprasMap.get(it.compra_id);
      if (!c) continue;
      const cot = parseCotacao(it.cotacao);
      if (cot == null) continue;
      const qtd = Number(it.quantidade || 0) || 0;
      const final = Number(it.valor_unitario || 0) * qtd;
      if (!qtd || !final) continue;
      const ag = porCompra.get(it.compra_id) ?? { cotado: 0, final: 0, itens: 0 };
      ag.cotado += cot * qtd;
      ag.final += final;
      ag.itens += 1;
      porCompra.set(it.compra_id, ag);
    }
    let cotado = 0, final = 0, itensComCotacao = 0;
    const porMesMap = new Map<string, { cotado: number; final: number }>();
    const porFornMap = new Map<string, { cotado: number; final: number }>();
    const ranking: { id: string; fornecedor: string; titulo: string; cotado: number; final: number; saving: number; pct: number }[] = [];
    porCompra.forEach((ag, id) => {
      const c: any = comprasMap.get(id);
      cotado += ag.cotado; final += ag.final; itensComCotacao += ag.itens;
      const ref = (c.data_compra || c.data_solicitacao || c.created_at) as string;
      if (ref) {
        const k = ref.slice(0, 7);
        const m = porMesMap.get(k) ?? { cotado: 0, final: 0 };
        m.cotado += ag.cotado; m.final += ag.final;
        porMesMap.set(k, m);
      }
      const fk = c.fornecedor || "Sem fornecedor";
      const f = porFornMap.get(fk) ?? { cotado: 0, final: 0 };
      f.cotado += ag.cotado; f.final += ag.final;
      porFornMap.set(fk, f);
      ranking.push({
        id,
        fornecedor: fk,
        titulo: c.titulo || fk,
        cotado: ag.cotado,
        final: ag.final,
        saving: ag.cotado - ag.final,
        pct: ag.cotado > 0 ? ((ag.cotado - ag.final) / ag.cotado) * 100 : 0,
      });
    });
    const evolucao = Array.from(porMesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({
        mes,
        cotado: Math.round(v.cotado * 100) / 100,
        final: Math.round(v.final * 100) / 100,
        saving: Math.round((v.cotado - v.final) * 100) / 100,
      }));
    const fornecedores = Array.from(porFornMap.entries())
      .map(([nome, v]) => ({
        nome,
        saving: Math.round((v.cotado - v.final) * 100) / 100,
        pct: v.cotado > 0 ? ((v.cotado - v.final) / v.cotado) * 100 : 0,
      }))
      .sort((a, b) => b.saving - a.saving)
      .slice(0, 8);
    return {
      cotado,
      final,
      total: cotado - final,
      pct: cotado > 0 ? ((cotado - final) / cotado) * 100 : 0,
      comprasAvaliadas: porCompra.size,
      itensComCotacao,
      evolucao,
      fornecedores,
      melhores: [...ranking].sort((a, b) => b.saving - a.saving).slice(0, 5),
      piores: ranking.filter((r) => r.saving < 0).sort((a, b) => a.saving - b.saving).slice(0, 5),
    };
  }, [compras, itens]);


  // Por mês
  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    compras.forEach((c) => {
      const ref = (c.data_compra || c.data_solicitacao || c.created_at) as string;
      if (!ref) return;
      const key = ref.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + Number(c.valor_total || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }));
  }, [compras]);

  // Por fornecedor
  const porFornecedor = useMemo(() => {
    const map = new Map<string, number>();
    compras.forEach((c) => {
      const k = c.fornecedor || "Sem fornecedor";
      map.set(k, (map.get(k) ?? 0) + Number(c.valor_total || 0));
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [compras]);

  // Por condição (usa as formas de pagamento múltiplas quando existirem)
  const porCondicao = useMemo(() => {
    const map = new Map<string, number>();
    const porCompra = new Map<string, any[]>();
    pagamentos.forEach((p) => {
      const arr = porCompra.get(p.compra_id) ?? [];
      arr.push(p);
      porCompra.set(p.compra_id, arr);
    });
    compras.forEach((c) => {
      const linhas = porCompra.get(c.id);
      if (linhas && linhas.length > 0) {
        linhas.forEach((p) => {
          const k = p.forma || "Não informado";
          map.set(k, (map.get(k) ?? 0) + Number(p.valor || 0));
        });
        return;
      }
      const k = c.condicao_pagamento || "Não informado";
      map.set(k, (map.get(k) ?? 0) + Number(c.valor_total || 0));
    });
    return Array.from(map.entries()).map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }));
  }, [compras, pagamentos]);


  // Por categoria (via itens vinculados)
  const porCategoria = useMemo(() => {
    const compraIds = new Set(compras.map((c) => c.id));
    const catMap = new Map<string, string>(estoque.map((i: any) => [i.id, i.categoria || "Sem categoria"]));
    const map = new Map<string, number>();
    itens.filter((it) => compraIds.has(it.compra_id)).forEach((it) => {
      const cat = it.item_id ? (catMap.get(it.item_id) ?? "Sem categoria") : "Item livre";
      const v = Number(it.quantidade || 0) * Number(it.valor_unitario || 0);
      map.set(cat, (map.get(cat) ?? 0) + v);
    });
    return Array.from(map.entries()).map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }));
  }, [compras, itens, estoque]);

  // Por status
  const porStatus = useMemo(() => {
    const labels = Object.fromEntries(COMPRA_STATUSES.map((s) => [s.key, s.label]));
    const map = new Map<string, number>();
    compras.forEach((c) => map.set(c.status, (map.get(c.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([k, v]) => ({ nome: labels[k] ?? k, valor: v }));
  }, [compras]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader title="Dashboard de Compras" description="Indicadores e gráficos do período selecionado" />

      <AlertaEstoqueCard />



      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Empresa faturada</label>
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label="Total compras" value={String(stats.count)} />
        <Stat label="Valor total" value={fmt(stats.total)} />
        <Stat label="Finalizadas" value={String(stats.finalizadas)} />
        <Stat label="Em andamento" value={String(stats.emAndamento)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Compras por mês (R$)">
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

        <ChartCard title="Compras por fornecedor (R$)">
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

        <ChartCard title="Compras por categoria (R$)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porCategoria} dataKey="valor" nameKey="nome" outerRadius={90} label>
                {porCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Compras por condição de pagamento (R$)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porCondicao} dataKey="valor" nameKey="nome" outerRadius={90} label>
                {porCondicao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Compras por status (qtd)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
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
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="text-sm font-semibold">Saving de Compras</div>
            <div className="text-xs text-muted-foreground">
              Comparação entre o valor de cotação dos itens e o valor final negociado
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {saving.comprasAvaliadas} compra(s) · {saving.itensComCotacao} item(ns) com cotação
          </div>
        </div>

        {saving.comprasAvaliadas === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma compra do período possui cotação preenchida nos itens.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <Stat label="Valor cotado" value={fmt(saving.cotado)} />
              <Stat label="Valor final" value={fmt(saving.final)} />
              <Stat label="Saving (R$)" value={fmt(saving.total)} />
              <Stat label="Saving (%)" value={`${saving.pct.toFixed(1)}%`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Evolução: cotado x final (R$)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={saving.evolucao}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cotado" name="Cotado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="final" name="Final" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saving" name="Saving" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Saving por fornecedor (R$)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={saving.fornecedores} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="nome" width={120} fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Bar dataKey="saving" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              <SavingList title="Maiores economias" linhas={saving.melhores} fmt={fmt} />
              <SavingList
                title="Compras acima da cotação"
                linhas={saving.piores}
                fmt={fmt}
                vazio="Nenhuma compra ficou acima do valor cotado."
              />
            </div>
          </>
        )}
      </Card>

      <FornecedorItensSection />
    </>
  );
}

function SavingList({
  title, linhas, fmt, vazio = "Sem dados no período.",
}: {
  title: string;
  linhas: { id: string; titulo: string; fornecedor: string; cotado: number; final: number; saving: number; pct: number }[];
  fmt: (n: number) => string;
  vazio?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {linhas.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">{vazio}</div>
      ) : (
        <div className="space-y-1">
          {linhas.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <div className="text-sm truncate">{l.titulo}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {l.fornecedor} · cotado {fmt(l.cotado)} → final {fmt(l.final)}
                </div>
              </div>
              <div className={`text-sm font-semibold tabular-nums shrink-0 ${l.saving >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {fmt(l.saving)} <span className="text-[11px] font-normal">({l.pct.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---- Cruzamento Fornecedor × Itens comprados ----
function FornecedorItensSection() {
  const [q, setQ] = useState("");
  const qd = useDebouncedValue(q, 250);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["estoque-forn-lookup"],
    queryFn: async () => {
      const { data } = await sb.from("fornecedores").select("id,nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const filtered = useMemo(() => {
    const term = qd.trim().toLowerCase();
    if (!term) return [] as typeof fornecedores;
    return fornecedores.filter((f) => f.nome.toLowerCase().includes(term)).slice(0, 8);
  }, [qd, fornecedores]);

  const [selected, setSelected] = useState<{ id: string; nome: string } | null>(null);

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["forn-itens", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      // entradas diretas (1 item)
      const { data: diretas } = await sb
        .from("movimentacoes")
        .select("id,item_id,quantidade,valor_unitario,data_movimento")
        .eq("tipo", "entrada")
        .eq("fornecedor_id", selected!.id);

      // entradas multi-item: pega movimentacoes do fornecedor e seus filhos
      const { data: mae } = await sb
        .from("movimentacoes")
        .select("id,data_movimento")
        .eq("tipo", "entrada")
        .eq("fornecedor_id", selected!.id)
        .is("item_id", null);
      const maeIds = (mae ?? []).map((m: any) => m.id);
      let filhos: any[] = [];
      if (maeIds.length) {
        const { data } = await sb
          .from("movimentacao_itens")
          .select("movimentacao_id,item_id,quantidade,valor_unitario")
          .in("movimentacao_id", maeIds);
        const dataMap = new Map((mae ?? []).map((m: any) => [m.id, m.data_movimento]));
        filhos = (data ?? []).map((f: any) => ({
          item_id: f.item_id,
          quantidade: Number(f.quantidade || 0),
          valor_unitario: f.valor_unitario,
          data_movimento: dataMap.get(f.movimentacao_id),
        }));
      }
      const linhasRaw = [
        ...(diretas ?? []).filter((d: any) => d.item_id).map((d: any) => ({
          item_id: d.item_id,
          quantidade: Number(d.quantidade || 0),
          valor_unitario: d.valor_unitario,
          data_movimento: d.data_movimento,
        })),
        ...filhos,
      ];

      const itemIds = Array.from(new Set(linhasRaw.map((l) => l.item_id).filter(Boolean)));
      if (!itemIds.length) return [];
      const { data: itens } = await sb.from("itens").select("id,nome,codigo,unidade").in("id", itemIds);
      const itemMap = new Map<string, any>((itens ?? []).map((i: any) => [i.id, i]));

      const byItem = new Map<string, {
        item_id: string; nome: string; codigo: string; unidade: string;
        quantidade: number; ultima_data: string; ultimo_valor: number | null; compras: number;
      }>();
      for (const l of linhasRaw) {
        const it = itemMap.get(l.item_id);
        if (!it) continue;
        const cur = byItem.get(l.item_id) ?? {
          item_id: l.item_id, nome: it.nome, codigo: it.codigo, unidade: it.unidade,
          quantidade: 0, ultima_data: "", ultimo_valor: null, compras: 0,
        };
        cur.quantidade += l.quantidade;
        cur.compras += 1;
        if (!cur.ultima_data || (l.data_movimento && l.data_movimento > cur.ultima_data)) {
          cur.ultima_data = l.data_movimento;
          cur.ultimo_valor = l.valor_unitario != null ? Number(l.valor_unitario) : cur.ultimo_valor;
        }
        byItem.set(l.item_id, cur);
      }
      return Array.from(byItem.values()).sort((a, b) => b.quantidade - a.quantidade);
    },
  });

  const brl = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = (d: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

  return (
    <Card className="p-4 mt-4">
      <div className="text-sm font-semibold mb-1">Itens comprados por fornecedor</div>
      <div className="text-xs text-muted-foreground mb-3">
        Digite o nome do fornecedor para ver os itens já adquiridos dele.
      </div>
      <div className="relative max-w-md">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setSelected(null); }}
          placeholder="Buscar fornecedor…"
        />
        {!selected && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                onClick={() => { setSelected(f); setQ(f.nome); }}
              >
                {f.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : linhas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma entrada registrada para este fornecedor.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="text-left p-2">Código</th>
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2">Qtd total</th>
                    <th className="text-right p-2">Último valor</th>
                    <th className="text-right p-2">Última compra</th>
                    <th className="text-right p-2">Nº compras</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.item_id} className="border-t border-border">
                      <td className="p-2 font-mono text-xs text-muted-foreground">{l.codigo}</td>
                      <td className="p-2">{l.nome}</td>
                      <td className="p-2 text-right">{l.quantidade.toLocaleString("pt-BR")} {l.unidade}</td>
                      <td className="p-2 text-right">{brl(l.ultimo_valor)}</td>
                      <td className="p-2 text-right">{fmtData(l.ultima_data)}</td>
                      <td className="p-2 text-right">{l.compras}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
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
