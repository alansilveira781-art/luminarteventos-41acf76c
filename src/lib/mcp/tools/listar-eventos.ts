import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, jsonResult, errorResult } from "../supabase";

export default defineTool({
  name: "listar_eventos",
  title: "Listar eventos",
  description:
    "Lista eventos do Grupo Luminart por período (data do evento), com nome, código, local, cidade/UF, produtor e datas de montagem/desmontagem. Inclui locais adicionais vinculados ao evento principal.",
  inputSchema: {
    data_inicio: z.string().describe("Data inicial no formato AAAA-MM-DD.").optional(),
    data_fim: z.string().describe("Data final no formato AAAA-MM-DD.").optional(),
    busca: z.string().describe("Texto para filtrar por nome, código ou local.").optional(),
    limite: z.number().int().describe("Máximo de registros (padrão 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ data_inicio, data_fim, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("eventos")
      .select(
        "id, codigo, codigo_evento, nome, local, cidade, uf, tipo, situacao, produtor, responsavel, data_evento, data_evento_fim, data_montagem, data_desmontagem, evento_pai_id",
      )
      .order("data_evento", { ascending: true })
      .limit(Math.min(limite ?? 50, 200));

    if (data_inicio) query = query.gte("data_evento", data_inicio);
    if (data_fim) query = query.lte("data_evento", data_fim);
    if (busca) query = query.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%,local.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ total: data?.length ?? 0, eventos: data ?? [] });
  },
});
