import DOMPurify from "dompurify";
import { fmtData, fmtMoeda, type ParcelaContrato } from "./contrato-form";

export const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "u", "h1", "h2", "h3", "ul", "ol", "li",
    "a", "span", "div", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "mark",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

export const sanitizeHtml = (html: string) => DOMPurify.sanitize(html ?? "", SANITIZE_OPTS);

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

function enderecoLinha(p: ContratoDados, prefixo: "cliente" | "resp_legal"): string {
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

/** Campos que o sistema preenche sozinho a partir do card do contrato. */
export function variaveisDoContrato(c: ContratoDados): Record<string, string> {
  const parcelas = (c.pagamento_parcelas ?? []) as ParcelaContrato[];
  const hoje = new Date();
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const parcelasTexto = parcelas.length
    ? parcelas
        .map((p) => `${p.n}ª parcela de ${fmtMoeda(Number(p.valor))} em ${fmtData(p.vencimento)}`)
        .join("; ")
    : "";

  const map: Record<string, string> = {
    titulo: c.titulo ?? "",
    contrato_titulo: c.titulo ?? "",
    empresa: c.empresa ?? "",
    categoria: c.categoria ?? "",
    cliente: c.cliente_nome ?? "",
    cliente_nome: c.cliente_nome ?? "",
    razao_social: c.cliente_nome ?? "",
    cliente_documento: c.cliente_documento ?? "",
    cpf: c.cliente_documento ?? "",
    cnpj: c.cliente_documento ?? "",
    cliente_email: c.cliente_email ?? "",
    cliente_telefone: c.cliente_telefone ?? "",
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
    resp_legal_documento: c.resp_legal_documento ?? "",
    resp_legal_email: c.resp_legal_email ?? "",
    resp_legal_telefone: c.resp_legal_telefone ?? "",
    resp_legal_endereco: enderecoLinha(c, "resp_legal"),
    valor: c.valor != null ? fmtMoeda(Number(c.valor)) : "",
    valor_total: c.valor != null ? fmtMoeda(Number(c.valor)) : "",
    forma_pagamento: c.pagamento_forma === "boleto" ? "Boleto" : c.pagamento_forma === "pix" ? "Pix" : "",
    condicao_pagamento: parcelas.length ? `${parcelas.length}x` : "",
    qtd_parcelas: parcelas.length ? String(parcelas.length) : "",
    parcelas: parcelasTexto,
    parcelas_detalhe: parcelasTexto,
    data_fechamento: fmtData(c.data_fechamento),
    data_assinatura: fmtData(c.data_assinatura),
    data_hoje: hoje.toLocaleDateString("pt-BR"),
    data_extenso: `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`,
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
  { campo: "valor_total", label: "Valor total" },
  { campo: "forma_pagamento", label: "Forma de pagamento" },
  { campo: "parcelas", label: "Parcelas (detalhe)" },
  { campo: "data_extenso", label: "Data por extenso" },
  { campo: "empresa", label: "Empresa contratada" },
];

/**
 * Substitui [campo] e {{campo}} pelos valores informados.
 * Campos sem valor permanecem como [campo] destacado.
 */
export function renderizarModelo(
  html: string,
  valores: Record<string, string>,
): string {
  const troca = (raw: string) => {
    const k = normalizarCampo(raw);
    const v = (valores[k] ?? "").toString().trim();
    if (!v) return `<mark class="modelo-campo-vazio">[${k}]</mark>`;
    return v.replace(/[<>]/g, "");
  };
  const out = (html ?? "")
    .replace(RE_COLCHETE, (_m, g1) => troca(g1))
    .replace(RE_CHAVES, (_m, g1) => troca(g1));
  return sanitizeHtml(out);
}
