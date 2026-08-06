import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, FormSection } from "@/components/FormSection";
import { QuantidadeInput } from "@/components/QuantidadeInput";
import { ItensMultiSelect, type ItemOption } from "@/components/estoque/ItensMultiSelect";
import { Printer, FileText } from "lucide-react";
import { format } from "date-fns";

type ItemDetalhe = {
  id: string;
  nome: string;
  codigo: string | null;
  unidade: string | null;
  valor_unitario: number | null;
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjecaoMateriais({ itensLista }: { itensLista: ItemOption[] }) {
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

  const idsKey = useMemo(() => [...itemIds].sort().join(","), [itemIds]);

  const { data: detalhes = [] } = useQuery({
    queryKey: ["projecao-itens", idsKey],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id,nome,codigo,unidade,valor_unitario")
        .in("id", itemIds);
      if (error) throw error;
      return (data ?? []) as ItemDetalhe[];
    },
  });

  const linhas = useMemo(() => {
    const byId = new Map(detalhes.map((d) => [d.id, d]));
    return itemIds.map((id) => {
      const d = byId.get(id);
      const base = itensLista.find((i) => i.id === id);
      const qtd = quantidades[id] ?? 0;
      const vu = Number(d?.valor_unitario ?? 0);
      return {
        id,
        codigo: d?.codigo ?? base?.codigo ?? "",
        nome: d?.nome ?? base?.nome ?? "(item não encontrado)",
        unidade: d?.unidade ?? "",
        valorUnitario: vu,
        quantidade: qtd,
        total: qtd * vu,
      };
    });
  }, [itemIds, detalhes, itensLista, quantidades]);

  const totalQtd = linhas.reduce((a, l) => a + l.quantidade, 0);
  const totalValor = linhas.reduce((a, l) => a + l.total, 0);

  const exportPdf = async () => {
    const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableMod.default;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

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
    doc.text("Projeção de materiais", pageWidth - 40, 30, { align: "right" });
    doc.setFontSize(8);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - 40, 46, { align: "right" });

    autoTable(doc, {
      startY: 80,
      head: [["Código", "Item", "Qtd", "Un", "Valor unit.", "Valor total"]],
      body: linhas.map((l) => [
        l.codigo,
        l.nome,
        fmtQtd(l.quantidade),
        l.unidade ?? "",
        fmtBRL(l.valorUnitario),
        fmtBRL(l.total),
      ]),
      foot: [["", "TOTAL", fmtQtd(totalQtd), "", "", fmtBRL(totalValor)]],
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        2: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
      margin: { left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Página ${data.pageNumber} de ${doc.getNumberOfPages()}  ·  ${linhas.length} itens`,
          pageWidth / 2,
          pageHeight - 20,
          { align: "center" },
        );
      },
    });

    doc.save(`projecao_materiais_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <>
      <Card className="p-4 mb-4">
        <FormSection>
          <FormField label="Item" wide>
            <ItensMultiSelect
              itens={itensLista}
              value={itemIds}
              onChange={setItemIds}
              allLabel="Selecione os materiais"
            />
          </FormField>
        </FormSection>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <FileText className="h-3 w-3" /> Selecione os materiais e digite a quantidade desejada para levantar o
          valor da projeção.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap gap-2 justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold">Projeção</h2>
            <p className="text-xs text-muted-foreground">
              {linhas.length} item{linhas.length !== 1 ? "ns" : ""} · Total {fmtBRL(totalValor)}
            </p>
          </div>
          <Button type="button" onClick={exportPdf} disabled={!linhas.length}>
            <Printer className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium w-40">Quantidade</th>
                <th className="px-4 py-3 font-medium">Un</th>
                <th className="px-4 py-3 font-medium text-right">Valor unit.</th>
                <th className="px-4 py-3 font-medium text-right">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    Selecione os materiais para montar a projeção.
                  </td>
                </tr>
              ) : (
                linhas.map((l) => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{l.codigo || "—"}</td>
                    <td className="px-4 py-2">{l.nome}</td>
                    <td className="px-4 py-2">
                      <QuantidadeInput
                        value={l.quantidade}
                        onChange={(v) => setQuantidades((p) => ({ ...p, [l.id]: v }))}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{l.unidade || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(l.valorUnitario)}</td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(l.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/60 font-semibold">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQtd(totalQtd)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">{fmtBRL(totalValor)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  );
}
