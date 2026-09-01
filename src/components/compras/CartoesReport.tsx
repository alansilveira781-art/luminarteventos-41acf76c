import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PeriodoFilter, PERIODO_MES_DEFAULT, type Periodo, type PeriodoPreset,
} from "@/components/PeriodoFilter";
import { fetchAllRows } from "@/lib/fetch-all";
import { TablePagination } from "@/components/TablePagination";
import { normForma } from "@/lib/conta-azul/exportacao-cards";

const sb = supabase as any;

const STATUS_PRESETS = {
  padrao: {
    label: "Finalizado + A receber",
    statuses: ["finalizado", "a_receber"] as string[] | null,
  },
  abertos: {
    label: "Incluir em aberto",
    statuses: [
      "finalizado",
      "a_receber",
      "em_andamento",
      "aprovada",
      "pendente_aprovacao",
      "analise",
      "solicitacao",
    ] as string[] | null,
  },
  todos: { label: "Todos os status", statuses: null as string[] | null },
} as const;

type StatusPreset = keyof typeof STATUS_PRESETS;

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
  forma: string | null;
  status: string | null;
  dataRef: string | null;
  itens: { descricao: string | null; quantidade: number | null }[];
};

type CartoesData = { rows: Row[]; total: number };

const PAGE_SIZE = 25;

const TODAS = "__todas__";
const SEM_FORMA = "__sem_forma__";

export default function CartoesReport() {
  const [cartao, setCartao] = useState<string>("");
  const [preset, setPreset] = useState<PeriodoPreset>(PERIODO_MES_DEFAULT.preset);
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_MES_DEFAULT.periodo);
  const [statusPreset, setStatusPreset] = useState<StatusPreset>("padrao");
  const [page, setPage] = useState(1);

  // Formas disponíveis: cadastro + formas realmente usadas nos cards,
  // agrupadas por chave normalizada (PIX/Pix = mesma forma).
  const { data: formas = [] } = useQuery({
    queryKey: ["financeiro-relatorio-formas"],
    queryFn: async (): Promise<{ key: string; label: string }[]> => {
      const [cond, pc, pd] = await Promise.all([
        sb.from("condicoes_pagamento").select("nome"),
        fetchAllRows<any>("compra_pagamentos", "forma"),
        fetchAllRows<any>("demanda_pagamentos", "forma"),
      ]);
      if ((cond as any).error) throw (cond as any).error;
      const nomes = [
        ...((cond as any).data ?? []).map((r: any) => r.nome),
        ...pc.map((r) => r.forma),
        ...pd.map((r) => r.forma),
      ].filter((n: any) => n && String(n).trim());
      const map = new Map<string, string>();
      for (const n of nomes) {
        const k = normForma(n);
        if (!map.has(k)) map.set(k, String(n).trim());
      }
      return [...map.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });

  const formaLabel = useMemo(() => {
    if (cartao === TODAS) return "Todas as formas";
    if (cartao === SEM_FORMA) return "Sem forma informada";
    return formas.find((f) => f.key === cartao)?.label ?? cartao;
  }, [cartao, formas]);

  const periodoLabel = useMemo(() => {
    if (!periodo.from && !periodo.to) return "Todos os períodos";
    const f = periodo.from ? format(periodo.from, "dd/MM/yyyy") : "…";
    const t = periodo.to ? format(periodo.to, "dd/MM/yyyy") : "…";
    return `${f} a ${t}`;
  }, [periodo]);

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-relatorio-cartoes", cartao],
    enabled: !!cartao,
    queryFn: async (): Promise<CartoesData> => {
      // Formas de pagamento lançadas nos cards (um card pode ser dividido em
      // várias formas: cada linha entra pelo seu próprio valor).
      const [pagC, pagD] = await Promise.all([
        fetchAllRows<any>("compra_pagamentos", "compra_id, valor, parcelamento, forma"),
        fetchAllRows<any>("demanda_pagamentos", "demanda_id, valor, parcelamento, forma"),
      ]);

      type Agg = { valor: number; parcelamento: string | null; formas: string[] };
      const agrupar = (linhas: any[], idKey: string) => {
        const m = new Map<string, Agg>();
        for (const p of linhas) {
          const id = p[idKey];
          if (!id) continue;
          const k = normForma(p.forma);
          if (cartao !== TODAS && cartao !== SEM_FORMA && k !== cartao) continue;
          if (cartao === SEM_FORMA && k !== "") continue;
          const cur = m.get(id) ?? { valor: 0, parcelamento: null, formas: [] };
          cur.valor += Number(p.valor ?? 0);
          cur.parcelamento = cur.parcelamento ?? p.parcelamento ?? null;
          const label = String(p.forma ?? "").trim();
          if (label && !cur.formas.includes(label)) cur.formas.push(label);
          m.set(id, cur);
        }
        return m;
      };

      // Cards que possuem qualquer linha de pagamento (para "sem forma").
      const comPagamentoC = new Set(pagC.map((p) => p.compra_id).filter(Boolean));
      const comPagamentoD = new Set(pagD.map((p) => p.demanda_id).filter(Boolean));

      const pagPorCompra = agrupar(pagC, "compra_id");
      const pagPorDemanda = agrupar(pagD, "demanda_id");

      const selectCompras =
        "id, numero, titulo, solicitante, comprador, observacoes, valor_total, data_compra, data_solicitacao, created_at, parcelamento, condicao_pagamento, status";
      const selectDemandas =
        "id, numero, titulo, solicitante, comprador, descritivo, observacoes, valor_total, data_compra, data_solicitacao, created_at, parcelamento, condicao_pagamento, status";

      let compras: any[] = [];
      let demandas: any[] = [];

      if (cartao === SEM_FORMA) {
        // Cards sem nenhuma linha de pagamento (ou só com forma em branco).
        const [todasC, todasD] = await Promise.all([
          fetchAllRows<any>("compras", selectCompras),
          fetchAllRows<any>("demandas", selectDemandas),
        ]);
        compras = todasC.filter((c) => !comPagamentoC.has(c.id) || pagPorCompra.has(c.id));
        demandas = todasD.filter((d) => !comPagamentoD.has(d.id) || pagPorDemanda.has(d.id));
      } else {
        const idsCompras = [...pagPorCompra.keys()];
        const idsDemandas = [...pagPorDemanda.keys()];
        const [comprasRes, demandasRes] = await Promise.all([
          idsCompras.length
            ? sb.from("compras").select(selectCompras).in("id", idsCompras)
            : Promise.resolve({ data: [], error: null }),
          idsDemandas.length
            ? sb.from("demandas").select(selectDemandas).in("id", idsDemandas)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if ((comprasRes as any).error) throw (comprasRes as any).error;
        if ((demandasRes as any).error) throw (demandasRes as any).error;
        compras = ((comprasRes as any).data ?? []) as any[];
        demandas = ((demandasRes as any).data ?? []) as any[];
      }

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

      // Data de referência: data da compra e, na falta dela, a data de
      // solicitação ou a criação do card (evita sumir do relatório).
      const dataRef = (r: any): string | null => {
        const v = r.data_compra ?? r.data_solicitacao ?? r.created_at ?? null;
        return v ? String(v).slice(0, 10) : null;
      };

      const formaTexto = (agg: Agg | undefined, card: any) =>
        agg && agg.formas.length ? agg.formas.join(" + ") : (card.condicao_pagamento ?? null);

      const cRows: Row[] = compras.map((c) => {
        const agg = pagPorCompra.get(c.id);
        return {
          tipo: "COMPRA" as const,
          numero: c.numero,
          id: c.id,
          titulo: c.titulo,
          solicitante: c.solicitante,
          comprador: c.comprador,
          descritivo_fallback: c.observacoes ?? c.titulo ?? null,
          valor_total: agg ? agg.valor : c.valor_total,
          parcelamento: agg?.parcelamento ?? c.parcelamento ?? null,
          forma: formaTexto(agg, c),
          status: c.status ?? null,
          dataRef: dataRef(c),
          itens: groupC.get(c.id) ?? [],
        };
      });
      const dRows: Row[] = demandas.map((d) => {
        const agg = pagPorDemanda.get(d.id);
        return {
          tipo: "DEMANDA" as const,
          numero: d.numero,
          id: d.id,
          titulo: d.titulo,
          solicitante: d.solicitante,
          comprador: d.comprador,
          descritivo_fallback: d.descritivo ?? d.observacoes ?? d.titulo ?? null,
          valor_total: agg ? agg.valor : d.valor_total,
          parcelamento: agg?.parcelamento ?? d.parcelamento ?? null,
          forma: formaTexto(agg, d),
          status: d.status ?? null,
          dataRef: dataRef(d),
          itens: groupD.get(d.id) ?? [],
        };
      });

      const all = [...cRows, ...dRows].sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1;
        return (b.numero ?? 0) - (a.numero ?? 0);
      });

      return { rows: all, total: all.length };
    },
  });

  const todas = data?.rows ?? [];

  const { rows, foraPorStatus, foraPorPeriodo } = useMemo(() => {
    const fromYmd = periodo.from ? format(periodo.from, "yyyy-MM-dd") : null;
    const toYmd = periodo.to ? format(periodo.to, "yyyy-MM-dd") : null;
    const statuses = STATUS_PRESETS[statusPreset].statuses;
    let fs = 0;
    let fp = 0;
    const out = todas.filter((r) => {
      if (statuses && !statuses.includes(String(r.status ?? ""))) { fs++; return false; }
      if (fromYmd || toYmd) {
        if (!r.dataRef) { fp++; return false; }
        if (fromYmd && r.dataRef < fromYmd) { fp++; return false; }
        if (toYmd && r.dataRef > toYmd) { fp++; return false; }
      }
      return true;
    });
    return { rows: out, foraPorStatus: fs, foraPorPeriodo: fp };
  }, [todas, periodo, statusPreset]);


  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageAtual = Math.min(page, pageCount);
  const inicio = (pageAtual - 1) * PAGE_SIZE;
  const rowsPagina = rows.slice(inicio, inicio + PAGE_SIZE);

  const foraDoFiltro = (data?.total ?? 0) - rows.length;
  const mostrarForma = cartao === TODAS;


  const totalGeral = rows.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);

  const totalCompras = rows.filter((r) => r.tipo === "COMPRA").reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const totalDemandas = rows.filter((r) => r.tipo === "DEMANDA").reduce((s, r) => s + Number(r.valor_total ?? 0), 0);

  const emitido = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const exportPdf = async () => {
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableMod.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Luminart Eventos", 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Relatório de Pagamentos — ${formaLabel}`, 40, 56);
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
      ...(mostrarForma ? [r.forma ?? "—"] : []),
      r.parcelamento ?? "—",
      brl(r.valor_total),
    ]);

    autoTable(doc, {
      startY: 90,
      head: [[
        "Tipo", "Título", "Solicitante", "Comprador", "Itens ou Descritivo",
        ...(mostrarForma ? ["Forma"] : []),
        "Pagamento", "Valor Total",
      ]],
      body,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: mostrarForma
        ? {
            0: { cellWidth: 60 }, 1: { cellWidth: 100 }, 2: { cellWidth: 80 }, 3: { cellWidth: 80 },
            4: { cellWidth: "auto" }, 5: { cellWidth: 80 }, 6: { cellWidth: 80 }, 7: { cellWidth: 75, halign: "right" },
          }
        : {
            0: { cellWidth: 60 }, 1: { cellWidth: 110 }, 2: { cellWidth: 90 }, 3: { cellWidth: 90 },
            4: { cellWidth: "auto" }, 5: { cellWidth: 90 }, 6: { cellWidth: 75, halign: "right" },
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
    const cartaoSlug = (formaLabel || "pagamentos").replace(/[^\w]+/g, "-").toLowerCase();
    doc.save(`relatorio-pagamentos-${cartaoSlug}-${periodoSlug}.pdf`);

  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Forma de pagamento</label>
          <Select value={cartao} onValueChange={(v) => { setCartao(v); setPage(1); }}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma forma…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as formas</SelectItem>
              <SelectItem value={SEM_FORMA}>Sem forma informada</SelectItem>
              {formas.map((f) => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Período</label>
          <PeriodoFilter
            preset={preset}
            periodo={periodo}
            onChange={(p, per) => { setPreset(p); setPeriodo(per); setPage(1); }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusPreset} onValueChange={(v) => { setStatusPreset(v as StatusPreset); setPage(1); }}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_PRESETS) as StatusPreset[]).map((k) => (
                <SelectItem key={k} value={k}>{STATUS_PRESETS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          Selecione uma forma de pagamento para gerar o relatório.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento em “{formaLabel}” no período/status selecionados.
          {foraDoFiltro > 0 && ` Existem ${foraDoFiltro} lançamento(s) fora do filtro atual.`}
        </div>

      ) : (
        <>
        <div className="overflow-auto rounded-lg border max-h-[calc(100vh-260px)]">
          <table className={`w-full table-fixed text-sm ${mostrarForma ? "min-w-[1180px]" : "min-w-[1040px]"}`}>
            <colgroup>
              <col className="w-[110px]" />
              <col className="w-[240px]" />
              <col className="w-[160px]" />
              <col className="w-[160px]" />
              <col className={mostrarForma ? "w-[240px]" : "w-[360px]"} />
              {mostrarForma && <col className="w-[140px]" />}
              <col className="w-[130px]" />
              <col className="w-[140px]" />
            </colgroup>
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="h-10">
                <th className="text-left px-3 font-medium"><span className="block truncate">Tipo</span></th>
                <th className="text-left px-3 font-medium"><span className="block truncate">Título</span></th>
                <th className="text-left px-3 font-medium"><span className="block truncate">Solicitante</span></th>
                <th className="text-left px-3 font-medium"><span className="block truncate">Comprador</span></th>
                <th className="text-left px-3 font-medium"><span className="block truncate">Itens ou Descritivo</span></th>
                {mostrarForma && <th className="text-left px-3 font-medium"><span className="block truncate">Forma</span></th>}
                <th className="text-left px-3 font-medium"><span className="block truncate">Parcelamento</span></th>
                <th className="text-right px-3 font-medium"><span className="block truncate">Valor total</span></th>
              </tr>
            </thead>

            <tbody>
              {rowsPagina.map((r) => {
                const itensTexto = r.itens.length > 0
                  ? r.itens.map((it) => `${Number(it.quantidade ?? 0)}x ${it.descricao ?? "—"}`).join(" · ")
                  : (r.descritivo_fallback ?? "—");
                return (
                  <tr key={`${r.tipo}-${r.id}`} className="h-11 border-t">
                    <td className="px-3 whitespace-nowrap font-mono text-xs">{r.tipo}-{r.numero ?? "—"}</td>
                    <td className="px-3 truncate" title={r.titulo ?? ""}>{r.titulo ?? "—"}</td>
                    <td className="px-3 truncate" title={r.solicitante ?? ""}>{r.solicitante ?? "—"}</td>
                    <td className="px-3 truncate" title={r.comprador ?? ""}>{r.comprador ?? "—"}</td>
                    <td className="px-3 truncate" title={itensTexto}>{itensTexto}</td>
                    {mostrarForma && (
                      <td className="px-3 truncate" title={r.forma ?? ""}>{r.forma ?? "—"}</td>
                    )}
                    <td className="px-3 truncate whitespace-nowrap">{r.parcelamento ?? "—"}</td>
                    <td className="px-3 text-right tabular-nums whitespace-nowrap">{brl(r.valor_total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-10 border-t bg-muted/30">
                <td colSpan={mostrarForma ? 7 : 6} className="px-3 text-right text-xs text-muted-foreground">
                  Subtotal Compras: {brl(totalCompras)} · Subtotal Despesas: {brl(totalDemandas)}
                </td>
                <td className="px-3 text-right font-mono text-xs text-muted-foreground">&nbsp;</td>
              </tr>
              <tr className="h-10 border-t bg-muted/60">
                <td colSpan={mostrarForma ? 7 : 6} className="px-3 text-right font-semibold">Total geral</td>
                <td className="px-3 text-right font-semibold whitespace-nowrap">{brl(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
          {foraDoFiltro > 0 && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {foraDoFiltro} lançamento(s) fora do filtro atual
              {foraPorPeriodo > 0 && ` · ${foraPorPeriodo} fora do período`}
              {foraPorStatus > 0 && ` · ${foraPorStatus} fora do status`}.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {inicio + 1}–{Math.min(inicio + PAGE_SIZE, rows.length)} de {rows.length}
          </span>
          <TablePagination page={pageAtual} pageCount={pageCount} onPageChange={setPage} />
        </div>
        </>
      )}


    </div>
  );
}
