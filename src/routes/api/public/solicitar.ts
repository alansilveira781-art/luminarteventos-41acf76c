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
  evento_projeto: z.string().trim().max(200).optional().nullable(),
});

const baseSchema = z.object({
  tipo: z.enum(["compra", "demanda"]),
  titulo: z.string().trim().min(1).max(200),
  subtipo: z.string().trim().max(100).optional().nullable(),
  solicitante_nome: z.string().trim().min(1).max(120),
  solicitante_email: z.string().trim().email().max(160),
  solicitante_user_id: z.string().uuid().optional().nullable(),

  solicitante_telefone: z.string().trim().max(40).optional().or(z.literal("")),
  fornecedor: z.string().trim().max(160).optional().or(z.literal("")),
  descricao: z.string().trim().max(4000).optional().or(z.literal("")),
  valor_total: z.number().nonnegative().max(100_000_000).optional().nullable(),
  itens: z.array(itemSchema).max(50).optional(),
  pago: z.boolean().optional().nullable(),
  parcelamento: z.string().trim().max(100).optional().or(z.literal("")),
  condicao_pagamento: z.string().trim().max(100).optional().or(z.literal("")),
  data_compra: z.string().trim().max(20).optional().or(z.literal("")),
  data_solicitacao: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  prazo: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),

  is_reembolso: z.boolean().optional(),
  reembolsar_para: z.string().trim().max(160).optional().or(z.literal("")),
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

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

async function uploadAnexos(
  bucket: string,
  table: "compra_anexos" | "demanda_anexos",
  parentField: "compra_id" | "demanda_id",
  parentId: string,
  files: File[],
): Promise<{ falhados: number; erros: string[] }> {
  const erros: string[] = [];
  for (const file of files) {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${parentId}/${Date.now()}_${safeName}`;
      const buffer = await file.arrayBuffer();
      const { error: upErr } = await (supabaseAdmin as any).storage
        .from(bucket)
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        console.error(`[solicitar] upload anexo falhou (${parentField}=${parentId})`, file.name, upErr);
        erros.push(`${file.name}: ${upErr.message ?? "falha no envio do arquivo"}`);
        continue;
      }
      const { error: insErr } = await (supabaseAdmin as any).from(table).insert({
        [parentField]: parentId,
        nome: file.name,
        path,
        mime_type: file.type || null,
        tamanho: file.size,
        uploaded_by: null,
      });
      if (insErr) {
        console.error(`[solicitar] insert anexo falhou (${parentField}=${parentId})`, file.name, insErr);
        erros.push(`${file.name}: ${insErr.message ?? "falha ao registrar o anexo"}`);
      }
    } catch (err: any) {
      console.error(`[solicitar] anexo erro inesperado (${parentField}=${parentId})`, file.name, err);
      erros.push(`${file.name}: ${err?.message ?? "erro inesperado"}`);
    }
  }
  return { falhados: erros.length, erros };
}


/** Registro de auditoria de toda tentativa vinda do link público. Nunca derruba a requisição. */
async function registrarTentativa(entry: {
  tipo?: string | null;
  titulo?: string | null;
  solicitante_nome?: string | null;
  solicitante_email?: string | null;
  ip_hash?: string | null;
  resultado: "criado" | "recusado" | "erro";
  erro?: string | null;
  card_id?: string | null;
  card_numero?: number | null;
}) {
  try {
    await (supabaseAdmin as any).from("solicitacoes_publicas_log").insert(entry);
  } catch (err) {
    console.error("[solicitar] falha ao registrar log da tentativa", err);
  }
}

async function hashIp(ip: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  } catch {
    return "unknown";
  }
}

/** Avisa os responsáveis padrão da etapa "Solicitação" que chegou um pedido novo. */
async function notificarResponsaveis(params: {
  origem: "compra" | "demanda";
  cardId: string;
  titulo: string;
  solicitante: string;
}) {
  try {
    const tabela = params.origem === "compra" ? "compras_status_defaults" : "financeiro_status_defaults";
    const { data } = await (supabaseAdmin as any)
      .from(tabela)
      .select("responsavel_id")
      .eq("status", "solicitacao");
    const ids = [...new Set(((data ?? []) as any[]).map((r) => r.responsavel_id).filter(Boolean))];
    if (!ids.length) return;
    await (supabaseAdmin as any).rpc("enqueue_notificacoes", {
      rows: ids.map((user_id) => ({
        user_id,
        tipo: "nova_solicitacao",
        titulo: params.origem === "compra" ? "Nova solicitação de compra" : "Nova solicitação de aquisição",
        mensagem: `${params.titulo} — ${params.solicitante}`.slice(0, 140),
        link: `/compras?id=${params.cardId}${params.origem === "demanda" ? "&origem=demanda" : ""}`,
      })),
    });
  } catch (err) {
    console.error("[solicitar] falha ao notificar responsáveis", err);
  }
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
        const ipHash = await hashIp(ip);
        // Contexto preenchido conforme os dados vão sendo lidos, para o log de tentativas.
        const ctx: { tipo?: string | null; titulo?: string | null; nome?: string | null; email?: string | null } = {};
        const recusar = async (status: number, payload: Record<string, unknown>, motivo: string) => {
          await registrarTentativa({
            tipo: ctx.tipo ?? null,
            titulo: ctx.titulo ?? null,
            solicitante_nome: ctx.nome ?? null,
            solicitante_email: ctx.email ?? null,
            ip_hash: ipHash,
            resultado: status >= 500 ? "erro" : "recusado",
            erro: motivo,
          });
          return new Response(JSON.stringify(payload), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        };

        if (!rateLimit(ip)) {
          return recusar(
            429,
            { error: "Muitas solicitações. Aguarde alguns instantes e tente novamente." },
            "rate limit por IP",
          );
        }

        let body: unknown;
        let uploadedFiles: File[] = [];
        const contentType = request.headers.get("content-type") || "";
        try {
          if (contentType.includes("multipart/form-data")) {
            const fd = await request.formData();
            const payloadRaw = fd.get("payload");
            if (typeof payloadRaw !== "string") {
              throw new Error("Campo 'payload' ausente");
            }
            body = JSON.parse(payloadRaw);
            const files = fd.getAll("anexos");
            for (const v of files) {
              if (v instanceof File && v.size > 0) uploadedFiles.push(v);
            }
            if (uploadedFiles.length > MAX_FILES) {
              return recusar(
                400,
                { error: `Máximo de ${MAX_FILES} anexos por solicitação` },
                "excedeu o limite de anexos",
              );
            }
            for (const f of uploadedFiles) {
              if (f.size > MAX_FILE_BYTES) {
                return recusar(400, { error: `Arquivo '${f.name}' excede 10 MB` }, "anexo acima de 10 MB");
              }
            }
          } else {
            body = await request.json();
          }
        } catch {
          return recusar(400, { error: "Requisição inválida" }, "corpo da requisição ilegível");
        }

        const anyBody = (body ?? {}) as Record<string, unknown>;
        ctx.tipo = typeof anyBody.tipo === "string" ? anyBody.tipo : null;
        ctx.titulo = typeof anyBody.titulo === "string" ? anyBody.titulo : null;
        ctx.nome = typeof anyBody.solicitante_nome === "string" ? anyBody.solicitante_nome : null;
        ctx.email = typeof anyBody.solicitante_email === "string" ? anyBody.solicitante_email : null;

        const parsed = baseSchema.safeParse(body);
        if (!parsed.success) {
          return recusar(
            400,
            { error: "Dados inválidos", issues: parsed.error.flatten() },
            `validação: ${JSON.stringify(parsed.error.flatten().fieldErrors).slice(0, 300)}`,
          );
        }

        const d = parsed.data;

        // Validações específicas por tipo
        if (d.tipo === "compra") {
          if (!d.itens || d.itens.length === 0) {
            return recusar(400, { error: "Informe ao menos um item para a compra" }, "compra sem itens");
          }
        } else {
          if (!d.descricao || d.descricao.trim().length === 0) {
            return recusar(400, { error: "Descreva a demanda" }, "aquisição sem descrição");
          }
        }

        const contato = [
          d.solicitante_email && `email: ${d.solicitante_email}`,
          d.solicitante_telefone && `telefone: ${d.solicitante_telefone}`,
        ]
          .filter(Boolean)
          .join(" · ");

        const reembolsoNota = d.is_reembolso && d.reembolsar_para
          ? `\n\n[REEMBOLSO] Reembolsar para: ${d.reembolsar_para}`
          : "";

        const observacoes =
          `[Solicitação enviada via formulário público]\n` +
          `Solicitante: ${d.solicitante_nome}${contato ? ` (${contato})` : ""}` +
          (d.descricao ? `\n\n${d.descricao}` : "") +
          reembolsoNota;

        const hoje = new Date().toISOString().slice(0, 10);
        const dataSolicitacao = d.data_solicitacao || hoje;

        // Vincula a solicitação ao usuário quando o e-mail informado existe em profiles
        const solicitanteEmail = (d.solicitante_email || "").trim().toLowerCase() || null;
        let solicitanteId: string | null = null;
        if (solicitanteEmail) {
          const { data: perfil } = await (supabaseAdmin as any)
            .from("profiles")
            .select("id")
            .ilike("email", solicitanteEmail)
            .maybeSingle();
          solicitanteId = (perfil as any)?.id ?? null;
        }
        if (!solicitanteId && d.solicitante_user_id) {
          const { data: perfilId } = await (supabaseAdmin as any)
            .from("profiles")
            .select("id")
            .eq("id", d.solicitante_user_id)
            .maybeSingle();
          solicitanteId = (perfilId as any)?.id ?? null;
        }
        const vinculado = !!solicitanteId;


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
              data_solicitacao: dataSolicitacao,
              prazo: d.prazo || null,

              tipo_compra: d.subtipo || null,
              solicitante_email: solicitanteEmail,
              solicitante_id: solicitanteId,
            })
            .select("id, numero")
            .single();

          if (error) {
            return recusar(
              500,
              { error: "Não foi possível registrar a compra" },
              `insert compras: ${error.message ?? "erro desconhecido"}`,
            );
          }

          const itensPayload = d.itens!.map((it) => ({
            compra_id: (compra as any).id,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unidade: it.unidade || null,
            valor_unitario: it.valor_unitario ?? null,
            evento_projeto: it.evento_projeto || null,
          }));

          await (supabaseAdmin as any).from("compra_itens").insert(itensPayload);

          let anexosResult = { falhados: 0, erros: [] as string[] };
          if (uploadedFiles.length > 0) {
            anexosResult = await uploadAnexos(
              "compra-anexos",
              "compra_anexos",
              "compra_id",
              (compra as any).id,
              uploadedFiles,
            );
          }

          return new Response(
            JSON.stringify({
              ok: true,
              id: (compra as any).id,
              numero: (compra as any).numero,
              tipo: "compra",
              anexos_falhados: anexosResult.falhados,
              anexos_erros: anexosResult.erros,
              vinculado,

            }),

            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Demanda
        const itensDemanda = d.itens ?? [];
        const somaItensDemanda = itensDemanda.reduce(
          (acc, it) => acc + (it.valor_unitario ?? 0) * it.quantidade,
          0,
        );
        const valorTotalDemanda =
          itensDemanda.length > 0
            ? (somaItensDemanda > 0 ? somaItensDemanda : (d.valor_total ?? null))
            : (d.valor_total ?? null);

        const demandaInsert: any = {
          status: "solicitacao",
          titulo: d.titulo,
          solicitante: d.solicitante_nome,
          fornecedor: d.fornecedor || null,
          descritivo: d.descricao || null,
          observacoes,
          valor_total: valorTotalDemanda,
          data_solicitacao: dataSolicitacao,
          prazo: d.prazo || null,

          tipo_demanda: d.is_reembolso ? "reembolso" : (d.subtipo || null),
          solicitante_email: solicitanteEmail,
          solicitante_id: solicitanteId,
        };
        if (!d.is_reembolso && d.pago === true) {
          demandaInsert.parcelamento = d.parcelamento || null;
          demandaInsert.condicao_pagamento = d.condicao_pagamento || null;
          demandaInsert.data_compra = d.data_compra || null;
        }
        const { data: demanda, error } = await (supabaseAdmin as any)
          .from("demandas")
          .insert(demandaInsert)
          .select("id, numero")
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Não foi possível registrar a demanda" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (itensDemanda.length > 0) {
          await (supabaseAdmin as any).from("demanda_itens").insert(
            itensDemanda.map((it) => ({
              demanda_id: (demanda as any).id,
              descricao: it.descricao,
              quantidade: it.quantidade,
              unidade: it.unidade || null,
              valor_unitario: it.valor_unitario ?? null,
              evento_projeto: it.evento_projeto || null,
            })),
          );
        }


        let anexosDemanda = { falhados: 0, erros: [] as string[] };
        if (uploadedFiles.length > 0) {
          anexosDemanda = await uploadAnexos(
            "demanda-anexos",
            "demanda_anexos",
            "demanda_id",
            (demanda as any).id,
            uploadedFiles,
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            id: (demanda as any).id,
            numero: (demanda as any).numero,
            tipo: "demanda",
            anexos_falhados: anexosDemanda.falhados,
            anexos_erros: anexosDemanda.erros,
            vinculado,

          }),

          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      },
    },
  },
});
