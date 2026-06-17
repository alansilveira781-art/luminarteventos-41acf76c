import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dispara um tick do cron do Conta Azul a partir da UI (após iniciar uma
 * carga histórica) sem chamar o endpoint público `/api/public/contaazul/cron`
 * do navegador — assim não precisamos expor o apikey/segredo no browser.
 * Executa o mesmo trabalho do tick: processa um chunk histórico se houver.
 */
export const tickContaAzulHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { processNextHistoricoChunk } = await import("@/lib/conta-azul/sync.server");
    try {
      const result = await processNextHistoricoChunk();
      return { ok: true, result };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });
