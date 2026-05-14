import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const baseSchema = z.object({
  tipo: z.enum(["compra", "demanda"]),
  titulo: z.string().trim().min(1).max(200),
  subtipo: z.string().trim().max(100).optional().nullable(),
  solicitante_nome: z.string().trim().min(1).max(120),
  solicitante_email: z.string().trim().email().max(160).optional().or(z.literal("")),
  solicitante_telefone: z.string().trim().max(40).optional().or(z.literal("")),
  fornecedor: z.string().trim().max(160).optional().or(z.literal("")),
  descricao: z.string().trim().min(1).max(4000),
  valor_total: z.number().nonnegative().max(100_000_000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/solicitar")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "JSON inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const parsed = baseSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Dados inválidos", issues: parsed.error.flatten() }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const d = parsed.data;
        const contato = [
          d.solicitante_email && `email: ${d.solicitante_email}`,
          d.solicitante_telefone && `telefone: ${d.solicitante_telefone}`,
        ]
          .filter(Boolean)
          .join(" · ");

        const observacoes =
          `[Solicitação enviada via formulário público]\n` +
          `Solicitante: ${d.solicitante_nome}${contato ? ` (${contato})` : ""}\n\n` +
          d.descricao;

        const table = d.tipo === "compra" ? "compras" : "demandas";
        const tipoColumn = d.tipo === "compra" ? "tipo_compra" : "tipo_demanda";

        const payload: Record<string, unknown> = {
          status: "solicitacao",
          titulo: d.titulo,
          solicitante: d.solicitante_nome,
          fornecedor: d.fornecedor || null,
          observacoes,
          valor_total: d.valor_total ?? null,
          data_solicitacao: new Date().toISOString().slice(0, 10),
          [tipoColumn]: d.subtipo || null,
        };

        const { data, error } = await (supabaseAdmin as any)
          .from(table)
          .insert(payload)
          .select("id, numero")
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Não foi possível registrar a solicitação" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            id: (data as any).id,
            numero: (data as any).numero,
            tipo: d.tipo,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      },
    },
  },
});
