// Helper to verify an authenticated user from a Bearer token in a server route.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireAdminOfModule(request: Request, moduleSlug: string) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { error: "Não autenticado", status: 401 as const };
  const token = auth.slice(7);

  const supaUrl = process.env.SUPABASE_URL!;
  const supaAnon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!;
  const c = createClient(supaUrl, supaAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error } = await c.auth.getUser(token);
  if (error || !userRes.user) return { error: "Token inválido", status: 401 as const };

  const userId = userRes.user.id;
  const { data: ok, error: rpcErr } = await (supabaseAdmin as any).rpc("is_module_admin", {
    _user_id: userId,
    _slug: moduleSlug,
  });
  if (rpcErr) return { error: rpcErr.message, status: 500 as const };
  if (!ok) return { error: "Acesso negado (requer admin do módulo)", status: 403 as const };
  return { userId };
}
