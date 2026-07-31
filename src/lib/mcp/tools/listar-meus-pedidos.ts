import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, jsonResult, errorResult } from "../supabase";

export default defineTool({
  name: "listar_meus_pedidos",
  title: "Listar meus pedidos",
  description:
    "Lista as solicitações feitas pelo próprio usuário conectado (compras e despesas), com status atual e datas — equivalente à tela 'Meus Pedidos'.",
  inputSchema: {
    ocultar_finalizados: z.boolean().describe("Se verdadeiro, oculta pedidos já finalizados.").optional(),
    limite: z.number().int().describe("Máximo de registros por tipo (padrão 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ ocultar_finalizados, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const email = ctx.getUserEmail();
    const userId = ctx.getUserId();
    if (!email && !userId) return errorResult("Não foi possível identificar o usuário conectado.");

    const supabase = supabaseForUser(ctx);
    const max = Math.min(limite ?? 50, 200);
    const filtro = [
      userId ? `solicitante_id.eq.${userId}` : null,
      email ? `solicitante_email.eq.${email}` : null,
    ]
      .filter(Boolean)
      .join(",");

    const [compras, despesas] = await Promise.all([
      supabase
        .from("compras")
        .select("id, numero, titulo, status, fornecedor, valor_total, data_solicitacao, updated_at")
        .or(filtro)
        .order("data_solicitacao", { ascending: false })
        .limit(max),
      supabase
        .from("demandas")
        .select(
          "id, numero, titulo, tipo_demanda, status, fornecedor, valor_total, data_solicitacao, updated_at",
        )
        .or(filtro)
        .order("data_solicitacao", { ascending: false })
        .limit(max),
    ]);

    if (compras.error) return errorResult(compras.error.message);
    if (despesas.error) return errorResult(despesas.error.message);

    const filtrar = <T extends { status?: string | null }>(rows: T[]) =>
      ocultar_finalizados ? rows.filter((r) => r.status !== "finalizado") : rows;

    return jsonResult({
      usuario: email ?? userId,
      compras: filtrar(compras.data ?? []),
      despesas: filtrar(despesas.data ?? []),
    });
  },
});
