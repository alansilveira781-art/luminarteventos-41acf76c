import jsPDF from "jspdf";
import timbrado from "@/assets/timbrado-luminart.png.asset.json";
import { ehTituloSecao, rotuloClausula } from "./modelo-render";

/** Palavra do contrato com o negrito herdado do HTML. */
export type Palavra = { txt: string; bold: boolean; colar?: boolean };

export type BlocoContrato = {
  texto: string;
  /** Palavras já com o negrito real vindo do HTML. */
  palavras: Palavra[];
  /** titulo = seção numerada/caixa alta; clausula = "Cláusula 1ª." com rótulo em negrito. */
  tipo: "titulo" | "clausula" | "paragrafo" | "lista";
  /** Trecho inicial em negrito (rótulo da cláusula). */
  rotulo?: string;
  /** Nível de recuo (listas). */
  nivel?: number;
  /** Recuo digitado no modelo (em caracteres de espaço). */
  recuoChars?: number;

};

type Trecho = { txt: string; bold: boolean };

const EH_NEGRITO = /font-weight\s*:\s*(bold(er)?|[6-9]00)/i;

/** Converte o HTML do contrato em blocos preservando parágrafos, listas e negrito. */
export function htmlParaBlocos(html: string): BlocoContrato[] {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  const blocos: BlocoContrato[] = [];

  /** Trechos de um elemento, mantendo `<br>` como "\n" e o negrito herdado. */
  const trechosDe = (el: Node, bold = false): Trecho[] => {
    const out: Trecho[] = [];
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const v = child.nodeValue ?? "";
        if (v) out.push({ txt: v, bold });
        return;
      }
      const e = child as HTMLElement;
      const tag = e.tagName?.toLowerCase();
      if (!tag) return;
      if (tag === "br") {
        out.push({ txt: "\n", bold });
        return;
      }
      const negrito =
        bold ||
        tag === "strong" ||
        tag === "b" ||
        ["h1", "h2", "h3"].includes(tag) ||
        EH_NEGRITO.test(e.getAttribute("style") ?? "");
      const filhos = trechosDe(e, negrito);
      if (!filhos.length) return;
      const anterior = out.map((t) => t.txt).join("");
      const inicio = filhos.map((t) => t.txt).join("");
      // Evita "Freitasinscrito" quando não há espaço entre os elementos.
      if (
        anterior &&
        !/[\s(\[{«"'/-]$/.test(anterior) &&
        !/^[\s.,;:!?)\]}%»"']/.test(inicio)
      ) {

        out.push({ txt: " ", bold });
      }
      out.push(...filhos);
    });
    return out;
  };

  /** Divide os trechos em linhas (por "\n") e cada linha em palavras com negrito. */
  type Linha = { palavras: Palavra[]; recuo: number };
  const linhasDe = (trechos: Trecho[]): Linha[] => {
    const linhas: Linha[] = [];
    let atual: Palavra[] = [];
    let recuo = 0;
    let cur: Palavra | null = null;
    let colar = false;
    const fechar = () => {
      if (atual.length) linhas.push({ palavras: atual, recuo });
      atual = [];
      recuo = 0;
      cur = null;
      colar = false;
    };
    for (const t of trechos) {
      const partes = t.txt.split(/(\s+)/);
      for (const p of partes) {
        if (!p) continue;
        if (p === "\n" || /\n/.test(p)) {
          fechar();
          continue;
        }
        if (/^\s+$/.test(p)) {
          // Espaços/nbsp no início da linha viram recuo do bloco.
          if (!atual.length) recuo += p.length;
          cur = null;
          colar = false;
          continue;
        }
        if (cur && cur.bold === t.bold) {
          cur.txt += p;
        } else {
          cur = { txt: p, bold: t.bold, colar: colar || undefined };
          atual.push(cur);
        }
        colar = true;
      }
    }
    fechar();
    return linhas;
  };

  const textoDaLinha = (linha: Palavra[]) =>
    linha.reduce((acc, p, i) => acc + (i > 0 && !p.colar ? " " : "") + p.txt, "").trim();

  const push = (trechos: Trecho[], tipo: BlocoContrato["tipo"], nivel = 0) => {
    linhasDe(trechos).forEach((linha, i) => {
      const texto = textoDaLinha(linha.palavras);
      if (!texto) return;
      const t = tipo === "titulo" && i > 0 ? "paragrafo" : tipo;
      const rotulo = t === "clausula" ? (rotuloClausula(texto) ?? undefined) : undefined;
      blocos.push({ texto, palavras: linha.palavras, tipo: t, rotulo, nivel, recuoChars: linha.recuo || undefined });
    });
  };


  const pushParagrafo = (el: HTMLElement, nivel = 0) => {
    const trechos = trechosDe(el);
    const primeira = textoDaLinha(linhasDe(trechos)[0]?.palavras ?? []);
    const forte = el.querySelector("strong, b");
    const jaNegrito =
      !!forte && (el.textContent ?? "").trim() === (forte.textContent ?? "").trim();
    if (ehTituloSecao(primeira, jaNegrito)) return push(trechos, "titulo", nivel);
    if (rotuloClausula(primeira)) return push(trechos, "clausula", nivel);
    push(trechos, nivel > 0 ? "lista" : "paragrafo", nivel);
  };

  const walk = (node: Node, nivel = 0) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      if (!tag) return;
      if (["h1", "h2", "h3"].includes(tag)) return push(trechosDe(el), "titulo", nivel);
      if (tag === "p" || tag === "blockquote") return pushParagrafo(el, nivel);
      if (tag === "li") return push(trechosDe(el), "lista", Math.max(1, nivel));
      if (["ul", "ol"].includes(tag)) return walk(el, nivel + 1);
      if (["div", "table", "tbody", "thead", "tr"].includes(tag)) return walk(el, nivel);
      if (tag === "td" || tag === "th") return push(trechosDe(el), "paragrafo", nivel);
      // Wrappers inline (span/font/strong…) que envolvem blocos: descer nos filhos.
      if (el.querySelector("p, div, ul, ol, li, table, h1, h2, h3")) return walk(el, nivel);
      pushParagrafo(el, nivel);
    });
  };

  walk(doc.body);
  if (blocos.length === 0) push(trechosDe(doc.body), "paragrafo");
  return blocos;
}

/** Espaçamento e tipografia padrão do contrato (mm / pt), espelhando o modelo em Word. */
const TAMANHO_CORPO = 10.5; // ≈ Calibri 11
const TAMANHO_TITULO = 11;
const ALTURA_LINHA = 4.35; // entrelinha 1,15
const ALTURA_LINHA_TITULO = 4.8;
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

  const larguraDe = (p: Palavra) => {
    doc.setFont("helvetica", p.bold ? "bold" : "normal");
    return doc.getTextWidth(p.txt);
  };
  const larguraEspaco = () => {
    doc.setFont("helvetica", "normal");
    return doc.getTextWidth(" ");
  };

  /** Quebra os tokens em linhas respeitando a largura disponível. */
  const quebrarLinhas = (palavras: Palavra[], larguraDisp: number): Palavra[][] => {
    const linhas: Palavra[][] = [];
    let atual: Palavra[] = [];
    let usado = 0;
    palavras.forEach((p) => {
      const w = larguraDe(p);
      const comEspaco = atual.length > 0 && !p.colar;
      const extra = comEspaco ? larguraEspaco() + w : w;
      if (atual.length && !p.colar && usado + extra > larguraDisp) {
        linhas.push(atual);
        atual = [{ ...p, colar: undefined }];
        usado = w;
      } else {
        atual.push(p);
        usado += extra;
      }
    });
    if (atual.length) linhas.push(atual);
    return linhas;
  };

  /** Escreve uma linha justificada (a última linha do parágrafo fica alinhada à esquerda). */
  const escreverLinha = (
    linha: Palavra[],
    x: number,
    larguraDisp: number,
    justificar: boolean,
  ) => {
    const espacoBase = larguraEspaco();
    const larguraTexto = linha.reduce((acc, p) => acc + larguraDe(p), 0);
    const vaos = linha.reduce((acc, p, i) => acc + (i > 0 && !p.colar ? 1 : 0), 0);
    let espaco = espacoBase;
    if (justificar && vaos > 0) {
      const calc = (larguraDisp - larguraTexto) / vaos;
      // Evita linhas com espaçamento exagerado (palavras muito longas).
      espaco = calc > espacoBase * 3 || calc < espacoBase ? espacoBase : calc;
    }
    let cursor = x;
    linha.forEach((p, i) => {
      if (i > 0 && !p.colar) cursor += espaco;
      doc.setFont("helvetica", p.bold ? "bold" : "normal");
      doc.text(p.txt, cursor, y);
      cursor += doc.getTextWidth(p.txt);
    });
  };

  /** Palavras do bloco, com o negrito do HTML + o realce do tipo (título / rótulo). */
  const tokens = (bloco: BlocoContrato): Palavra[] => {
    const base = bloco.palavras.length
      ? bloco.palavras
      : bloco.texto.split(/\s+/).filter(Boolean).map((txt) => ({ txt, bold: false }));

    if (bloco.tipo === "titulo") return base.map((p) => ({ ...p, bold: true }));

    const rotulo = bloco.tipo === "clausula" ? bloco.rotulo : undefined;
    if (!rotulo) return base;

    // Negrita o rótulo inicial ("Cláusula 1ª.") mantendo o resto como está.
    let restante = rotulo.replace(/\s+/g, "").length;
    return base.map((p) => {
      if (restante <= 0) return p;
      restante -= p.txt.replace(/\s+/g, "").length;
      return { ...p, bold: true };
    });
  };


  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const tituloLinhas = doc.splitTextToSize(titulo || "Contrato", largura);
  doc.text(tituloLinhas, margem, y);
  y += tituloLinhas.length * 6 + 4;

  const blocos = htmlParaBlocos(html);
  blocos.forEach((bloco, i) => {
    const ehTitulo = bloco.tipo === "titulo";
    doc.setFontSize(ehTitulo ? TAMANHO_TITULO : TAMANHO_CORPO);
    const recuoDigitado = (bloco.recuoChars ?? 0) > 0 ? (bloco.recuoChars ?? 0) * larguraEspaco() : 0;
    const recuo =
      recuoDigitado || (bloco.tipo === "lista" ? RECUO_LISTA * Math.max(1, bloco.nivel ?? 1) : 0);
    const x = margem + recuo;
    const larguraDisp = largura - recuo;
    const alturaLinha = ehTitulo ? ALTURA_LINHA_TITULO : ALTURA_LINHA;
    const linhas = quebrarLinhas(tokens(bloco), larguraDisp);

    if (ehTitulo && y > topoConteudo) y += ESPACO_ANTES_TITULO;

    // Um título nunca fica sozinho no fim da página.
    const alturaMinima = ehTitulo
      ? linhas.length * alturaLinha + ESPACO_DEPOIS_TITULO + ALTURA_LINHA
      : alturaLinha;
    quebra(alturaMinima);

    linhas.forEach((linha, idx) => {
      if (!(ehTitulo && idx === 0)) quebra(alturaLinha);
      const justificar = !ehTitulo && !recuoDigitado && idx < linhas.length - 1;
      escreverLinha(linha, x, larguraDisp, justificar);
      y += alturaLinha;
    });


    const proximo = blocos[i + 1];
    const seguidasRecuadas = !!bloco.recuoChars && !!proximo?.recuoChars;
    y += ehTitulo
      ? ESPACO_DEPOIS_TITULO
      : proximo?.tipo === "titulo"
        ? 0
        : seguidasRecuadas || (proximo?.tipo === "lista" && bloco.tipo === "lista")
          ? ESPACO_PARAGRAFO / 2
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
