// Relatório de Patrimônio em PDF (A4 paisagem, estruturado).
// jspdf carregado sob demanda para não pesar no bundle.

export type RelatorioPatItem = {
  cod: number | null;
  id_item: string | null;
  nome: string | null;
  especificacao?: string | null;
  categoria: string | null;
  subcategoria: string | null;
  localizacao: string | null;
  estado: string | null;
  unidade: string | null;
  quantidade: number;
  valor: number; // valor unitário
};

export type RelatorioPatrimonioParams = {
  filtros?: string[];
  itens: RelatorioPatItem[];
  /** Agrupar por "categoria" | "subcategoria" | "nenhum" */
  agruparPor?: "categoria" | "subcategoria" | "nenhum";
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const num = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v || 0);

export async function gerarRelatorioPatrimonioPdf(params: RelatorioPatrimonioParams) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const agruparPor = params.agruparPor ?? "categoria";
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Grupo Luminart — Relatório de Patrimônio", marginX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 21;
  const filtros = (params.filtros ?? []).filter(Boolean);
  if (filtros.length) {
    const linhas = doc.splitTextToSize(`Filtros: ${filtros.join("  ·  ")}`, pageW - marginX * 2);
    doc.text(linhas, marginX, y);
    y += linhas.length * 4;
  }
  const agora = new Date();
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    marginX,
    y,
  );
  doc.setTextColor(0);
  y += 4;

  // Agrupamento
  const grupos = new Map<string, RelatorioPatItem[]>();
  for (const it of params.itens) {
    const chave =
      agruparPor === "nenhum"
        ? "__todos"
        : (agruparPor === "categoria" ? it.categoria : it.subcategoria) || "Sem classificação";
    const arr = grupos.get(chave) ?? [];
    arr.push(it);
    grupos.set(chave, arr);
  }

  const body: any[] = [];
  const chaves = [...grupos.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  let totalQtd = 0;
  let totalValor = 0;

  for (const chave of chaves) {
    const lista = grupos
      .get(chave)!
      .slice()
      .sort((a, b) => {
        const ea = (a.especificacao ?? "").trim();
        const eb = (b.especificacao ?? "").trim();
        const cmp = ea.localeCompare(eb, "pt-BR", { numeric: true });
        if (cmp !== 0) return cmp;
        return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { numeric: true });
      });

    if (agruparPor !== "nenhum") {
      body.push([
        {
          content: chave,
          colSpan: 9,
          styles: { fillColor: [235, 235, 235], fontStyle: "bold", textColor: 20 },
        },
      ]);
    }

    let subQtd = 0;
    let subValor = 0;
    for (const it of lista) {
      const qtd = Number(it.quantidade || 0);
      const total = Number(it.valor || 0) * (qtd || 1);
      subQtd += qtd;
      subValor += total;
      body.push([
        it.cod != null ? String(it.cod) : (it.id_item ?? "—"),
        [it.nome ?? "—", it.especificacao].filter(Boolean).join(" · "),
        it.categoria ?? "—",
        it.subcategoria ?? "—",
        it.localizacao ?? "—",
        it.estado ?? "—",
        `${num(qtd)} ${it.unidade ?? ""}`.trim(),
        brl(it.valor),
        brl(total),
      ]);
    }
    totalQtd += subQtd;
    totalValor += subValor;

    if (agruparPor !== "nenhum") {
      body.push([
        {
          content: `Subtotal — ${chave} (${lista.length} ${lista.length === 1 ? "item" : "itens"})`,
          colSpan: 6,
          styles: { fontStyle: "bold", halign: "right" },
        },
        { content: num(subQtd), styles: { fontStyle: "bold", halign: "right" } },
        { content: "", styles: {} },
        { content: brl(subValor), styles: { fontStyle: "bold", halign: "right" } },
      ]);
    }
  }

  body.push([
    {
      content: `TOTAL GERAL (${params.itens.length} ${params.itens.length === 1 ? "item" : "itens"})`,
      colSpan: 6,
      styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 },
    },
    { content: num(totalQtd), styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 } },
    { content: "", styles: { fillColor: [55, 55, 55] } },
    { content: brl(totalValor), styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 } },
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [[
      "Código",
      "Item",
      "Categoria",
      "Subcategoria",
      "Localização",
      "Estado",
      "Qtd.",
      "Valor unit.",
      "Valor total",
    ]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 70 },
      2: { cellWidth: 32 },
      3: { cellWidth: 32 },
      4: { cellWidth: 34 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 24, halign: "right" },
      8: { cellWidth: 26, halign: "right" },
    },
    margin: { left: marginX, right: marginX, bottom: 14 },
  });

  // Rodapé com numeração
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Grupo Luminart — Relatório de Patrimônio", marginX, pageH - 7);
    doc.text(`Página ${p} de ${pages}`, pageW - marginX, pageH - 7, { align: "right" });
  }
  doc.setTextColor(0);

  const stamp = agora.toISOString().slice(0, 10);
  doc.save(`relatorio-patrimonio-${stamp}.pdf`);
}

export type RelatorioPatConsolidadoLinha = {
  nome: string;
  especificacao?: string | null;
  categoria: string;
  subcategoria: string;
  registros: number;
  quantidade: number;
  valorMedio: number;
  valorTotal: number;
};

export async function gerarRelatorioPatrimonioConsolidadoPdf(params: {
  filtros?: string[];
  linhas: RelatorioPatConsolidadoLinha[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Grupo Luminart — Patrimônio por item", marginX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 21;
  const filtros = (params.filtros ?? []).filter(Boolean);
  if (filtros.length) {
    const linhas = doc.splitTextToSize(`Filtros: ${filtros.join("  ·  ")}`, pageW - marginX * 2);
    doc.text(linhas, marginX, y);
    y += linhas.length * 4;
  }
  const agora = new Date();
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    marginX,
    y,
  );
  doc.setTextColor(0);
  y += 4;

  let totQtd = 0;
  let totValor = 0;
  const linhasOrdenadas = [...params.linhas].sort((a, b) => {
    const ea = (a.especificacao ?? "").trim();
    const eb = (b.especificacao ?? "").trim();
    const cmp = ea.localeCompare(eb, "pt-BR", { numeric: true });
    if (cmp !== 0) return cmp;
    return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { numeric: true });
  });
  const body: any[] = linhasOrdenadas.map((l) => {
    totQtd += l.quantidade;
    totValor += l.valorTotal;
    return [
      [l.nome ?? "—", l.especificacao].filter(Boolean).join(" · "),
      l.categoria,
      String(l.registros),
      num(l.quantidade),
      brl(l.valorMedio),
      brl(l.valorTotal),
    ];
  });

  body.push([
    {
      content: `TOTAL GERAL (${params.linhas.length} ${params.linhas.length === 1 ? "item" : "itens"})`,
      colSpan: 3,
      styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 },
    },
    { content: num(totQtd), styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 } },
    { content: "", styles: { fillColor: [55, 55, 55] } },
    { content: brl(totValor), styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 } },
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [["Item", "Categoria", "Reg.", "Qtd.", "Valor unit. médio", "Valor total"]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 34 },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
    },
    margin: { left: marginX, right: marginX, bottom: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Grupo Luminart — Patrimônio por item", marginX, pageH - 7);
    doc.text(`Página ${p} de ${pages}`, pageW - marginX, pageH - 7, { align: "right" });
  }
  doc.setTextColor(0);

  const stamp = agora.toISOString().slice(0, 10);
  doc.save(`relatorio-patrimonio-consolidado-${stamp}.pdf`);
}

export async function gerarFolhaConferenciaPatrimonioPdf(params: {
  filtros?: string[];
  linhas: RelatorioPatConsolidadoLinha[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Grupo Luminart — Folha de conferência de Patrimônio", marginX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 21;
  const filtros = (params.filtros ?? []).filter(Boolean);
  if (filtros.length) {
    const linhas = doc.splitTextToSize(`Filtros: ${filtros.join("  ·  ")}`, pageW - marginX * 2);
    doc.text(linhas, marginX, y);
    y += linhas.length * 4;
  }
  const agora = new Date();
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    marginX,
    y,
  );
  doc.setTextColor(0);
  y += 4;

  let totQtd = 0;
  const body: any[] = params.linhas.map((l) => {
    totQtd += l.quantidade;
    return [
      [l.nome ?? "—", l.especificacao].filter(Boolean).join(" · "),
      l.categoria,
      num(l.quantidade),
      "",
      "",
    ];
  });

  body.push([
    {
      content: `TOTAL GERAL (${params.linhas.length} ${params.linhas.length === 1 ? "item" : "itens"})`,
      colSpan: 2,
      styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 },
    },
    { content: num(totQtd), styles: { fontStyle: "bold", halign: "right", fillColor: [55, 55, 55], textColor: 255 } },
    { content: "", styles: { fillColor: [55, 55, 55] } },
    { content: "", styles: { fillColor: [55, 55, 55] } },
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [["Item", "Categoria", "Qtd. sistema", "Qtd. conferida", "Observações"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak", minCellHeight: 8 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 8, fontStyle: "bold", minCellHeight: 7 },
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 32 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 26 },
      4: { cellWidth: 40 },
    },
    margin: { left: marginX, right: marginX, bottom: 22 },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text("Responsável: ____________________________", marginX, pageH - 14);
    doc.text("Data: ____/____/______", pageW - marginX, pageH - 14, { align: "right" });
    doc.setTextColor(130);
    doc.text("Grupo Luminart — Folha de conferência de Patrimônio", marginX, pageH - 7);
    doc.text(`Página ${p} de ${pages}`, pageW - marginX, pageH - 7, { align: "right" });
  }
  doc.setTextColor(0);

  const stamp = agora.toISOString().slice(0, 10);
  doc.save(`folha-conferencia-patrimonio-${stamp}.pdf`);
}
