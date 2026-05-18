import jsPDF from "jspdf";
import type { Proposta, DescricaoItem } from "./types";
import {
  ambienteSubtotal,
  itemSubtotal,
  descricaoSubtotal,
  descricaoMedidaLabel,
  propostaSubtotalAmbientes,
  propostaCustos,
  propostaTotal,
} from "./types";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
};
const fmtPeriodo = (ini: string, fim: string) => {
  if (!ini && !fim) return "—";
  if (!fim || ini === fim) return fmtDate(ini);
  return `${fmtDate(ini)} – ${fmtDate(fim)}`;
};

// Paleta clean
const INK = [30, 30, 35] as const;
const MUTED = [120, 120, 130] as const;
const LINE = [220, 220, 225] as const;
const ACCENT = [40, 40, 60] as const;

function setColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function pageFooter(doc: jsPDF, numero: number, pageIdx: number, pageTotal: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  setDraw(doc, LINE);
  doc.line(20, H - 18, W - 20, H - 18);
  doc.setFontSize(8);
  setColor(doc, MUTED);
  doc.text(`Proposta #${numero}`, 20, H - 10);
  doc.text(`Página ${pageIdx} de ${pageTotal}`, W - 20, H - 10, { align: "right" });
}

function pageHeader(doc: jsPDF, p: Proposta) {
  const W = doc.internal.pageSize.getWidth();
  setColor(doc, INK);
  doc.setFontSize(10);
  doc.setFont(undefined as any, "bold");
  doc.text("LUMINART", 20, 18);
  doc.setFont(undefined as any, "normal");
  doc.setFontSize(8);
  setColor(doc, MUTED);
  doc.text("Cenografia para eventos", 20, 23);

  doc.setFontSize(8);
  doc.text(`Proposta nº ${p.numero}`, W - 20, 18, { align: "right" });
  doc.text(`Emitida ${fmtDate(p.createdAt.slice(0, 10))}`, W - 20, 23, { align: "right" });

  setDraw(doc, LINE);
  doc.line(20, 28, W - 20, 28);
}

// Carrega imagem em data URL e mede dimensões originais
async function loadImage(src: string): Promise<{ src: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function detectFmt(src: string): "JPEG" | "PNG" {
  return src.startsWith("data:image/png") ? "PNG" : "JPEG";
}

function descricaoLinha(d: DescricaoItem): string {
  const medida = descricaoMedidaLabel(d);
  const unitSuffix =
    d.tipoMedida === "area" ? "/m²" : d.tipoMedida === "linear" ? "/m" : "";
  const unit = `${brl(d.valorUnitario)}${unitSuffix}`;
  const total = brl(descricaoSubtotal(d));
  const desc = d.descricao || "—";
  return `${desc}  ·  ${medida}  ·  ${unit}  =  ${total}`;
}

export async function gerarPropostaPDF(p: Proposta) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica");

  // ===== Capa =====
  pageHeader(doc, p);
  let y = 50;

  setColor(doc, INK);
  doc.setFontSize(22);
  doc.setFont(undefined as any, "bold");
  doc.text("Proposta Comercial", 20, y);
  doc.setFont(undefined as any, "normal");

  y += 6;
  setColor(doc, MUTED);
  doc.setFontSize(10);
  doc.text(p.evento.tipo ? `Evento: ${p.evento.tipo}` : "Evento", 20, y);

  // Bloco Cliente
  y += 18;
  setColor(doc, INK);
  doc.setFontSize(11);
  doc.setFont(undefined as any, "bold");
  doc.text("CLIENTE", 20, y);
  doc.setFont(undefined as any, "normal");
  setDraw(doc, LINE);
  doc.line(20, y + 2, W - 20, y + 2);
  y += 10;
  doc.setFontSize(10);
  doc.text(p.cliente.nome || "—", 20, y); y += 5;
  setColor(doc, MUTED);
  if (p.cliente.telefone) { doc.text(`Telefone: ${p.cliente.telefone}`, 20, y); y += 5; }
  if (p.cliente.email) { doc.text(`Email: ${p.cliente.email}`, 20, y); y += 5; }

  // Bloco Evento
  y += 8;
  setColor(doc, INK);
  doc.setFontSize(11);
  doc.setFont(undefined as any, "bold");
  doc.text("EVENTO", 20, y);
  doc.setFont(undefined as any, "normal");
  setDraw(doc, LINE);
  doc.line(20, y + 2, W - 20, y + 2);
  y += 10;
  doc.setFontSize(10);
  setColor(doc, INK);
  doc.text(`Tipo:`, 20, y);
  setColor(doc, MUTED);
  doc.text(p.evento.tipo || "—", 50, y);
  setColor(doc, INK);
  doc.text(`Período:`, 110, y);
  setColor(doc, MUTED);
  doc.text(fmtPeriodo(p.evento.dataInicio, p.evento.dataFim), 140, y);
  y += 6;
  setColor(doc, INK);
  doc.text(`Local:`, 20, y);
  setColor(doc, MUTED);
  doc.text(p.evento.local || "—", 50, y);
  setColor(doc, INK);
  doc.text(`Cidade:`, 110, y);
  setColor(doc, MUTED);
  doc.text(p.evento.cidade || "—", 140, y);
  y += 6;
  if (p.evento.observacoes) {
    setColor(doc, INK);
    doc.text("Observações:", 20, y);
    y += 5;
    setColor(doc, MUTED);
    const lines = doc.splitTextToSize(p.evento.observacoes, W - 40);
    doc.text(lines, 20, y);
    y += lines.length * 5;
  }

  // Bloco Atendimento / Validade
  y += 6;
  setColor(doc, INK);
  doc.setFontSize(11);
  doc.setFont(undefined as any, "bold");
  doc.text("ATENDIMENTO", 20, y);
  doc.setFont(undefined as any, "normal");
  setDraw(doc, LINE);
  doc.line(20, y + 2, W - 20, y + 2);
  y += 10;
  doc.setFontSize(10);
  setColor(doc, INK);
  doc.text("Consultor(a):", 20, y);
  setColor(doc, MUTED);
  doc.text(p.responsavel || "—", 50, y);
  setColor(doc, INK);
  doc.text("Validade:", 110, y);
  setColor(doc, MUTED);
  doc.text(fmtDate(p.resumo.validade), 140, y);

  // Footer da capa (a numeração definitiva é setada no final)
  // ===== Páginas de ambientes =====
  for (const amb of p.ambientes || []) {
    doc.addPage();
    pageHeader(doc, p);

    // Título do ambiente
    let yy = 40;
    setColor(doc, INK);
    doc.setFontSize(16);
    doc.setFont(undefined as any, "bold");
    doc.text(amb.nome || "Ambiente", 20, yy);
    doc.setFont(undefined as any, "normal");
    yy += 6;
    setColor(doc, MUTED);
    doc.setFontSize(9);
    doc.text("Ambiente", 20, yy);

    // Layout duas colunas
    const colLeftX = 20;
    const colLeftW = 80;
    const colRightX = colLeftX + colLeftW + 8;
    const colRightW = W - colRightX - 20;
    const contentTop = 55;
    const contentBottom = H - 30;
    const contentH = contentBottom - contentTop;

    // Imagem à esquerda
    const firstImg = amb.imagens?.[0];
    if (firstImg) {
      const loaded = await loadImage(firstImg);
      if (loaded) {
        const maxW = colLeftW;
        const maxH = contentH;
        const ratio = loaded.w / loaded.h;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) { h = maxH; w = h * ratio; }
        try {
          doc.addImage(loaded.src, detectFmt(loaded.src), colLeftX, contentTop, w, h, undefined, "FAST");
        } catch {
          // fallback silencioso
        }
      }
    } else {
      setDraw(doc, LINE);
      doc.rect(colLeftX, contentTop, colLeftW, 60);
      setColor(doc, MUTED);
      doc.setFontSize(8);
      doc.text("Sem imagem", colLeftX + colLeftW / 2, contentTop + 32, { align: "center" });
    }

    // Itens à direita
    let ry = contentTop;
    doc.setFontSize(10);
    for (const it of amb.itens) {
      // page-break check
      if (ry > contentBottom - 20) {
        doc.addPage();
        pageHeader(doc, p);
        ry = 40;
      }
      // Nome do item em negrito
      setColor(doc, INK);
      doc.setFont(undefined as any, "bold");
      doc.setFontSize(11);
      const itemLines = doc.splitTextToSize(it.nome || "Item", colRightW);
      doc.text(itemLines, colRightX, ry);
      ry += itemLines.length * 5 + 1;

      // Descrições em itálico
      doc.setFont(undefined as any, "italic");
      doc.setFontSize(9);
      setColor(doc, INK);
      for (const d of it.descricoes) {
        const line = descricaoLinha(d);
        const wrapped = doc.splitTextToSize(line, colRightW - 4);
        if (ry + wrapped.length * 4.2 > contentBottom - 10) {
          doc.addPage();
          pageHeader(doc, p);
          ry = 40;
          doc.setFont(undefined as any, "italic");
          doc.setFontSize(9);
        }
        doc.text(wrapped, colRightX + 3, ry);
        ry += wrapped.length * 4.2 + 1;
      }
      doc.setFont(undefined as any, "normal");

      // Subtotal do item
      setColor(doc, MUTED);
      doc.setFontSize(8);
      doc.text(`Subtotal do item: ${brl(itemSubtotal(it))}`, colRightX + colRightW, ry, { align: "right" });
      ry += 6;

      // separador leve
      setDraw(doc, LINE);
      doc.line(colRightX, ry, colRightX + colRightW, ry);
      ry += 4;
    }

    // Subtotal do ambiente
    if (ry > contentBottom - 12) {
      doc.addPage();
      pageHeader(doc, p);
      ry = 40;
    }
    setColor(doc, ACCENT);
    doc.setFont(undefined as any, "bold");
    doc.setFontSize(11);
    doc.text(`Subtotal ${amb.nome || "ambiente"}: ${brl(ambienteSubtotal(amb))}`, colRightX + colRightW, ry + 4, { align: "right" });
    doc.setFont(undefined as any, "normal");
  }

  // ===== Página de resumo financeiro =====
  doc.addPage();
  pageHeader(doc, p);
  let ry = 50;

  setColor(doc, INK);
  doc.setFontSize(18);
  doc.setFont(undefined as any, "bold");
  doc.text("Resumo financeiro", 20, ry);
  doc.setFont(undefined as any, "normal");
  ry += 12;

  const subAmb = propostaSubtotalAmbientes(p);
  const totCustos = propostaCustos(p);
  const totFinal = propostaTotal(p);

  doc.setFontSize(10);

  // Subtotais por ambiente
  setColor(doc, INK);
  doc.setFont(undefined as any, "bold");
  doc.text("Por ambiente", 20, ry);
  doc.setFont(undefined as any, "normal");
  ry += 6;
  setDraw(doc, LINE);
  doc.line(20, ry, W - 20, ry);
  ry += 5;
  for (const a of p.ambientes || []) {
    setColor(doc, INK);
    doc.text(a.nome || "Ambiente", 20, ry);
    doc.text(brl(ambienteSubtotal(a)), W - 20, ry, { align: "right" });
    ry += 5;
  }
  ry += 2;
  doc.line(20, ry, W - 20, ry);
  ry += 5;
  setColor(doc, INK);
  doc.setFont(undefined as any, "bold");
  doc.text("Subtotal ambientes", 20, ry);
  doc.text(brl(subAmb), W - 20, ry, { align: "right" });
  doc.setFont(undefined as any, "normal");
  ry += 10;

  // Custos adicionais
  setColor(doc, INK);
  doc.setFont(undefined as any, "bold");
  doc.text("Custos adicionais", 20, ry);
  doc.setFont(undefined as any, "normal");
  ry += 6;
  doc.line(20, ry, W - 20, ry);
  ry += 5;
  const custosRows: [string, number][] = [
    ["Frete", p.custos.frete],
    ["Montagem", p.custos.montagem],
    ["Desmontagem", p.custos.desmontagem],
    ...(p.custos.outros || []).map((c) => [c.descricao || "Outro", c.valor] as [string, number]),
  ];
  for (const [label, val] of custosRows) {
    setColor(doc, INK);
    doc.text(label, 20, ry);
    doc.text(brl(val || 0), W - 20, ry, { align: "right" });
    ry += 5;
  }
  ry += 2;
  doc.line(20, ry, W - 20, ry);
  ry += 5;
  setColor(doc, INK);
  doc.setFont(undefined as any, "bold");
  doc.text("Total custos", 20, ry);
  doc.text(brl(totCustos), W - 20, ry, { align: "right" });
  doc.setFont(undefined as any, "normal");
  ry += 14;

  // Total final
  setDraw(doc, ACCENT);
  doc.setLineWidth(0.4);
  doc.line(20, ry, W - 20, ry);
  doc.setLineWidth(0.2);
  ry += 8;
  setColor(doc, INK);
  doc.setFont(undefined as any, "bold");
  doc.setFontSize(14);
  doc.text("Total final", 20, ry);
  doc.text(brl(totFinal), W - 20, ry, { align: "right" });
  doc.setFont(undefined as any, "normal");
  ry += 12;

  setColor(doc, MUTED);
  doc.setFontSize(9);
  doc.text(`Validade da proposta: ${fmtDate(p.resumo.validade)}`, 20, ry);

  // ===== Numeração das páginas =====
  const pageTotal = doc.getNumberOfPages();
  for (let i = 1; i <= pageTotal; i++) {
    doc.setPage(i);
    pageFooter(doc, p.numero, i, pageTotal);
  }

  doc.save(`Proposta-${p.numero}.pdf`);
}
