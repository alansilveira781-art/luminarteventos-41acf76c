// Relatório de Diaristas em PDF (A4 retrato).
// jspdf carregado sob demanda para não pesar no bundle.

export type RelatorioItem = {
  data: string; // ISO yyyy-mm-dd
  projeto: string;
  local: string;
  horarioLabel?: string;
  horasLabel: string;

  diaria: number;
  extra: number;
  refeicoes?: number;
  total: number;
};

export type RelatorioEventoItem = {
  evento: string;
  dias: number;
  horasLabel: string;
  total: number;
};

export type RelatorioGrupo = {
  nome: string;
  /** "Pago", "Em aberto" ou "Parcial" */
  statusLabel?: string;
  chavePix: string | null;
  dias: number;
  horasLabel: string;
  total: number;
  valorHoraFortaleza?: number;
  valorHoraFora?: number;
  itens: RelatorioItem[];
  /** Usado quando o relatório é agrupado por evento */
  eventos?: RelatorioEventoItem[];
};

export type RelatorioDiaristasParams = {
  de: string;
  ate: string;
  filtros?: string[];
  grupos: RelatorioGrupo[];
  totais: { dias: number; horasLabel: string; valor: number };
  /** Detalha por evento (somando os dias) em vez de listar dia a dia */
  porEvento?: boolean;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export async function gerarRelatorioDiaristasPdf(params: RelatorioDiaristasParams) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Relatório de Diaristas", marginX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Período: ${fmtDate(params.de)} a ${fmtDate(params.ate)}`, marginX, 22);
  const filtros = (params.filtros ?? []).filter(Boolean);
  let y = 26;
  if (filtros.length) {
    doc.text(`Filtros: ${filtros.join(" · ")}`, marginX, y);
    y += 4;
  }
  const agora = new Date();
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    marginX,
    y,
  );
  doc.setTextColor(0);
  y += 6;

  doc.setDrawColor(200);
  doc.line(marginX, y, pageW - marginX, y);
  y += 8;

  for (const g of params.grupos) {
    const nLinhas = params.porEvento ? (g.eventos?.length ?? 0) : g.itens.length;
    const alturaEstimada = 16 + 8 + nLinhas * 6.5;
    if (y + Math.min(alturaEstimada, 60) > pageH - 18) {
      doc.addPage();
      y = 18;
    }

    // Faixa com nome + total
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX, y, contentW, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(g.nome, marginX + 3, y + 6.2);
    doc.text(brl(g.total), pageW - marginX - 3, y + 6.2, { align: "right" });
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    const info = [
      g.chavePix ? `Pix: ${g.chavePix}` : null,
      `${g.dias} ${g.dias === 1 ? "dia" : "dias"}`,
      `${g.horasLabel} trabalhadas`,
      (g.valorHoraFortaleza ?? 0) > 0 ? `Fortaleza ${brl(g.valorHoraFortaleza!)}/h` : null,
      (g.valorHoraFora ?? 0) > 0 ? `Fora ${brl(g.valorHoraFora!)}/h` : null,
    ]
      .filter(Boolean)
      .join("   |   ");
    doc.text(info, marginX + 1, y);
    doc.setTextColor(0);
    y += 3;

    const porEvento = !!params.porEvento;
    const body: Array<Array<string | { content: string; colSpan?: number; styles?: any }>> = [];
    if (porEvento) {
      for (const ev of g.eventos ?? []) {
        body.push([ev.evento || "—", String(ev.dias), ev.horasLabel || "—", brl(ev.total)]);
      }
    } else {
      for (const it of g.itens) {
        body.push([
          fmtDate(it.data),
          it.projeto || "—",
          it.local || "—",
          it.horarioLabel || "—",
          it.horasLabel || "—",
          brl(it.diaria),
          brl(it.extra),
          brl(it.refeicoes ?? 0),
          brl(it.total),
        ]);
      }
    }

    autoTable(doc, {
      startY: y,
      head: porEvento
        ? [["Evento / Projeto", "Dias", "Horas", "Total"]]
        : [["Data", "Projeto / Evento", "Local", "Horário", "Horas", "Diária", "Extra", "Refeições", "Total"]],
      body: body as any,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: [55, 55, 55], textColor: 255, fontSize: 8, fontStyle: "bold" },
      columnStyles: porEvento
        ? {
            0: { cellWidth: 108 },
            1: { cellWidth: 18, halign: "right" },
            2: { cellWidth: 24, halign: "right" },
            3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
          }
        : {
            0: { cellWidth: 19 },
            1: { cellWidth: 38 },
            2: { cellWidth: 15 },
            3: { cellWidth: 21, halign: "center" },
            4: { cellWidth: 14, halign: "right" },
            5: { cellWidth: 20, halign: "right" },
            6: { cellWidth: 17, halign: "right" },
            7: { cellWidth: 20, halign: "right" },
            8: { cellWidth: 22, halign: "right", fontStyle: "bold" },
          },

      margin: { left: marginX, right: marginX },
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  // Total geral
  if (y + 14 > pageH - 18) {
    doc.addPage();
    y = 18;
  }
  doc.setFillColor(55, 55, 55);
  doc.rect(marginX, y, contentW, 10, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `TOTAL GERAL — ${params.totais.dias} dia(s) · ${params.totais.horasLabel}`,
    marginX + 3,
    y + 6.6,
  );
  doc.text(brl(params.totais.valor), pageW - marginX - 3, y + 6.6, { align: "right" });
  doc.setTextColor(0);

  // Rodapé com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Página ${i} de ${total}`, pageW - marginX, pageH - 8, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`relatorio-diaristas-${params.de}_a_${params.ate}.pdf`);
}
