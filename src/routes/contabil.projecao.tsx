import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/MoneyInput";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Calculator, History, Settings2, Loader2, TrendingUp, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import {
  analisar, brl, pct, competenciaAtual, addMeses, rotuloCompetencia, AVISO_LEGAL,
  type EmpresaFiscal, type FaturamentoMes, type FaixaSimples,
  type ResultadoAnalise, type ResultadoEmpresa, type Severidade,
} from "@/lib/fiscal/engine";
import { carregarNotasPorCompetencia, mesclarFaturamento } from "@/lib/fiscal/faturamento";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção Tributária — Contábil" },
      {
        name: "description",
        content:
          "Simule o custo tributário de uma nota fiscal em cada empresa do grupo, com memória de cálculo aberta.",
      },
      { property: "og:title", content: "Projeção Tributária — Contábil" },
      {
        property: "og:description",
        content:
          "Simule o custo tributário de uma nota fiscal em cada empresa do grupo, com memória de cálculo aberta.",
      },
    ],
  }),
  component: ProjecaoTributaria,
});

// ─────────────────────────────────────────────────────────────

function useDadosFiscais() {
  const empresas = useQuery({
    queryKey: ["fiscal-empresas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("fiscal_empresas")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmpresaFiscal[];
    },
  });

  const faixas = useQuery({
    queryKey: ["fiscal-faixas"],
    queryFn: async () => {
      const { data, error } = await sb.from("fiscal_faixas_simples").select("*");
      if (error) throw error;
      return (data ?? []) as FaixaSimples[];
    },
    staleTime: 5 * 60_000,
  });

  const faturamento = useQuery({
    queryKey: ["fiscal-faturamento", "com-apuracao"],
    queryFn: async () => {
      const [{ data, error }, notas] = await Promise.all([
        sb
          .from("fiscal_faturamento")
          .select("empresa_id,competencia,receita_bruta,folha_bruta")
          .order("competencia", { ascending: true }),
        carregarNotasPorCompetencia(),
      ]);
      if (error) throw error;
      const manual: Record<string, FaturamentoMes[]> = {};
      for (const r of (data ?? []) as any[]) {
        (manual[r.empresa_id] ??= []).push({
          competencia: r.competencia,
          receita_bruta: Number(r.receita_bruta) || 0,
          folha_bruta: Number(r.folha_bruta) || 0,
        });
      }
      return { manual, notas };
    },
  });

  const faturamentoPorEmpresa = useMemo(() => {
    const map: Record<string, FaturamentoMes[]> = {};
    const manual = faturamento.data?.manual ?? {};
    const notas = faturamento.data?.notas ?? {};
    for (const e of empresas.data ?? []) {
      const ref = e.empresa_ref ?? e.nome;
      map[e.id] = mesclarFaturamento(manual[e.id] ?? [], notas[ref]).serie;
    }
    for (const [id, linhas] of Object.entries(manual)) {
      if (!map[id]) map[id] = linhas;
    }
    return map;
  }, [empresas.data, faturamento.data]);

  return { empresas, faixas, faturamento, faturamentoPorEmpresa };
}

const SEV_CLASS: Record<Severidade, string> = {
  informativa: "bg-muted text-muted-foreground",
  atencao: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  alta: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  critica: "bg-destructive/15 text-destructive border-destructive/30",
};

// ─────────────────────────────────────────────────────────────

function ProjecaoTributaria() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { empresas, faixas, faturamento, faturamentoPorEmpresa } = useDadosFiscais();

  const [valor, setValor] = useState(0);
  const [atividade, setAtividade] = useState<string>("__todas");
  const [competencia, setCompetencia] = useState<string>(competenciaAtual());
  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);

  const atividades = useMemo(() => {
    const set = new Set<string>();
    for (const e of empresas.data ?? []) {
      if (!e.ativo) continue;
      for (const a of e.atividades ?? []) set.add(a);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [empresas.data]);

  const competencias = useMemo(() => {
    const atual = competenciaAtual();
    return Array.from({ length: 18 }, (_, i) => addMeses(atual, 6 - i));
  }, []);

  const salvarHistorico = useMutation({
    mutationFn: async (res: ResultadoAnalise) => {
      const { error } = await sb.from("fiscal_projecoes").insert({
        valor_analisado: res.valor,
        atividade: res.atividade,
        competencia: res.competencia,
        criado_por: user?.id ?? null,
        resultado: res as any,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiscal-projecoes"] }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível gravar o histórico"),
  });

  function rodarAnalise() {
    if (valor <= 0) {
      toast.error("Informe o valor da nota fiscal");
      return;
    }
    if (!(empresas.data ?? []).length) {
      toast.error("Cadastre ao menos uma empresa fiscal antes de analisar");
      return;
    }
    const res = analisar({
      empresas: empresas.data ?? [],
      faturamentoPorEmpresa,
      faixas: faixas.data ?? [],
      valor,
      competencia,
      atividade: atividade === "__todas" ? null : atividade,
    });
    setResultado(res);
    salvarHistorico.mutate(res);
  }

  const carregando = empresas.isLoading || faixas.isLoading || faturamento.isLoading;

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-24">
      <PageHeader
        title="Projeção Tributária"
        description="Informe o valor de uma nota fiscal e veja quanto ela custa em impostos em cada empresa do grupo, com a memória de cálculo aberta."
      />

      {/* Cabeçalho de análise */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label>Valor da nota fiscal</Label>
            <MoneyInput value={valor} onChange={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label>Atividade</Label>
            <Select value={atividade} onValueChange={setAtividade}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas">Sem filtro de atividade</SelectItem>
                {atividades.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Competência</Label>
            <Select value={competencia} onValueChange={setCompetencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {competencias.map((c) => (
                  <SelectItem key={c} value={c}>{rotuloCompetencia(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={rodarAnalise} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
            Analisar
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <Link
            to="/contabil/projecao-empresas"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground inline-flex items-center gap-1"
          >
            <Settings2 className="h-3.5 w-3.5" /> Configurar empresas e faturamento
          </Link>
          <HistoricoSheet onAbrir={(r) => setResultado(r)} />
        </div>
      </Card>

      {!resultado ? (
        <Card className="p-10 text-center">
          <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-semibold mb-1">Nenhuma análise rodada ainda</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Digite o valor da nota, escolha a atividade que será prestada e clique em Analisar.
            O sistema calcula o custo tributário em cada empresa do grupo — no Simples, incluindo o
            arrasto que a nota provoca no DAS dos 12 meses seguintes — e indica por qual empresa
            emitir. Todo número exibido vem acompanhado da memória de cálculo.
          </p>
        </Card>
      ) : (
        <Resultado res={resultado} />
      )}

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        {AVISO_LEGAL}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function Resultado({ res }: { res: ResultadoAnalise }) {
  const vencedora = res.empresas.find((e) => e.empresa.id === res.vencedoraId);

  const dadosGrafico = res.empresas
    .filter((e) => !e.bloqueada)
    .map((e) => ({
      nome: e.empresa.nome.length > 26 ? `${e.empresa.nome.slice(0, 26)}…` : e.empresa.nome,
      "Custo imediato": Number(e.custoImediato.toFixed(2)),
      Arrasto: Number(e.arrasto.toFixed(2)),
    }));

  return (
    <div className="space-y-4">
      {vencedora && (
        <Card
          className={`p-4 border-l-4 ${
            res.diferencaIrrelevante ? "border-l-muted-foreground" : "border-l-primary"
          }`}
        >
          {res.diferencaIrrelevante ? (
            <p className="text-sm">
              <strong>Diferença irrelevante entre as empresas.</strong> Decida pelo critério
              operacional, não pelo fiscal. Menor custo: {vencedora.empresa.nome} com{" "}
              {brl(vencedora.custoTotal)}, apenas {brl(res.economia)} abaixo da segunda opção.
            </p>
          ) : (
            <p className="text-sm">
              Emitir pela <strong>{vencedora.empresa.nome}</strong> — custo de{" "}
              <strong>{brl(vencedora.custoTotal)}</strong>
              {res.economia > 0 && <>, economia de <strong>{brl(res.economia)}</strong> em relação à segunda opção.</>}
            </p>
          )}
        </Card>
      )}

      {res.empresas.map((e) => (
        <CardEmpresa key={e.empresa.id} r={e} valor={res.valor} vencedora={e.empresa.id === res.vencedoraId} />
      ))}

      {dadosGrafico.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-1">Comparativo de custo total</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Barra empilhada em custo imediato e arrasto — o arrasto só existe no Simples Nacional.
          </p>
          <div style={{ height: Math.max(160, dadosGrafico.length * 64) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => brl(Number(v))} fontSize={11} />
                <YAxis type="category" dataKey="nome" width={180} fontSize={11} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="Custo imediato" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Arrasto" stackId="a" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function CardEmpresa({ r, valor, vencedora }: { r: ResultadoEmpresa; valor: number; vencedora: boolean }) {
  if (r.bloqueada) {
    return (
      <Card className="p-4 opacity-70 border-dashed">
        <div className="flex items-start gap-3">
          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <div className="font-semibold text-muted-foreground">{r.empresa.nome}</div>
            <div className="text-xs text-muted-foreground mt-1">{r.motivoBloqueio}</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 space-y-4 ${vencedora ? "ring-1 ring-primary" : ""}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-semibold">{r.empresa.nome}</div>
          <Badge variant="secondary" className="mt-1">{r.regimeLabel}</Badge>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold tabular-nums">{brl(r.custoTotal)}</div>
          <div className="text-xs text-muted-foreground">
            {pct(r.aliquotaMarginal)} sobre a nota
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{r.descritivo}</p>

      {/* Composição */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
              <th className="py-2 pr-3">Tributo</th>
              <th className="py-2 px-3 text-right">Base de cálculo</th>
              <th className="py-2 px-3 text-right">Alíquota</th>
              <th className="py-2 pl-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {r.composicao.map((l) => (
              <tr key={l.tributo} className="border-b border-border/50">
                <td className="py-1.5 pr-3">
                  {l.tributo}
                  {l.nota && <span className="block text-[11px] text-muted-foreground">{l.nota}</span>}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums">{brl(l.base)}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{pct(l.aliquota, 4)}</td>
                <td className="py-1.5 pl-3 text-right tabular-nums">{brl(l.valor)}</td>
              </tr>
            ))}
            {r.arrasto !== 0 && (
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-3">
                  Arrasto nos 12 meses seguintes
                  <span className="block text-[11px] text-muted-foreground">
                    Aumento do DAS de toda a receita futura
                  </span>
                </td>
                <td className="py-1.5 px-3 text-right text-muted-foreground">—</td>
                <td className="py-1.5 px-3 text-right tabular-nums">
                  {pct(valor > 0 ? (r.arrasto / valor) * 100 : 0, 4)}
                </td>
                <td className="py-1.5 pl-3 text-right tabular-nums">{brl(r.arrasto)}</td>
              </tr>
            )}
            <tr className="font-semibold">
              <td className="py-2 pr-3">Custo total</td>
              <td />
              <td className="py-2 px-3 text-right tabular-nums">{pct(r.aliquotaMarginal)}</td>
              <td className="py-2 pl-3 text-right tabular-nums">{brl(r.custoTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {r.encargoFolhaNota && (
        <p className="text-[11px] text-muted-foreground border-l-2 border-border pl-2">
          {r.encargoFolhaNota}
        </p>
      )}

      <Accordion type="multiple" className="border-t border-border">
        <AccordionItem value="memoria">
          <AccordionTrigger className="text-sm">Como chegamos nesse valor</AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-3">
              {r.memoria.map((p) => (
                <li key={p.ordem} className="text-sm">
                  <div className="font-medium">
                    {p.ordem}. {p.titulo}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.formula}</div>
                  <div className="text-xs font-mono mt-0.5">{p.substituicao}</div>
                  <div className="text-sm tabular-nums">= {p.resultado}</div>
                  {p.nota && <div className="text-[11px] text-muted-foreground mt-0.5">{p.nota}</div>}
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        {r.projecaoBase.length > 0 && (
          <AccordionItem value="projecao">
            <AccordionTrigger className="text-sm">Projeção dos 12 meses</AccordionTrigger>
            <AccordionContent>
              <TabelaProjecao r={r} />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {r.alertas.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.alertas.map((a, i) => (
            <span
              key={i}
              className={`text-[11px] px-2 py-1 rounded-md border ${SEV_CLASS[a.severidade]}`}
            >
              {a.texto}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function TabelaProjecao({ r }: { r: ResultadoEmpresa }) {
  const totalBase = r.projecaoBase.reduce((a, m) => a + m.das, 0);
  const totalCom = r.projecaoComNota.reduce((a, m) => a + m.das, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left border-b border-border text-muted-foreground uppercase tracking-wide">
            <th className="py-2 pr-3">Competência</th>
            <th className="py-2 px-3 text-right">RBT12 base</th>
            <th className="py-2 px-3 text-right">Alíq. base</th>
            <th className="py-2 px-3 text-right">DAS base</th>
            <th className="py-2 px-3 text-right">RBT12 c/ nota</th>
            <th className="py-2 px-3 text-right">Alíq. c/ nota</th>
            <th className="py-2 pl-3 text-right">DAS c/ nota</th>
          </tr>
        </thead>
        <tbody>
          {r.projecaoBase.map((m, i) => {
            const c = r.projecaoComNota[i]!;
            return (
              <tr key={m.competencia} className="border-b border-border/50">
                <td className="py-1.5 pr-3">{m.rotulo}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{brl(m.rbt12)}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{pct(m.aliquotaEfetiva)}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{brl(m.das)}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{brl(c.rbt12)}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{pct(c.aliquotaEfetiva)}</td>
                <td className="py-1.5 pl-3 text-right tabular-nums">{brl(c.das)}</td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td className="py-2 pr-3">Total</td>
            <td /><td />
            <td className="py-2 px-3 text-right tabular-nums">{brl(totalBase)}</td>
            <td /><td />
            <td className="py-2 pl-3 text-right tabular-nums">{brl(totalCom)}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 text-muted-foreground" colSpan={6}>
              Diferença entre os cenários (DAS imediato + arrasto)
            </td>
            <td className="py-1 pl-3 text-right tabular-nums">{brl(totalCom - totalBase)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function HistoricoSheet({ onAbrir }: { onAbrir: (r: ResultadoAnalise) => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["fiscal-projecoes"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("fiscal_projecoes")
        .select("id,valor_analisado,atividade,competencia,criado_em,resultado")
        .order("criado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-1" /> Histórico
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Análises anteriores</SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-6">Nenhuma análise gravada ainda.</p>
        ) : (
          <div className="mt-4 divide-y divide-border/60">
            {data.map((p) => (
              <button
                key={p.id}
                className="w-full text-left py-2.5 hover:bg-muted/40 rounded px-2"
                onClick={() => onAbrir(p.resultado as ResultadoAnalise)}
              >
                <div className="text-sm font-medium">{brl(Number(p.valor_analisado))}</div>
                <div className="text-xs text-muted-foreground">
                  {p.atividade || "Sem filtro de atividade"} ·{" "}
                  {p.competencia ? rotuloCompetencia(p.competencia) : "—"} ·{" "}
                  {new Date(p.criado_em).toLocaleString("pt-BR")}
                </div>
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
