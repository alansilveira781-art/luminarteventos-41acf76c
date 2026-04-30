import { createServerFn } from "@tanstack/react-start";

const SHEET_ID = "10GnRkuewcH5Kzoh1_cjDplpLXUeP8eY5xCF-8cxDFRw";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const listEventos = createServerFn({ method: "GET" }).handler(async () => {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_SHEETS_API_KEY) {
    return { eventos: [] as string[], error: "Conector Google Sheets não configurado" };
  }
  try {
    // Buscar primeira aba inteira
    const meta = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}`, {
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY },
    });
    if (!meta.ok) return { eventos: [], error: `Erro ${meta.status} ao ler planilha` };
    const metaJson: any = await meta.json();
    const firstSheet = metaJson.sheets?.[0]?.properties?.title ?? "Página1";

    const range = `${firstSheet}!A:Z`;
    const valsRes = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${range}`, {
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY },
    });
    if (!valsRes.ok) return { eventos: [], error: `Erro ${valsRes.status} ao ler valores` };
    const vals: any = await valsRes.json();
    const rows: string[][] = vals.values ?? [];
    if (rows.length === 0) return { eventos: [] };

    // Heurística: pega valores não vazios da primeira coluna a partir da linha 2 (assumindo cabeçalho)
    // Se não houver cabeçalho, ainda funciona pois apenas remove o primeiro item.
    const eventos = Array.from(
      new Set(
        rows.slice(1).map((r) => (r?.[0] ?? "").toString().trim()).filter(Boolean),
      ),
    ).sort();
    return { eventos };
  } catch (e: any) {
    return { eventos: [], error: e.message ?? "Falha ao buscar Google Sheets" };
  }
});
