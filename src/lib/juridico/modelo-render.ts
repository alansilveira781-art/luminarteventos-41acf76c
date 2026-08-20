import DOMPurify from "dompurify";
import { fmtData, fmtMoeda, type ParcelaContrato } from "./contrato-form";
import { valorPorExtenso } from "./valor-extenso";

export const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "sup", "sub",
    "h1", "h2", "h3", "ul", "ol", "li",
    "a", "span", "div", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "mark",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

export const sanitizeHtml = (html: string) => DOMPurify.sanitize(html ?? "", SANITIZE_OPTS);

/**
 * Normaliza o HTML vindo do editor / colagem do Word:
 * converte `<b>/<i>` e `font-weight` em `<strong>/<em>`, remove lixo do Word
 * (classes `Mso*`, propriedades `mso-*`, spans vazios) e transforma as quebras
 * de linha soltas dentro do parágrafo em espaço (evita palavras/linhas cortadas).
 */
export function normalizarHtmlEditor(html: string): string {
  if (typeof window === "undefined" || !html) return html ?? "";
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), "text/html");

  const trocarTag = (el: Element, nova: string) => {
    const novo = doc.createElement(nova);
    while (el.firstChild) novo.appendChild(el.firstChild);
    el.replaceWith(novo);
    return novo;
  };

  // <b>/<i> -> <strong>/<em>
  doc.body.querySelectorAll("b").forEach((el) => trocarTag(el, "strong"));
  doc.body.querySelectorAll("i").forEach((el) => trocarTag(el, "em"));

  doc.body.querySelectorAll("[style], [class], [id], [lang]").forEach((el) => {
    const style = el.getAttribute("style") ?? "";
    const negrito = /font-weight\s*:\s*(bold(er)?|[6-9]00)/i.test(style);
    const italico = /font-style\s*:\s*italic/i.test(style);

    // Mantém alinhamento e recuos; o resto do estilo do Word é descartado.
    const manter: string[] = [];
    const align = /text-align\s*:\s*(justify|center|right|left)/i.exec(style)?.[1];
    if (align) manter.push(`text-align:${align.toLowerCase()}`);
    const ml = /margin-left\s*:\s*([\d.]+(px|pt|cm|em|rem))/i.exec(style)?.[1];
    if (ml) manter.push(`margin-left:${ml}`);
    const pl = /padding-left\s*:\s*([\d.]+(px|pt|cm|em|rem))/i.exec(style)?.[1];
    if (pl) manter.push(`padding-left:${pl}`);
    const ti = /text-indent\s*:\s*(-?[\d.]+(px|pt|cm|em|rem))/i.exec(style)?.[1];
    if (ti) manter.push(`text-indent:${ti}`);
    if (manter.length) el.setAttribute("style", manter.join(";"));
    else el.removeAttribute("style");

    const cls = el.getAttribute("class") ?? "";
    if (/mso|^Normal$|WordSection|ListParagraph/i.test(cls)) el.removeAttribute("class");
    el.removeAttribute("lang");
    if (/^docs-internal|^m_/.test(el.getAttribute("id") ?? "")) el.removeAttribute("id");

    if (negrito || italico) {
      const wrapper = doc.createElement(negrito ? "strong" : "em");
      while (el.firstChild) wrapper.appendChild(el.firstChild);
      if (negrito && italico) {
        const em = doc.createElement("em");
        while (wrapper.firstChild) em.appendChild(wrapper.firstChild);
        wrapper.appendChild(em);
      }
      el.appendChild(wrapper);
    }
  });

  // Spans sem atributos úteis viram o próprio conteúdo.
  doc.body.querySelectorAll("span, font").forEach((el) => {
    if (!el.getAttribute("style") && !el.getAttribute("class")) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  });

  // Quebras de linha soltas viram espaço, mas o recuo do início da linha
  // (espaços/tabulação após <br> ou no começo do bloco) é preservado.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textos: Text[] = [];
  while (walker.nextNode()) textos.push(walker.currentNode as Text);
  textos.forEach((t) => {
    const inicioDeLinha =
      !t.previousSibling ||
      (t.previousSibling as HTMLElement).tagName?.toLowerCase() === "br";
    let v = (t.nodeValue ?? "")
      .replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0")
      .replace(/[\r\n]+/g, " ");
    if (inicioDeLinha) {
      v = v.replace(/^[ \u00a0]+/, (m) => "\u00a0".repeat(m.length));
    }
    t.nodeValue = v;
  });

  let out = doc.body.innerHTML
    .replace(/<(p|div)([^>]*)>(\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, "<p></p>")
    .replace(/(<p><\/p>\s*){2,}/gi, "<p></p>")
    .replace(/[ \t]{2,}/g, " ");

  return sanitizeHtml(out);
}



const RE_TITULO_NUM = /^\d+(\.\d+)*[.)-]?\s+\S/;
const RE_ABERTURA_CLAUSULA =
  /^((?:cl[áa]usula|par[áa]grafo)\s+[^.:—-]{0,40}?[.:]|par[áa]grafo\s+[úu]nico\s*[.:]|considerando\s+que\s*:)/i;

/** Rótulo em negrito de uma abertura de cláusula ("Cláusula 1ª.", "Parágrafo Único:"). */
export function rotuloClausula(texto: string): string | null {
  const t = (texto ?? "").replace(/\s+/g, " ").trimStart();
  const m = t.match(RE_ABERTURA_CLAUSULA);
  return m ? m[1] : null;
}

/**
 * Título de seção do contrato: numeração "1. DAS PARTES", "2. DO OBJETO"
 * ou linha curta inteiramente em caixa alta. Aberturas de cláusula NÃO entram aqui.
 */
export function ehTituloSecao(texto: string, jaEmNegrito = false): boolean {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 120) return false;
  if (rotuloClausula(t)) return false;
  if (/^anexo\b/i.test(t)) return true;
  if (RE_TITULO_NUM.test(t) && t.length <= 90 && !/[.!?]\s+\S/.test(t)) return true;
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length >= 4 && letras === letras.toUpperCase() && !t.endsWith(".")) return true;
  return jaEmNegrito && t.length <= 90 && !/[.!?]\s+\S/.test(t);
}

/** @deprecated use `ehTituloSecao` */
export const ehCabecalhoClausula = ehTituloSecao;

/**
 * Prévia em tela: títulos de seção em negrito e, nas aberturas de cláusula,
 * apenas o rótulo em negrito — igual ao PDF.
 */
export function realcarCabecalhos(html: string): string {
  return (html ?? "").replace(
    /<p([^>]*)>([\s\S]*?)<\/p>/gi,
    (m, attrs: string, inner: string) => {
      const texto = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!texto) return m;
      const jaNegrito = /^\s*<(strong|b)\b/i.test(inner);

      if (ehTituloSecao(texto, jaNegrito)) {
        if (/^\s*<(strong|b)\b[\s\S]*<\/(strong|b)>\s*$/i.test(inner.trim())) return m;
        const limpo = inner.replace(/<\/?(strong|b)>/gi, "");
        return `<p${attrs}><strong>${limpo}</strong></p>`;
      }

      const rotulo = rotuloClausula(texto);
      if (rotulo && !jaNegrito) {
        const limpo = inner.replace(/<\/?(strong|b)>/gi, "");
        const semTags = limpo.replace(/<[^>]+>/g, "");
        if (semTags.trimStart().startsWith(rotulo)) {
          const idx = limpo.indexOf(rotulo);
          if (idx >= 0) {
            const resto = limpo.slice(idx + rotulo.length);
            return `<p${attrs}><strong>${limpo.slice(0, idx)}${rotulo}</strong>${resto}</p>`;
          }
        }
      }
      return m;
    },
  );
}


/** Normaliza um nome de campo: minúsculo, sem acento, espaços viram "_". */
export function normalizarCampo(nome: string): string {
  return (nome ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const RE_COLCHETE = /\[([^\[\]<>\n]{2,60})\]/g;
const RE_CHAVES = /\{\{\s*([^{}<>\n]{1,60})\s*\}\}/g;

/** Extrai os campos preenchíveis de um modelo, aceitando [campo] e {{campo}}. */
export function extrairCampos(html: string): string[] {
  const set = new Set<string>();
  const push = (raw: string) => {
    const k = normalizarCampo(raw);
    if (k) set.add(k);
  };
  let m: RegExpExecArray | null;
  const a = new RegExp(RE_COLCHETE);
  while ((m = a.exec(html ?? ""))) push(m[1]);
  const b = new RegExp(RE_CHAVES);
  while ((m = b.exec(html ?? ""))) push(m[1]);
  return Array.from(set);
}

export type ContratoDados = Record<string, any>;

export type EmpresaContratada = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  representante_nome?: string | null;
  representante_documento?: string | null;
  representante_email?: string | null;
  representante_telefone?: string | null;
};

/** Contratada padrão: dados fixos da Luminart / Maicon usados quando o cadastro não tem o campo. */
export const CONTRATADA_PADRAO: Required<EmpresaContratada> = {
  razao_social: "LUMINART ALUGUEL DE MÁQUINAS E ESTRUTURAS PARA EVENTOS LTDA",
  nome_fantasia: "LUMINART",
  cnpj: "14552439000131",
  endereco: "Av. Maestro Lisboa, n.º 2181, Lagoa Redonda, Fortaleza/CE",
  representante_nome: "Maicon Viana de Lima",
  representante_documento: "04027005384",
  representante_email: "maicon@luminarteventos.com.br",
  representante_telefone: "85999331605",
};

/** Junta o cadastro da empresa com os dados fixos da contratada. */
export function contratadaComPadrao(empresa?: EmpresaContratada | null): Required<EmpresaContratada> {
  const val = (v: unknown) => (String(v ?? "").trim() ? String(v).trim() : null);
  return {
    razao_social: val(empresa?.razao_social) ?? CONTRATADA_PADRAO.razao_social,
    nome_fantasia: val(empresa?.nome_fantasia) ?? CONTRATADA_PADRAO.nome_fantasia,
    cnpj: val(empresa?.cnpj) ?? CONTRATADA_PADRAO.cnpj,
    endereco: val(empresa?.endereco) ?? CONTRATADA_PADRAO.endereco,
    representante_nome: val(empresa?.representante_nome) ?? CONTRATADA_PADRAO.representante_nome,
    representante_documento:
      val(empresa?.representante_documento) ?? CONTRATADA_PADRAO.representante_documento,
    representante_email: val(empresa?.representante_email) ?? CONTRATADA_PADRAO.representante_email,
    representante_telefone:
      val(empresa?.representante_telefone) ?? CONTRATADA_PADRAO.representante_telefone,
  };
}


export type Testemunha = { nome?: string; documento?: string; email?: string };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const porExtenso = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

/** CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx); devolve como veio se não bater. */
export function fmtDoc(v?: string | null): string {
  const s = String(v ?? "").trim();
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return s;
}

/** Telefone (xx)x.xxxx-xxxx (celular) ou (xx)xxxx-xxxx (fixo). */
export function fmtTel(v?: string | null): string {
  const s = String(v ?? "").trim();
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1)$2.$3-$4");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1)$2-$3");
  return s;
}

function enderecoLinha(p: ContratoDados, prefixo: "cliente" | "resp_legal" | "resp_legal2"): string {
  return [
    [p[`${prefixo}_logradouro`], p[`${prefixo}_numero`]].filter(Boolean).join(", "),
    p[`${prefixo}_complemento`],
    p[`${prefixo}_bairro`],
    [p[`${prefixo}_cidade`], p[`${prefixo}_uf`]].filter(Boolean).join("/"),
    p[`${prefixo}_cep`] ? `CEP ${p[`${prefixo}_cep`]}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

/** Texto das parcelas: uma linha numerada por parcela, conforme o pagamento do card. */
export function parcelasTexto(parcelas: ParcelaContrato[]): string {
  return (parcelas ?? [])
    .map(
      (p, i) =>
        `${p.n ?? i + 1}ª parcela de ${fmtMoeda(Number(p.valor))} com vencimento em ${fmtData(p.vencimento)};`,
    )
    .join("<br>");
}

/** Texto padrão da forma de pagamento: uma parcela por linha. */
export function pagamentoTexto(parcelas: ParcelaContrato[]): string {
  const lista = (parcelas ?? []).filter((p) => Number(p?.valor) > 0 || p?.vencimento);
  if (!lista.length) return "";
  return lista
    .map(
      (p, i) =>
        `${fmtMoeda(Number(p.valor))} com vencimento em ${fmtData(p.vencimento)}${
          i === lista.length - 1 ? "." : ";"
        }`,
    )
    .join("<br>");
}

function blocoAssinaturas(c: ContratoDados, empresa?: EmpresaContratada | null): string {
  const linha = (nome: string, sub?: string) =>
    `<p style="text-align:center;margin-top:36px">___________________________________________<br>` +
    `${(nome || "").toUpperCase()}${sub ? `<br>${sub}` : ""}</p>`;

  const testemunhas = (c.testemunhas ?? []) as Testemunha[];
  const partes: string[] = [];
  const contratada = contratadaComPadrao(empresa);

  partes.push(
    linha(
      contratada.razao_social,
      [contratada.representante_nome, fmtDoc(contratada.representante_documento)]
        .filter(Boolean)
        .join(" — ") || undefined,
    ),
  );

  partes.push(
    linha(
      c.cliente_nome || "",
      [c.resp_legal_nome, fmtDoc(c.resp_legal_documento)].filter(Boolean).join(" — ") || undefined,
    ),
  );
  if (c.resp_legal2_nome) {
    partes.push(
      linha(
        c.cliente_nome || "",
        [c.resp_legal2_nome, fmtDoc(c.resp_legal2_documento)].filter(Boolean).join(" — ") || undefined,
      ),
    );
  }
  const comNome = testemunhas.filter((t) => (t?.nome ?? "").trim());
  if (comNome.length) {
    partes.push(`<p style="margin-top:24px"><strong>Testemunhas:</strong></p>`);
    comNome.forEach((t) =>
      partes.push(linha(t.nome ?? "", t.documento ? `CPF ${fmtDoc(t.documento)}` : undefined)),
    );
  }
  return partes.join("");
}



const fmtHora = (h?: string | null) => (h ? String(h).slice(0, 5) : "");

/** Texto pronto de um período: "10/09/2026 a 12/09/2026, das 08h00 às 18h00". */
export function periodoTexto(
  inicio?: string | null,
  fim?: string | null,
  horaInicio?: string | null,
  horaFim?: string | null,
): string {
  if (!inicio && !fim) return "";
  const datas = inicio && fim && inicio !== fim ? `${fmtData(inicio)} a ${fmtData(fim)}` : fmtData(inicio || fim);
  const hi = fmtHora(horaInicio);
  const hf = fmtHora(horaFim);
  if (hi && hf) return `${datas}, das ${hi.replace(":", "h")} às ${hf.replace(":", "h")}`;
  if (hi) return `${datas}, a partir das ${hi.replace(":", "h")}`;
  return datas;
}

/** Campos que o sistema preenche sozinho a partir do card do contrato. */
export function variaveisDoContrato(
  c: ContratoDados,
  empresa?: EmpresaContratada | null,
): Record<string, string> {
  const parcelas = (c.pagamento_parcelas ?? []) as ParcelaContrato[];
  const hoje = new Date();
  const criacao = c.created_at ? new Date(c.created_at) : hoje;
  const testemunhas = (c.testemunhas ?? []) as Testemunha[];
  const texto = parcelasTexto(parcelas);

  const contratada = contratadaComPadrao(empresa);
  const map: Record<string, string> = {
    titulo: c.titulo ?? "",
    contrato_titulo: c.titulo ?? "",
    empresa: contratada.razao_social,
    empresa_razao_social: contratada.razao_social,
    empresa_nome_fantasia: contratada.nome_fantasia,
    empresa_cnpj: fmtDoc(contratada.cnpj),
    empresa_endereco: contratada.endereco,
    empresa_representante: contratada.representante_nome,
    empresa_representante_documento: fmtDoc(contratada.representante_documento),
    empresa_representante_email: contratada.representante_email,
    empresa_representante_telefone: fmtTel(contratada.representante_telefone),

    categoria: c.categoria ?? "",
    evento_nome: c.evento_nome ?? "",
    nome_evento: c.evento_nome ?? "",
    local: c.evento_local ?? "",
    local_evento: c.evento_local ?? "",
    evento_local: c.evento_local ?? "",
    numero_proposta: c.proposta_numero_manual ?? (c.proposta_numero != null ? String(c.proposta_numero) : ""),
    proposta_numero: c.proposta_numero_manual ?? (c.proposta_numero != null ? String(c.proposta_numero) : ""),
    cliente: c.cliente_nome ?? "",
    cliente_nome: c.cliente_nome ?? "",
    razao_social: c.cliente_nome ?? "",
    cliente_documento: fmtDoc(c.cliente_documento),
    cpf: fmtDoc(c.cliente_documento),
    cnpj: fmtDoc(c.cliente_documento),
    cliente_email: c.cliente_email ?? "",
    cliente_telefone: fmtTel(c.cliente_telefone),
    cliente_cep: c.cliente_cep ?? "",
    cliente_logradouro: c.cliente_logradouro ?? "",
    cliente_numero: c.cliente_numero ?? "",
    cliente_complemento: c.cliente_complemento ?? "",
    cliente_bairro: c.cliente_bairro ?? "",
    cliente_cidade: c.cliente_cidade ?? "",
    cliente_uf: c.cliente_uf ?? "",
    cliente_endereco: enderecoLinha(c, "cliente"),
    endereco: enderecoLinha(c, "cliente"),
    endereco_completo: enderecoLinha(c, "cliente"),
    resp_legal_nome: c.resp_legal_nome ?? "",
    representante_legal: c.resp_legal_nome ?? "",
    resp_legal_documento: fmtDoc(c.resp_legal_documento),
    resp_legal_email: c.resp_legal_email ?? "",
    resp_legal_telefone: fmtTel(c.resp_legal_telefone),
    resp_legal_endereco: enderecoLinha(c, "resp_legal"),
    resp_legal2_nome: c.resp_legal2_nome ?? "",
    representante_legal_2: c.resp_legal2_nome ?? "",
    resp_legal2_documento: fmtDoc(c.resp_legal2_documento),
    resp_legal2_email: c.resp_legal2_email ?? "",
    resp_legal2_telefone: fmtTel(c.resp_legal2_telefone),
    resp_legal2_endereco: enderecoLinha(c, "resp_legal2"),
    testemunha1_nome: testemunhas[0]?.nome ?? "",
    testemunha1_documento: fmtDoc(testemunhas[0]?.documento),
    testemunha2_nome: testemunhas[1]?.nome ?? "",
    testemunha2_documento: fmtDoc(testemunhas[1]?.documento),
    valor: c.valor != null ? fmtMoeda(Number(c.valor)) : "",
    valor_total: c.valor != null ? fmtMoeda(Number(c.valor)) : "",
    valor_extenso: c.valor != null ? valorPorExtenso(Number(c.valor)) : "",
    valor_total_extenso: c.valor != null ? valorPorExtenso(Number(c.valor)) : "",
    forma_pagamento: pagamentoTexto(parcelas),
    forma_pagamento_tipo:
      c.pagamento_forma === "boleto" ? "Boleto" : c.pagamento_forma === "pix" ? "Pix" : "",
    condicao_pagamento: parcelas.length ? `${parcelas.length}x` : "",
    qtd_parcelas: parcelas.length ? String(parcelas.length) : "",
    parcelas: texto,
    parcelas_detalhe: texto,
    data_fechamento: fmtData(c.data_fechamento),
    evento_inicio: fmtData(c.evento_inicio),
    evento_fim: fmtData(c.evento_fim),
    evento_periodo: periodoTexto(c.evento_inicio, c.evento_fim, c.evento_hora_inicio, c.evento_hora_fim),
    montagem_inicio: fmtData(c.montagem_inicio),
    montagem_fim: fmtData(c.montagem_fim),
    montagem_periodo: periodoTexto(c.montagem_inicio, c.montagem_fim, c.montagem_hora_inicio, c.montagem_hora_fim),
    desmontagem_inicio: fmtData(c.desmontagem_inicio),
    desmontagem_fim: fmtData(c.desmontagem_fim),
    desmontagem_periodo: periodoTexto(
      c.desmontagem_inicio,
      c.desmontagem_fim,
      c.desmontagem_hora_inicio,
      c.desmontagem_hora_fim,
    ),
    data_assinatura: fmtData(c.data_assinatura),
    data_hoje: hoje.toLocaleDateString("pt-BR"),
    data_extenso: porExtenso(hoje),
    data_criacao: criacao.toLocaleDateString("pt-BR"),
    data_criacao_extenso: porExtenso(criacao),
    cidade_data: `${c.cliente_cidade || "Belo Horizonte"}, ${porExtenso(hoje)}`,
    assinaturas: blocoAssinaturas(c, empresa),
  };
  return map;
}

/** Campos sugeridos para inserir no editor de modelos. */
export const CAMPOS_SUGERIDOS: { campo: string; label: string }[] = [
  { campo: "cliente_nome", label: "Nome / Razão social" },
  { campo: "cliente_documento", label: "CPF / CNPJ" },
  { campo: "cliente_endereco", label: "Endereço completo" },
  { campo: "cliente_email", label: "E-mail" },
  { campo: "cliente_telefone", label: "Telefone" },
  { campo: "representante_legal", label: "Representante legal" },
  { campo: "resp_legal_documento", label: "CPF do representante" },
  { campo: "resp_legal_email", label: "E-mail do representante" },
  { campo: "resp_legal_telefone", label: "Telefone do representante" },
  { campo: "representante_legal_2", label: "2º representante legal" },
  { campo: "resp_legal2_documento", label: "CPF do 2º representante" },
  { campo: "resp_legal2_email", label: "E-mail do 2º representante" },
  { campo: "resp_legal2_telefone", label: "Telefone do 2º representante" },

  { campo: "testemunha1_nome", label: "Testemunha 1" },
  { campo: "testemunha1_documento", label: "CPF testemunha 1" },
  { campo: "testemunha2_nome", label: "Testemunha 2" },
  { campo: "testemunha2_documento", label: "CPF testemunha 2" },
  { campo: "valor_total", label: "Valor total" },
  { campo: "valor_extenso", label: "Valor total por extenso" },
  { campo: "forma_pagamento", label: "Forma de pagamento" },
  { campo: "parcelas", label: "Parcelas (detalhe)" },
  { campo: "qtd_parcelas", label: "Qtd. de parcelas" },
  { campo: "forma_pagamento_tipo", label: "Meio de pagamento (Pix/Boleto)" },
  { campo: "evento_nome", label: "Nome do evento" },
  { campo: "local", label: "Local do evento" },
  { campo: "numero_proposta", label: "Nº da proposta" },
  { campo: "evento_periodo", label: "Período do evento" },
  { campo: "evento_inicio", label: "Início do evento" },
  { campo: "evento_fim", label: "Fim do evento" },
  { campo: "montagem_periodo", label: "Período de montagem" },
  { campo: "montagem_inicio", label: "Início da montagem" },
  { campo: "montagem_fim", label: "Fim da montagem" },
  { campo: "desmontagem_periodo", label: "Período de desmontagem" },
  { campo: "desmontagem_inicio", label: "Início da desmontagem" },
  { campo: "desmontagem_fim", label: "Fim da desmontagem" },
  { campo: "data_hoje", label: "Data de hoje" },
  { campo: "data_extenso", label: "Data por extenso" },
  { campo: "data_criacao", label: "Data de criação" },
  { campo: "cidade_data", label: "Cidade e data" },
  { campo: "empresa_razao_social", label: "Empresa contratada" },
  { campo: "empresa_cnpj", label: "CNPJ da contratada" },
  { campo: "empresa_representante", label: "Representante da contratada" },
  { campo: "empresa_representante_documento", label: "CPF do representante da contratada" },
  { campo: "empresa_representante_email", label: "E-mail da contratada" },
  { campo: "empresa_representante_telefone", label: "Telefone da contratada" },
  { campo: "empresa_endereco", label: "Endereço da contratada" },
  { campo: "assinaturas", label: "Bloco de assinaturas" },

];


/**
 * Substitui [campo] e {{campo}} pelos valores informados.
 * Campos sem valor permanecem como [campo] destacado.
 */
export function renderizarModelo(
  html: string,
  valores: Record<string, string>,
): string {
  // Campos gerados pelo sistema que já contêm HTML (quebras de linha, blocos).
  const CAMPOS_HTML = new Set(["parcelas", "parcelas_detalhe", "forma_pagamento", "assinaturas"]);
  const troca = (raw: string) => {
    const k = normalizarCampo(raw);
    const v = (valores[k] ?? "").toString().trim();
    if (!v) return `<mark class="modelo-campo-vazio">[${k}]</mark>`;
    return CAMPOS_HTML.has(k) ? v : v.replace(/[<>]/g, "");
  };
  const out = (html ?? "")
    .replace(RE_COLCHETE, (_m, g1) => troca(g1))
    .replace(RE_CHAVES, (_m, g1) => troca(g1));
  return sanitizeHtml(out);
}

/** Campos que não podem ficar vazios no contrato enviado para assinatura. */
export const CAMPOS_OBRIGATORIOS = [
  "cliente_nome",
  "cliente_documento",
  "valor_total",
  "empresa_razao_social",
  "empresa_cnpj",
  "representante_legal",
  "resp_legal_documento",
];

/** Lista os campos do modelo que continuam sem valor. */
export function camposPendentes(html: string, valores: Record<string, any>): string[] {
  return extrairCampos(html).filter((c) => !String(valores?.[c] ?? "").trim());
}

/** Remove os marcadores que sobraram sem valor (usado antes de gerar o PDF final). */
export function limparCamposVazios(html: string): string {
  return sanitizeHtml(normalizarPontuacao(removerParagrafosVazios(
    (html ?? "")
      .replace(/<mark class="modelo-campo-vazio">\[[^\]]*\]<\/mark>/g, "")
      .replace(RE_COLCHETE, "")
      .replace(RE_CHAVES, ""),
  )));
}

const RE_PLACEHOLDER_ANY = /\[([^\[\]<>\n]{2,60})\]|\{\{\s*([^{}<>\n]{1,60})\s*\}\}/g;

function placeholdersDe(txt: string): string[] {
  const out: string[] = [];
  const re = new RegExp(RE_PLACEHOLDER_ANY);
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const k = normalizarCampo(m[1] ?? m[2] ?? "");
    if (k) out.push(k);
  }
  return out;
}

const temValor = (valores: Record<string, any>, campo: string) =>
  String(valores?.[campo] ?? "").trim().length > 0;

function removerParagrafosVazios(html: string): string {
  return (html ?? "")
    .replace(/<(p|li|h[1-6]|div)([^>]*)>(\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");
}

function normalizarPontuacao(html: string): string {
  return (html ?? "")
    .replace(/[ \t\u00a0]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .replace(/(?:[,;]\s*)+\./g, ".")
    .replace(/\.\s*(?:[,;]\s*)+/g, ". ")
    .replace(/\s+[eE]\s*\./g, ".")
    .replace(/(^|>)[\s.,;:]+(<|$)/g, "$1$2");
}

/**
 * Remove as frases/linhas do modelo cujos campos estão todos vazios
 * (testemunhas, 2º representante etc.) antes de renderizar o contrato final.
 */
export function limparTrechosOpcionais(html: string, valores: Record<string, any>): string {
  const blocos = (html ?? "").split(/(<\/p>|<br\s*\/?>|<\/li>|<\/div>|<\/h[1-6]>)/i);

  const limpo = blocos
    .map((bloco, i) => {
      if (i % 2 === 1) return bloco; // delimitador
      const campos = placeholdersDe(bloco);
      if (!campos.length) return bloco;

      // Bloco inteiro sem nenhum campo preenchido → some (rótulo incluído).
      if (campos.every((c) => !temValor(valores, c))) {
        const textoFixo = bloco
          .replace(/<[^>]+>/g, "")
          .replace(RE_PLACEHOLDER_ANY, "")
          .replace(/[\s:;.,\-—_]/g, "");
        // Só remove quando o que sobra é rótulo curto (ex.: "TESTEMUNHA", "CPF").
        if (textoFixo.length <= 40) return "";
      }

      // Caso contrário, remove apenas as frases sem nenhum campo preenchido.
      return bloco.replace(/[^.!?]*[.!?]+/g, (frase) => {
        const c = placeholdersDe(frase);
        if (!c.length) return frase;
        if (c.some((k) => temValor(valores, k))) return frase;
        return "";
      });
    })
    .join("");

  return removerParagrafosVazios(limpo);
}

/** Renderiza o contrato já sem os trechos opcionais vazios (PDF / envio). */
export function renderizarContratoFinal(html: string, valores: Record<string, string>): string {
  return realcarCabecalhos(
    limparCamposVazios(renderizarModelo(limparTrechosOpcionais(html, valores), valores)),
  );
}

