import jsPDF from "jspdf";
import logoUrl from "@/assets/luminart-logo.png";
import type { Proposta, DescricaoItem, Ambiente } from "./types";
import {
  ambienteSubtotal,
  
  descricaoMedidaLabel,
  propostaCustos,
  propostaTotal,
} from "./types";

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────
const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};
const fmtPeriodo = (ini: string, fim: string) => {
  if (!ini && !fim) return "—";
  if (!fim || ini === fim) return fmtDate(ini);
  return `${fmtDate(ini)} – ${fmtDate(fim)}`;
};

// Paleta Luminart
const GOLD: [number, number, number] = [232, 163, 61];
const INK: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [120, 120, 130];
const GREY: [number, number, number] = [180, 180, 180];
const SOFT: [number, number, number] = [235, 235, 238];
const WHITE: [number, number, number] = [255, 255, 255];

const setText = (doc: jsPDF, c: readonly [number, number, number]) =>
  doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: readonly [number, number, number]) =>
  doc.setDrawColor(c[0], c[1], c[2]);
const setFill = (doc: jsPDF, c: readonly [number, number, number]) =>
  doc.setFillColor(c[0], c[1], c[2]);

// Carrega URL → data URL + dimensões originais
async function loadImage(
  src: string,
): Promise<{ src: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        resolve({ src: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve({ src, w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function descricaoLinha(d: DescricaoItem): string {
  const medida = descricaoMedidaLabel(d);
  const desc = d.descricao || "—";
  const qtd = d.quantidade ?? 1;
  return `- ${qtd}x ${desc}  (${medida})`;
}

// ─────────────────────────────────────────────────────────────
// Decorações vetoriais
// ─────────────────────────────────────────────────────────────
function drawCoverWaves(doc: jsPDF, W: number, H: number) {
  // onda cinza (inferior)
  setFill(doc, GREY);
  // jsPDF não tem path arbitrário; usamos sequência de triângulos/curvas via lines()
  // Aproximação com polígono suave
  const grey: [number, number][] = [];
  const baseY = H - 8;
  const peakY = H - 38;
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * W;
    const y = peakY + (baseY - peakY) * (0.5 + 0.5 * Math.cos(t * Math.PI * 1.2));
    grey.push([x, y]);
  }
  // polígono fechado
  doc.setLineWidth(0);
  const points = grey
    .concat([
      [W, H],
      [0, H],
    ])
    .map(([x, y]) => [x, y] as [number, number]);
  fillPolygon(doc, points);

  // onda dourada (sobreposta)
  setFill(doc, GOLD);
  const gold: [number, number][] = [];
  const base2 = H - 18;
  const peak2 = H - 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * W;
    const y = peak2 + (base2 - peak2) * (0.5 + 0.5 * Math.cos(t * Math.PI * 1.6 + 0.4));
    gold.push([x, y]);
  }
  const goldPts = gold
    .concat([
      [W, H - 10],
      [0, H - 10],
    ])
    .map(([x, y]) => [x, y] as [number, number]);
  fillPolygon(doc, goldPts);
}

function fillPolygon(doc: jsPDF, pts: [number, number][]) {
  if (pts.length < 3) return;
  const [x0, y0] = pts[0];
  const lines: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    lines.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  // @ts-ignore jsPDF.lines accepts segments
  doc.lines(lines, x0, y0, [1, 1], "F", true);
}

// ─────────────────────────────────────────────────────────────
// Páginas
// ─────────────────────────────────────────────────────────────
async function drawCover(
  doc: jsPDF,
  p: Proposta,
  logo: { src: string; w: number; h: number } | null,
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Logo centralizado no topo
  if (logo) {
    const maxW = 110;
    const maxH = 60;
    const ratio = logo.w / logo.h;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    try {
      doc.addImage(logo.src, "PNG", (W - w) / 2, 14, w, h, undefined, "FAST");
    } catch {
      /* ignore */
    }
  } else {
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("LUMINART", W / 2, 36, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, MUTED);
    doc.text("CENOGRAFIA PARA EVENTOS", W / 2, 42, { align: "center" });
  }

  // Linha dourada
  setDraw(doc, GOLD);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 70, 66, W / 2 + 70, 66);

  // Subtítulo
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Seu Sonho, Nosso Projeto", W / 2, 76, { align: "center" });

  // ORC
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, GOLD);
  const orc = `ORC-${p.numero}`;
  doc.text(orc, W / 2, 84, { align: "center" });
  setDraw(doc, GOLD);
  doc.setLineWidth(0.2);
  const orcWidth = doc.getTextWidth(orc);
  doc.line(W / 2 - orcWidth / 2 - 14, 83, W / 2 - orcWidth / 2 - 4, 83);
  doc.line(W / 2 + orcWidth / 2 + 4, 83, W / 2 + orcWidth / 2 + 14, 83);

  // Bloco de campos centralizado
  const fields: [string, string][] = [
    ...((p.evento.nome || "").trim() ? ([["Nome do Evento:", p.evento.nome]] as [string, string][]) : []),
    ["Cliente:", p.cliente.nome || "—"],
    ["Local do Evento:", p.evento.local || "—"],
    ["Período:", fmtPeriodo(p.evento.dataInicio, p.evento.dataFim)],
    ["Data do Orçamento:", fmtDate(p.createdAt.slice(0, 10))],
    ["Consultor Responsável:", p.responsavel || "—"],
  ];

  doc.setFontSize(11);
  // medir largura máxima
  doc.setFont("helvetica", "normal");
  const labelW = Math.max(...fields.map(([l]) => doc.getTextWidth(l)));
  doc.setFont("helvetica", "bold");
  const valueW = Math.max(...fields.map(([, v]) => doc.getTextWidth(v)));
  const gap = 8;
  const totalW = labelW + gap + Math.max(valueW, 60);
  const startX = (W - totalW) / 2;
  const labelX = startX + labelW; // labels alinhados à direita
  const valueX = startX + labelW + gap;
  const colSepX = valueX - gap / 2;

  let y = 100;
  const lineH = 9;
  // linha vertical sutil entre label e valor
  setDraw(doc, GOLD);
  doc.setLineWidth(0.2);
  doc.line(colSepX, y - 5, colSepX, y + lineH * (fields.length - 1) + 2);

  for (const [label, value] of fields) {
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(label, labelX, y, { align: "right" });
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.text(value, valueX, y);
    y += lineH;
  }

  // Ondas decorativas
  drawCoverWaves(doc, W, H);
}

function drawAmbienteHeader(doc: jsPDF, nome: string) {
  const W = doc.internal.pageSize.getWidth();
  setFill(doc, INK);
  doc.rect(0, 0, W, 16, "F");
  setText(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text((nome || "AMBIENTE").toUpperCase(), 14, 10.5);
}

function drawAmbienteFooter(doc: jsPDF, subtotal: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  setFill(doc, INK);
  doc.rect(0, H - 16, W, 16, "F");
  setText(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total ambiente:  ${brl(subtotal)}`, W / 2, H - 5.5, { align: "center" });
}

function drawColumnHeaders(doc: jsPDF, leftX: number, leftW: number, rightX: number, rightW: number, y: number) {
  setFill(doc, SOFT);
  doc.rect(leftX, y, leftW, 8, "F");
  doc.rect(rightX, y, rightW, 8, "F");
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Imagem", leftX + leftW / 2, y + 5.5, { align: "center" });
  doc.text("Descrição / Componentes", rightX + rightW / 2, y + 5.5, { align: "center" });
}

async function drawAmbientePage(
  doc: jsPDF,
  amb: Ambiente,
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  drawAmbienteHeader(doc, amb.nome);

  const margin = 12;
  const headerY = 22;
  const leftX = margin;
  const leftW = (W - margin * 2) * 0.4;
  const rightX = leftX + leftW + 6;
  const rightW = W - margin - rightX;
  drawColumnHeaders(doc, leftX, leftW, rightX, rightW, headerY);

  const contentTop = headerY + 12;
  const contentBottom = H - 22;

  // Imagem à esquerda
  const firstImg = amb.imagens?.[0];
  if (firstImg) {
    const loaded = await loadImage(firstImg);
    if (loaded) {
      const maxW = leftW;
      const maxH = contentBottom - contentTop;
      const ratio = loaded.w / loaded.h;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      try {
        doc.addImage(
          loaded.src,
          "PNG",
          leftX + (leftW - w) / 2,
          contentTop + ((contentBottom - contentTop) - h) / 2,
          w,
          h,
          undefined,
          "FAST",
        );
      } catch {
        /* ignore */
      }
    }
  } else {
    setDraw(doc, GREY);
    doc.setLineWidth(0.2);
    doc.rect(leftX, contentTop, leftW, 80);
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Sem imagem", leftX + leftW / 2, contentTop + 42, { align: "center" });
  }

  // Itens à direita
  let ry = contentTop;
  for (const it of amb.itens) {
    // page break se precisar
    if (ry > contentBottom - 14) {
      drawAmbienteFooter(doc, ambienteSubtotal(amb));
      doc.addPage();
      drawAmbienteHeader(doc, amb.nome);
      drawColumnHeaders(doc, leftX, leftW, rightX, rightW, headerY);
      ry = contentTop;
    }

    // Item em caixa alta negrito
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const nameLines = doc.splitTextToSize((it.nome || "ITEM").toUpperCase(), rightW);
    doc.text(nameLines, rightX, ry);
    ry += nameLines.length * 5 + 1;

    // Descrições em itálico
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(doc, INK);
    for (const d of it.descricoes) {
      const line = descricaoLinha(d);
      const wrapped = doc.splitTextToSize(line, rightW - 2);
      if (ry + wrapped.length * 4.4 > contentBottom - 6) {
        drawAmbienteFooter(doc, ambienteSubtotal(amb));
        doc.addPage();
        drawAmbienteHeader(doc, amb.nome);
        drawColumnHeaders(doc, leftX, leftW, rightX, rightW, headerY);
        ry = contentTop;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
      }
      doc.text(wrapped, rightX + 2, ry);
      ry += wrapped.length * 4.4 + 0.8;
    }
    doc.setFont("helvetica", "normal");
    ry += 3;
  }

  drawAmbienteFooter(doc, ambienteSubtotal(amb));
}

function drawInvestimentoPage(doc: jsPDF, p: Proposta) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // título
  setDraw(doc, GOLD);
  doc.setLineWidth(0.4);
  const titleY = 28;
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titleText = "INVESTIMENTO";
  doc.text(titleText, W / 2, titleY, { align: "center" });
  const tw = doc.getTextWidth(titleText);
  doc.line(W / 2 - tw / 2 - 20, titleY - 1.5, W / 2 - tw / 2 - 4, titleY - 1.5);
  doc.line(W / 2 + tw / 2 + 4, titleY - 1.5, W / 2 + tw / 2 + 20, titleY - 1.5);

  // tabela centralizada
  const rows: [string, number][] = [];
  for (const a of p.ambientes || []) {
    rows.push([a.nome || "Ambiente", ambienteSubtotal(a)]);
  }
  if (p.custos.frete) rows.push(["Frete", p.custos.frete]);
  if (p.custos.montagem) rows.push(["Montagem", p.custos.montagem]);
  if (p.custos.desmontagem) rows.push(["Desmontagem", p.custos.desmontagem]);
  for (const o of p.custos.outros || []) {
    if (o.valor) rows.push([o.descricao || "Outro", o.valor]);
  }

  const tableW = 150;
  const tableX = (W - tableW) / 2;
  const labelX = tableX + 6;
  const valueX = tableX + tableW - 6;
  let ry = titleY + 18;
  const rowH = 9;

  doc.setFontSize(11);
  for (const [label, val] of rows) {
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    const maxLabelW = (valueX - labelX) - 20;
    const labelLines = doc.splitTextToSize(label, maxLabelW);
    doc.text(labelLines, labelX, ry);
    doc.setFont("helvetica", "normal");
    doc.text(brl(val), valueX, ry, { align: "right" });
    setDraw(doc, SOFT);
    doc.setLineWidth(0.2);
    const usedH = Math.max(rowH, labelLines.length * 5 + 2);
    doc.line(tableX, ry + usedH - 6.5, tableX + tableW, ry + usedH - 6.5);
    ry += usedH;
  }

  // Total Geral — faixa dourada com sombra
  ry += 6;
  // sombra
  setFill(doc, GREY);
  doc.rect(tableX + 2, ry + 2, tableW, 14, "F");
  // faixa
  setFill(doc, GOLD);
  doc.rect(tableX, ry, tableW, 14, "F");
  setText(doc, INK);
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(13);
  doc.text("Total Geral:", labelX, ry + 9);
  doc.setFont("helvetica", "bold");
  doc.text(brl(propostaTotal(p)), valueX, ry + 9, { align: "right" });

  // rodapé fixo
  const footerY = H - 38;
  setText(doc, MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Av. Maestro Lisboa, 2181 - Lagoa Redonda - Fortaleza CE", W / 2, footerY, {
    align: "center",
  });
  doc.text("(85) 9 9997-1804 / (85) 9 9933-1605", W / 2, footerY + 5, { align: "center" });
  doc.text("comercial@luminarteventos.com.br", W / 2, footerY + 10, { align: "center" });

  // tagline entre linhas douradas
  setDraw(doc, GOLD);
  doc.setLineWidth(0.3);
  const taglineY = H - 16;
  const tagline = "Detalhes que transformam eventos em experiências.";
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  setText(doc, MUTED);
  const tlW = doc.getTextWidth(tagline);
  doc.text(tagline, W / 2, taglineY, { align: "center" });
  doc.line(W / 2 - tlW / 2 - 20, taglineY - 1.5, W / 2 - tlW / 2 - 6, taglineY - 1.5);
  doc.line(W / 2 + tlW / 2 + 6, taglineY - 1.5, W / 2 + tlW / 2 + 20, taglineY - 1.5);

  // validade discreta no topo direito
  if (p.resumo.validade) {
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Validade: ${fmtDate(p.resumo.validade)}`, W - 12, 14, { align: "right" });
  }
}

// ─────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────
export async function gerarPropostaPDF(p: Proposta) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  doc.setFont("helvetica");

  const logo = await loadImage(logoUrl as unknown as string);

  // Capa
  await drawCover(doc, p, logo);

  // Páginas de ambientes
  for (const amb of p.ambientes || []) {
    doc.addPage();
    await drawAmbientePage(doc, amb);
  }

  // Investimento
  doc.addPage();
  drawInvestimentoPage(doc, p);

  // Compatibilidade caso alguém ainda use propostaCustos
  void propostaCustos;

  doc.save(`Proposta-${p.numero}.pdf`);
}
