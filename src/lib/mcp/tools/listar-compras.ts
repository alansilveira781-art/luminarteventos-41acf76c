import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, jsonResult, errorResult } from "../supabase";

export default defineTool({
  name: "listar_compras",
  title: "Listar compras",
  description:
    "Lista compras do módulo Compras com status, solicitante, fornecedor, valor total, condição de pagamento e datas. Permite filtrar por status, período de solicitação e texto livre.",
  inputSchema: {
    status: z.string().describe("Status do card (ex.: em_andamento, finalizado).").optional(),
    data_inicio: z.string().describe("Data inicial de solicitação (AAAA-MM-DD).").optional(),
    data_fim: z.string().describe("Data final de solicitação (AAAA-MM-DD).").optional(),
    busca: z.string().describe("Texto para filtrar por título, fornecedor ou solicitante.").optional(),
    limite: z.number().int().describe("Máximo de registros (padrão 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, data_inicio, data_fim, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("compras")
      .select(
        "id, numero, titulo, status, solicitante, fornecedor, comprador, valor_total, condicao_pagamento, parcelamento, data_solicitacao, data_compra, tem_nf, status_financeiro",
      )
      .order("data_solicitacao", { ascending: false })
      .limit(Math.min(limite ?? 50, 200));

    if (status) query = query.eq("status", status);
    if (data_inicio) query = query.gte("data_solicitacao", data_inicio);
    if (data_fim) query = query.lte("data_solicitacao", data_fim);
    if (busca) query = query.or(`titulo.ilike.%${busca}%,fornecedor.ilike.%${busca}%,solicitante.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const total = (data ?? []).reduce((acc, r) => acc + Number(r.valor_total ?? 0), 0);
    return jsonResult({ quantidade: data?.length ?? 0, valor_total_listado: total, compras: data ?? [] });
  },
});
