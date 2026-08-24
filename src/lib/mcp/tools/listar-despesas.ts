import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, jsonResult, errorResult } from "../supabase";

export default defineTool({
  name: "listar_despesas",
  title: "Listar despesas",
  description:
    "Lista as despesas/demandas do módulo Aquisições com tipo de despesa, status, evento/projeto, fornecedor, valor e datas.",
  inputSchema: {
    status: z.string().describe("Status do card (ex.: em_andamento, finalizado).").optional(),
    tipo_demanda: z.string().describe("Tipo de despesa (ex.: reposicao_estoque, pro_labore).").optional(),
    data_inicio: z.string().describe("Data inicial de solicitação (AAAA-MM-DD).").optional(),
    data_fim: z.string().describe("Data final de solicitação (AAAA-MM-DD).").optional(),
    busca: z.string().describe("Texto para filtrar por título, fornecedor ou evento/projeto.").optional(),
    limite: z.number().int().describe("Máximo de registros (padrão 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, tipo_demanda, data_inicio, data_fim, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("demandas")
      .select(
        "id, numero, titulo, tipo_demanda, status, solicitante, fornecedor, evento_projeto, valor_total, condicao_pagamento, parcelamento, data_solicitacao, data_compra, status_financeiro",
      )
      .order("data_solicitacao", { ascending: false })
      .limit(Math.min(limite ?? 50, 200));

    if (status) query = query.eq("status", status);
    if (tipo_demanda) query = query.eq("tipo_demanda", tipo_demanda);
    if (data_inicio) query = query.gte("data_solicitacao", data_inicio);
    if (data_fim) query = query.lte("data_solicitacao", data_fim);
    if (busca)
      query = query.or(`titulo.ilike.%${busca}%,fornecedor.ilike.%${busca}%,evento_projeto.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const total = (data ?? []).reduce((acc, r) => acc + Number(r.valor_total ?? 0), 0);
    return jsonResult({ quantidade: data?.length ?? 0, valor_total_listado: total, despesas: data ?? [] });
  },
});
