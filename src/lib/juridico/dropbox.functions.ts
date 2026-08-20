import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  contratoId: string;
  caminho: string;
  enviarAnexos?: boolean;
};

function validar(input: Input): Input {
  if (!input?.contratoId) throw new Error("Contrato inválido");
  const caminho = (input?.caminho ?? "").trim();
  if (!caminho.startsWith("/")) throw new Error("Caminho da pasta inválido");
  if (caminho.split("/").filter(Boolean).length < 2) throw new Error("Caminho da pasta incompleto");
  return { ...input, caminho: caminho.replace(/\/+$/, "") };
}

/**
 * Cria a estrutura de pastas do evento no Dropbox e envia os anexos
 * (contrato assinado e proposta) para a subpasta de documentos.
 */
export const criarPastasContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { SUBPASTAS, SUBPASTA_DOCS } = await import("./dropbox-paths");
    const { dropboxClient } = await import("./dropbox.server");

    const dbx = await dropboxClient();

    // Cria os níveis de cima para baixo (ano, mês, pasta do evento).
    const partes = data.caminho.split("/").filter(Boolean);
    let acumulado = "";
    for (const p of partes) {
      acumulado += `/${p}`;
      await dbx.criarPasta(acumulado);
    }
    for (const sub of SUBPASTAS) {
      await dbx.criarPasta(`${data.caminho}/${sub}`);
    }

    const enviados: string[] = [];
    if (data.enviarAnexos !== false) {
      const { data: anexos } = await (supabase as any)
        .from("juridico_anexos")
        .select("nome,path,tipo,created_at")
        .eq("contrato_id", data.contratoId)
        .in("tipo", ["contrato_assinado", "contrato", "proposta"])
        .order("created_at", { ascending: false });

      const escolhidos: any[] = [];
      const doc = (anexos ?? []).find((a: any) => a.tipo === "contrato_assinado")
        ?? (anexos ?? []).find((a: any) => a.tipo === "contrato");
      if (doc) escolhidos.push(doc);
      const proposta = (anexos ?? []).find((a: any) => a.tipo === "proposta");
      if (proposta) escolhidos.push(proposta);

      for (const anexo of escolhidos) {
        const { data: file, error } = await (supabase as any).storage
          .from("juridico-anexos")
          .download(anexo.path);
        if (error || !file) continue;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const nome = String(anexo.nome ?? "arquivo.pdf").replace(/[\\/:?*<>"|]+/g, " ").trim();
        await dbx.enviarArquivo(`${data.caminho}/${SUBPASTA_DOCS}/${nome}`, bytes);
        enviados.push(nome);
      }
    }

    const url = await dbx.linkCompartilhado(data.caminho);

    await (supabase as any)
      .from("juridico_contratos")
      .update({ dropbox_path: data.caminho, dropbox_url: url })
      .eq("id", data.contratoId);

    return { path: data.caminho, url, enviados };
  });
