import { createServerFn } from "@tanstack/react-start";

const SHEET_ID = "10GnRkuewcH5Kzoh1_cjDplpLXUeP8eY5xCF-8cxDFRw";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export type EventoSheetRow = {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  local: string;
  uf: string;
  produtor: string;
  montagemInicio: string;
  montagemFim: string;
  desmontagemInicio: string;
  desmontagemFim: string;
  observacoes: string;
};

export type ListEventosResult = {
  /** Lista de IDs (texto principal exibido) — mantida para compatibilidade. */
  eventos: string[];
  /** Linhas completas da planilha, com todos os campos. */
  rows: EventoSheetRow[];
  error?: string;
};

export const listEventos = createServerFn({ method: "GET" }).handler(async (): Promise<ListEventosResult> => {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_SHEETS_API_KEY) {
    return { eventos: [], rows: [], error: "Conector Google Sheets não configurado" };
  }
  try {
    const meta = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}`, {
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY },
    });
    if (!meta.ok) return { eventos: [], rows: [], error: `Erro ${meta.status} ao ler planilha` };
    const metaJson: any = await meta.json();
    const firstSheet = metaJson.sheets?.[0]?.properties?.title ?? "Página1";

    const range = `${firstSheet}!A:Z`;
    const valsRes = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${range}`, {
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY },
    });
    if (!valsRes.ok) return { eventos: [], rows: [], error: `Erro ${valsRes.status} ao ler valores` };
    const vals: any = await valsRes.json();
    const allRows: string[][] = vals.values ?? [];
    if (allRows.length === 0) return { eventos: [], rows: [] };

    // Mapeia conforme cabeçalho conhecido da planilha:
    // 0:ID 1:Nome 2:Início 3:Final 4:Local 5:UF 6:Produtor
    // 7:Início Montagem 8:Final Montagem 9:Início Desmontagem 10:Final Desmontagem 11:Observações
    const dataRows = allRows.slice(1);
    const cell = (r: string[], i: number) => (r?.[i] ?? "").toString().trim();
    const rows: EventoSheetRow[] = dataRows
      .map((r) => ({
        id: cell(r, 0),
        nome: cell(r, 1),
        dataInicio: cell(r, 2),
        dataFim: cell(r, 3),
        local: cell(r, 4),
        uf: cell(r, 5),
        produtor: cell(r, 6),
        montagemInicio: cell(r, 7),
        montagemFim: cell(r, 8),
        desmontagemInicio: cell(r, 9),
        desmontagemFim: cell(r, 10),
        observacoes: cell(r, 11),
      }))
      .filter((r) => r.id);

    // Deduplicar por id mantendo a primeira ocorrência
    const seen = new Set<string>();
    const uniqueRows = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const eventos = uniqueRows.map((r) => r.id).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { eventos, rows: uniqueRows };
  } catch (e: any) {
    return { eventos: [], rows: [], error: e.message ?? "Falha ao buscar Google Sheets" };
  }
});
