// Uber for Business OAuth (client_credentials)
let cached: { token: string; scope: string; exp: number } | null = null;

export async function getUberAccessToken(scope = "business.trips"): Promise<string> {
  const clientId = process.env.UBER_CLIENT_ID;
  const clientSecret = process.env.UBER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Uber não configuradas (UBER_CLIENT_ID / UBER_CLIENT_SECRET)");
  }

  if (cached && cached.scope === scope && cached.exp > Date.now() + 30_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope,
  });

  const res = await fetch("https://auth.uber.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("invalid_scope")) {
      throw new Error(
        `Escopo "${scope}" não está habilitado no seu app Uber. Acesse developer.uber.com → seu app → Auth → OAuth Scopes e habilite "${scope}" (pode exigir aprovação da Uber for Business).`,
      );
    }
    throw new Error(`Falha ao autenticar na Uber (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, scope, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}
