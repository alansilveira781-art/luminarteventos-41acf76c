// Relatório PDF do Inventário de Patrimônio (colunas selecionadas pelo usuário).
// jspdf/jspdf-autotable carregados sob demanda.

export type InventarioPdfColuna = { key: string; label: string };

export type InventarioPdfParams = {
  escopo: string;
  colunas: InventarioPdfColuna[];
  linhas: Record<string, any>[];
};

const brl = (v: any) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso: any) => {
  const s = iso == null ? "" : String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const NUM_RIGHT = new Set(["quantidade", "valor", "cod"]);

const cellText = (key: string, v: any) => {
  if (key === "valor") return brl(v);
  if (key === "data_compra") return fmtData(v);
  if (v == null || v === "") return "";
  return String(v);
};

// Larguras relativas por coluna (peso), usadas para distribuir a largura da tabela.
const PESO: Record<string, number> = {
  cod: 1, id_item: 1.1, categoria: 1.4, subcategoria: 1.4, nome: 2.6,
  especificacao: 2.6, dimensoes: 1.6, quantidade: 0.9, unidade: 1,
  valor: 1.4, estado: 1.2, localizacao: 1.4, data_compra: 1.2, observacoes: 2.4,
};

export async function gerarInventarioPdf({ escopo, colunas, linhas }: InventarioPdfParams) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const landscape = colunas.length > 6;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: landscape ? "landscape" : "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;

  const totalQtd = linhas.reduce((a, r) => a + Number(r.quantidade || 0), 0);
  const totalValor = linhas.reduce((a, r) => a + Number(r.valor || 0) * Number(r.quantidade || 0), 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Grupo Luminart — Inventário de Patrimônio", marginX, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `${escopo} · ${linhas.length} ${linhas.length === 1 ? "item" : "itens"} · ${totalQtd.toLocaleString("pt-BR")} un · ${brl(totalValor)}`,
    marginX,
    19,
  );
  const agora = new Date();
  doc.setTextColor(130);
  doc.text(
    `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    marginX,
    24,
  );
  doc.setTextColor(0);

  const tableW = pageW - marginX * 2;
  const pesos = colunas.map((c) => PESO[c.key] ?? 1.3);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const columnStyles: Record<number, any> = {};
  colunas.forEach((c, i) => {
    columnStyles[i] = {
      cellWidth: (pesos[i] / somaPesos) * tableW,
      halign: NUM_RIGHT.has(c.key) ? "right" : "left",
    };
  });

  const body: any[] = linhas.map((r) => colunas.map((c) => cellText(c.key, r[c.key])));

  const temQtd = colunas.some((c) => c.key === "quantidade");
  const temValor = colunas.some((c) => c.key === "valor");
  if (temQtd || temValor) {
    const totalStyle = {
      fontStyle: "bold" as const,
      fillColor: [55, 55, 55] as [number, number, number],
      textColor: 255,
    };
    const idxQtd = colunas.findIndex((c) => c.key === "quantidade");
    const idxValor = colunas.findIndex((c) => c.key === "valor");
    const primeiroTotal = Math.min(...[idxQtd, idxValor].filter((i) => i >= 0));
    const row: any[] = [];
    if (primeiroTotal > 0) {
      row.push({ content: `TOTAL (${linhas.length})`, colSpan: primeiroTotal, styles: totalStyle });
    }
    for (let i = primeiroTotal; i < colunas.length; i++) {
      const key = colunas[i].key;
      const content =
        key === "quantidade" ? totalQtd.toLocaleString("pt-BR")
        : key === "valor" ? brl(totalValor)
        : i === 0 ? `TOTAL (${linhas.length})`
        : "";
      row.push({
        content,
        styles: { ...totalStyle, halign: NUM_RIGHT.has(key) ? "right" : "left" },
      });
    }
    body.push(row);
  }

  autoTable(doc, {
    startY: 28,
    head: [colunas.map((c) => c.label)],
    body,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.4, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    columnStyles,
    tableWidth: tableW,
    margin: { left: marginX, right: marginX, top: 14, bottom: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Grupo Luminart — Inventário de Patrimônio", marginX, pageH - 6);
    doc.text(`Página ${p} de ${pages}`, pageW - marginX, pageH - 6, { align: "right" });
  }
  doc.setTextColor(0);

  doc.save(`inventario_patrimonio_${agora.toISOString().slice(0, 10)}.pdf`);
}
