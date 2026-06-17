import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que existe uma sessão válida antes de uma operação de escrita.
 * Se a sessão estiver ausente/expirada, tenta renovar; se ainda assim falhar,
 * lança um erro claro para o usuário refazer login.
 */
export async function ensureValidSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  const now = Math.floor(Date.now() / 1000);
  const expired = !session || (session.expires_at && session.expires_at <= now + 5);
  if (expired) {
    const { data: ref, error } = await supabase.auth.refreshSession();
    if (error || !ref.session) {
      throw new Error("Sua sessão expirou. Faça login novamente para continuar.");
    }
    session = ref.session;
  }
  if (!session) {
    throw new Error("Sua sessão expirou. Faça login novamente para continuar.");
  }
}

/**
 * Traduz erros do Supabase/PostgREST para mensagens claras (RLS, sessão, etc).
 */
export function describeSupabaseError(err: any): string {
  const code = err?.code || err?.details?.code;
  const msg = String(err?.message ?? err ?? "");
  if (code === "42501" || /row-level security|permission denied|policy/i.test(msg)) {
    return "Sem permissão para registrar — verifique o acesso ao módulo Estoque.";
  }
  if (/jwt|token|session|expired/i.test(msg)) {
    return "Sua sessão expirou. Faça login novamente para continuar.";
  }
  return msg || "Erro ao processar a operação.";
}
