// Cliente mínimo da API do Dropbox (server-only).
// Usa refresh token de longa duração do app criado no Dropbox App Console.

type Creds = { appKey: string; appSecret: string; refreshToken: string };

function lerCreds(): Creds {
  const appKey = process.env["DROPBOX_APP_KEY"];
  const appSecret = process.env["DROPBOX_APP_SECRET"];
  const refreshToken = process.env["DROPBOX_REFRESH_TOKEN"];
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error(
      "Integração com o Dropbox não configurada (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN).",
    );
  }
  return { appKey, appSecret, refreshToken };
}

async function accessToken(): Promise<string> {
  const { appKey, appSecret, refreshToken } = lerCreds();
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
    },
    body,
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Falha na autenticação do Dropbox [${res.status}]: ${texto}`);
  const json = JSON.parse(texto);
  if (!json?.access_token) throw new Error("Dropbox não retornou access_token");
  return json.access_token as string;
}

async function rpc(token: string, path: string, arg: unknown): Promise<any> {
  const res = await fetch(`https://api.dropboxapi.com/2/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const texto = await res.text();
  if (!res.ok) {
    const err: any = new Error(`Dropbox ${path} falhou [${res.status}]: ${texto}`);
    err.body = texto;
    err.status = res.status;
    throw err;
  }
  return texto ? JSON.parse(texto) : null;
}

export type DropboxClient = {
  criarPasta(path: string): Promise<void>;
  enviarArquivo(path: string, bytes: ArrayBuffer | Uint8Array): Promise<void>;
  linkCompartilhado(path: string): Promise<string | null>;
};

export async function dropboxClient(): Promise<DropboxClient> {
  const token = await accessToken();

  return {
    async criarPasta(path: string) {
      try {
        await rpc(token, "files/create_folder_v2", { path, autorename: false });
      } catch (e: any) {
        // Pasta já existente é sucesso para o nosso fluxo.
        if (typeof e?.body === "string" && /conflict/.test(e.body)) return;
        throw e;
      }
    },

    async enviarArquivo(path: string, bytes: ArrayBuffer | Uint8Array) {
      const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({ path, mode: "add", autorename: true, mute: true }),
        },
        body: bytes instanceof Uint8Array ? (bytes.slice().buffer as ArrayBuffer) : bytes,
      });
      if (!res.ok) {
        const texto = await res.text();
        throw new Error(`Falha ao enviar arquivo ao Dropbox [${res.status}]: ${texto}`);
      }
    },

    async linkCompartilhado(path: string) {
      try {
        const r = await rpc(token, "sharing/create_shared_link_with_settings", { path });
        return r?.url ?? null;
      } catch (e: any) {
        // Link já existe: recupera o existente.
        if (typeof e?.body === "string" && /shared_link_already_exists/.test(e.body)) {
          try {
            const r = await rpc(token, "sharing/list_shared_links", { path, direct_only: true });
            return r?.links?.[0]?.url ?? null;
          } catch {
            return null;
          }
        }
        return null;
      }
    },
  };
}
