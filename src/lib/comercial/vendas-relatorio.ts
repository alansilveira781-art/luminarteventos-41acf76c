// Relatório de Vendas em PDF (A4 paisagem, padrão Grupo Luminart).
// jspdf carregado sob demanda para não pesar no bundle.

export type VendaRelatorioLinha = {
  dataEvento: string | null;
  dataRegistro: string | null;
  nomeEvento: string | null;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  empresa: string | null;
  classificacao: string | null;
  consultor: string | null;
  cerimonial: string | null;
  valorProposta: number;
  desconto: number;
  valorFinal: number;
  valorBV: number;
  valorComissao: number;
};

export type RelatorioVendasParams = {
  filtros?: string[];
  linhas: VendaRelatorioLinha[];
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const LEGACY_EVENTO = "1900-01-01";
const fmtData = (iso: string | null) => {
  if (!iso || iso.slice(0, 10) === LEGACY_EVENTO) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export async function gerarRelatorioVendasPdf(params: RelatorioVendasParams) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Grupo Luminart — Relatório de Vendas", marginX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 21;
  const filtros = (params.filtros ?? []).filter(Boolean);
  if (filtros.length) {
    const linhasTxt = doc.splitTextToSize(`Filtros: ${filtros.join("  ·  ")}`, pageW - marginX * 2);
    doc.text(linhasTxt, marginX, y);
    y += linhasTxt.length * 4;
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

  const linhas = params.linhas;
  const tot = linhas.reduce(
    (acc, l) => {
      acc.proposta += Number(l.valorProposta || 0);
      acc.desconto += Number(l.desconto || 0);
      acc.final += Number(l.valorFinal || 0);
      acc.bv += Number(l.valorBV || 0);
      acc.comissao += Number(l.valorComissao || 0);
      return acc;
    },
    { proposta: 0, desconto: 0, final: 0, bv: 0, comissao: 0 },
  );

  const body: any[] = linhas.map((l) => [
    fmtData(l.dataEvento),
    l.nomeEvento ?? "—",
    (l.classificacao ?? "").trim() || "—",
    [l.local, [l.cidade, l.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "—",
    l.empresa ?? "—",
    l.consultor ?? "—",
    l.cerimonial ?? "—",
    brl(l.valorProposta),
    brl(l.desconto),
    brl(l.valorFinal),
    brl(l.valorBV),
    brl(l.valorComissao),
  ]);

  const totalStyle = { fontStyle: "bold" as const, halign: "right" as const, fillColor: [55, 55, 55] as [number, number, number], textColor: 255 };
  body.push([
    { content: `TOTAL (${linhas.length} ${linhas.length === 1 ? "venda" : "vendas"})`, colSpan: 7, styles: totalStyle },
    { content: brl(tot.proposta), styles: totalStyle },
    { content: brl(tot.desconto), styles: totalStyle },
    { content: brl(tot.final), styles: totalStyle },
    { content: brl(tot.bv), styles: totalStyle },
    { content: brl(tot.comissao), styles: totalStyle },
  ]);

  const tableW = pageW - marginX * 2; // 273 mm em A4 paisagem com margem 12

  autoTable(doc, {
    startY: y + 4,
    head: [[
      "Data evento", "Evento", "Categoria", "Local / Cidade", "Empresa", "Consultor", "Cerimonial",
      "Proposta", "Desconto", "Valor final", "BV", "Comissão",
    ]],
    body,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.3, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 7, fontStyle: "bold", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 42 },
      2: { cellWidth: 22 },
      3: { cellWidth: 32 },
      4: { cellWidth: 16 },
      5: { cellWidth: 21 },
      6: { cellWidth: 21 },
      7: { cellWidth: 21, halign: "right" },
      8: { cellWidth: 19, halign: "right" },
      9: { cellWidth: 22, halign: "right" },
      10: { cellWidth: 19, halign: "right" },
      11: { cellWidth: 22, halign: "right" },
    },
    tableWidth: tableW,
    margin: { left: marginX, right: marginX, bottom: 14 },
  });

  // Resumo de comissões por consultor
  const porConsultor = new Map<string, { qtd: number; final: number; comissao: number }>();
  for (const l of linhas) {
    const nome = (l.consultor ?? "").trim() || "— Sem consultor —";
    const cur = porConsultor.get(nome) ?? { qtd: 0, final: 0, comissao: 0 };
    cur.qtd += 1;
    cur.final += Number(l.valorFinal || 0);
    cur.comissao += Number(l.valorComissao || 0);
    porConsultor.set(nome, cur);
  }
  const resumo = [...porConsultor.entries()].sort((a, b) => b[1].comissao - a[1].comissao);

  let cursorY = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  if (cursorY > pageH - 45) {
    doc.addPage();
    cursorY = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total de comissões por consultor", marginX, cursorY);

  autoTable(doc, {
    startY: cursorY + 3,
    head: [["Consultor", "Vendas", "Valor final", "Comissão", "% médio"]],
    body: ([
      ...resumo.map(([nome, r]) => [
        nome,
        String(r.qtd),
        brl(r.final),
        brl(r.comissao),
        `${(r.final ? (r.comissao / r.final) * 100 : 0).toFixed(2).replace(".", ",")}%`,
      ]),
      [
        { content: "TOTAL", styles: totalStyle },
        { content: String(linhas.length), styles: totalStyle },
        { content: brl(tot.final), styles: totalStyle },
        { content: brl(tot.comissao), styles: totalStyle },
        {
          content: `${(tot.final ? (tot.comissao / tot.final) * 100 : 0).toFixed(2).replace(".", ",")}%`,
          styles: totalStyle,
        },
      ],
    ] as any),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 34, halign: "right" },
      3: { cellWidth: 34, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
    },
    margin: { left: marginX, right: marginX, bottom: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Grupo Luminart — Relatório de Vendas", marginX, pageH - 7);
    doc.text(`Página ${p} de ${pages}`, pageW - marginX, pageH - 7, { align: "right" });
  }
  doc.setTextColor(0);

  doc.save(`relatorio-vendas-${agora.toISOString().slice(0, 10)}.pdf`);
}
