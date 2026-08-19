import jsPDF from "jspdf";

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

/** Gera o PDF A4 do contrato a partir do HTML e devolve o conteúdo em base64 (sem prefixo). */
export function gerarContratoPdfBase64(titulo: string, html: string): { base64: string; nomeArquivo: string } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 20;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const alturaPagina = doc.internal.pageSize.getHeight();
  let y = margem;

  const quebra = (altura: number) => {
    if (y + altura > alturaPagina - margem) {
      doc.addPage();
      y = margem;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const tituloLinhas = doc.splitTextToSize(titulo || "Contrato", largura);
  quebra(tituloLinhas.length * 6);
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

  const dataUri = doc.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const nomeArquivo = `${(titulo || "contrato").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 60)}.pdf`;
  return { base64, nomeArquivo };
}
