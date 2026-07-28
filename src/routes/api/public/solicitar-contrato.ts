import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const schema = z.object({
  tipo: z.enum(["contrato", "aditivo"]),
  titulo: z.string().trim().min(1).max(200),
  empresa: z.string().trim().max(120).optional().or(z.literal("")),
  cliente_nome: z.string().trim().min(1).max(160),
  cliente_documento: z.string().trim().min(11).max(40),
  cliente_email: z.string().trim().email().max(160),
  cliente_telefone: z.string().trim().min(8).max(40),
  resp_legal_nome: z.string().trim().min(1).max(160),
  resp_legal_documento: z.string().trim().min(11).max(40),
  resp_legal_email: z.string().trim().email().max(160),
  resp_legal_telefone: z.string().trim().min(8).max(40),
  valor: z.number().nonnegative().max(100_000_000).optional().nullable(),
  data_fechamento: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  observacoes: z.string().trim().max(4000).optional().or(z.literal("")),
});

// Rate limit por IP (best-effort, por instância)
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
    for (const [k, v] of ipHits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) ipHits.delete(k);
    }
  }
  return true;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/api/public/solicitar-contrato")({
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
          return json({ error: "Muitas solicitações. Aguarde alguns instantes e tente novamente." }, 429);
        }

        let body: unknown;
        const anexos: { file: File; tipo: string }[] = [];
        try {
          const fd = await request.formData();
          const payloadRaw = fd.get("payload");
          if (typeof payloadRaw !== "string") throw new Error("payload ausente");
          body = JSON.parse(payloadRaw);
          for (const key of ["proposta", "cartao_cnpj"] as const) {
            const f = fd.get(key);
            if (f instanceof File && f.size > 0) anexos.push({ file: f, tipo: key });
          }
        } catch {
          return json({ error: "Requisição inválida" }, 400);
        }

        if (anexos.length < 2) {
          return json({ error: "Envie a proposta e o cartão CNPJ" }, 400);
        }
        for (const a of anexos) {
          if (a.file.size > MAX_FILE_BYTES) {
            return json({ error: `Arquivo '${a.file.name}' excede 10 MB` }, 400);
          }
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "Dados inválidos", issues: parsed.error.flatten() }, 400);
        }
        const d = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;

        const observacoes =
          `[Solicitação enviada via formulário público]` + (d.observacoes ? `\n\n${d.observacoes}` : "");

        const { data: criado, error } = await sb
          .from("juridico_contratos")
          .insert({
            titulo: d.titulo,
            tipo: d.tipo,
            status: "entrada",
            empresa: d.empresa || null,
            cliente_nome: d.cliente_nome,
            cliente_documento: d.cliente_documento,
            cliente_email: d.cliente_email,
            cliente_telefone: d.cliente_telefone,
            resp_legal_nome: d.resp_legal_nome,
            resp_legal_documento: d.resp_legal_documento,
            resp_legal_email: d.resp_legal_email,
            resp_legal_telefone: d.resp_legal_telefone,
            valor: d.valor ?? null,
            data_fechamento: d.data_fechamento || null,
            observacoes,
            created_by: null,
          })
          .select("id, tipo, numero")
          .single();

        if (error) {
          console.error("[solicitar-contrato] insert falhou", error);
          return json({ error: "Não foi possível registrar a solicitação" }, 500);
        }

        let anexosFalhados = 0;
        for (const a of anexos) {
          try {
            const safe = a.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = `${criado.id}/${Date.now()}_${safe}`;
            const buffer = await a.file.arrayBuffer();
            const { error: upErr } = await sb.storage
              .from("juridico-anexos")
              .upload(path, buffer, {
                contentType: a.file.type || "application/octet-stream",
                upsert: false,
              });
            if (upErr) throw upErr;
            const { error: insErr } = await sb.from("juridico_anexos").insert({
              contrato_id: criado.id,
              nome: a.file.name,
              path,
              mime_type: a.file.type || null,
              tamanho: a.file.size,
              tipo: a.tipo,
              uploaded_by: null,
            });
            if (insErr) throw insErr;
          } catch (err) {
            console.error("[solicitar-contrato] anexo falhou", a.file.name, err);
            anexosFalhados++;
          }
        }

        return json({
          ok: true,
          id: criado.id,
          numero: criado.numero,
          tipo: criado.tipo,
          anexos_falhados: anexosFalhados,
        });
      },
    },
  },
});
