import jsPDF from "jspdf";
import timbrado from "@/assets/timbrado-luminart.png.asset.json";
import { ehTituloSecao, rotuloClausula } from "./modelo-render";

export type BlocoContrato = {
  texto: string;
  /** titulo = seção numerada/caixa alta; clausula = "Cláusula 1ª." com rótulo em negrito. */
  tipo: "titulo" | "clausula" | "paragrafo" | "lista";
  /** Trecho inicial em negrito (rótulo da cláusula). */
  rotulo?: string;
  /** Nível de recuo (listas). */
  nivel?: number;
};

/** Converte o HTML do contrato em blocos de texto simples preservando parágrafos e listas. */
export function htmlParaBlocos(html: string): BlocoContrato[] {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  const blocos: BlocoContrato[] = [];

  /**
   * Texto de um elemento preservando as quebras `<br>` como "\n" e
   * garantindo separação entre elementos inline vizinhos sem espaço.
   */
  const textoDe = (el: Node): string => {
    let out = "";
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue ?? "";
        return;
      }
      const e = child as HTMLElement;
      const tag = e.tagName?.toLowerCase();
      if (tag === "br") {
        out += "\n";
        return;
      }
      const interno = textoDe(e);
      if (!interno) return;
      // Evita "Freitasinscrito" quando não há espaço entre os elementos.
      if (out && !/[\s(\[{«"'\/-]$/.test(out) && !/^[\s.,;:!?)\]}%»"']/.test(interno)) out += " ";
      out += interno;
    });
    return out;
  };

  const push = (texto: string, tipo: BlocoContrato["tipo"], nivel = 0) => {
    texto
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .forEach((linha, i) => {
        const t = tipo === "titulo" && i > 0 ? "paragrafo" : tipo;
        const rotulo = t === "clausula" ? (rotuloClausula(linha) ?? undefined) : undefined;
        blocos.push({ texto: linha, tipo: t, rotulo, nivel });
      });
  };

  const pushParagrafo = (el: HTMLElement, nivel = 0) => {
    const texto = textoDe(el);
    const primeira = texto.split("\n").find((l) => l.trim()) ?? "";
    const forte = el.querySelector("strong, b");
    const jaNegrito =
      !!forte && (el.textContent ?? "").trim() === (forte.textContent ?? "").trim();
    if (ehTituloSecao(primeira, jaNegrito)) return push(texto, "titulo", nivel);
    if (rotuloClausula(primeira)) return push(texto, "clausula", nivel);
    push(texto, nivel > 0 ? "lista" : "paragrafo", nivel);
  };

  const walk = (node: Node, nivel = 0) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      if (!tag) return;
      if (["h1", "h2", "h3"].includes(tag)) return push(textoDe(el), "titulo", nivel);
      if (tag === "p" || tag === "blockquote") return pushParagrafo(el, nivel);
      if (tag === "li") return push(textoDe(el), "lista", Math.max(1, nivel));
      if (["ul", "ol"].includes(tag)) return walk(el, nivel + 1);
      if (["div", "table", "tbody", "thead", "tr"].includes(tag)) return walk(el, nivel);
      if (tag === "td" || tag === "th") return push(textoDe(el), "paragrafo", nivel);
      pushParagrafo(el, nivel);
    });
  };

  walk(doc.body);
  if (blocos.length === 0) push(textoDe(doc.body), "paragrafo");
  return blocos;
}

/** Espaçamento e tipografia padrão do contrato (mm / pt), espelhando o modelo em Word. */
const TAMANHO_CORPO = 10.5; // ≈ Calibri 11
const TAMANHO_TITULO = 11;
const ALTURA_LINHA = 4.7; // entrelinha ~1,15
const ALTURA_LINHA_TITULO = 5.2;
const ESPACO_ANTES_TITULO = 4.2; // 12 pt
const ESPACO_DEPOIS_TITULO = 2.1; // 6 pt
const ESPACO_PARAGRAFO = 2.1; // 6 pt
const RECUO_LISTA = 8; // recuo à esquerda dos itens a) b) c)


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
  nomeBase?: string,
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

  const blocos = htmlParaBlocos(html);
  blocos.forEach((bloco, i) => {
    doc.setFont("helvetica", bloco.negrito ? "bold" : "normal");
    doc.setFontSize(bloco.titulo ? 11 : 10);
    const linhas = doc.splitTextToSize(bloco.texto, largura);
    const alturaLinha = bloco.titulo ? ALTURA_LINHA_TITULO : ALTURA_LINHA;

    if (bloco.titulo && y > topoConteudo) y += ESPACO_ANTES_TITULO;

    // Um cabeçalho nunca fica sozinho no fim da página.
    const alturaMinima = bloco.titulo
      ? linhas.length * alturaLinha + ESPACO_DEPOIS_TITULO + ALTURA_LINHA
      : alturaLinha;
    quebra(alturaMinima);

    linhas.forEach((linha: string, idx: number) => {
      if (!(bloco.titulo && idx === 0)) quebra(alturaLinha);
      doc.text(linha, margem, y, { align: "justify", maxWidth: largura });
      y += alturaLinha;
    });

    const proximo = blocos[i + 1];
    y += bloco.titulo
      ? ESPACO_DEPOIS_TITULO
      : proximo?.titulo
        ? 0
        : ESPACO_PARAGRAFO;
  });

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
  const nomeArquivo = `${((nomeBase || titulo || "contrato") as string)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)}.pdf`;
  return { base64, nomeArquivo };
}
