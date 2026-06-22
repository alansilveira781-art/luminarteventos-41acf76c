import { createServerFn } from "@tanstack/react-start";

export type VendaRow = {
  id?: string;
  dataRegistro: string | null; // ISO yyyy-mm-dd
  ano: number | null;
  mes: string | null;
  semana: number | null;
  tipo: string | null; // VENDA / EXTRA ...
  quantidade: number;
  nomeEvento: string | null;
  local: string | null;
  estado: string | null;
  cidade: string | null;
  salao: string | null;
  tipoEvento: string | null;
  classificacao: string | null;
  dataEvento: string | null;
  consultor: string | null;
  gestor: string | null;
  cerimonial: string | null;
  decorador: string | null;
  empresa: string | null;
  valorProposta: number;
  desconto: number;
  percentual: number;
  valorFinal: number;
  valorBV: number;
  comissaoGestor: number;
  tipoComissao: string | null;
  comissaoConsultor: number; // sometimes bool; converted to numeric flag
  mesEvento: string | null;
  anoEvento: number | null;
  trimestreEvento: 1 | 2 | 3 | 4 | null;
};

export type ListVendasResult = {
  rows: VendaRow[];
  fetchedAt: string;
  error?: string;
};

const DROPBOX_URL =
  "https://www.dropbox.com/scl/fi/f1r2414qsg2sfriu7xxdh/CONTROLE-DE-VENDAS-NOVO.xlsx?rlkey=xpw1rxphb6r82j6szw2t26acf&dl=1";

// Simple in-memory cache per worker instance
let cache: { at: number; data: ListVendasResult } | null = null;
const TTL_MS = 5 * 60 * 1000;

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
    // Excel serial date
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

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
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

export const listVendasDropbox = createServerFn({ method: "GET" }).handler(
  async (): Promise<ListVendasResult> => {
    const now = Date.now();
    if (cache && now - cache.at < TTL_MS) return cache.data;

    try {
      const res = await fetch(DROPBOX_URL, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 LuminartDashboard" },
      });
      if (!res.ok) {
        return { rows: [], fetchedAt: new Date().toISOString(), error: `Erro ${res.status} ao baixar planilha` };
      }
      const buf = await res.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
      const sheet = wb.Sheets["Base de Dados"];
      if (!sheet) {
        return { rows: [], fetchedAt: new Date().toISOString(), error: "Aba 'Base de Dados' não encontrada" };
      }
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
        // skip fully empty rows
        if (!row.nomeEvento && !row.valorFinal && !row.dataRegistro) continue;
        rows.push(row);
      }
      const data: ListVendasResult = { rows, fetchedAt: new Date().toISOString() };
      cache = { at: now, data };
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar planilha";
      return { rows: [], fetchedAt: new Date().toISOString(), error: msg };
    }
  },
);
