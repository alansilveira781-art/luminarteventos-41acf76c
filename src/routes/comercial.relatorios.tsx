import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, Fragment, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, AlertTriangle, Download, FileBarChart, CalendarRange, Printer, Award, Plus, Trash2 } from "lucide-react";
import { listVendasDb } from "@/lib/comercial/vendas-db.functions";
import { getAno, getMes, cleanText } from "@/lib/comercial/vendas-metrics";
import { RelatorioVendasPeriodo } from "@/components/comercial/RelatorioVendasPeriodo";

import {
  useProdutores,
  useAlcadas,
  useBonificacoes,
  useBonificacaoMutations,
  sugerirComplexidade,
  multiplicadorDaCategoria,
} from "@/lib/comercial/bonificacao";
import { toast } from "sonner";

export const Route = createFileRoute("/comercial/relatorios")({
  component: RelatoriosPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const fmtBRL = (v: number) =>
  v === 0
    ? "R$ -"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type LinhaVenda = {
  consultor: string;
  evento: string;
  local: string;
  tipo: string;
  valorFinal: number;
  valorComissao: number;
};

type Grupo = {
  consultor: string;
  linhas: LinhaVenda[];
  totalFinal: number;
  totalComissao: number;
};

function RelatoriosPage() {
  const [relatorioAtivo, setRelatorioAtivo] = useState<"comissao" | "periodo" | "bonificacao">("comissao");
  const [ano, setAno] = useState<number | "Todos">("Todos");
  const [mes, setMes] = useState<string>("Todos");


  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-db", "relatorios"],
    queryFn: () => listVendasDb(),
    staleTime: 30 * 1000,
  });

  const rows = data?.rows ?? [];

  const anoDoRegistro = (r: typeof rows[number]): number | null => {
    const iso = r.dataRegistro || r.dataEvento || null;
    if (iso && /^\d{4}/.test(iso)) {
      const y = Number(iso.slice(0, 4));
      if (y > 1900 && y < 2100) return y;
    }
    return getAno(r);
  };
  const mesDoRegistro = (r: typeof rows[number]): string | null => {
    const iso = r.dataRegistro || r.dataEvento || null;
    if (iso && /^\d{4}-\d{2}/.test(iso)) {
      const m = Number(iso.slice(5, 7));
      if (m >= 1 && m <= 12) return MESES_PT[m - 1];
    }
    return (getMes(r) ?? "").toLowerCase() || null;
  };

  const anosDisponiveis = useMemo(() => {
    const s = new Set<number>();
    for (const r of rows) {
      const a = anoDoRegistro(r);
      if (a) s.add(a);
    }
    return [...s].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtradas = useMemo(() => {
    const mesAlvo = mes === "Todos" ? null : mes.toLowerCase();
    return rows.filter((r) => {
      if (ano !== "Todos" && anoDoRegistro(r) !== ano) return false;
      if (mesAlvo) {
        const m = (mesDoRegistro(r) ?? "").toLowerCase();
        if (m !== mesAlvo) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ano, mes]);

  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, LinhaVenda[]>();
    for (const r of filtradas) {
      const consultor = cleanText(r.consultor) || "(vazio)";
      const linha: LinhaVenda = {
        consultor,
        evento: cleanText(r.nomeEvento) || "-",
        local: cleanText(r.local) || "-",
        tipo: cleanText(r.tipo) || "-",
        valorFinal: Number(r.valorFinal || 0),
        valorComissao: Number(r.valorComissao || 0),
      };
      const arr = map.get(consultor) ?? [];
      arr.push(linha);
      map.set(consultor, arr);
    }
    const nomes = [...map.keys()].sort((a, b) => {
      if (a === "(vazio)") return 1;
      if (b === "(vazio)") return -1;
      return a.localeCompare(b, "pt-BR");
    });
    return nomes.map((consultor) => {
      const linhas = map.get(consultor)!;
      const totalFinal = linhas.reduce((s, l) => s + l.valorFinal, 0);
      const totalComissao = linhas.reduce((s, l) => s + l.valorComissao, 0);
      return { consultor, linhas, totalFinal, totalComissao };
    });
  }, [filtradas]);

  const totalGeral = useMemo(
    () => ({
      final: grupos.reduce((s, g) => s + g.totalFinal, 0),
      comissao: grupos.reduce((s, g) => s + g.totalComissao, 0),
      qtd: filtradas.length,
    }),
    [grupos, filtradas.length],
  );

  const exportarCSV = () => {
    const linhas: string[] = ["Consultor;Evento;Local;Tipo;Vr. Final;Vr. Comissao"];
    for (const g of grupos) {
      for (const l of g.linhas) {
        linhas.push(
          [l.consultor, l.evento, l.local, l.tipo, l.valorFinal.toFixed(2), l.valorComissao.toFixed(2)].join(";"),
        );
      }
      linhas.push(
        [`${g.consultor} Total`, "", "", "", g.totalFinal.toFixed(2), g.totalComissao.toFixed(2)].join(";"),
      );
    }
    linhas.push(
      ["TOTAL GERAL", "", "", "", totalGeral.final.toFixed(2), totalGeral.comissao.toFixed(2)].join(";"),
    );
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `distribuicao-comissao-${ano}-${mes}.csv`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Relatórios"
        description="Relatórios operacionais do Comercial."
      />

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          variant={relatorioAtivo === "comissao" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setRelatorioAtivo("comissao")}
        >
          <FileBarChart className="h-4 w-4" /> Distribuição de Comissão
        </Button>
        <Button
          variant={relatorioAtivo === "periodo" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setRelatorioAtivo("periodo")}
        >
          <CalendarRange className="h-4 w-4" /> Vendas por Período
        </Button>
        <Button
          variant={relatorioAtivo === "bonificacao" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setRelatorioAtivo("bonificacao")}
        >
          <Award className="h-4 w-4" /> Distribuição Bonificação
        </Button>
      </div>

      {relatorioAtivo === "periodo" && (
        <RelatorioVendasPeriodo rows={rows} isLoading={isLoading} error={error} />
      )}

      {relatorioAtivo === "bonificacao" && (
        <DistribuicaoBonificacao
          rows={rows}
          isLoading={isLoading}
          error={error as Error | null}
          ano={ano}
          setAno={setAno}
          mes={mes}
          setMes={setMes}
          anosDisponiveis={anosDisponiveis}
          anoDoRegistro={anoDoRegistro}
          mesDoRegistro={mesDoRegistro}
        />
      )}

      {relatorioAtivo === "comissao" && (
        <div className="print-area space-y-6">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible !important; }
              .print-area { position: absolute; inset: 0; padding: 0; }
              .print\\:hidden { display: none !important; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}</style>

          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold">Distribuição de Comissão</h1>
            <p className="text-muted-foreground">
              {ano === "Todos" ? "Todos os anos" : ano} · {mes === "Todos" ? "Todos os meses" : mes}
            </p>
          </div>


      <Card className="p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-[160px_200px_1fr] sm:items-end">
          <div className="space-y-1">
            <Label>Ano</Label>
            <Select
              value={String(ano)}
              onValueChange={(v) => setAno(v === "Todos" ? "Todos" : Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportarCSV}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando vendas…
        </Card>
      )}
      {error && (
        <Card className="p-6 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>
            Não foi possível carregar os dados. {(error as Error)?.message ?? data?.error}
          </span>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Vendas no período
              </p>
              <p className="text-2xl font-semibold mt-1">{totalGeral.qtd}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Valor final total
              </p>
              <p className="text-2xl font-semibold mt-1">{fmtBRL(totalGeral.final)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Comissão total
              </p>
              <p className="text-2xl font-semibold mt-1">{fmtBRL(totalGeral.comissao)}</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Consultor</th>
                    <th className="text-left px-3 py-2">Evento</th>
                    <th className="text-left px-3 py-2">Local</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-right px-3 py-2">Vr. Final</th>
                    <th className="text-right px-3 py-2">Vr. Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhuma venda no filtro selecionado.
                      </td>
                    </tr>
                  )}
                  {grupos.map((g) => (
                    <Fragment key={g.consultor}>
                      {g.linhas.map((l, i) => (
                        <tr key={`${g.consultor}-${i}`} className="border-t border-border/50">
                          <td className="px-3 py-2">{l.consultor}</td>
                          <td className="px-3 py-2">{l.evento}</td>
                          <td className="px-3 py-2">{l.local}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="font-normal">
                              {l.tipo}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtBRL(l.valorFinal)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtBRL(l.valorComissao)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/40 font-semibold border-t border-border">
                        <td className="px-3 py-2" colSpan={4}>
                          {g.consultor} Total
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtBRL(g.totalFinal)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtBRL(g.totalComissao)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
                {grupos.length > 0 && (
                  <tfoot>
                    <tr className="bg-primary/10 font-semibold border-t-2 border-primary/40">
                      <td className="px-3 py-2" colSpan={4}>
                        TOTAL GERAL
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtBRL(totalGeral.final)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtBRL(totalGeral.comissao)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
        </div>
      )}
    </div>

  );
}

/* -------------------- Distribuição Bonificação -------------------- */

type EventoBonif = {
  vendaId: string;
  nomeEvento: string;
  dataEvento: string | null;
  categoria: string;
  valorFinal: number;
  ano: number | null;
  mes: string | null;
};

type LinhaAtribuicao = {
  key: string;
  vendaId: string;
  produtorId: string | null;
  complexidade: number;
  bonifId?: string;
  dirty?: boolean;
};

function DistribuicaoBonificacao({
  rows,
  isLoading,
  error,
  ano,
  setAno,
  mes,
  setMes,
  anosDisponiveis,
  anoDoRegistro,
  mesDoRegistro,
}: {
  rows: any[];
  isLoading: boolean;
  error: Error | null;
  ano: number | "Todos";
  setAno: (v: number | "Todos") => void;
  mes: string;
  setMes: (v: string) => void;
  anosDisponiveis: number[];
  anoDoRegistro: (r: any) => number | null;
  mesDoRegistro: (r: any) => string | null;
}) {
  const { data: produtoresData } = useProdutores(true);
  const { data: alcadasData } = useAlcadas();
  const { data: bonifData } = useBonificacoes(ano, mes);
  const { upsert, remove } = useBonificacaoMutations();

  const produtores = useMemo(() => produtoresData ?? [], [produtoresData]);
  const alcadas = useMemo(() => alcadasData ?? [], [alcadasData]);
  const bonifRows = useMemo(() => bonifData ?? [], [bonifData]);

  // Filtrar somente vendas do tipo VENDA (ignora EXTRA), no período
  const eventos = useMemo<EventoBonif[]>(() => {
    const mesAlvo = mes === "Todos" ? null : mes.toLowerCase();
    return rows
      .filter((r) => {
        const t = (r.tipo || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        if (t !== "VENDA") return false;
        if (ano !== "Todos" && anoDoRegistro(r) !== ano) return false;
        if (mesAlvo) {
          const m = (mesDoRegistro(r) ?? "").toLowerCase();
          if (m !== mesAlvo) return false;
        }
        return !!r.id;
      })
      .map((r) => ({
        vendaId: r.id as string,
        nomeEvento: cleanText(r.nomeEvento) || "-",
        dataEvento: r.dataEvento || null,
        categoria: cleanText(r.tipoEvento) || "",
        valorFinal: Number(r.valorFinal || 0),
        ano: anoDoRegistro(r),
        mes: mesDoRegistro(r),
      }))
      .sort((a, b) => (a.dataEvento || "").localeCompare(b.dataEvento || ""));
    // anoDoRegistro/mesDoRegistro são recriados a cada render do pai; ignoramos de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ano, mes]);

  // Local state para linhas de atribuição por venda_id (permite múltiplos produtores)
  const [linhasPorVenda, setLinhasPorVenda] = useState<Record<string, LinhaAtribuicao[]>>({});

  // Chaves estáveis: só mudam quando o conteúdo relevante muda.
  const bonifKey = useMemo(
    () => bonifRows.map((b) => `${b.id}:${b.venda_id}:${b.produtor_id}:${b.complexidade}`).join("|"),
    [bonifRows],
  );
  const eventosKey = useMemo(
    () => eventos.map((e) => `${e.vendaId}:${e.categoria}:${e.valorFinal}`).join("|"),
    [eventos],
  );
  const alcadasKey = useMemo(
    () => alcadas.map((a) => `${a.categoria}:${a.nivel}:${a.valor_ate}:${a.multiplicador}`).join("|"),
    [alcadas],
  );

  // Hidratar (idempotente): faz merge com o estado anterior, preservando edições.
  useEffect(() => {
    setLinhasPorVenda((prev) => {
      const next: Record<string, LinhaAtribuicao[]> = { ...prev };

      // Agrupar linhas salvas por venda_id
      const salvasPorVenda = new Map<string, LinhaAtribuicao[]>();
      for (const b of bonifRows) {
        if (!b.venda_id) continue;
        const arr = salvasPorVenda.get(b.venda_id) ?? [];
        arr.push({
          key: b.id,
          vendaId: b.venda_id,
          produtorId: b.produtor_id,
          complexidade: b.complexidade ?? 1,
          bonifId: b.id,
        });
        salvasPorVenda.set(b.venda_id, arr);
      }

      // Substitui apenas quando o servidor tem dados e o estado local ainda não tem
      // nenhuma linha persistida (bonifId) para aquela venda.
      for (const [vendaId, linhasSalvas] of salvasPorVenda) {
        const atual = next[vendaId] ?? [];
        const jaTemPersistidas = atual.some((l) => l.bonifId);
        if (!jaTemPersistidas) next[vendaId] = linhasSalvas;
      }

      // Garante 1 linha vazia para eventos ainda sem entrada
      for (const e of eventos) {
        if (!next[e.vendaId] || next[e.vendaId].length === 0) {
          next[e.vendaId] = [{
            key: `new-${e.vendaId}`,
            vendaId: e.vendaId,
            produtorId: null,
            complexidade: sugerirComplexidade(alcadas, e.categoria, e.valorFinal),
          }];
        }
      }

      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonifKey, eventosKey, alcadasKey]);


  const valorBonificacao = (e: EventoBonif, complexidade: number) => {
    const mult = multiplicadorDaCategoria(alcadas, e.categoria);
    return complexidade * mult;
  };

  const addLinha = (e: EventoBonif) => {
    setLinhasPorVenda((prev) => {
      const arr = prev[e.vendaId] ?? [];
      return {
        ...prev,
        [e.vendaId]: [
          ...arr,
          {
            key: `new-${e.vendaId}-${Date.now()}`,
            vendaId: e.vendaId,
            produtorId: null,
            complexidade: sugerirComplexidade(alcadas, e.categoria, e.valorFinal),
          },
        ],
      };
    });
  };

  const updateLinha = (e: EventoBonif, key: string, patch: Partial<LinhaAtribuicao>) => {
    setLinhasPorVenda((prev) => ({
      ...prev,
      [e.vendaId]: (prev[e.vendaId] ?? []).map((l) => (l.key === key ? { ...l, ...patch, dirty: true } : l)),
    }));
  };

  const removeLinha = async (e: EventoBonif, l: LinhaAtribuicao) => {
    if (l.bonifId) {
      try {
        await remove.mutateAsync(l.bonifId);
        toast.success("Removido");
      } catch (err: any) {
        toast.error(err?.message || "Falha ao remover");
        return;
      }
    }
    setLinhasPorVenda((prev) => ({
      ...prev,
      [e.vendaId]: (prev[e.vendaId] ?? []).filter((x) => x.key !== l.key),
    }));
  };

  const salvarLinha = async (e: EventoBonif, l: LinhaAtribuicao) => {
    if (!l.produtorId) {
      toast.error("Selecione o produtor");
      return;
    }
    const produtor = produtores.find((p) => p.id === l.produtorId);
    const valor = valorBonificacao(e, l.complexidade);
    try {
      await upsert.mutateAsync({
        id: l.bonifId,
        venda_id: e.vendaId,
        nome_evento: e.nomeEvento,
        data_evento: e.dataEvento,
        categoria: e.categoria,
        produtor_id: l.produtorId,
        produtor_nome: produtor?.nome ?? null,
        complexidade: l.complexidade,
        valor_final: valor,
        ano: e.ano,
        mes: e.mes,
      });
      toast.success("Salvo");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar");
    }
  };

  // Informativo agregado por produtor no período
  const porProdutor = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    for (const e of eventos) {
      const linhas = linhasPorVenda[e.vendaId] ?? [];
      for (const l of linhas) {
        if (!l.produtorId) continue;
        const nome = produtores.find((p) => p.id === l.produtorId)?.nome || "?";
        const key = l.produtorId;
        const prev = map.get(key) ?? { nome, total: 0 };
        prev.total += valorBonificacao(e, l.complexidade);
        map.set(key, prev);
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [eventos, linhasPorVenda, produtores, alcadas]);

  return (
    <div className="print-area space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Distribuição Bonificação</h1>
        <p className="text-muted-foreground">
          {ano === "Todos" ? "Todos os anos" : ano} · {mes === "Todos" ? "Todos os meses" : mes}
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-[160px_200px_1fr] sm:items-end">
          <div className="space-y-1">
            <Label>Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(v === "Todos" ? "Todos" : Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando vendas…
        </Card>
      )}
      {error && (
        <Card className="p-6 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>Não foi possível carregar os dados. {error.message}</span>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Nome do evento</th>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-left px-3 py-2">Produtor</th>
                    <th className="text-left px-3 py-2 w-28">Complexidade</th>
                    <th className="text-right px-3 py-2">Valor Final</th>
                    <th className="text-right px-3 py-2 print:hidden">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhuma venda no período.
                      </td>
                    </tr>
                  )}
                  {eventos.map((e) => {
                    const linhas = linhasPorVenda[e.vendaId] ?? [];
                    const cat = catDe(e);
                    return (
                      <Fragment key={e.vendaId}>
                        {linhas.map((l, idx) => (
                          <tr key={l.key} className="border-t border-border/50 align-top">
                            {idx === 0 ? (
                              <>
                                <td className="px-3 py-2" rowSpan={linhas.length}>{e.nomeEvento}</td>
                                <td className="px-3 py-2" rowSpan={linhas.length}>
                                  {e.dataEvento ? new Date(e.dataEvento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="px-3 py-2" rowSpan={linhas.length}>
                                  <Select
                                    value={cat && (TIPOS_EVENTO as readonly string[]).includes(cat) ? cat : ""}
                                    onValueChange={(v) => setCategoriaOverride((prev) => ({ ...prev, [e.vendaId]: v }))}
                                  >
                                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                                    <SelectContent>
                                      {TIPOS_EVENTO.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              </>
                            ) : null}
                            <td className="px-3 py-2">
                              <Select
                                value={l.produtorId ?? ""}
                                onValueChange={(v) => updateLinha(e, l.key, { produtorId: v })}
                              >
                                <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Selecionar produtor" /></SelectTrigger>
                                <SelectContent>
                                  {produtores.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={1}
                                max={6}
                                className="h-8 w-20"
                                value={l.complexidade}
                                onChange={(ev) => {
                                  const n = Math.max(1, Math.min(6, Number(ev.target.value) || 1));
                                  updateLinha(e, l.key, { complexidade: n });
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtBRL(valorBonificacao(e, l.complexidade))}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap print:hidden">
                              <Button size="sm" variant="outline" onClick={() => salvarLinha(e, l)} disabled={upsert.isPending}>
                                Salvar
                              </Button>
                              {idx === linhas.length - 1 && (
                                <Button size="sm" variant="ghost" className="ml-1" onClick={() => addLinha(e)} title="Adicionar produtor">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                              {linhas.length > 1 || l.bonifId ? (
                                <Button size="sm" variant="ghost" className="ml-1 text-destructive" onClick={() => removeLinha(e, l)} title="Remover">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Valor a pagar por produtor</h3>
            {porProdutor.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produtor atribuído no período.</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {porProdutor.map((p) => (
                  <span key={p.nome} className="tabular-nums">
                    <strong>{p.nome}</strong> — {fmtBRL(p.total)}
                  </span>
                ))}
                <span className="ml-auto tabular-nums text-muted-foreground">
                  Total: <strong>{fmtBRL(porProdutor.reduce((s, p) => s + p.total, 0))}</strong>
                </span>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
