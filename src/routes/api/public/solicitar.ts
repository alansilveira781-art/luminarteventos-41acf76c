import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const itemSchema = z.object({
  descricao: z.string().trim().min(1).max(300),
  quantidade: z.number().positive().max(1_000_000),
  unidade: z.string().trim().max(20).optional().or(z.literal("")),
  valor_unitario: z.number().nonnegative().max(10_000_000).optional().nullable(),
});

const baseSchema = z.object({
  tipo: z.enum(["compra", "demanda"]),
  titulo: z.string().trim().min(1).max(200),
  subtipo: z.string().trim().max(100).optional().nullable(),
  solicitante_nome: z.string().trim().min(1).max(120),
  solicitante_email: z.string().trim().email().max(160).optional().or(z.literal("")),
  solicitante_telefone: z.string().trim().max(40).optional().or(z.literal("")),
  fornecedor: z.string().trim().max(160).optional().or(z.literal("")),
  descricao: z.string().trim().max(4000).optional().or(z.literal("")),
  valor_total: z.number().nonnegative().max(100_000_000).optional().nullable(),
  itens: z.array(itemSchema).max(50).optional(),
});

// In-memory IP rate limiter (best-effort; works per worker instance).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const ipHits = new Map<string, number[]>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) {
    // basic cleanup to avoid unbounded growth
    for (const [k, v] of ipHits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) ipHits.delete(k);
    }
  }
  return true;
}

export const Route = createFileRoute("/api/public/solicitar")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";
        if (!rateLimit(ip)) {
          return new Response(
            JSON.stringify({ error: "Muitas solicitações. Aguarde alguns instantes e tente novamente." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

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

        // Validações específicas por tipo
        if (d.tipo === "compra") {
          if (!d.itens || d.itens.length === 0) {
            return new Response(
              JSON.stringify({ error: "Informe ao menos um item para a compra" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } else {
          if (!d.descricao || d.descricao.trim().length === 0) {
            return new Response(
              JSON.stringify({ error: "Descreva a demanda" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }

        const contato = [
          d.solicitante_email && `email: ${d.solicitante_email}`,
          d.solicitante_telefone && `telefone: ${d.solicitante_telefone}`,
        ]
          .filter(Boolean)
          .join(" · ");

        const observacoes =
          `[Solicitação enviada via formulário público]\n` +
          `Solicitante: ${d.solicitante_nome}${contato ? ` (${contato})` : ""}` +
          (d.descricao ? `\n\n${d.descricao}` : "");

        if (d.tipo === "compra") {
          const somaItens = d.itens!.reduce(
            (acc, it) => acc + (it.valor_unitario ?? 0) * it.quantidade,
            0,
          );
          const valorTotal = d.valor_total ?? (somaItens > 0 ? somaItens : null);

          const { data: compra, error } = await (supabaseAdmin as any)
            .from("compras")
            .insert({
              status: "solicitacao",
              titulo: d.titulo,
              solicitante: d.solicitante_nome,
              fornecedor: d.fornecedor || null,
              observacoes,
              valor_total: valorTotal,
              data_solicitacao: new Date().toISOString().slice(0, 10),
              tipo_compra: d.subtipo || null,
            })
            .select("id, numero")
            .single();

          if (error) {
            return new Response(
              JSON.stringify({ error: "Não foi possível registrar a compra" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          const itensPayload = d.itens!.map((it) => ({
            compra_id: (compra as any).id,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unidade: it.unidade || null,
            valor_unitario: it.valor_unitario ?? null,
          }));

          await (supabaseAdmin as any).from("compra_itens").insert(itensPayload);

          return new Response(
            JSON.stringify({
              ok: true,
              id: (compra as any).id,
              numero: (compra as any).numero,
              tipo: "compra",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Demanda
        const { data: demanda, error } = await (supabaseAdmin as any)
          .from("demandas")
          .insert({
            status: "solicitacao",
            titulo: d.titulo,
            solicitante: d.solicitante_nome,
            fornecedor: d.fornecedor || null,
            descritivo: d.descricao || null,
            observacoes,
            valor_total: d.valor_total ?? null,
            data_solicitacao: new Date().toISOString().slice(0, 10),
            tipo_demanda: d.subtipo || null,
          })
          .select("id, numero")
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Não foi possível registrar a demanda" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            id: (demanda as any).id,
            numero: (demanda as any).numero,
            tipo: "demanda",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      },
    },
  },
});
