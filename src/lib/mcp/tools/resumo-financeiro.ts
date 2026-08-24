import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, jsonResult, errorResult } from "../supabase";

type Linha = { valor_total: number | null; status: string | null };

function consolidar(rows: Linha[]) {
  const total = rows.reduce((acc, r) => acc + Number(r.valor_total ?? 0), 0);
  const porStatus: Record<string, { quantidade: number; valor: number }> = {};
  for (const r of rows) {
    const key = r.status ?? "sem_status";
    porStatus[key] ??= { quantidade: 0, valor: 0 };
    porStatus[key].quantidade += 1;
    porStatus[key].valor += Number(r.valor_total ?? 0);
  }
  return { quantidade: rows.length, valor_total: total, por_status: porStatus };
}

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro do período",
  description:
    "Consolida os gastos de Compras e Aquisições em um período, com totais gerais e quebra por status. Útil para perguntas como 'quanto gastamos em julho?'.",
  inputSchema: {
    data_inicio: z.string().describe("Data inicial (AAAA-MM-DD)."),
    data_fim: z.string().describe("Data final (AAAA-MM-DD)."),
    base_data: z
      .enum(["solicitacao", "compra"])
      .describe("Data usada no filtro: 'solicitacao' (padrão) ou 'compra'.")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ data_inicio, data_fim, base_data }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const campo = base_data === "compra" ? "data_compra" : "data_solicitacao";

    const [compras, despesas] = await Promise.all([
      supabase.from("compras").select("valor_total, status").gte(campo, data_inicio).lte(campo, data_fim),
      supabase.from("demandas").select("valor_total, status").gte(campo, data_inicio).lte(campo, data_fim),
    ]);

    if (compras.error) return errorResult(compras.error.message);
    if (despesas.error) return errorResult(despesas.error.message);

    const c = consolidar((compras.data ?? []) as Linha[]);
    const d = consolidar((despesas.data ?? []) as Linha[]);

    return jsonResult({
      periodo: { inicio: data_inicio, fim: data_fim, base_data: campo },
      compras: c,
      despesas: d,
      total_geral: c.valor_total + d.valor_total,
    });
  },
});
