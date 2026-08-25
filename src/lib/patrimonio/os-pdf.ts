import logoUrl from "@/assets/luminart-logo.png";
import { compareFamiliaNomeMedida } from "@/lib/patrimonio/ordenacao";

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

const chaveMaterial = (nome: string, especificacao?: string | null) =>
  `${(nome || "").trim().toLowerCase()}|${(especificacao || "").trim().toLowerCase()}`;

/** Agrupa lançamentos iguais (nome + especificação) somando as quantidades. */
function agruparItens(itens: OSPdfItem[]) {
  const map = new Map<
    string,
    OSPdfItem & { codigos: Set<string>; registros: number }
  >();
  for (const i of itens) {
    const k = chaveMaterial(i.nome, i.especificacao);
    let g = map.get(k);
    if (!g) {
      g = {
        nome: i.nome,
        especificacao: i.especificacao ?? null,
        unidade: i.unidade ?? null,
        id_item: null,
        quantidade: 0,
        devolvida: 0,
        perdida: 0,
        codigos: new Set<string>(),
        registros: 0,
      };
      map.set(k, g);
    }
    g.quantidade += Number(i.quantidade || 0);
    g.devolvida += Number(i.devolvida || 0);
    g.perdida += Number(i.perdida || 0);
    g.registros += 1;
    if (i.id_item) g.codigos.add(i.id_item);
    if (!g.unidade && i.unidade) g.unidade = i.unidade;
  }
  return [...map.values()].sort((a, b) => compareFamiliaNomeMedida(a, b));
}


// Carrega a logo em data URL, recortando a margem vazia e preservando a proporção real.
async function carregarLogo(): Promise<{ src: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let minX = c.width,
          minY = c.height,
          maxX = 0,
          maxY = 0;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            const alpha = data[i + 3];
            if (alpha > 10 && !(data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX > minX && maxY > minY) {
          const cropW = maxX - minX + 1;
          const cropH = maxY - minY + 1;
          const cropped = document.createElement("canvas");
          cropped.width = cropW;
          cropped.height = cropH;
          cropped.getContext("2d")!.putImageData(ctx.getImageData(minX, minY, cropW, cropH), 0, 0);
          resolve({ src: cropped.toDataURL("image/png"), w: cropW, h: cropH });
        } else {
          resolve({ src: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
        }
      } catch {
        resolve({ src: img.src, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
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
      // mantém a proporção original: altura base de 12 mm, largura limitada a 45 mm
      const ratio = logo.w / logo.h;
      let h = 12;
      let w = h * ratio;
      if (w > 45) {
        w = 45;
        h = w / ratio;
      }
      doc.addImage(logo.src, "PNG", marginX, 10, w, h, undefined, "FAST");
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
    body: agruparItens(p.itens).map((i) => [
      `${i.nome}${i.especificacao ? ` — ${i.especificacao}` : ""}`,
      i.codigos.size === 1 ? [...i.codigos][0] : i.codigos.size > 1 ? `vários (${i.codigos.size})` : "—",
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
