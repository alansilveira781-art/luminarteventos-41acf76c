import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PeriodoFilter, PERIODO_MES_DEFAULT, type Periodo, type PeriodoPreset,
} from "@/components/PeriodoFilter";
import { toast } from "sonner";
import { useDreEstrutura } from "@/hooks/useDreEstrutura";
import {
  DRE_STRUCTURE, calcularDRECaixa, type DreGroupId, type DreLine,
} from "@/lib/conta-azul/dre";
import {
  CATEGORIAS_CENTRO_CUSTO, CATEGORIA_LABEL, type CategoriaCentroCusto,
} from "@/lib/centro-custo-categorias";

const sb = supabase as any;

export const Route = createFileRoute("/financeiro-op/relatorios")({
  component: RelatoriosPage,
});

const STATUS_INCLUIDOS = ["finalizado", "a_receber"] as const;

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

type Row = {
  tipo: "COMPRA" | "DEMANDA";
  numero: number | null;
  id: string;
  titulo: string | null;
  solicitante: string | null;
  comprador: string | null;
  descritivo_fallback: string | null;
  valor_total: number | null;
  parcelamento: string | null;
  itens: { descricao: string | null; quantidade: number | null }[];
};

function RelatoriosPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="print:hidden">
        <PageHeader title="Relatórios — Financeiro Op" description="Cartões, análises e classificação de eventos" />
      </div>
      <Tabs defaultValue="cartoes" className="print:hidden">
        <TabsList>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
          <TabsTrigger value="analises">Análises</TabsTrigger>
          <TabsTrigger value="classificacao">Classificação de Eventos</TabsTrigger>
        </TabsList>
        <TabsContent value="cartoes"><CartoesReport /></TabsContent>
        <TabsContent value="analises"><AnalisesReport /></TabsContent>
        <TabsContent value="classificacao"><ClassificacaoEventos /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Cartões (relatório existente) -------------------- */

function CartoesReport() {
  const [cartao, setCartao] = useState<string>("");
  const [preset, setPreset] = useState<PeriodoPreset>(PERIODO_MES_DEFAULT.preset);
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_MES_DEFAULT.periodo);

  const { data: cartoes = [] } = useQuery({
    queryKey: ["condicoes_pagamento"],
    queryFn: async () => {
      const { data, error } = await sb.from("condicoes_pagamento").select("nome").order("nome");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.nome as string).filter(Boolean);
    },
  });

  const periodoLabel = useMemo(() => {
    if (!periodo.from && !periodo.to) return "Todos os períodos";
    const f = periodo.from ? format(periodo.from, "dd/MM/yyyy") : "…";
    const t = periodo.to ? format(periodo.to, "dd/MM/yyyy") : "…";
    return `${f} a ${t}`;
  }, [periodo]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["financeiro-relatorio-cartoes", cartao, periodo.from?.toISOString() ?? "", periodo.to?.toISOString() ?? ""],
    enabled: !!cartao,
    queryFn: async (): Promise<Row[]> => {
      const fromYmd = periodo.from ? format(periodo.from, "yyyy-MM-dd") : null;
      const toYmd = periodo.to ? format(periodo.to, "yyyy-MM-dd") : null;

      const buildFilter = (q: any, dateCol: string) => {
        let x = q
          .eq("condicao_pagamento", cartao)
          .in("status", STATUS_INCLUIDOS as unknown as string[]);
        if (fromYmd) x = x.gte(dateCol, fromYmd);
        if (toYmd) x = x.lte(dateCol, toYmd);
        return x;
      };

      const [comprasRes, demandasRes] = await Promise.all([
        buildFilter(
          sb.from("compras").select("id, numero, titulo, solicitante, comprador, observacoes, valor_total, data_compra, parcelamento"),
          "data_compra",
        ),
        buildFilter(
          sb.from("demandas").select("id, numero, titulo, solicitante, comprador, descritivo, observacoes, valor_total, data_compra, parcelamento"),
          "data_compra",
        ),
      ]);
      if (comprasRes.error) throw comprasRes.error;
      if (demandasRes.error) throw demandasRes.error;

      const compras = (comprasRes.data ?? []) as any[];
      const demandas = (demandasRes.data ?? []) as any[];

      const compraIds = compras.map((c) => c.id);
      const demandaIds = demandas.map((d) => d.id);

      const [compraItens, demandaItens] = await Promise.all([
        compraIds.length
          ? sb.from("compra_itens").select("compra_id, descricao, quantidade").in("compra_id", compraIds)
          : Promise.resolve({ data: [], error: null }),
        demandaIds.length
          ? sb.from("demanda_itens").select("demanda_id, descricao, quantidade").in("demanda_id", demandaIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if ((compraItens as any).error) throw (compraItens as any).error;
      if ((demandaItens as any).error) throw (demandaItens as any).error;

      const groupC = new Map<string, { descricao: string | null; quantidade: number | null }[]>();
      for (const it of ((compraItens as any).data ?? []) as any[]) {
        const arr = groupC.get(it.compra_id) ?? [];
        arr.push({ descricao: it.descricao, quantidade: it.quantidade });
        groupC.set(it.compra_id, arr);
      }
      const groupD = new Map<string, { descricao: string | null; quantidade: number | null }[]>();
      for (const it of ((demandaItens as any).data ?? []) as any[]) {
        const arr = groupD.get(it.demanda_id) ?? [];
        arr.push({ descricao: it.descricao, quantidade: it.quantidade });
        groupD.set(it.demanda_id, arr);
      }

      const cRows: Row[] = compras.map((c) => ({
        tipo: "COMPRA",
        numero: c.numero,
        id: c.id,
        titulo: c.titulo,
        solicitante: c.solicitante,
        comprador: c.comprador,
        descritivo_fallback: c.observacoes ?? c.titulo ?? null,
        valor_total: c.valor_total,
        parcelamento: c.parcelamento ?? null,
        itens: groupC.get(c.id) ?? [],
      }));
      const dRows: Row[] = demandas.map((d) => ({
        tipo: "DEMANDA",
        numero: d.numero,
        id: d.id,
        titulo: d.titulo,
        solicitante: d.solicitante,
        comprador: d.comprador,
        descritivo_fallback: d.descritivo ?? d.observacoes ?? d.titulo ?? null,
        valor_total: d.valor_total,
        parcelamento: d.parcelamento ?? null,
        itens: groupD.get(d.id) ?? [],
      }));

      return [...cRows, ...dRows].sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1;
        return (b.numero ?? 0) - (a.numero ?? 0);
      });
    },
  });

  const totalGeral = rows.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const totalCompras = rows.filter((r) => r.tipo === "COMPRA").reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const totalDemandas = rows.filter((r) => r.tipo === "DEMANDA").reduce((s, r) => s + Number(r.valor_total ?? 0), 0);

  const emitido = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Luminart Eventos", 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Relatório de Cartão — Cartão Final ${cartao}`, 40, 56);
    doc.text(`Período: ${periodoLabel}`, 40, 70);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emitido em ${emitido}`, pageWidth - 40, 40, { align: "right" });
    doc.setTextColor(0, 0, 0);

    const body = rows.map((r) => [
      `${r.tipo}-${r.numero ?? "—"}`,
      r.titulo ?? "—",
      r.solicitante ?? "—",
      r.comprador ?? "—",
      r.itens.length > 0
        ? r.itens.map((it) => `${Number(it.quantidade ?? 0)}x ${it.descricao ?? "—"}`).join("\n")
        : (r.descritivo_fallback ?? "—"),
      r.parcelamento ?? "—",
      brl(r.valor_total),
    ]);

    autoTable(doc, {
      startY: 90,
      head: [["Tipo", "Título", "Solicitante", "Comprador", "Itens ou Descritivo", "Pagamento", "Valor Total"]],
      body,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 110 },
        2: { cellWidth: 90 },
        3: { cellWidth: 90 },
        4: { cellWidth: "auto" },
        5: { cellWidth: 90 },
        6: { cellWidth: 75, halign: "right" },
      },
      margin: { left: 40, right: 40 },
      showHead: "everyPage",
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 90;
    let y = finalY + 20;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total de Compras: ${brl(totalCompras)}`, pageWidth - 40, y, { align: "right" });
    doc.text(`Total de Despesas: ${brl(totalDemandas)}`, pageWidth - 40, y + 16, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total Geral: ${brl(totalGeral)}`, pageWidth - 40, y + 36, { align: "right" });

    const periodoSlug = periodoLabel.replace(/[^\w]+/g, "-").toLowerCase();
    const cartaoSlug = (cartao || "cartao").replace(/[^\w]+/g, "-").toLowerCase();
    doc.save(`relatorio-cartao-${cartaoSlug}-${periodoSlug}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Cartão (condição de pagamento)</label>
          <Select value={cartao} onValueChange={setCartao}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione um cartão…" />
            </SelectTrigger>
            <SelectContent>
              {cartoes.map((n: string) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Período</label>
          <PeriodoFilter
            preset={preset}
            periodo={periodo}
            onChange={(p, per) => { setPreset(p); setPeriodo(per); }}
          />
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportPdf} disabled={!cartao || rows.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {!cartao ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Selecione um cartão para gerar o relatório.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum registro finalizado ou a receber para este cartão no período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Título</th>
                <th className="text-left px-3 py-2 font-medium">Solicitante</th>
                <th className="text-left px-3 py-2 font-medium">Comprador</th>
                <th className="text-left px-3 py-2 font-medium">Itens ou Descritivo</th>
                <th className="text-left px-3 py-2 font-medium">Parcelamento</th>
                <th className="text-right px-3 py-2 font-medium">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r.tipo}-{r.numero ?? "—"}</td>
                  <td className="px-3 py-2">{r.titulo ?? "—"}</td>
                  <td className="px-3 py-2">{r.solicitante ?? "—"}</td>
                  <td className="px-3 py-2">{r.comprador ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.itens.length > 0 ? (
                      <ul className="space-y-0.5">
                        {r.itens.map((it, i) => (
                          <li key={i}>{Number(it.quantidade ?? 0)}x {it.descricao ?? "—"}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="whitespace-pre-wrap">{r.descritivo_fallback ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.parcelamento ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{brl(r.valor_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={6} className="px-3 py-2 text-right text-xs text-muted-foreground">
                  Subtotal Compras: {brl(totalCompras)} · Subtotal Despesas: {brl(totalDemandas)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">&nbsp;</td>
              </tr>
              <tr className="border-t bg-muted/60">
                <td colSpan={6} className="px-3 py-2 text-right font-semibold">Total geral</td>
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{brl(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------- Classificação de Eventos -------------------- */

type EventoCC = {
  id: string;
  external_id: string;
  nome: string;
  categoria: CategoriaCentroCusto | null;
  ativo: boolean;
  removido_em: string | null;
};

function ClassificacaoEventos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [soNaoClassificados, setSoNaoClassificados] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos_centros_custo"],
    queryFn: async (): Promise<EventoCC[]> => {
      const { data, error } = await sb
        .from("eventos_centros_custo")
        .select("id, external_id, nome, categoria, ativo, removido_em")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EventoCC[];
    },
  });

  const setCategoria = useMutation({
    mutationFn: async ({ id, categoria }: { id: string; categoria: CategoriaCentroCusto | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb
        .from("eventos_centros_custo")
        .update({ categoria, classificado_por: u?.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos_centros_custo"] });
      toast.success("Classificação atualizada");
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const filtrados = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      if (!mostrarInativos && !e.ativo) return false;
      if (soNaoClassificados && e.categoria) return false;
      if (needle && !e.nome.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [eventos, busca, soNaoClassificados, mostrarInativos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 w-[280px]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={soNaoClassificados} onCheckedChange={(v) => setSoNaoClassificados(!!v)} />
          Somente não classificados
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={mostrarInativos} onCheckedChange={(v) => setMostrarInativos(!!v)} />
          Mostrar removidos
        </label>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} de {eventos.length}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Evento / Centro de Custo</th>
                <th className="text-left px-3 py-2 font-medium w-[220px]">Categoria</th>
                <th className="text-left px-3 py-2 font-medium w-[120px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2">{e.nome}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={e.categoria ?? "__none__"}
                      onValueChange={(v) =>
                        setCategoria.mutate({
                          id: e.id,
                          categoria: v === "__none__" ? null : (v as CategoriaCentroCusto),
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem classificação</SelectItem>
                        {CATEGORIAS_CENTRO_CUSTO.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    {e.ativo ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Removido</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------- Análises — Comparação entre eventos -------------------- */

type PlanoConta = { external_id: string; nome: string };

function AnalisesReport() {
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(0);
  const [categoriaFiltro, setCategoriaFiltro] = useState<"todas" | CategoriaCentroCusto>("todas");

  const dreEstrutura = useDreEstrutura().data ?? DRE_STRUCTURE;

  const eventos = useQuery({
    queryKey: ["eventos_centros_custo", "analises"],
    queryFn: async (): Promise<EventoCC[]> => {
      const { data, error } = await sb
        .from("eventos_centros_custo")
        .select("id, external_id, nome, categoria, ativo, removido_em")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EventoCC[];
    },
  });

  const planos = useQuery({
    queryKey: ["ca-plano", "analises"],
    queryFn: async (): Promise<PlanoConta[]> => {
      const { data } = await sb.from("ca_plano_contas").select("external_id,nome");
      return (data ?? []) as PlanoConta[];
    },
  });

  const buildPeriodo = (a: number, m: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const inicio = m > 0 ? `${a}-${pad(m)}-01` : `${a}-01-01`;
    const fim = m > 0 ? `${a}-${pad(m)}-${pad(new Date(a, m, 0).getDate())}` : `${a}-12-31`;
    return { inicio, fim };
  };

  const { inicio, fim } = buildPeriodo(ano, mes);
  const orFilter = `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`;
  const cols = "external_id,descricao,categoria_external_id,centro_custo_external_id,valor,data_vencimento,data_pagamento,status,observacoes";

  const fetchPaged = async <T,>(build: (from: number, to: number) => any): Promise<T[]> => {
    const all: T[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await build(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as T[]));
      if (data.length < pageSize) break;
    }
    return all;
  };

  const pagar = useQuery({
    queryKey: ["ca-pagar", "analises", ano, mes],
    queryFn: () => fetchPaged<any>((f, t) => sb.from("ca_contas_pagar").select(cols).or(orFilter).range(f, t)),
  });
  const receber = useQuery({
    queryKey: ["ca-receber", "analises", ano, mes],
    queryFn: () => fetchPaged<any>((f, t) => sb.from("ca_contas_receber").select(cols).or(orFilter).range(f, t)),
  });

  const planoMap = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    (planos.data ?? []).forEach((p) => m.set(p.external_id, { nome: p.nome }));
    return m;
  }, [planos.data]);

  const loading = eventos.isLoading || planos.isLoading || pagar.isLoading || receber.isLoading;

  // Categorias do DRE (kind === "sum") + Lucro ao final. Dinâmico via estrutura.
  const linhasCard: DreLine[] = useMemo(() => {
    const sums = dreEstrutura.filter((l) => l.kind === "sum");
    const lu = dreEstrutura.find((l) => l.id === "LU");
    return lu ? [...sums, lu] : sums;
  }, [dreEstrutura]);
  const idsCard = useMemo(() => linhasCard.map((l) => l.id as DreGroupId), [linhasCard]);

  const gruposCategoria = useMemo(() => {
    const evs = eventos.data ?? [];
    const map = new Map<CategoriaCentroCusto | "sc", EventoCC[]>();
    evs.forEach((e) => {
      const key = (e.categoria ?? "sc") as CategoriaCentroCusto | "sc";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [eventos.data]);

  const calcularParaEvento = (external_id: string) =>
    calcularDRECaixa(pagar.data ?? [], receber.data ?? [], planoMap, ano, mes, dreEstrutura, external_id, undefined, "caixa");

  const somarTotais = (evs: EventoCC[]) => {
    const acc: Partial<Record<DreGroupId, number>> = {};
    evs.forEach((e) => {
      const { totais } = calcularParaEvento(e.external_id);
      idsCard.forEach((k) => {
        acc[k] = (acc[k] ?? 0) + (totais[k] ?? 0);
      });
      acc.RB = (acc.RB ?? 0) + (totais.RB ?? 0);
      acc.RN = (acc.RN ?? 0) + (totais.RN ?? 0);
      acc.LU = (acc.LU ?? 0) + (totais.LU ?? 0);
    });
    return acc;
  };

  const temMovimento = (external_id: string): boolean => {
    const { totais } = calcularParaEvento(external_id);
    return Object.values(totais).some((v) => Math.abs(v ?? 0) > 0.005);
  };

  const YEARS = Array.from({ length: new Date().getFullYear() - 2022 + 1 }, (_, i) => 2023 + i);
  const MESES = ["Todos", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const categoriasOrdenadas: CategoriaCentroCusto[] = ["corporativo", "stand", "social", "cenografia"];

  const renderCard = (e: EventoCC) => {
    const { totais } = calcularParaEvento(e.external_id);
    return (
      <Card key={e.id} className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="font-semibold text-sm leading-tight">{e.nome}</div>
          {!e.ativo && <Badge variant="destructive" className="shrink-0">Removido</Badge>}
        </div>
        <div className="space-y-1 text-sm">
          {linhasCard.map((line) => {
            const k = line.id as DreGroupId;
            const v = totais[k] ?? 0;
            const isLucro = k === "LU";
            return (
              <div
                key={k}
                className={`flex justify-between py-0.5 ${isLucro ? "mt-1 border-t pt-1 font-bold" : "border-b border-dashed last:border-0"}`}
              >
                <span className={`text-xs ${isLucro ? "text-foreground" : "text-muted-foreground"}`}>{line.label}</span>
                <span className={`tabular-nums text-xs ${v < 0 ? "text-red-600" : ""} ${isLucro ? "font-bold" : ""}`}>{brl(v)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Ano</label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Mês</label>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={categoriaFiltro} onValueChange={(v) => setCategoriaFiltro(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {CATEGORIAS_CENTRO_CUSTO.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          {categoriasOrdenadas
            .filter((cat) => categoriaFiltro === "todas" || categoriaFiltro === cat)
            .map((cat) => {
              const evs = (gruposCategoria.get(cat) ?? []).filter((e) => e.ativo || temMovimento(e.external_id));
              if (evs.length === 0) return null;
              const totalCat = somarTotais(evs);
              return (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-bold">{CATEGORIA_LABEL[cat]}</h2>
                    <div className="text-xs text-muted-foreground flex gap-3">
                      <span>Receita: <span className="text-foreground font-medium">{brl(totalCat.RB ?? 0)}</span></span>
                      <span>Resultado: <span className={`font-medium ${(totalCat.RN ?? 0) < 0 ? "text-red-600" : "text-foreground"}`}>{brl(totalCat.RN ?? 0)}</span></span>
                      <span>Lucro: <span className={`font-medium ${(totalCat.LU ?? 0) < 0 ? "text-red-600" : "text-foreground"}`}>{brl(totalCat.LU ?? 0)}</span></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {evs.map(renderCard)}
                  </div>
                </div>
              );
            })}

          {categoriaFiltro === "todas" && (() => {
            const semClas = (gruposCategoria.get("sc") ?? []).filter((e) => e.ativo || temMovimento(e.external_id));
            if (semClas.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="text-lg font-bold text-muted-foreground">Sem classificação</h2>
                  <div className="text-xs text-muted-foreground">Classifique estes eventos na aba "Classificação de Eventos"</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {semClas.map(renderCard)}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
