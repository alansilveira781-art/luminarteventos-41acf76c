// Relatório em PDF do Painel Financeiro (cards + gráficos + análises + DRE por grupos).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { labelPeriodo } from "./painel-analises";

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtPct = (n: number) =>
  `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Converte um <svg> (gráfico Recharts) em PNG dataURL, sem dependências extras. */
export async function svgParaPng(svg: SVGSVGElement, escala = 2): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const rect = svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || Number(svg.getAttribute("width")) || 600));
    const h = Math.max(1, Math.round(rect.height || Number(svg.getAttribute("height")) || 300));
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    // Garante texto legível no PNG (o app pode estar em tema escuro / cor herdada de CSS).
    clone.querySelectorAll("text").forEach((t) => {
      const fill = t.getAttribute("fill");
      if (!fill || fill === "currentColor" || fill.startsWith("var(")) t.setAttribute("fill", "#111827");
    });
    const xml = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg load"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * escala;
    canvas.height = h * escala;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), w, h };
  } catch {
    return null;
  }
}

export type PainelPdfKpi = { label: string; value: string; sub: string };
export type PainelPdfGrafico = { titulo: string; texto: string; imagem: { dataUrl: string; w: number; h: number } | null };
export type PainelPdfDreLinha = { label: string; valor: number; pct: number; forte: boolean };

export type PainelPdfInput = {
  ano: number;
  mes: number;
  empresa?: string;
  kpis: PainelPdfKpi[];
  graficos: PainelPdfGrafico[];
  faturamento: { linhas: [string, string][]; texto: string };
  dre: PainelPdfDreLinha[];
};

export function gerarPainelPdf(input: PainelPdfInput): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 12;
  let y = M;

  const periodo = labelPeriodo(input.ano, input.mes);

  const quebra = (altura: number) => {
    if (y + altura > ph - M) {
      doc.addPage();
      y = M;
    }
  };

  // Cabeçalho
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pw, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Painel Financeiro — ${periodo}`, M, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${input.empresa ?? "Grupo Luminart"} · Emitido em ${new Date().toLocaleString("pt-BR")}`,
    M,
    15,
  );
  doc.setTextColor(17, 24, 39);
  y = 26;

  // Cards de indicadores
  const cols = input.kpis.length || 1;
  const gap = 3;
  const cw = (pw - M * 2 - gap * (cols - 1)) / cols;
  const chh = 20;
  input.kpis.forEach((k, i) => {
    const x = M + i * (cw + gap);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cw, chh, 1.5, 1.5, "FD");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, x + 2.5, y + 5);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(k.value, x + 2.5, y + 11.5, { maxWidth: cw - 5 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(k.sub, x + 2.5, y + 16.5, { maxWidth: cw - 5 });
  });
  doc.setTextColor(17, 24, 39);
  y += chh + 6;

  // Gráficos + análises
  input.graficos.forEach((g) => {
    const imgH = g.imagem ? Math.min(85, (g.imagem.h / g.imagem.w) * (pw - M * 2)) : 0;
    const textoLinhas = doc.splitTextToSize(g.texto, pw - M * 2 - 4);
    const blocoH = 8 + imgH + 4 + textoLinhas.length * 4 + 6;
    quebra(blocoH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(g.titulo, M, y);
    y += 4;
    if (g.imagem) {
      doc.addImage(g.imagem.dataUrl, "PNG", M, y, pw - M * 2, imgH, undefined, "FAST");
      y += imgH + 3;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text(textoLinhas, M, y + 3);
    doc.setTextColor(17, 24, 39);
    y += textoLinhas.length * 4 + 7;
  });

  // Faturamento x Recebimento
  quebra(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Faturamento (Vendas) x Recebimento", M, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    head: [["Indicador", "Valor"]],
    body: input.faturamento.linhas,
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  const fatLinhas = doc.splitTextToSize(input.faturamento.texto, pw - M * 2);
  quebra(fatLinhas.length * 4 + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(fatLinhas, M, y + 2);
  doc.setTextColor(17, 24, 39);
  y += fatLinhas.length * 4 + 8;

  // Demonstrativo por grupos
  quebra(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Demonstrativo de Resultado (grupos)", M, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right", cellWidth: 22 } },
    head: [["Linha", "Valor", "% RB"]],
    body: input.dre.map((l) => [l.label, fmtMoney(l.valor), fmtPct(l.pct)]),
    didParseCell: (data) => {
      const linha = input.dre[data.row.index];
      if (!linha) return;
      if (linha.forte) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
      }
      if (data.column.index === 1 && linha.valor < 0) data.cell.styles.textColor = [190, 18, 60];
    },
  });

  // Rodapé com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Painel Financeiro — ${periodo}`, M, ph - 6);
    doc.text(`Página ${i} de ${total}`, pw - M, ph - 6, { align: "right" });
  }

  doc.save(`painel-financeiro-${periodo.replace("/", "-")}.pdf`);
}
