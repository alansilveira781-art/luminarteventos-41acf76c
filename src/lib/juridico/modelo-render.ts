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

export type EmpresaContratada = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  representante_nome?: string | null;
  representante_documento?: string | null;
};

export type Testemunha = { nome?: string; documento?: string; email?: string };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const porExtenso = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

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

function blocoAssinaturas(c: ContratoDados, empresa?: EmpresaContratada | null): string {
  const linha = (nome: string, sub?: string) =>
    `<p style="text-align:center;margin-top:36px">___________________________________________<br>` +
    `${(nome || "").toUpperCase()}${sub ? `<br>${sub}` : ""}</p>`;

  const testemunhas = (c.testemunhas ?? []) as Testemunha[];
  const partes: string[] = [];

  partes.push(
    linha(
      empresa?.razao_social || c.empresa || "",
      [empresa?.representante_nome, empresa?.representante_documento]
        .filter(Boolean)
        .join(" — ") || undefined,
    ),
  );
  partes.push(
    linha(
      c.cliente_nome || "",
      [c.resp_legal_nome, c.resp_legal_documento].filter(Boolean).join(" — ") || undefined,
    ),
  );
  if (c.resp_legal2_nome) {
    partes.push(
      linha(
        c.cliente_nome || "",
        [c.resp_legal2_nome, c.resp_legal2_documento].filter(Boolean).join(" — ") || undefined,
      ),
    );
  }
  const comNome = testemunhas.filter((t) => (t?.nome ?? "").trim());
  if (comNome.length) {
    partes.push(`<p style="margin-top:24px"><strong>Testemunhas:</strong></p>`);
    comNome.forEach((t) =>
      partes.push(linha(t.nome ?? "", t.documento ? `CPF ${t.documento}` : undefined)),
    );
  }
  return partes.join("");
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

  const map: Record<string, string> = {
    titulo: c.titulo ?? "",
    contrato_titulo: c.titulo ?? "",
    empresa: empresa?.razao_social ?? c.empresa ?? "",
    empresa_razao_social: empresa?.razao_social ?? c.empresa ?? "",
    empresa_nome_fantasia: empresa?.nome_fantasia ?? "",
    empresa_cnpj: empresa?.cnpj ?? "",
    empresa_endereco: empresa?.endereco ?? "",
    empresa_representante: empresa?.representante_nome ?? "",
    empresa_representante_documento: empresa?.representante_documento ?? "",
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
    resp_legal2_nome: c.resp_legal2_nome ?? "",
    representante_legal_2: c.resp_legal2_nome ?? "",
    resp_legal2_documento: c.resp_legal2_documento ?? "",
    resp_legal2_email: c.resp_legal2_email ?? "",
    resp_legal2_telefone: c.resp_legal2_telefone ?? "",
    resp_legal2_endereco: enderecoLinha(c, "resp_legal2"),
    testemunha1_nome: testemunhas[0]?.nome ?? "",
    testemunha1_documento: testemunhas[0]?.documento ?? "",
    testemunha2_nome: testemunhas[1]?.nome ?? "",
    testemunha2_documento: testemunhas[1]?.documento ?? "",
    valor: c.valor != null ? fmtMoeda(Number(c.valor)) : "",
    valor_total: c.valor != null ? fmtMoeda(Number(c.valor)) : "",
    forma_pagamento: c.pagamento_forma === "boleto" ? "Boleto" : c.pagamento_forma === "pix" ? "Pix" : "",
    condicao_pagamento: parcelas.length ? `${parcelas.length}x` : "",
    qtd_parcelas: parcelas.length ? String(parcelas.length) : "",
    parcelas: texto,
    parcelas_detalhe: texto,
    data_fechamento: fmtData(c.data_fechamento),
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
  { campo: "representante_legal_2", label: "2º representante legal" },
  { campo: "resp_legal2_documento", label: "CPF do 2º representante" },
  { campo: "testemunha1_nome", label: "Testemunha 1" },
  { campo: "testemunha1_documento", label: "CPF testemunha 1" },
  { campo: "testemunha2_nome", label: "Testemunha 2" },
  { campo: "testemunha2_documento", label: "CPF testemunha 2" },
  { campo: "valor_total", label: "Valor total" },
  { campo: "forma_pagamento", label: "Forma de pagamento" },
  { campo: "parcelas", label: "Parcelas (detalhe)" },
  { campo: "qtd_parcelas", label: "Qtd. de parcelas" },
  { campo: "data_hoje", label: "Data de hoje" },
  { campo: "data_extenso", label: "Data por extenso" },
  { campo: "data_criacao", label: "Data de criação" },
  { campo: "cidade_data", label: "Cidade e data" },
  { campo: "empresa_razao_social", label: "Empresa contratada" },
  { campo: "empresa_cnpj", label: "CNPJ da contratada" },
  { campo: "empresa_representante", label: "Representante da contratada" },
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
