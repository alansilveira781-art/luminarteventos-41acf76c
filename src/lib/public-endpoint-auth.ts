// Helpers para autenticar chamadas a endpoints /api/public/*.
// Esses endpoints bypassam a autenticação do Lovable, então cada handler
// precisa validar o chamador antes de executar trabalho.

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const apikey = request.headers.get("apikey");
  if (apikey) return apikey.trim();
  const url = new URL(request.url);
  const qp = url.searchParams.get("token");
  if (qp) return qp.trim();
  return null;
}

/**
 * Valida que a chamada traz a chave anon (publishable) do projeto.
 * Usado em endpoints internos disparados por pg_cron — o job já envia
 * `apikey: <anon>` por padrão.
 */
export function requireProjectApiKey(request: Request): Response | null {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!expected) {
    return new Response("Server misconfigured: missing publishable key", { status: 500 });
  }
  const got = extractBearer(request);
  if (!got || !timingSafeEqualStr(got, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/**
 * Valida um token dedicado (ex.: webhook externo do Dropbox).
 * O segredo é lido de process.env[envName].
 */
export function requireSharedSecret(request: Request, envName: string): Response | null {
  const expected = process.env[envName];
  if (!expected) {
    return new Response(`Server misconfigured: missing ${envName}`, { status: 500 });
  }
  const got = extractBearer(request);
  if (!got || !timingSafeEqualStr(got, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
