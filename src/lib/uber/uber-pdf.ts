// Relatório em PDF da seção Uber (painel e análises), no padrão visual da Luminart:
// logo, cabeçalho grafite, acento âmbar, cards de indicadores, gráficos e tabelas.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/luminart-logo.png";
import { CHART_BASE, CHART_ACCENT } from "@/lib/financeiro/chart-colors";

const GRAFITE: [number, number, number] = [26, 26, 26];
const AMBAR: [number, number, number] = [217, 155, 43];
const CINZA: [number, number, number] = [110, 110, 110];

export type UberPdfImagem = { dataUrl: string; w: number; h: number };
export type UberPdfKpi = { label: string; value: string; hint?: string };
export type UberPdfSecao =
  | { tipo: "grafico"; titulo: string; imagem: UberPdfImagem | null; altura?: number }
  | {
      tipo: "tabela";
      titulo: string;
      head: string[];
      body: (string | number)[][];
      alignRight?: number[];
      larguras?: Record<number, number>;
    }
  | { tipo: "lista"; titulo: string; itens: [string, string][] };

export type UberPdfInput = {
  titulo: string;
  subtitulo: string;
  orientacao?: "portrait" | "landscape";
  kpis: UberPdfKpi[];
  secoes: UberPdfSecao[];
  arquivo: string;
};

/** Converte um <svg> (gráfico Recharts) em PNG dataURL. */
export async function svgParaPng(
  svg: SVGSVGElement,
  escala = 2,
): Promise<UberPdfImagem | null> {
  try {
    const rect = svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || 600));
    const h = Math.max(1, Math.round(rect.height || 300));
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
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

/** Captura os gráficos marcados com data-pdf-chart="Título" dentro de um container. */
export async function capturarGraficos(
  root: HTMLElement | null,
): Promise<Record<string, UberPdfImagem | null>> {
  const out: Record<string, UberPdfImagem | null> = {};
  if (!root) return out;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-chart]"));
  for (const node of nodes) {
    const titulo = node.dataset.pdfChart || "";
    const svg = node.querySelector("svg");
    out[titulo] = svg ? await svgParaPng(svg as SVGSVGElement) : null;
  }
  return out;
}

// Carrega a logo recortando margens vazias e preservando a proporção real.
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
        let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
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

export async function gerarUberPdf(input: UberPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: input.orientacao ?? "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 12;
  const emitido = new Date().toLocaleString("pt-BR");

  const cabecalho = async () => {
    doc.setFillColor(...GRAFITE);
    doc.rect(0, 0, pw, 24, "F");
    const logo = await carregarLogo();
    if (logo) {
      try {
        const ratio = logo.w / logo.h;
        let h = 10;
        let w = h * ratio;
        if (w > 38) { w = 38; h = w / ratio; }
        doc.addImage(logo.src, "PNG", pw - M - w, (24 - h) / 2, w, h, undefined, "FAST");
      } catch { /* ignora falha da logo */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(input.titulo, M, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(220, 220, 220);
    doc.text(doc.splitTextToSize(input.subtitulo, pw - M * 2 - 45)[0] ?? "", M, 16.5);
    doc.text(`Grupo Luminart · Emitido em ${emitido}`, M, 21);
    doc.setFillColor(...AMBAR);
    doc.rect(0, 24, pw, 1.2, "F");
    doc.setTextColor(...GRAFITE);
  };

  await cabecalho();
  let y = 33;

  const quebra = (altura: number) => {
    if (y + altura > ph - 12) {
      doc.addPage();
      y = M;
    }
  };

  // Cards de indicadores (até 4 por linha)
  const porLinha = Math.min(4, Math.max(1, input.kpis.length));
  const gap = 3;
  const cw = (pw - M * 2 - gap * (porLinha - 1)) / porLinha;
  const chh = 19;
  input.kpis.forEach((k, i) => {
    const col = i % porLinha;
    if (col === 0 && i > 0) y += chh + gap;
    if (col === 0) quebra(chh);
    const x = M + col * (cw + gap);
    doc.setDrawColor(226, 226, 226);
    doc.setFillColor(249, 249, 249);
    doc.roundedRect(x, y, cw, chh, 1.5, 1.5, "FD");
    doc.setFillColor(...AMBAR);
    doc.rect(x, y, 1.2, chh, "F");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(doc.splitTextToSize(k.label, cw - 6)[0] ?? "", x + 3.5, y + 5);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAFITE);
    doc.text(doc.splitTextToSize(k.value, cw - 6)[0] ?? "", x + 3.5, y + 11.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...CINZA);
    if (k.hint) doc.text(doc.splitTextToSize(k.hint, cw - 6)[0] ?? "", x + 3.5, y + 16);
  });
  if (input.kpis.length) y += chh + 7;
  doc.setTextColor(...GRAFITE);

  const titulo = (t: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GRAFITE);
    doc.text(t, M, y);
    doc.setDrawColor(...AMBAR);
    doc.setLineWidth(0.6);
    doc.line(M, y + 1.6, M + 18, y + 1.6);
    doc.setLineWidth(0.2);
    y += 5;
  };

  for (const s of input.secoes) {
    if (s.tipo === "grafico") {
      if (!s.imagem) continue;
      const imgW = pw - M * 2;
      const imgH = Math.min(s.altura ?? 80, (s.imagem.h / s.imagem.w) * imgW);
      quebra(imgH + 12);
      titulo(s.titulo);
      doc.addImage(s.imagem.dataUrl, "PNG", M, y, imgW, imgH, undefined, "FAST");
      y += imgH + 8;
    } else if (s.tipo === "tabela") {
      if (!s.body.length) continue;
      quebra(24);
      titulo(s.titulo);
      const columnStyles: Record<number, any> = {};
      (s.alignRight ?? []).forEach((i) => { columnStyles[i] = { halign: "right" }; });
      Object.entries(s.larguras ?? {}).forEach(([i, w]) => {
        columnStyles[Number(i)] = { ...(columnStyles[Number(i)] ?? {}), cellWidth: w };
      });
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, top: M },
        theme: "grid",
        styles: { fontSize: 7.8, cellPadding: 1.6, overflow: "linebreak", textColor: [40, 40, 40] },
        headStyles: { fillColor: GRAFITE, textColor: 255, fontSize: 7.8 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles,
        head: [s.head],
        body: s.body.map((r) => r.map((c) => String(c))),
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      quebra(18);
      titulo(s.titulo);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      s.itens.forEach(([label, valor]) => {
        quebra(6);
        doc.setTextColor(...CINZA);
        doc.text(label, M, y);
        doc.setTextColor(...GRAFITE);
        doc.text(valor, pw - M, y, { align: "right" });
        doc.setDrawColor(232, 232, 232);
        doc.line(M, y + 1.5, pw - M, y + 1.5);
        y += 6;
      });
      y += 3;
    }
  }

  // Rodapé
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`${input.titulo} · Grupo Luminart`, M, ph - 6);
    doc.text(`Página ${i} de ${total}`, pw - M, ph - 6, { align: "right" });
  }

  doc.save(`${input.arquivo}.pdf`);
}

export const UBER_PDF_CORES = { base: CHART_BASE, acento: CHART_ACCENT };
