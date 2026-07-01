import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormSection } from "@/components/FormSection";
import { Download, FileText, Printer } from "lucide-react";
import { isAjusteMovimentacao } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
});

type ReportId =
  | "saidas"
  | "entradas"
  | "devolucoes"
  | "estoque"
  | "estoque_negativo"
  | "solicitantes"
  | "fornecedores"
  | "gastos_mes"
  | "gastos_categoria"
  | "saidas_evento"
  | "ajustes";

const REPORTS: { id: ReportId; label: string; description: string; needsPeriod: boolean }[] = [
  { id: "saidas", label: "Saídas", description: "Lista de itens retirados do estoque com solicitante, evento e valor.", needsPeriod: true },
  { id: "entradas", label: "Entradas", description: "Lista de itens recebidos com fornecedor, NF e valor.", needsPeriod: true },
  { id: "devolucoes", label: "Devoluções", description: "Itens devolvidos vinculados às saídas originais.", needsPeriod: true },
  { id: "ajustes", label: "Ajustes de estoque", description: "Movimentações de ajuste (conferência/contagem) no período.", needsPeriod: true },
  { id: "estoque", label: "Posição de estoque", description: "Quantidade atual de cada item, valor total e status.", needsPeriod: false },
  { id: "estoque_negativo", label: "Itens com estoque negativo", description: "Itens cujo saldo atual está abaixo de zero — precisam de ajuste/contagem.", needsPeriod: false },
  { id: "solicitantes", label: "Solicitantes", description: "Cadastro completo dos solicitantes ativos.", needsPeriod: false },
  { id: "fornecedores", label: "Fornecedores", description: "Cadastro completo dos fornecedores.", needsPeriod: false },
  { id: "gastos_mes", label: "Gastos por mês", description: "Total comprado por mês no período selecionado.", needsPeriod: true },
  { id: "gastos_categoria", label: "Gastos por categoria", description: "Total comprado por categoria de item.", needsPeriod: true },
  { id: "saidas_evento", label: "Saídas por evento", description: "Quantidade e valor das saídas agrupadas por evento/projeto.", needsPeriod: true },
];


function RelatoriosPage() {
  const hoje = new Date();
  const [reportId, setReportId] = useState<ReportId>("saidas");
  const [dataIni, setDataIni] = useState(format(startOfMonth(subMonths(hoje, 2)), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [itemId, setItemId] = useState("todos");
  const [buscaItem, setBuscaItem] = useState("");

  const { data: itensLista = [] } = useQuery({
    queryKey: ["relatorios-itens-select"],
    queryFn: async () => {
      const { data } = await supabase.from("itens").select("id,nome,codigo").order("nome").limit(5000);
      return (data ?? []) as { id: string; nome: string; codigo: string | null }[];
    },
  });

  const itensFiltrados = useMemo(() => {
    const b = buscaItem.trim().toLowerCase();
    if (!b) return itensLista;
    return itensLista.filter((i) =>
      `${i.nome} ${i.codigo ?? ""}`.toLowerCase().includes(b),
    );
  }, [itensLista, buscaItem]);

  const meta = REPORTS.find((r) => r.id === reportId)!;

  const { data: rows, isLoading } = useQuery({
    queryKey: ["report", reportId, dataIni, dataFim, itemId],
    queryFn: async () => loadReport(reportId, dataIni, dataFim, itemId),
  });

  const { headers, body, totals } = useMemo(() => formatReport(reportId, rows ?? []), [reportId, rows]);

  const exportCsv = () => {
    const linhas = [headers, ...body, ...(totals ? [totals] : [])];
    const csv = linhas.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${reportId}_${dataIni}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageWidth, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LUMINART", 40, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Cenografia para eventos", 40, 46);
    doc.setFontSize(11);
    doc.text(meta.label, pageWidth - 40, 30, { align: "right" });
    doc.setFontSize(8);
    const periodo = meta.needsPeriod
      ? `${format(new Date(dataIni), "dd/MM/yyyy")} a ${format(new Date(dataFim), "dd/MM/yyyy")}`
      : `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
    doc.text(periodo, pageWidth - 40, 46, { align: "right" });

    autoTable(doc, {
      startY: 80,
      head: [headers],
      body: body.map((r) => r.map((c) => String(c ?? ""))),
      foot: totals ? [totals.map((c) => String(c ?? ""))] : undefined,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}  ·  ${body.length} registros`,
          pageWidth / 2,
          pageHeight - 20,
          { align: "center" },
        );
      },
    });

    doc.save(`relatorio_${reportId}_${dataIni}_a_${dataFim}.pdf`);
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Escolha um relatório, defina o período e visualize antes de exportar"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" variant="outline" onClick={exportCsv} disabled={!body.length}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
            <Button type="button" size="lg" onClick={exportPdf} disabled={!body.length}>
              <Printer className="h-4 w-4 mr-1" /> Exportar PDF
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <FormSection>
          <FormField label="Tipo de relatório" wide>
            <Select value={reportId} onValueChange={(v: any) => setReportId(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORTS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Data inicial">
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} disabled={!meta.needsPeriod} />
          </FormField>
          <FormField label="Data final">
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={!meta.needsPeriod} />
          </FormField>
        </FormSection>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <FileText className="h-3 w-3" /> {meta.description}
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold">{meta.label}</h2>
            <p className="text-xs text-muted-foreground">
              {meta.needsPeriod ? `${format(new Date(dataIni), "dd/MM/yyyy")} → ${format(new Date(dataFim), "dd/MM/yyyy")} · ` : ""}
              {body.length} registro{body.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                {headers.map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={headers.length} className="text-center py-10 text-muted-foreground">Carregando…</td></tr>
              ) : body.length === 0 ? (
                <tr><td colSpan={headers.length} className="text-center py-10 text-muted-foreground">Sem dados para este relatório.</td></tr>
              ) : body.slice(0, 500).map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/30">
                  {r.map((c, j) => <td key={j} className="px-4 py-2.5 whitespace-nowrap">{c}</td>)}
                </tr>
              ))}
            </tbody>
            {totals && body.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/60 font-semibold">
                  {totals.map((c, j) => (
                    <td key={j} className="px-4 py-3 whitespace-nowrap">{c}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
          {body.length > 500 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              Exibindo as primeiras 500 linhas. Exporte para CSV para ver tudo.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

async function loadReport(id: ReportId, dataIni: string, dataFim: string): Promise<any[]> {
  const ini = new Date(dataIni).toISOString();
  const fim = new Date(`${dataFim}T23:59:59`).toISOString();

  if (id === "saidas") {
    const { data } = await supabase
      .from("movimentacoes")
      .select("data_movimento,quantidade,valor_unitario,evento_projeto,saida_status, item:itens(nome,codigo,unidade,valor_unitario), solicitante:solicitantes(nome)")
      .eq("tipo", "saida")
      .gte("data_movimento", ini).lte("data_movimento", fim)
      .order("data_movimento", { ascending: false }).limit(5000);
    return data ?? [];
  }
  if (id === "entradas") {
    const { data } = await supabase
      .from("movimentacoes")
      .select("data_movimento,quantidade,valor_unitario,nota_fiscal, item:itens(nome,codigo,unidade), fornecedor:fornecedores(nome)")
      .eq("tipo", "entrada")
      .gte("data_movimento", ini).lte("data_movimento", fim)
      .order("data_movimento", { ascending: false }).limit(5000);
    return data ?? [];
  }
  if (id === "devolucoes") {
    const { data } = await supabase
      .from("movimentacoes")
      .select("data_movimento,quantidade,responsavel_recebimento, item:itens(nome,codigo,unidade), solicitante:solicitantes(nome)")
      .eq("tipo", "devolucao")
      .gte("data_movimento", ini).lte("data_movimento", fim)
      .order("data_movimento", { ascending: false }).limit(5000);
    return data ?? [];
  }
  if (id === "estoque") {
    const { data } = await supabase.from("itens").select("*").order("nome").limit(5000);
    return data ?? [];
  }
  if (id === "estoque_negativo") {
    const { data } = await supabase
      .from("itens")
      .select("*")
      .lt("quantidade_atual", 0)
      .order("quantidade_atual", { ascending: true })
      .limit(5000);
    return data ?? [];
  }

  if (id === "solicitantes") {
    const { data } = await supabase.from("solicitantes").select("*").order("nome").limit(5000);
    return data ?? [];
  }
  if (id === "fornecedores") {
    const { data } = await supabase.from("fornecedores").select("*").order("nome").limit(5000);
    return data ?? [];
  }
  if (id === "gastos_mes" || id === "gastos_categoria" || id === "saidas_evento") {
    const tipo = id === "saidas_evento" ? "saida" : "entrada";
    const { data } = await supabase
      .from("movimentacoes")
      .select("data_movimento,quantidade,valor_unitario,evento_projeto, item:itens(nome,categoria,valor_unitario)")
      .eq("tipo", tipo)
      .gte("data_movimento", ini).lte("data_movimento", fim)
      .limit(10000);
    return data ?? [];
  }
  return [];
}

function formatReport(id: ReportId, rows: any[]): { headers: string[]; body: any[][]; totals: any[] | null } {
  const fmtBRL = (n: number) => `R$ ${n.toFixed(2)}`;

  if (id === "saidas") {
    const headers = ["Data", "Código", "Item", "Qtd", "Un", "Valor unit.", "Valor total", "Solicitante", "Evento/Projeto", "Status"];
    let sumQ = 0, sumT = 0;
    const body = rows.map((r) => {
      const vu = Number(r.valor_unitario ?? r.item?.valor_unitario ?? 0);
      const q = Number(r.quantidade);
      sumQ += q; sumT += vu * q;
      return [
        format(new Date(r.data_movimento), "dd/MM/yyyy HH:mm"),
        r.item?.codigo ?? "", r.item?.nome ?? "",
        q, r.item?.unidade ?? "",
        fmtBRL(vu), fmtBRL(vu * q),
        r.solicitante?.nome ?? "—", r.evento_projeto ?? "—", r.saida_status ?? "—",
      ];
    });
    return { headers, body, totals: ["TOTAL", "", "", sumQ, "", "", fmtBRL(sumT), "", "", ""] };
  }
  if (id === "entradas") {
    const headers = ["Data", "Código", "Item", "Qtd", "Un", "Valor unit.", "Valor total", "Fornecedor", "NF"];
    let sumQ = 0, sumT = 0;
    const body = rows.map((r) => {
      const vu = Number(r.valor_unitario ?? 0);
      const q = Number(r.quantidade);
      sumQ += q; sumT += vu * q;
      return [
        format(new Date(r.data_movimento), "dd/MM/yyyy HH:mm"),
        r.item?.codigo ?? "", r.item?.nome ?? "",
        q, r.item?.unidade ?? "",
        fmtBRL(vu), fmtBRL(vu * q),
        r.fornecedor?.nome ?? "—", r.nota_fiscal ?? "—",
      ];
    });
    return { headers, body, totals: ["TOTAL", "", "", sumQ, "", "", fmtBRL(sumT), "", ""] };
  }
  if (id === "devolucoes") {
    const headers = ["Data", "Código", "Item", "Qtd", "Un", "Solicitante", "Recebido por"];
    let sumQ = 0;
    const body = rows.map((r) => {
      const q = Number(r.quantidade);
      sumQ += q;
      return [
        format(new Date(r.data_movimento), "dd/MM/yyyy HH:mm"),
        r.item?.codigo ?? "", r.item?.nome ?? "",
        q, r.item?.unidade ?? "",
        r.solicitante?.nome ?? "—", r.responsavel_recebimento ?? "—",
      ];
    });
    return { headers, body, totals: ["TOTAL", "", "", sumQ, "", "", ""] };
  }
  if (id === "estoque") {
    const headers = ["Código", "Item", "Categoria", "Un", "Qtd atual", "Mín", "Valor unit.", "Valor total", "Localização", "Status"];
    let sumQ = 0, sumMin = 0, sumT = 0;
    const body = rows.map((r) => {
      const vu = Number(r.valor_unitario ?? 0);
      const q = Number(r.quantidade_atual);
      const mn = Number(r.quantidade_minima);
      sumQ += q; sumMin += mn; sumT += vu * q;
      return [
        r.codigo, r.nome, r.categoria ?? "—", r.unidade,
        q, mn,
        fmtBRL(vu), fmtBRL(vu * q),
        r.localizacao ?? "—", r.status,
      ];
    });
    return { headers, body, totals: ["TOTAL", "", "", "", sumQ, sumMin, "", fmtBRL(sumT), "", ""] };
  }
  if (id === "estoque_negativo") {
    const headers = ["Código", "Item", "Categoria", "Un", "Qtd atual", "Mín", "Localização", "Status"];
    let sumQ = 0;
    const body = rows.map((r) => {
      const q = Number(r.quantidade_atual);
      sumQ += q;
      return [
        r.codigo, r.nome, r.categoria ?? "—", r.unidade,
        q, Number(r.quantidade_minima),
        r.localizacao ?? "—", r.status,
      ];
    });
    return { headers, body, totals: ["TOTAL", "", "", "", sumQ, "", "", ""] };
  }
  if (id === "solicitantes") {
    return {
      headers: ["Nome", "Setor", "Cargo", "Telefone", "Email", "Status"],
      body: rows.map((r) => [r.nome, r.setor ?? "—", r.cargo ?? "—", r.telefone ?? "—", r.email ?? "—", r.status]),
      totals: null,
    };
  }
  if (id === "fornecedores") {
    return {
      headers: ["Nome", "Documento", "Contato", "Telefone", "Email", "Tipo de fornecimento", "Status"],
      body: rows.map((r) => [r.nome, r.documento ?? "—", r.contato_nome ?? "—", r.telefone ?? "—", r.email ?? "—", r.tipo_fornecimento ?? "—", r.status]),
      totals: null,
    };
  }
  if (id === "gastos_mes") {
    const m = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const k = format(new Date(r.data_movimento), "yyyy-MM");
      const cur = m.get(k) ?? { qtd: 0, total: 0 };
      const q = Number(r.quantidade);
      cur.qtd += q; cur.total += Number(r.valor_unitario ?? 0) * q;
      m.set(k, cur);
    }
    const entries = Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let sumQ = 0, sumT = 0; entries.forEach(([, v]) => { sumQ += v.qtd; sumT += v.total; });
    return {
      headers: ["Mês", "Qtd entradas", "Gasto total"],
      body: entries.map(([k, v]) => [k, v.qtd, fmtBRL(v.total)]),
      totals: ["TOTAL", sumQ, fmtBRL(sumT)],
    };
  }
  if (id === "gastos_categoria") {
    const m = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const cat = r.item?.categoria ?? "Sem categoria";
      const cur = m.get(cat) ?? { qtd: 0, total: 0 };
      const q = Number(r.quantidade);
      cur.qtd += q; cur.total += Number(r.valor_unitario ?? 0) * q;
      m.set(cat, cur);
    }
    const entries = Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
    let sumQ = 0, sumT = 0; entries.forEach(([, v]) => { sumQ += v.qtd; sumT += v.total; });
    return {
      headers: ["Categoria", "Qtd entradas", "Gasto total"],
      body: entries.map(([cat, v]) => [cat, v.qtd, fmtBRL(v.total)]),
      totals: ["TOTAL", sumQ, fmtBRL(sumT)],
    };
  }
  if (id === "saidas_evento") {
    const m = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const ev = r.evento_projeto ?? "Sem evento";
      const cur = m.get(ev) ?? { qtd: 0, total: 0 };
      const q = Number(r.quantidade);
      const vu = Number(r.valor_unitario ?? r.item?.valor_unitario ?? 0);
      cur.qtd += q; cur.total += vu * q;
      m.set(ev, cur);
    }
    const entries = Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
    let sumQ = 0, sumT = 0; entries.forEach(([, v]) => { sumQ += v.qtd; sumT += v.total; });
    return {
      headers: ["Evento/Projeto", "Qtd saídas", "Valor total"],
      body: entries.map(([ev, v]) => [ev, v.qtd, fmtBRL(v.total)]),
      totals: ["TOTAL", sumQ, fmtBRL(sumT)],
    };
  }
  return { headers: [], body: [], totals: null };
}
