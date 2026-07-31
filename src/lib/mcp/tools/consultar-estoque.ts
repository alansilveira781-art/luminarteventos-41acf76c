import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, jsonResult, errorResult } from "../supabase";

export default defineTool({
  name: "consultar_estoque",
  title: "Consultar estoque",
  description:
    "Consulta itens do estoque por nome, código, categoria ou subcategoria, retornando saldo atual, quantidade mínima, unidade, localização e valor unitário.",
  inputSchema: {
    busca: z.string().describe("Texto para filtrar por nome ou código do item.").optional(),
    categoria: z.string().describe("Categoria exata do item.").optional(),
    subcategoria: z.string().describe("Subcategoria exata do item.").optional(),
    somente_abaixo_minimo: z
      .boolean()
      .describe("Se verdadeiro, retorna apenas itens com saldo abaixo da quantidade mínima.")
      .optional(),
    limite: z.number().int().describe("Máximo de registros (padrão 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, categoria, subcategoria, somente_abaixo_minimo, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("itens")
      .select(
        "id, codigo, codigo_proprio, nome, categoria, subcategoria, unidade, quantidade_atual, quantidade_minima, localizacao, valor_unitario, status",
      )
      .order("nome", { ascending: true })
      .limit(Math.min(limite ?? 50, 200));

    if (busca) query = query.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%,codigo_proprio.ilike.%${busca}%`);
    if (categoria) query = query.eq("categoria", categoria);
    if (subcategoria) query = query.eq("subcategoria", subcategoria);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const itens = somente_abaixo_minimo
      ? (data ?? []).filter((i) => Number(i.quantidade_atual ?? 0) < Number(i.quantidade_minima ?? 0))
      : (data ?? []);
    return jsonResult({ quantidade: itens.length, itens });
  },
});
