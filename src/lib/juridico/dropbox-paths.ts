// Helpers puros (client-safe) para montar os caminhos das pastas no Dropbox.

export const SUBPASTAS = [
  "01 - REUNIÃO FINAL",
  "02 - PROJETO",
  "03 - COMUNICAÇÃO VISUAL",
  "04 - DOC",
  "05 - ARQUIVOS RECEBIDOS",
  "06 - ROUTER",
] as const;

/** Subpasta onde o contrato assinado e a proposta são gravados. */
export const SUBPASTA_DOCS = "04 - DOC";

export const RAIZ_PADRAO = "/EVENTOS DA SEMANA";

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

/** "2026-08-22" -> { ano: "2026", mes: "08 - AGOSTO", dia: 22, mesNum: 8 } */
function partes(iso?: string | null) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { ano: m[1], mesNum: Number(m[2]), dia: Number(m[3]) };
}

export function anoDaData(iso?: string | null): string {
  return partes(iso)?.ano ?? "";
}

export function mesDaData(iso?: string | null): string {
  const p = partes(iso);
  if (!p) return "";
  return `${String(p.mesNum).padStart(2, "0")} - ${MESES[p.mesNum - 1]}`;
}

/** Período do evento: "22.08" ou "20 A 22.08" (ou "30.07 A 02.08" entre meses). */
export function periodoEvento(inicio?: string | null, fim?: string | null): string {
  const a = partes(inicio);
  if (!a) return "";
  const dd = (n: number) => String(n).padStart(2, "0");
  const b = partes(fim);
  const iniStr = `${dd(a.dia)}.${dd(a.mesNum)}`;
  if (!b || (b.dia === a.dia && b.mesNum === a.mesNum && b.ano === a.ano)) return iniStr;
  const fimStr = `${dd(b.dia)}.${dd(b.mesNum)}`;
  if (b.mesNum === a.mesNum && b.ano === a.ano) return `${dd(a.dia)} A ${fimStr}`;
  return `${iniStr} A ${fimStr}`;
}

/** Remove caracteres inválidos para nomes no Dropbox e normaliza em maiúsculas. */
export function sanitizarNome(texto: string): string {
  return (texto ?? "")
    .replace(/[\\/:?*<>"|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export type PastaContratoInput = {
  raiz?: string;
  ano: string;
  mes: string;
  periodo: string;
  nomeEvento: string;
  localEvento?: string;
};

/** Nome final: "PERÍODO - NOME DO EVENTO - LOCAL DO EVENTO". */
export function nomePastaEvento(i: PastaContratoInput): string {
  return [i.periodo, i.nomeEvento, i.localEvento]
    .map((p) => sanitizarNome(p ?? ""))
    .filter(Boolean)
    .join(" - ");
}

/** Caminho completo da pasta do evento no Dropbox. */
export function caminhoPastaEvento(i: PastaContratoInput): string {
  const raiz = (i.raiz || RAIZ_PADRAO).replace(/\/+$/, "");
  const segs = [raiz, sanitizarNome(i.ano), sanitizarNome(i.mes), nomePastaEvento(i)].filter(Boolean);
  return segs.join("/");
}

/** Pré-preenchimento a partir de um contrato. */
export function pastaFromContrato(c: any): PastaContratoInput {
  const inicio = c?.evento_inicio ?? null;
  return {
    raiz: RAIZ_PADRAO,
    ano: anoDaData(inicio),
    mes: mesDaData(inicio),
    periodo: periodoEvento(inicio, c?.evento_fim ?? null),
    nomeEvento: sanitizarNome(c?.titulo ?? ""),
    localEvento: sanitizarNome(c?.evento_local ?? c?.cliente_cidade ?? ""),
  };
}
