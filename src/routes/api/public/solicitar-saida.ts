import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const materialSchema = z.object({
  descricao: z.string().trim().min(1).max(300),
  quantidade: z.number().positive().max(1_000_000),
});

const schema = z.object({
  data_retirada: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  solicitante_id: z.string().uuid().optional().nullable(),
  solicitante_nome: z.string().trim().min(1).max(160),
  is_evento: z.boolean(),
  evento_projeto: z.string().trim().max(200).optional().or(z.literal("")),
  finalidade_livre: z.string().trim().max(300).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  materiais: z.array(materialSchema).min(1).max(50),
});

// Rate limit simples por IP (best-effort, por instância).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
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
  return true;
}

export const Route = createFileRoute("/api/public/solicitar-saida")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      // Lista de solicitantes ativos para o formulário público (apenas id + nome).
      GET: async () => {
        const { data, error } = await (supabaseAdmin as any)
          .from("solicitantes")
          .select("id, nome, apelido")
          .eq("status", "ativo")
          .order("nome");
        if (error) return json({ solicitantes: [] });
        return json({ solicitantes: data ?? [] });
      },

      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";
        if (!rateLimit(ip)) {
          return json({ error: "Muitas solicitações. Aguarde alguns instantes." }, 429);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Requisição inválida" }, 400);
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "Dados inválidos", issues: parsed.error.flatten() }, 400);
        }
        const d = parsed.data;
        if (d.is_evento && !d.evento_projeto) {
          return json({ error: "Selecione o evento/projeto" }, 400);
        }
        if (!d.is_evento && !d.finalidade_livre) {
          return json({ error: "Informe a finalidade da retirada" }, 400);
        }

        const { data: solic, error } = await (supabaseAdmin as any)
          .from("estoque_solicitacoes_saida")
          .insert({
            data_retirada: d.data_retirada,
            solicitante_id: d.solicitante_id || null,
            solicitante_nome: d.solicitante_nome,
            is_evento: d.is_evento,
            evento_projeto: d.is_evento ? d.evento_projeto || null : null,
            finalidade_livre: d.is_evento ? null : d.finalidade_livre || null,
            observacoes: d.observacoes || null,
            status: "pendente",
          })
          .select("id, numero")
          .single();

        if (error || !solic) {
          console.error("[solicitar-saida] insert error", error);
          return json({ error: "Não foi possível registrar a solicitação" }, 500);
        }

        const { error: itensErr } = await (supabaseAdmin as any)
          .from("estoque_solicitacoes_saida_itens")
          .insert(
            d.materiais.map((m) => ({
              solicitacao_id: (solic as any).id,
              descricao: m.descricao,
              quantidade: m.quantidade,
            })),
          );
        if (itensErr) {
          console.error("[solicitar-saida] itens error", itensErr);
          return json({ error: "Não foi possível registrar os materiais" }, 500);
        }

        return json({ ok: true, id: (solic as any).id, numero: (solic as any).numero });
      },
    },
  },
});
