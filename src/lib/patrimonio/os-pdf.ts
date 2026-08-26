import logoUrl from "@/assets/luminart-logo.png";

// Relatório de uma O.S. de patrimônio (A4 retrato).

export type OSPdfItem = {
  nome: string;
  especificacao?: string | null;
  id_item?: string | null;
  unidade?: string | null;
  quantidade: number;
  devolvida: number;
  perdida: number;
};

export type OSPdfDevolucao = {
  data: string;
  responsavel?: string | null;
  observacoes?: string | null;
  linhas: Array<{ material: string; devolvida: number; faltante: number; motivo?: string | null; justificativa?: string | null }>;
};

export type OSPdfParams = {
  numero: number;
  tipo: string;
  status: string;
  dataSaida: string;
  previsaoRetorno?: string | null;
  eventoProjeto?: string | null;
  tomadorNome?: string | null;
  tomadorDocumento?: string | null;
  tomadorEndereco?: string | null;
  tomadorTelefone?: string | null;
  retiranteNome?: string | null;
  retiranteCpf?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: OSPdfItem[];
  devolucoes?: OSPdfDevolucao[];
};

const dt = (v?: string | null) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");

async function carregarLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarOSPdf(p: OSPdfParams) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const numero = `O.S.-${String(p.numero).padStart(3, "0")}`;

  const logo = await carregarLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, 10, 34, 12, undefined, "FAST");
    } catch {
      /* ignora falha da logo */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Ordem de Saída de Materiais", pageW - marginX, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(numero, pageW - marginX, 22, { align: "right" });
  doc.setDrawColor(212, 165, 116);
  doc.setLineWidth(0.8);
  doc.line(marginX, 26, pageW - marginX, 26);
  doc.setLineWidth(0.2);
  doc.setDrawColor(200);

  const info: Array<[string, string]> = [
    ["Tipo", p.tipo === "evento" ? "Uso em Evento" : "Empréstimo"],
    ["Situação", p.status],
    ["Data de saída", dt(p.dataSaida)],
    ["Previsão de retorno", dt(p.previsaoRetorno)],
  ];
  if (p.tipo === "evento") {
    info.push(["Evento / Projeto", p.eventoProjeto || "—"]);
  } else {
    info.push(["Solicitante", p.tomadorNome || "—"]);
    info.push(["CNPJ / CPF", p.tomadorDocumento || "—"]);
    info.push(["Endereço", p.tomadorEndereco || "—"]);
    info.push(["Telefone", p.tomadorTelefone || "—"]);
    info.push(["Quem retirou", p.retiranteNome || "—"]);
    info.push(["CPF de quem retirou", p.retiranteCpf || "—"]);
  }
  info.push(["Responsável pela liberação", p.responsavel || "—"]);
  if (p.observacoes) info.push(["Observações", p.observacoes]);

  autoTable(doc, {
    startY: 31,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold", fillColor: [246, 246, 246] } },
    body: info,
    margin: { left: marginX, right: marginX },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Materiais", marginX, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    theme: "striped",
    headStyles: { fillColor: [30, 30, 34], textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2 },
    head: [["Material", "Identificação", "Un.", "Saiu", "Devolvido", "Perdido", "Pendente"]],
    body: p.itens.map((i) => [
      `${i.nome}${i.especificacao ? ` — ${i.especificacao}` : ""}`,
      i.id_item || "—",
      i.unidade || "—",
      String(i.quantidade),
      String(i.devolvida),
      String(i.perdida),
      String(Math.max(0, i.quantidade - i.devolvida - i.perdida)),
    ]),
    columnStyles: {
      3: { halign: "right", cellWidth: 15 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 17 },
      6: { halign: "right", cellWidth: 20 },
    },
    margin: { left: marginX, right: marginX },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  const devs = p.devolucoes ?? [];
  if (devs.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Histórico de devoluções", marginX, y);
    autoTable(doc, {
      startY: y + 3,
      theme: "grid",
      headStyles: { fillColor: [30, 30, 34], textColor: 255, fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      head: [["Data", "Material", "Devolvido", "Faltante", "Motivo", "Justificativa"]],
      body: devs.flatMap((d) =>
        d.linhas.map((l) => [
          dt(d.data),
          l.material,
          String(l.devolvida),
          String(l.faltante),
          l.motivo === "perda" ? "Perda" : l.motivo === "emprestimo" ? "Continua emprestado" : "—",
          l.justificativa || "—",
        ]),
      ),
      columnStyles: { 2: { halign: "right", cellWidth: 20 }, 3: { halign: "right", cellWidth: 18 } },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Assinaturas
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 40) {
    doc.addPage();
    y = 30;
  }
  const colW = (pageW - marginX * 2 - 10) / 2;
  doc.setDrawColor(120);
  doc.line(marginX, y + 12, marginX + colW, y + 12);
  doc.line(marginX + colW + 10, y + 12, pageW - marginX, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Responsável pela liberação", marginX, y + 16);
  doc.text("Recebedor / Retirante", marginX + colW + 10, y + 16);

  const agora = new Date();
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text(
    `Grupo Luminart · Emitido em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    marginX,
    pageH - 8,
  );

  doc.save(`${numero}.pdf`);
}
