import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cake,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcularIndicadoresCaixa } from "@/lib/conta-azul/dre";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel Executivo — Grupo Luminart" },
      { name: "description", content: "Visão consolidada de aniversariantes, indicadores financeiros, Uber, atividades do dia e calendário." },
      { property: "og:title", content: "Painel Executivo — Grupo Luminart" },
      { property: "og:description", content: "Visão consolidada da operação do Grupo Luminart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelPage,
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

function PainelPage() {
  const { isMasterAdmin, user } = useAuth();
  const hoje = new Date();
  const [ref, setRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSel, setDiaSel] = useState<string>(iso(hoje));

  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const inicioMes = iso(new Date(ano, mes, 1));
  const fimMes = iso(new Date(ano, mes + 1, 0));
  const hojeIso = iso(hoje);

  /* ---------- aniversariantes ---------- */
  const { data: aniversariantes } = useQuery({
    queryKey: ["painel-aniversariantes", mes],
    enabled: isMasterAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_colaboradores")
        .select("id,nome,departamento,data_nascimento,ativo")
        .not("data_nascimento", "is", null);
      if (error) throw error;
      return (data ?? [])
        .filter((c: any) => c.ativo && Number(String(c.data_nascimento).slice(5, 7)) === mes + 1)
        .sort((a: any, b: any) => String(a.data_nascimento).slice(8, 10).localeCompare(String(b.data_nascimento).slice(8, 10)));
    },
  });

  /* ---------- indicadores financeiros (caixa, igual ao dashboard financeiro) ---------- */
  const { data: fin } = useQuery({
    queryKey: ["painel-financeiro", inicioMes, fimMes],
    enabled: isMasterAdmin,
    queryFn: async () => {
      const cols = "external_id,valor,status,data_vencimento,data_pagamento,descricao,categoria_external_id";
      const [recRes, pagRes, planos] = await Promise.all([
        supabase.from("ca_contas_receber").select(cols).gte("data_vencimento", inicioMes).lte("data_vencimento", fimMes).limit(20000),
        supabase.from("ca_contas_pagar").select(cols).gte("data_vencimento", inicioMes).lte("data_vencimento", fimMes).limit(20000),
        supabase.from("ca_plano_contas").select("external_id,nome"),
      ]);
      const planoMap = new Map(((planos.data ?? []) as any[]).map((p) => [p.external_id, p.nome as string]));
      return calcularIndicadoresCaixa(
        (pagRes.data ?? []) as any[],
        (recRes.data ?? []) as any[],
        new Map(Array.from(planoMap, ([id, nome]) => [id, { nome }])),
        ano,
        mes + 1,
      );
    },
  });


  /* ---------- uber ---------- */
  const { data: uber } = useQuery({
    queryKey: ["painel-uber", inicioMes, fimMes],
    enabled: isMasterAdmin,
    queryFn: async () => {
      const anteriorIni = iso(new Date(ano, mes - 1, 1));
      const anteriorFim = iso(new Date(ano, mes, 0));
      const [atual, anterior] = await Promise.all([
        supabase.from("uber_corridas").select("valor,nome,sobrenome,projeto").gte("data_solicitacao", inicioMes).lte("data_solicitacao", fimMes),
        supabase.from("uber_corridas").select("valor").gte("data_solicitacao", anteriorIni).lte("data_solicitacao", anteriorFim),
      ]);
      const linhas = (atual.data ?? []) as any[];
      const total = linhas.reduce((s, r) => s + Number(r.valor || 0), 0);
      const totalAnterior = (anterior.data ?? []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
      const porPessoa = new Map<string, number>();
      linhas.forEach((r) => {
        const k = `${r.nome ?? ""} ${r.sobrenome ?? ""}`.trim() || "Não identificado";
        porPessoa.set(k, (porPessoa.get(k) ?? 0) + Number(r.valor || 0));
      });
      return {
        total,
        corridas: linhas.length,
        variacao: totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null,
        ranking: [...porPessoa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      };
    },
  });

  /* ---------- eventos do mês ---------- */
  const { data: eventos } = useQuery({
    queryKey: ["painel-eventos", inicioMes, fimMes],
    enabled: isMasterAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id,nome,local,cidade,data_evento,data_evento_fim,cor,situacao")
        .lte("data_evento", fimMes)
        .or(`data_evento_fim.gte.${inicioMes},and(data_evento_fim.is.null,data_evento.gte.${inicioMes})`)
        .order("data_evento");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  /* ---------- tarefas do usuário ---------- */
  const { data: tarefas } = useQuery({
    queryKey: ["painel-tarefas", inicioMes, fimMes, user?.id],
    enabled: isMasterAdmin && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lembretes_tarefas")
        .select("id,titulo,data_hora,status,prioridade,dia_inteiro")
        .gte("data_hora", `${inicioMes}T00:00:00`)
        .lte("data_hora", `${fimMes}T23:59:59`)
        .order("data_hora");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, any[]>();
    (eventos ?? []).forEach((e) => {
      const ini = new Date(`${String(e.data_evento).slice(0, 10)}T00:00:00`);
      const fim = new Date(`${String(e.data_evento_fim ?? e.data_evento).slice(0, 10)}T00:00:00`);
      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        m.set(k, [...(m.get(k) ?? []), e]);
      }
    });
    return m;
  }, [eventos]);

  const tarefasPorDia = useMemo(() => {
    const m = new Map<string, any[]>();
    (tarefas ?? []).forEach((t) => {
      const k = String(t.data_hora).slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), t]);
    });
    return m;
  }, [tarefas]);

  const celulas = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [ano, mes]);

  const atividadesHoje = useMemo(
    () => ({
      eventos: eventosPorDia.get(hojeIso) ?? [],
      tarefas: (tarefasPorDia.get(hojeIso) ?? []).filter((t) => t.status !== "concluida"),
    }),
    [eventosPorDia, tarefasPorDia, hojeIso],
  );

  const doDiaSelecionado = {
    eventos: eventosPorDia.get(diaSel) ?? [],
    tarefas: tarefasPorDia.get(diaSel) ?? [],
    aniversariantes: (aniversariantes ?? []).filter(
      (c: any) => String(c.data_nascimento).slice(5, 10) === diaSel.slice(5, 10),
    ),
  };

  if (!isMasterAdmin) {
    return (
      <>
        <PageHeader title="Painel" description="Visão executiva" />
        <Card className="p-6 text-sm text-muted-foreground">
          Este painel está disponível apenas para administradores máster.
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Painel"
        description="Aniversariantes, indicadores financeiros, Uber, atividades do dia e calendário"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setRef(new Date(ano, mes - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 text-sm font-medium min-w-[150px] text-center">
              {MESES[mes]} / {ano}
            </div>
            <Button variant="outline" size="icon" onClick={() => setRef(new Date(ano, mes + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* KPIs financeiros */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Recebido no mês</div>
          <div className="text-xl font-semibold mt-1 text-emerald-600">{brl(fin?.recebido ?? 0)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">A receber: {brl(fin?.aReceber ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-3.5 w-3.5" /> Pago no mês</div>
          <div className="text-xl font-semibold mt-1 text-rose-600">{brl(fin?.pago ?? 0)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">A pagar: {brl(fin?.aPagar ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Saldo de caixa</div>
          <div className={`text-xl font-semibold mt-1 ${(fin?.saldo ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {brl(fin?.saldo ?? 0)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Recebido menos pago</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Car className="h-3.5 w-3.5" /> Uber no mês</div>
          <div className="text-xl font-semibold mt-1">{brl(uber?.total ?? 0)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {uber?.corridas ?? 0} corrida(s)
            {uber?.variacao != null && (
              <span className={uber.variacao >= 0 ? " text-rose-600" : " text-emerald-600"}>
                {` · ${uber.variacao >= 0 ? "+" : ""}${uber.variacao.toFixed(1)}% vs. mês anterior`}
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendário */}
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <CalendarDays className="h-4 w-4" /> Calendário de {MESES[mes]}
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
            {DIAS.map((d, i) => (
              <div key={i} className="text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((d) => {
              const k = iso(d);
              const foraDoMes = d.getMonth() !== mes;
              const evs = eventosPorDia.get(k) ?? [];
              const tfs = tarefasPorDia.get(k) ?? [];
              const nivers = (aniversariantes ?? []).filter((c: any) => String(c.data_nascimento).slice(5, 10) === k.slice(5, 10));
              const selecionado = k === diaSel;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDiaSel(k)}
                  className={`rounded-md border p-1.5 h-16 text-left transition ${
                    selecionado ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted/40"
                  } ${foraDoMes ? "opacity-40" : ""} ${k === hojeIso ? "bg-primary/5" : ""}`}
                >
                  <div className="text-[11px] font-medium">{d.getDate()}</div>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {evs.slice(0, 3).map((e, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: e.cor || "hsl(var(--primary))" }} />
                    ))}
                    {tfs.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />}
                    {nivers.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t pt-3">
            <div className="text-sm font-medium mb-2">
              {diaSel.split("-").reverse().join("/")}
            </div>
            {doDiaSelecionado.eventos.length === 0 &&
            doDiaSelecionado.tarefas.length === 0 &&
            doDiaSelecionado.aniversariantes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada programado para este dia.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {doDiaSelecionado.aniversariantes.map((c: any) => (
                  <div key={`n-${c.id}`} className="flex items-center gap-2">
                    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Aniversário</Badge>
                    <span>{c.nome}</span>
                  </div>
                ))}
                {doDiaSelecionado.eventos.map((e: any) => (
                  <div key={`e-${e.id}`} className="flex items-center gap-2">
                    <Badge variant="outline">Evento</Badge>
                    <span className="font-medium">{e.nome}</span>
                    <span className="text-muted-foreground">{[e.local, e.cidade].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
                {doDiaSelecionado.tarefas.map((t: any) => (
                  <div key={`t-${t.id}`} className="flex items-center gap-2">
                    <Badge variant="secondary">Tarefa</Badge>
                    <span className={t.status === "concluida" ? "line-through text-muted-foreground" : ""}>{t.titulo}</span>
                    {!t.dia_inteiro && (
                      <span className="text-muted-foreground">
                        {new Date(t.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Aniversariantes */}
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Cake className="h-4 w-4" /> Aniversariantes de {MESES[mes]}
            </div>
            {(aniversariantes?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum aniversariante neste mês.</p>
            ) : (
              <div className="space-y-1.5">
                {(aniversariantes ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-muted-foreground">{c.departamento ?? "—"}</div>
                    </div>
                    <Badge variant={String(c.data_nascimento).slice(5, 10) === hojeIso.slice(5, 10) ? "default" : "outline"}>
                      {String(c.data_nascimento).slice(8, 10)}/{String(c.data_nascimento).slice(5, 7)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Atividades de hoje */}
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <ListChecks className="h-4 w-4" /> Atividades de hoje
            </div>
            {atividadesHoje.eventos.length === 0 && atividadesHoje.tarefas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem atividades registradas para hoje.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {atividadesHoje.eventos.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <Badge variant="outline">Evento</Badge>
                    <span className="truncate">{e.nome}</span>
                  </div>
                ))}
                {atividadesHoje.tarefas.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Badge variant="secondary">Tarefa</Badge>
                    <span className="truncate">{t.titulo}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Uber */}
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Car className="h-4 w-4" /> Comportamento do Uber
            </div>
            {(uber?.ranking.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma corrida no período.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {(uber?.ranking ?? []).map(([nome, valor]) => (
                  <div key={nome} className="flex items-center justify-between">
                    <span className="truncate">{nome}</span>
                    <span className="font-medium">{brl(valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
