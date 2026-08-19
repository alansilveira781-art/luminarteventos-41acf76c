import jsPDF from "jspdf";
import timbrado from "@/assets/timbrado-luminart.png.asset.json";

/** Converte o HTML do contrato em blocos de texto simples preservando parágrafos e listas. */
export function htmlParaBlocos(html: string): { texto: string; negrito: boolean; titulo: boolean }[] {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  const blocos: { texto: string; negrito: boolean; titulo: boolean }[] = [];

  const push = (texto: string, negrito = false, titulo = false) => {
    const t = texto.replace(/\s+/g, " ").trim();
    if (t) blocos.push({ texto: t, negrito, titulo });
  };

  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      if (!tag) return;
      if (["h1", "h2", "h3"].includes(tag)) return push(el.textContent ?? "", true, true);
      if (tag === "p" || tag === "blockquote") return push(el.textContent ?? "");
      if (tag === "li") return push(`• ${el.textContent ?? ""}`);
      if (["ul", "ol", "div", "table", "tbody", "thead", "tr"].includes(tag)) return walk(el);
      if (tag === "td" || tag === "th") return push(el.textContent ?? "");
      push(el.textContent ?? "");
    });
  };

  walk(doc.body);
  if (blocos.length === 0) push(doc.body.textContent ?? "");
  return blocos;
}

const RODAPE_LINHAS = [
  "Av. Maestro Lisboa, 2181 — Lagoa Redonda — Fortaleza / CE — CEP 60810-670",
  "Fone: (85) 9.9933-1605 • contato@luminarteventos.com.br",
];

/** Logo do papel timbrado convertida em dataURL (cacheada por sessão). */
let logoCache: string | null = null;
async function carregarLogo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(timbrado.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    return logoCache;
  } catch {
    return null;
  }
}

/**
 * Gera o PDF A4 do contrato em papel timbrado da Luminart
 * e devolve o conteúdo em base64 (sem prefixo).
 */
export async function gerarContratoPdfBase64(
  titulo: string,
  html: string,
): Promise<{ base64: string; nomeArquivo: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 20;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const topoConteudo = 42; // abaixo do cabeçalho timbrado
  const limiteInferior = alturaPagina - 26; // acima do rodapé
  let y = topoConteudo;

  const logo = await carregarLogo();

  const quebra = (altura: number) => {
    if (y + altura > limiteInferior) {
      doc.addPage();
      y = topoConteudo;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const tituloLinhas = doc.splitTextToSize(titulo || "Contrato", largura);
  doc.text(tituloLinhas, margem, y);
  y += tituloLinhas.length * 6 + 4;

  for (const bloco of htmlParaBlocos(html)) {
    doc.setFont("helvetica", bloco.negrito ? "bold" : "normal");
    doc.setFontSize(bloco.titulo ? 11 : 10);
    const linhas = doc.splitTextToSize(bloco.texto, largura);
    const alturaLinha = bloco.titulo ? 6 : 5;
    for (const linha of linhas) {
      quebra(alturaLinha);
      doc.text(linha, margem, y, { align: "justify", maxWidth: largura });
      y += alturaLinha;
    }
    y += bloco.titulo ? 3 : 2;
  }

  // Cabeçalho e rodapé do papel timbrado em todas as páginas.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (logo) {
      const w = 57;
      const h = w * (569 / 1352);
      doc.addImage(logo, "PNG", (larguraPagina - w) / 2, 12, w, h, undefined, "FAST");
    }
    doc.setDrawColor(210);
    doc.setLineWidth(0.3);
    doc.line(margem, alturaPagina - 22, larguraPagina - margem, alturaPagina - 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(RODAPE_LINHAS[0], larguraPagina / 2, alturaPagina - 17, { align: "center" });
    doc.text(RODAPE_LINHAS[1], larguraPagina / 2, alturaPagina - 13, { align: "center" });
    doc.text(`Página ${p} de ${total}`, larguraPagina - margem, alturaPagina - 9, { align: "right" });
    doc.setTextColor(0);
  }

  const dataUri = doc.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const nomeArquivo = `${(titulo || "contrato").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 60)}.pdf`;
  return { base64, nomeArquivo };
}
