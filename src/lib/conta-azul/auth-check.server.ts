// Helper to verify an authenticated user from a Bearer token in a server route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireAdminOfModule(request: Request, moduleSlug: string) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { error: "Não autenticado", status: 401 as const };
  const token = auth.slice(7);

  const { data: userRes, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !userRes?.user) return { error: "Token inválido", status: 401 as const };

  const userId = userRes.user.id;
  const { data: ok, error: rpcErr } = await (supabaseAdmin as any).rpc("is_module_admin", {
    _user_id: userId,
    _slug: moduleSlug,
  });
  if (rpcErr) return { error: rpcErr.message, status: 500 as const };
  if (!ok) return { error: "Acesso negado (requer admin do módulo)", status: 403 as const };
  return { userId };
}
