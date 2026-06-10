// Server-only XLSX parser for CONTROLE DE VENDAS NOVO.
// Keeps the same field shape used by the dashboard (VendaRow).
import type { VendaRow } from "./vendas.functions";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
function trimestreFrom(iso: string | null): 1 | 2 | 3 | 4 | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  if (!m) return null;
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 9) return 3;
  return 4;
}
function mesNomeFrom(iso: string | null): string | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  if (!m) return null;
  return MESES_PT[m - 1] ?? null;
}
function anoFrom(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
function titleCaseMes(s: string | null): string | null {
  if (!s) return null;
  const lower = s.toLowerCase().trim();
  const idx = MESES_PT.findIndex((m) => m.toLowerCase() === lower);
  return idx >= 0 ? MESES_PT[idx] : s;
}

export async function parseVendasXlsx(buf: ArrayBuffer): Promise<VendaRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const sheet = wb.Sheets["Base de Dados"];
  if (!sheet) throw new Error("Aba 'Base de Dados' não encontrada na planilha");
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const rows: VendaRow[] = [];
  for (const r of json) {
    const dataRegistro = toIsoDate(r["Data de Registro"]);
    const dataEvento = toIsoDate(r["Data do Evento"]);
    const baseDate = dataEvento ?? dataRegistro;
    const mesRaw = toStr(r["Mês"]);
    const anoColuna = toNum(r["Ano"]) || null;
    const row: VendaRow = {
      dataRegistro,
      ano: anoColuna,
      mes: titleCaseMes(mesRaw),
      semana: toNum(r["Semana"]) || null,
      tipo: toStr(r["Tipo"]),
      quantidade: toNum(r["Quantidade"]),
      nomeEvento: toStr(r["Nome do Evento"]),
      local: toStr(r["Local"]),
      estado: toStr(r["Estado"]),
      cidade: toStr(r["Cidade"]),
      salao: toStr(r["Salão"]),
      tipoEvento: toStr(r["Tipo de Evento"]),
      classificacao: toStr(r["Classificação"]),
      dataEvento,
      consultor: toStr(r["Consultor"]),
      gestor: toStr(r["Gestor"]),
      cerimonial: toStr(r["Cerimonial"]),
      decorador: toStr(r["Decorador"]),
      empresa: toStr(r["Empresa"]),
      valorProposta: toNum(r["Valor da proposta"]),
      desconto: toNum(r["Desconto"]),
      percentual: toNum(r["Percentual"]),
      valorFinal: toNum(r["Valor Final"]),
      valorBV: toNum(r["Valor BV"]),
      comissaoGestor: toNum(r["Comissão Gestor"]),
      tipoComissao: toStr(r["Tipo de comissão"]),
      comissaoConsultor: toNum(r["Comissão Consultor"]),
      mesEvento: mesNomeFrom(baseDate) ?? titleCaseMes(mesRaw),
      anoEvento: anoFrom(baseDate) ?? anoColuna,
      trimestreEvento: trimestreFrom(baseDate),
    };
    if (!row.nomeEvento && !row.valorFinal && !row.dataRegistro) continue;
    rows.push(row);
  }
  return rows;
}

export const DROPBOX_VENDAS_URL =
  "https://www.dropbox.com/scl/fi/f1r2414qsg2sfriu7xxdh/CONTROLE-DE-VENDAS-NOVO.xlsx?rlkey=xpw1rxphb6r82j6szw2t26acf&dl=1";

export async function fetchVendasFromDropbox(): Promise<VendaRow[]> {
  const res = await fetch(DROPBOX_VENDAS_URL, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 LuminartDashboard" },
  });
  if (!res.ok) throw new Error(`Erro ${res.status} ao baixar planilha do Dropbox`);
  const buf = await res.arrayBuffer();
  return parseVendasXlsx(buf);
}

// Map VendaRow -> DB row
export function vendaRowToDb(r: VendaRow, source: "dropbox" | "upload") {
  return {
    nome_evento: r.nomeEvento,
    data_registro: r.dataRegistro,
    data_evento: r.dataEvento,
    ano: r.ano,
    mes: r.mes,
    semana: r.semana,
    mes_evento: r.mesEvento,
    ano_evento: r.anoEvento,
    trimestre_evento: r.trimestreEvento,
    tipo: r.tipo,
    tipo_evento: r.tipoEvento,
    classificacao: r.classificacao,
    empresa: r.empresa,
    local: r.local,
    estado: r.estado,
    cidade: r.cidade,
    salao: r.salao,
    consultor: r.consultor,
    gestor: r.gestor,
    cerimonial: r.cerimonial,
    decorador: r.decorador,
    quantidade: r.quantidade,
    valor_proposta: r.valorProposta,
    desconto: r.desconto,
    percentual: r.percentual,
    valor_final: r.valorFinal,
    valor_bv: r.valorBV,
    comissao_gestor: r.comissaoGestor,
    tipo_comissao: r.tipoComissao,
    comissao_consultor: r.comissaoConsultor,
    source,
  };
}

export function dbRowToVenda(d: Record<string, unknown>): VendaRow {
  return {
    dataRegistro: (d.data_registro as string) ?? null,
    ano: (d.ano as number) ?? null,
    mes: (d.mes as string) ?? null,
    semana: (d.semana as number) ?? null,
    tipo: (d.tipo as string) ?? null,
    quantidade: Number(d.quantidade) || 0,
    nomeEvento: (d.nome_evento as string) ?? null,
    local: (d.local as string) ?? null,
    estado: (d.estado as string) ?? null,
    cidade: (d.cidade as string) ?? null,
    salao: (d.salao as string) ?? null,
    tipoEvento: (d.tipo_evento as string) ?? null,
    classificacao: (d.classificacao as string) ?? null,
    dataEvento: (d.data_evento as string) ?? null,
    consultor: (d.consultor as string) ?? null,
    gestor: (d.gestor as string) ?? null,
    cerimonial: (d.cerimonial as string) ?? null,
    decorador: (d.decorador as string) ?? null,
    empresa: (d.empresa as string) ?? null,
    valorProposta: Number(d.valor_proposta) || 0,
    desconto: Number(d.desconto) || 0,
    percentual: Number(d.percentual) || 0,
    valorFinal: Number(d.valor_final) || 0,
    valorBV: Number(d.valor_bv) || 0,
    comissaoGestor: Number(d.comissao_gestor) || 0,
    tipoComissao: (d.tipo_comissao as string) ?? null,
    comissaoConsultor: Number(d.comissao_consultor) || 0,
    mesEvento: (d.mes_evento as string) ?? null,
    anoEvento: (d.ano_evento as number) ?? null,
    trimestreEvento: (d.trimestre_evento as 1 | 2 | 3 | 4 | null) ?? null,
  };
}
