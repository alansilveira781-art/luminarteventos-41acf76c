// Server-only Conta Azul OAuth + API client.
// IMPORTANT: never import this file from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AUTH_BASE = "https://auth.contaazul.com";
const TOKEN_URL = `${AUTH_BASE}/oauth2/token`;
const AUTHORIZE_URL = `${AUTH_BASE}/oauth2/authorize`;
const API_BASE = `https://api-v2.contaazul.com/v1`;

export function getClientCreds() {
  const id = process.env.CONTA_AZUL_CLIENT_ID;
  const secret = process.env.CONTA_AZUL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("CONTA_AZUL_CLIENT_ID/SECRET não configurados");
  return { id, secret };
}

// Full scope set needed to read Plano de Contas, Centros de Custo,
// Contas a Pagar/Receber e Extrato Bancário.
const DEFAULT_SCOPES = "openid profile aws.cognito.signin.user.admin";

export function buildAuthorizeUrl(redirectUri: string, state: string, scope = DEFAULT_SCOPES) {
  const { id } = getClientCreds();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { id, secret } = getClientCreds();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Conta Azul token error [${res.status}]: ${text}`);
  return JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
}

async function refreshTokens(refreshToken: string) {
  const { id, secret } = getClientCreds();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Conta Azul refresh error [${res.status}]: ${text}`);
  return JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

async function getCredsRow() {
  const { data, error } = await (supabaseAdmin as any)
    .from("conta_azul_credentials")
    .select("*")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        id: string;
        access_token: string;
        refresh_token: string;
        expires_at: string;
        scope: string | null;
      }
    | null;
}

export async function saveTokens(
  tokens: { access_token: string; refresh_token: string; expires_in: number; scope?: string },
  connectedBy?: string,
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  // single-row table: clear and insert
  await (supabaseAdmin as any).from("conta_azul_credentials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await (supabaseAdmin as any).from("conta_azul_credentials").insert({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope ?? null,
    connected_by: connectedBy ?? null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getValidAccessToken(): Promise<string> {
  const row = await getCredsRow();
  if (!row) throw new Error("Conta Azul não conectado");
  const expiresAt = new Date(row.expires_at).getTime();
  // Refresh if expiring within 60s
  if (Date.now() < expiresAt - 60_000) return row.access_token;
  const refreshed = await refreshTokens(row.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await (supabaseAdmin as any)
    .from("conta_azul_credentials")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

async function forceRefreshToken(): Promise<string> {
  const row = await getCredsRow();
  if (!row) throw new Error("Conta Azul não conectado");
  const refreshed = await refreshTokens(row.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await (supabaseAdmin as any)
    .from("conta_azul_credentials")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

const RETRY_STATUSES = new Set([408, 429, 502, 503, 504]);
const MAX_ATTEMPTS = 6;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function caFetch(path: string, init: RequestInit = {}) {
  const doFetch = async (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

  let token = await getValidAccessToken();
  let res: Response | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      res = await doFetch(token);
    } catch (e) {
      if (attempt < MAX_ATTEMPTS) {
        const wait = 1000 * 2 ** (attempt - 1);
        console.warn(`[caFetch] ${path} network error (attempt ${attempt}/${MAX_ATTEMPTS}), retry in ${wait}ms`, e);
        await sleep(wait);
        continue;
      }
      throw e;
    }

    // 401 -> force token refresh once, then retry the same attempt
    if (res.status === 401 && attempt === 1) {
      try {
        token = await forceRefreshToken();
        res = await doFetch(token);
      } catch {
        // fall through
      }
    }

    if (res.ok) break;

    if (RETRY_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 15000)
        : 1000 * 2 ** (attempt - 1);
      console.warn(`[caFetch] ${path} ${res.status} (attempt ${attempt}/${MAX_ATTEMPTS}), retry in ${wait}ms`);
      await sleep(wait);
      continue;
    }

    break; // non-retryable
  }

  if (!res) throw new Error(`Conta Azul API ${path}: sem resposta`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Conta Azul API ${path} [${res.status}]: ${text.slice(0, 500)}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export async function isConnected() {
  const row = await getCredsRow();
  return Boolean(row);
}

export async function getConnectionInfo() {
  const row = await getCredsRow();
  if (!row) return { connected: false as const };
  return { connected: true as const, expires_at: row.expires_at, scope: row.scope };
}

export async function disconnect() {
  await (supabaseAdmin as any).from("conta_azul_credentials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
