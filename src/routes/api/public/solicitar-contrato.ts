import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const enderecoSchema = z.object({
  cep: z.string().trim().min(8).max(12),
  logradouro: z.string().trim().min(1).max(200),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(120).optional().or(z.literal("")),
  bairro: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  uf: z.string().trim().length(2),
});

const parcelaSchema = z.object({
  n: z.number().int().min(1).max(36),
  vencimento: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.number().nonnegative().max(100_000_000),
});

const schema = z
  .object({
    tipo: z.enum(["contrato", "aditivo"]),
    titulo: z.string().trim().min(1).max(200),
    empresa: z.string().trim().max(120).optional().or(z.literal("")),
    cliente_tipo: z.enum(["pf", "pj"]),
    cliente_nome: z.string().trim().min(1).max(160),
    cliente_documento: z.string().trim().min(11).max(40),
    cliente_email: z.string().trim().email().max(160),
    cliente_telefone: z.string().trim().min(8).max(40),
    cliente_endereco: enderecoSchema,
    resp_legal_nome: z.string().trim().max(160).optional().or(z.literal("")),
    resp_legal_documento: z.string().trim().max(40).optional().or(z.literal("")),
    resp_legal_email: z.string().trim().max(160).optional().or(z.literal("")),
    resp_legal_telefone: z.string().trim().max(40).optional().or(z.literal("")),
    resp_legal_endereco: enderecoSchema.nullable().optional(),
    resp_legal2_nome: z.string().trim().max(160).optional().or(z.literal("")),
    resp_legal2_documento: z.string().trim().max(40).optional().or(z.literal("")),
    resp_legal2_email: z.string().trim().max(160).optional().or(z.literal("")),
    resp_legal2_telefone: z.string().trim().max(40).optional().or(z.literal("")),
    resp_legal2_endereco: enderecoSchema.nullable().optional(),
    testemunhas: z
      .array(
        z.object({
          nome: z.string().trim().min(2).max(160),
          documento: z.string().trim().max(40).optional().or(z.literal("")),
          email: z.string().trim().max(160).optional().or(z.literal("")),
        }),
      )
      .max(2)
      .optional(),
    valor: z.number().nonnegative().max(100_000_000),
    pagamento_forma: z.enum(["pix", "boleto"]),
    pagamento_modo: z.enum(["igual", "diferente"]),
    pagamento_parcelas: z.array(parcelaSchema).min(1).max(36),
    data_fechamento: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
    observacoes: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    const digits = (v: string) => v.replace(/\D/g, "");
    if (d.cliente_tipo === "pj") {
      if (digits(d.cliente_documento).length !== 14)
        ctx.addIssue({ code: "custom", path: ["cliente_documento"], message: "CNPJ inválido" });
      for (const k of ["resp_legal_nome", "resp_legal_documento", "resp_legal_email", "resp_legal_telefone"] as const) {
        if (!d[k]) ctx.addIssue({ code: "custom", path: [k], message: "Campo obrigatório" });
      }
      if (d.resp_legal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.resp_legal_email))
        ctx.addIssue({ code: "custom", path: ["resp_legal_email"], message: "E-mail inválido" });
      if (!d.resp_legal_endereco)
        ctx.addIssue({ code: "custom", path: ["resp_legal_endereco"], message: "Endereço obrigatório" });
    } else if (digits(d.cliente_documento).length !== 11) {
      ctx.addIssue({ code: "custom", path: ["cliente_documento"], message: "CPF inválido" });
    }

    const soma = d.pagamento_parcelas.reduce((a, p) => a + p.valor, 0);
    if (Math.abs(soma - d.valor) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["pagamento_parcelas"],
        message: "A soma das parcelas deve ser igual ao valor total",
      });
    }
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

const enderecoTexto = (e: z.infer<typeof enderecoSchema> | null | undefined) =>
  e
    ? `${e.logradouro}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ""} — ${e.bairro}, ${e.cidade}/${e.uf} — CEP ${e.cep}`
    : "";

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

        // Exige usuário autenticado (qualquer usuário do sistema)
        const authHeader =
          request.headers.get("authorization") || request.headers.get("Authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
          return json({ error: "Faça login para enviar a solicitação" }, 401);
        }
        const { supabaseAdmin: sbAuth } = await import("@/integrations/supabase/client.server");
        const { data: userRes, error: userErr } = await (sbAuth as any).auth.getUser(
          authHeader.slice(7),
        );
        if (userErr || !userRes?.user) {
          return json({ error: "Sessão inválida. Entre novamente." }, 401);
        }
        const solicitanteId: string = userRes.user.id;
        const solicitanteEmail: string = userRes.user.email ?? "";

        let body: unknown;
        const anexos: { file: File; tipo: string }[] = [];
        try {
          const fd = await request.formData();
          const payloadRaw = fd.get("payload");
          if (typeof payloadRaw !== "string") throw new Error("payload ausente");
          body = JSON.parse(payloadRaw);
          for (const key of ["proposta", "cartao_cnpj", "documento_foto"] as const) {
            const f = fd.get(key);
            if (f instanceof File && f.size > 0) anexos.push({ file: f, tipo: key });
          }
        } catch {
          return json({ error: "Requisição inválida" }, 400);
        }

        if (anexos.length < 2) {
          return json({ error: "Envie a proposta e o documento obrigatório" }, 400);
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

        const resumoPagamento = [
          `Pagamento: ${d.pagamento_forma === "pix" ? "Pix" : "Boleto"}`,
          `${d.pagamento_parcelas.length}x (${d.pagamento_modo === "igual" ? "parcelas iguais" : "valores diferentes"})`,
          ...d.pagamento_parcelas.map(
            (p) => `  ${p.n}ª — ${p.vencimento} — R$ ${p.valor.toFixed(2)}`,
          ),
        ].join("\n");

        const observacoes = [
          "[Solicitação enviada via formulário público]",
          `Tipo de pessoa: ${d.cliente_tipo === "pj" ? "Pessoa Jurídica" : "Pessoa Física"}`,
          `Endereço: ${enderecoTexto(d.cliente_endereco)}`,
          d.resp_legal_endereco ? `Endereço do responsável legal: ${enderecoTexto(d.resp_legal_endereco)}` : "",
          resumoPagamento,
          d.observacoes ? `\n${d.observacoes}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const ec = d.cliente_endereco;
        const er = d.resp_legal_endereco ?? null;

        const { data: criado, error } = await sb
          .from("juridico_contratos")
          .insert({
            titulo: d.titulo,
            tipo: d.tipo,
            status: "entrada",
            empresa: d.empresa || null,
            cliente_tipo: d.cliente_tipo,
            cliente_nome: d.cliente_nome,
            cliente_documento: d.cliente_documento,
            cliente_email: d.cliente_email,
            cliente_telefone: d.cliente_telefone,
            cliente_cep: ec.cep,
            cliente_logradouro: ec.logradouro,
            cliente_numero: ec.numero,
            cliente_complemento: ec.complemento || null,
            cliente_bairro: ec.bairro,
            cliente_cidade: ec.cidade,
            cliente_uf: ec.uf,
            resp_legal_nome: d.resp_legal_nome || null,
            resp_legal_documento: d.resp_legal_documento || null,
            resp_legal_email: d.resp_legal_email || null,
            resp_legal_telefone: d.resp_legal_telefone || null,
            resp_legal_cep: er?.cep ?? null,
            resp_legal_logradouro: er?.logradouro ?? null,
            resp_legal_numero: er?.numero ?? null,
            resp_legal_complemento: er?.complemento || null,
            resp_legal_bairro: er?.bairro ?? null,
            resp_legal_cidade: er?.cidade ?? null,
            resp_legal_uf: er?.uf ?? null,
            resp_legal2_nome: d.resp_legal2_nome || null,
            resp_legal2_documento: d.resp_legal2_documento || null,
            resp_legal2_email: d.resp_legal2_email || null,
            resp_legal2_telefone: d.resp_legal2_telefone || null,
            resp_legal2_cep: er2?.cep ?? null,
            resp_legal2_logradouro: er2?.logradouro ?? null,
            resp_legal2_numero: er2?.numero ?? null,
            resp_legal2_complemento: er2?.complemento || null,
            resp_legal2_bairro: er2?.bairro ?? null,
            resp_legal2_cidade: er2?.cidade ?? null,
            resp_legal2_uf: er2?.uf ?? null,
            testemunhas: d.testemunhas ?? [],
            valor: d.valor ?? null,
            forma_pagamento: d.pagamento_forma === "pix" ? "PIX" : "Boleto",
            pagamento_forma: d.pagamento_forma,
            pagamento_modo: d.pagamento_modo,
            pagamento_parcelas: d.pagamento_parcelas,
            data_fechamento: d.data_fechamento || null,
            observacoes,
            solicitante_email: solicitanteEmail || null,
            created_by: solicitanteId,
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
