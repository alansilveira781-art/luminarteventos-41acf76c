import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, FileSpreadsheet, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PeriodoFilter, PERIODO_MES_DEFAULT, type Periodo, type PeriodoPreset,
} from "@/components/PeriodoFilter";
import { TablePagination } from "@/components/TablePagination";
import { fetchAllRows } from "@/lib/fetch-all";
import {
  agruparPorFornecedor, normalizarNome,
  type CardAnalise, type FornecedorAgregado,
} from "@/lib/compras/analises-fornecedor";

const sb = supabase as any;

const PAGE_SIZE = 25;

const STATUS_PRESETS = {
  padrao: { label: "Finalizado + A receber", statuses: ["finalizado", "a_receber"] as string[] | null },
  abertos: {
    label: "Incluir em aberto",
    statuses: [
      "finalizado", "a_receber", "em_andamento", "aprovada",
      "pendente_aprovacao", "analise", "solicitacao",
    ] as string[] | null,
  },
  todos: { label: "Todos os status", statuses: null as string[] | null },
} as const;
type StatusPreset = keyof typeof STATUS_PRESETS;

const STATUS_LABEL: Record<string, string> = {
  solicitacao: "Solicitação",
  analise: "Análise",
  negada: "Negada",
  pendente_aprovacao: "Pendente de aprovação",
  aprovada: "Aprovada",
  em_andamento: "Em andamento",
  a_receber: "A receber",
  finalizado: "Finalizado",
};

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

const dataRef = (r: any): string | null => {
  const v = r.data_compra ?? r.data_solicitacao ?? r.created_at ?? null;
  return v ? String(v).slice(0, 10) : null;
};

const dataBR = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export default function AnalisesFornecedorReport() {
  const [preset, setPreset] = useState<PeriodoPreset>(PERIODO_MES_DEFAULT.preset);
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_MES_DEFAULT.periodo);
  const [statusPreset, setStatusPreset] = useState<StatusPreset>("padrao");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["compras-analises-fornecedor"],
    queryFn: async (): Promise<CardAnalise[]> => {
      const selectCompras =
        "id, numero, titulo, fornecedor, fornecedor_id, documento, valor_total, parcelamento, condicao_pagamento, status, data_compra, data_solicitacao, created_at";
      const selectDemandas = selectCompras;

      const [compras, demandas, pagC, pagD, resolver] = await Promise.all([
        fetchAllRows<any>("compras", selectCompras),
        fetchAllRows<any>("demandas", selectDemandas),
        fetchAllRows<any>("compra_pagamentos", "compra_id, forma, parcelamento, valor"),
        fetchAllRows<any>("demanda_pagamentos", "demanda_id, forma, parcelamento, valor"),
        carregarResolverFornecedor(),
      ]);

      type Agg = { valor: number; formas: string[]; parcelamentos: string[]; linhas: number };
      const agrupar = (linhas: any[], idKey: string) => {
        const m = new Map<string, Agg>();
        for (const p of linhas) {
          const id = p[idKey];
          if (!id) continue;
          const cur = m.get(id) ?? { valor: 0, formas: [], parcelamentos: [], linhas: 0 };
          cur.valor += Number(p.valor ?? 0);
          cur.linhas += 1;
          const label = String(p.forma ?? "").trim();
          if (label && !cur.formas.includes(label)) cur.formas.push(label);
          const parc = String(p.parcelamento ?? "").trim();
          if (parc && !cur.parcelamentos.includes(parc)) cur.parcelamentos.push(parc);
          m.set(id, cur);
        }
        return m;
      };
      const aggC = agrupar(pagC, "compra_id");
      const aggD = agrupar(pagD, "demanda_id");

      const monta = (r: any, tipo: "COMPRA" | "DESPESA", agg: Agg | undefined): CardAnalise => {
        const parcelamento =
          (agg?.parcelamentos.length ? agg.parcelamentos.join(" + ") : null) ??
          (String(r.parcelamento ?? "").trim() || null) ??
          (agg && agg.linhas > 1 ? `${agg.linhas}x` : null);
        const condicao =
          (String(r.condicao_pagamento ?? "").trim() || null) ??
          null ??
          null;
        return {
          tipo,
          id: r.id,
          numero: r.numero ?? null,
          titulo: r.titulo ?? null,
          fornecedor: resolver.nome(r) || null,
          documento: resolver.documento(r),
          status: r.status ?? null,
          data: dataRef(r),
          valor: agg && agg.valor ? agg.valor : Number(r.valor_total ?? 0),
          formas: agg?.formas ?? [],
          parcelamento,
          condicao:
            condicao ??
            (parcelamento && parcelamento !== "1x" ? `Parcelado ${parcelamento}` : "À vista"),
        };
      };


      return [
        ...compras.map((c) => monta(c, "COMPRA", aggC.get(c.id))),
        ...demandas.map((d) => monta(d, "DESPESA", aggD.get(d.id))),
      ];
    },
  });

  const fornecedoresAgg: FornecedorAgregado[] = useMemo(() => {
    const fromYmd = periodo.from ? format(periodo.from, "yyyy-MM-dd") : null;
    const toYmd = periodo.to ? format(periodo.to, "yyyy-MM-dd") : null;
    const statuses = STATUS_PRESETS[statusPreset].statuses;
    const termo = normalizarNome(busca);

    const filtrados = cards.filter((c) => {
      if (statuses && !statuses.includes(String(c.status ?? ""))) return false;
      if (fromYmd || toYmd) {
        if (!c.data) return false;
        if (fromYmd && c.data < fromYmd) return false;
        if (toYmd && c.data > toYmd) return false;
      }
      if (termo && !normalizarNome(c.fornecedor).includes(termo)) return false;
      return true;
    });
    return agruparPorFornecedor(filtrados);
  }, [cards, periodo, statusPreset, busca]);

  const pageCount = Math.max(1, Math.ceil(fornecedoresAgg.length / PAGE_SIZE));
  const pageAtual = Math.min(page, pageCount);
  const inicio = (pageAtual - 1) * PAGE_SIZE;
  const visiveis = fornecedoresAgg.slice(inicio, inicio + PAGE_SIZE);

  const totalCards = fornecedoresAgg.reduce((s, f) => s + f.qtd, 0);
  const totalValor = fornecedoresAgg.reduce((s, f) => s + f.valor, 0);

  const periodoLabel = useMemo(() => {
    if (!periodo.from && !periodo.to) return "Todos os períodos";
    const f = periodo.from ? format(periodo.from, "dd/MM/yyyy") : "…";
    const t = periodo.to ? format(periodo.to, "dd/MM/yyyy") : "…";
    return `${f} a ${t}`;
  }, [periodo]);

  const exportarExcel = async () => {
    const XLSX = await import("xlsx");
    const aoa: (string | number)[][] = [
      ["Fornecedor", "CNPJ/CPF", "Qtde. demandas", "Valor total", "Formas de pagamento", "Condição", "Parcelamento"],
      ...fornecedoresAgg.map((f) => [
        f.fornecedor, f.documento || "", f.qtd, Number(f.valor.toFixed(2)),
        f.formas.join(", "), f.condicoes.join(", "), f.parcelamentos.join(", "),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 36 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 22 }, { wch: 18 }];

    const det: (string | number)[][] = [
      ["Fornecedor", "Card", "Título", "Data", "Status", "Forma", "Parcelamento", "Condição", "Valor"],
    ];
    for (const f of fornecedoresAgg) {
      for (const c of f.cards) {
        det.push([
          f.fornecedor, `${c.tipo}-${c.numero ?? "?"}`, c.titulo ?? "", dataBR(c.data),
          STATUS_LABEL[String(c.status ?? "")] ?? (c.status ?? ""),
          c.formas.join(", "), c.parcelamento ?? "", c.condicao ?? "",
          Number(Number(c.valor).toFixed(2)),
        ]);
      }
    }
    const wsDet = XLSX.utils.aoa_to_sheet(det);
    wsDet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 40 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Por fornecedor");
    XLSX.utils.book_append_sheet(wb, wsDet, "Detalhe");
    XLSX.writeFile(wb, `analise-fornecedores-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportarPdf = async () => {
    const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableMod.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Luminart Eventos", 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Análise por fornecedor — Compras", 40, 56);
    doc.text(`Período: ${periodoLabel} · ${STATUS_PRESETS[statusPreset].label}`, 40, 70);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth - 40, 40, { align: "right" },
    );
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 90,
      head: [["Fornecedor", "CNPJ/CPF", "Demandas", "Formas", "Condição", "Parcelamento", "Valor total"]],
      body: fornecedoresAgg.map((f) => [
        f.fornecedor, f.documento || "—", String(f.qtd),
        f.formas.join(", ") || "—", f.condicoes.join(", ") || "—",
        f.parcelamentos.join(", ") || "—", brl(f.valor),
      ]),
      foot: [["Total", "", String(totalCards), "", "", "", brl(totalValor)]],
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 180 }, 1: { cellWidth: 90 }, 2: { cellWidth: 60, halign: "right" },
        3: { cellWidth: "auto" }, 4: { cellWidth: 100 }, 5: { cellWidth: 80 },
        6: { cellWidth: 85, halign: "right" },
      },
    });

    doc.save(`analise-fornecedores-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
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
          <Select
            value={statusPreset}
            onValueChange={(v) => { setStatusPreset(v as StatusPreset); setPage(1); }}
          >
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_PRESETS) as StatusPreset[]).map((k) => (
                <SelectItem key={k} value={k}>{STATUS_PRESETS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Fornecedor</label>
          <Input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
            placeholder="Buscar fornecedor…"
            className="w-[240px]"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportarExcel} disabled={fornecedoresAgg.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportarPdf} disabled={fornecedoresAgg.length === 0}>
            <Printer className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : fornecedoresAgg.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento no filtro selecionado.
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {fornecedoresAgg.length} fornecedor(es) · {totalCards} demanda(s) · Total {brl(totalValor)}
          </div>
          <div className="overflow-auto rounded-lg border max-h-[calc(100vh-260px)]">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[17%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-muted/50">
                <tr className="h-10">
                  <th className="text-left px-3 font-medium">Fornecedor</th>
                  <th className="text-left px-3 font-medium">CNPJ/CPF</th>
                  <th className="text-right px-3 font-medium">Demandas</th>
                  <th className="text-left px-3 font-medium">Formas</th>
                  <th className="text-left px-3 font-medium">Condição</th>
                  <th className="text-left px-3 font-medium">Parcelamento</th>
                  <th className="text-right px-3 font-medium">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((f) => {
                  const aberto = !!abertos[f.key];
                  return (
                    <Fragment key={f.key}>
                      <tr
                        className="h-10 border-t cursor-pointer hover:bg-muted/40"
                        onClick={() => setAbertos((s) => ({ ...s, [f.key]: !s[f.key] }))}
                      >
                        <td className="px-3 truncate" title={f.fornecedor}>
                          <span className="inline-flex items-center gap-1">
                            {aberto ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{f.fornecedor}</span>
                          </span>
                        </td>
                        <td className="px-3 truncate" title={f.documento}>{f.documento || "—"}</td>
                        <td className="px-3 text-right tabular-nums">{f.qtd}</td>
                        <td className="px-3 truncate" title={f.formas.join(", ")}>{f.formas.join(", ") || "—"}</td>
                        <td className="px-3 truncate" title={f.condicoes.join(", ")}>{f.condicoes.join(", ") || "—"}</td>
                        <td className="px-3 truncate" title={f.parcelamentos.join(", ")}>{f.parcelamentos.join(", ") || "—"}</td>
                        <td className="px-3 text-right tabular-nums whitespace-nowrap">{brl(f.valor)}</td>
                      </tr>
                      {aberto &&
                        f.cards.map((c) => (
                          <tr key={`${f.key}-${c.id}`} className="h-9 border-t bg-muted/20 text-xs">
                            <td className="px-3 pl-8 truncate" title={c.titulo ?? ""}>
                              <span className="font-mono mr-2">{c.tipo}-{c.numero ?? "?"}</span>
                              {c.titulo ?? "—"}
                            </td>
                            <td className="px-3 whitespace-nowrap">{dataBR(c.data)}</td>
                            <td className="px-3 truncate" colSpan={1} title={STATUS_LABEL[String(c.status ?? "")] ?? ""}>
                              {STATUS_LABEL[String(c.status ?? "")] ?? "—"}
                            </td>
                            <td className="px-3 truncate" title={c.formas.join(", ")}>{c.formas.join(", ") || "—"}</td>
                            <td className="px-3 truncate" title={c.condicao ?? ""}>{c.condicao || "—"}</td>
                            <td className="px-3 truncate">{c.parcelamento || "—"}</td>
                            <td className="px-3 text-right tabular-nums whitespace-nowrap">{brl(c.valor)}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="h-10 border-t bg-muted/60">
                  <td className="px-3 font-semibold" colSpan={2}>Total geral</td>
                  <td className="px-3 text-right font-semibold tabular-nums">{totalCards}</td>
                  <td colSpan={3} />
                  <td className="px-3 text-right font-semibold whitespace-nowrap">{brl(totalValor)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {inicio + 1}–{Math.min(inicio + PAGE_SIZE, fornecedoresAgg.length)} de {fornecedoresAgg.length}
            </span>
            <TablePagination page={pageAtual} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
