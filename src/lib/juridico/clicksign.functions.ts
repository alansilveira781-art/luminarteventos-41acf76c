import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SignatarioInput = {
  nome: string;
  email: string;
  documento?: string | null;
  papel: "cliente" | "contratada" | "testemunha";
};

type EnviarInput = {
  contratoId: string;
  nomeArquivo: string;
  pdfBase64: string;
  signatarios: SignatarioInput[];
  mensagem?: string;
};

function validar(input: EnviarInput): EnviarInput {
  if (!input?.contratoId) throw new Error("Contrato inválido");
  if (!input?.pdfBase64) throw new Error("PDF do contrato não gerado");
  if (!Array.isArray(input.signatarios) || input.signatarios.length === 0) {
    throw new Error("Informe ao menos um signatário");
  }
  for (const s of input.signatarios) {
    if (!s.nome?.trim()) throw new Error("Signatário sem nome");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email ?? "")) throw new Error(`E-mail inválido: ${s.nome}`);
  }
  return input;
}

const signAsDe = (papel: SignatarioInput["papel"]) =>
  papel === "testemunha" ? "witness" : papel === "contratada" ? "contractor" : "contractee";

export const enviarParaAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: contrato, error: cErr } = await supabase
      .from("juridico_contratos")
      .select("id, titulo")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contrato) throw new Error("Contrato não encontrado ou sem permissão");

    const cs = await import("./clicksign.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const doc = await cs.criarDocumento(data.nomeArquivo || "contrato.pdf", data.pdfBase64);

      const criados: any[] = [];
      for (const s of data.signatarios) {
        const signer = await cs.criarSignatario({
          nome: s.nome.trim(),
          email: s.email.trim().toLowerCase(),
          documento: s.documento ?? null,
          sign_as: signAsDe(s.papel) as any,
        });
        const list = await cs.vincularSignatario(doc.key, signer.key, signAsDe(s.papel), data.mensagem);
        await cs.notificarSignatario(list.request_signature_key, data.mensagem);
        criados.push({
          contrato_id: data.contratoId,
          nome: s.nome.trim(),
          email: s.email.trim().toLowerCase(),
          documento: s.documento ?? null,
          papel: s.papel,
          sign_as: signAsDe(s.papel),
          signer_key: signer.key,
          request_signature_key: list.request_signature_key,
          status: "pendente",
        });
      }

      await supabaseAdmin.from("juridico_assinaturas").delete().eq("contrato_id", data.contratoId);
      await supabaseAdmin.from("juridico_assinaturas").insert(criados);

      await supabaseAdmin
        .from("juridico_contratos")
        .update({
          clicksign_document_key: doc.key,
          clicksign_status: "enviado",
          clicksign_enviado_em: new Date().toISOString(),
          clicksign_assinado_em: null,
          clicksign_erro: null,
          status: "assinatura",
        })
        .eq("id", data.contratoId);

      await supabaseAdmin.from("juridico_historico").insert({
        contrato_id: data.contratoId,
        user_id: userId,
        acao: "enviou para assinatura (Clicksign)",
        detalhe: `${criados.length} signatário(s)`,
      });

      return { ok: true as const, documentKey: doc.key, signatarios: criados.length };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      await supabaseAdmin
        .from("juridico_contratos")
        .update({ clicksign_status: "erro", clicksign_erro: msg.slice(0, 500) })
        .eq("id", data.contratoId);
      throw new Error(msg);
    }
  });

/** Reconsulta o Clicksign e sincroniza o status local (fallback do webhook). */
export const sincronizarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contratoId: string }) => {
    if (!input?.contratoId) throw new Error("Contrato inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: contrato, error } = await context.supabase
      .from("juridico_contratos")
      .select("id, clicksign_document_key")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const key = (contrato as any)?.clicksign_document_key as string | null;
    if (!key) throw new Error("Contrato ainda não foi enviado ao Clicksign");

    const { sincronizarDocumento } = await import("./clicksign-sync.server");
    return sincronizarDocumento(key);
  });

/** Cancela o envio para assinatura e devolve o contrato para Validação. */
export const cancelarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contratoId: string; motivo?: string }) => {
    if (!input?.contratoId) throw new Error("Contrato inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: contrato, error } = await supabase
      .from("juridico_contratos")
      .select("id, status, clicksign_document_key, clicksign_status")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contrato) throw new Error("Contrato não encontrado ou sem permissão");

    const c = contrato as any;
    if (c.status === "concluido" || c.clicksign_status === "assinado") {
      throw new Error("Contrato já assinado/concluído — não é possível cancelar a assinatura.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let aviso: string | null = null;
    if (c.clicksign_document_key) {
      const cs = await import("./clicksign.server");
      try {
        await cs.cancelarDocumento(c.clicksign_document_key);
      } catch (err: any) {
        // Documento já finalizado/cancelado/removido no Clicksign: seguimos com a limpeza local.
        aviso = String(err?.message ?? err);
      }
    }


    await supabaseAdmin.from("juridico_assinaturas").delete().eq("contrato_id", data.contratoId);

    const { error: uErr } = await supabaseAdmin
      .from("juridico_contratos")
      .update({
        clicksign_document_key: null,
        clicksign_status: "nao_enviado",
        clicksign_enviado_em: null,
        clicksign_assinado_em: null,
        clicksign_erro: null,
        data_assinatura: null,
        status: "validacao",
      })
      .eq("id", data.contratoId);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("juridico_historico").insert({
      contrato_id: data.contratoId,
      user_id: userId,
      acao: "cancelou o envio para assinatura (Clicksign)",
      detalhe: data.motivo?.trim() || undefined,
    });

    return { ok: true as const };
  });
