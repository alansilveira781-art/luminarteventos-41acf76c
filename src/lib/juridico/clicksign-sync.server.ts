/**
 * Sincroniza o estado de um documento do Clicksign com o contrato local.
 * Usado tanto pelo webhook quanto pela sincronização manual.
 */
import { obterDocumento, baixarAssinado } from "./clicksign.server";

export async function sincronizarDocumento(documentKey: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: contrato } = await supabaseAdmin
    .from("juridico_contratos")
    .select("id, titulo, clicksign_status")
    .eq("clicksign_document_key", documentKey)
    .maybeSingle();
  if (!contrato) return { ok: false as const, motivo: "contrato_nao_encontrado" };

  const doc = await obterDocumento(documentKey);
  const assinados = (doc.signers ?? []).filter((s) => !!s.signed_at);

  for (const s of doc.signers ?? []) {
    if (!s.key) continue;
    await supabaseAdmin
      .from("juridico_assinaturas")
      .update({ status: s.signed_at ? "assinado" : "pendente", assinado_em: s.signed_at ?? null })
      .eq("contrato_id", (contrato as any).id)
      .eq("signer_key", s.key);
  }

  const fechado = ["closed", "signed", "finished"].includes(String(doc.status ?? "").toLowerCase());
  const total = (doc.signers ?? []).length;

  let novoStatus: string = fechado ? "assinado" : assinados.length > 0 ? "parcial" : "enviado";

  if (fechado) {
    await anexarAssinado(documentKey, (contrato as any).id, (contrato as any).titulo);
  }

  await supabaseAdmin
    .from("juridico_contratos")
    .update({
      clicksign_status: novoStatus,
      clicksign_assinado_em: fechado ? new Date().toISOString() : null,
      ...(fechado ? { data_assinatura: new Date().toISOString().slice(0, 10) } : {}),
    })
    .eq("id", (contrato as any).id);

  return { ok: true as const, status: novoStatus, assinados: assinados.length, total };
}

export async function marcarRecusa(documentKey: string, detalhe?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: contrato } = await supabaseAdmin
    .from("juridico_contratos")
    .select("id")
    .eq("clicksign_document_key", documentKey)
    .maybeSingle();
  if (!contrato) return;
  await supabaseAdmin
    .from("juridico_contratos")
    .update({ clicksign_status: "recusado", clicksign_erro: (detalhe ?? "Assinatura recusada").slice(0, 500) })
    .eq("id", (contrato as any).id);
  await supabaseAdmin.from("juridico_historico").insert({
    contrato_id: (contrato as any).id,
    acao: "assinatura recusada (Clicksign)",
    detalhe: detalhe ?? null,
  });
}

/** Baixa o PDF assinado e anexa ao card, evitando duplicidade. */
async function anexarAssinado(documentKey: string, contratoId: string, titulo?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: jaTem } = await supabaseAdmin
    .from("juridico_anexos")
    .select("id")
    .eq("contrato_id", contratoId)
    .eq("tipo", "contrato_assinado")
    .limit(1);
  if (jaTem && jaTem.length > 0) return;

  const bytes = await baixarAssinado(documentKey);
  if (!bytes) return;

  const nome = `${(titulo ?? "contrato").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 60)} - assinado.pdf`;
  const path = `${contratoId}/${Date.now()}_assinado.pdf`;

  const { error: upErr } = await supabaseAdmin.storage
    .from("juridico-anexos")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) {
    console.error("Falha ao subir PDF assinado:", upErr.message);
    return;
  }

  await supabaseAdmin.from("juridico_anexos").insert({
    contrato_id: contratoId,
    nome,
    path,
    mime_type: "application/pdf",
    tamanho: bytes.byteLength,
    tipo: "contrato_assinado",
  });

  await supabaseAdmin.from("juridico_historico").insert({
    contrato_id: contratoId,
    acao: "contrato assinado (Clicksign)",
    detalhe: "PDF assinado anexado automaticamente",
  });
}
