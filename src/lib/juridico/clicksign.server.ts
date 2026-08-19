/**
 * Cliente da API do Clicksign (v1). Uso exclusivo no servidor.
 * Base padrão: sandbox. Configure CLICKSIGN_BASE_URL para produção.
 */

export type ClicksignSigner = {
  nome: string;
  email: string;
  documento?: string | null;
  /** party = parte do contrato, witness = testemunha */
  sign_as: "party" | "witness" | "contractor" | "contractee";
};

function baseUrl() {
  return (process.env["CLICKSIGN_BASE_URL"] || "https://sandbox.clicksign.com").replace(/\/$/, "");
}

function token() {
  const t = process.env["CLICKSIGN_API_TOKEN"];
  if (!t) throw new Error("CLICKSIGN_API_TOKEN não configurado");
  return t;
}

async function call(path: string, init: RequestInit & { method: string }) {
  const url = `${baseUrl()}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token())}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Clicksign ${init.method} ${path} falhou [${res.status}]: ${text}`);
    throw new Error(mensagemErro(res.status, text));
  }
  return text ? JSON.parse(text) : {};
}

/** Cria o documento a partir de um PDF em base64 (sem prefixo data:). */
export async function criarDocumento(nomeArquivo: string, pdfBase64: string) {
  const safe = nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
  const json = await call("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify({
      document: {
        path: `/Contratos/${Date.now()}_${safe}`,
        content_base64: `data:application/pdf;base64,${pdfBase64}`,
        deadline_at: null,
        auto_close: true,
        locale: "pt-BR",
        sequence_enabled: false,
      },
    }),
  });
  return json.document as { key: string; status: string };
}

export async function criarSignatario(s: ClicksignSigner) {
  const json = await call("/api/v1/signers", {
    method: "POST",
    body: JSON.stringify({
      signer: {
        email: s.email,
        name: s.nome,
        documentation: (s.documento ?? "").replace(/\D/g, "") || undefined,
        auths: ["email"],
        delivery: "email",
        has_documentation: !!(s.documento ?? "").replace(/\D/g, ""),
      },
    }),
  });
  return json.signer as { key: string };
}

export async function vincularSignatario(documentKey: string, signerKey: string, signAs: string, mensagem?: string) {
  const json = await call("/api/v1/lists", {
    method: "POST",
    body: JSON.stringify({
      list: { document_key: documentKey, signer_key: signerKey, sign_as: signAs, message: mensagem ?? undefined },
    }),
  });
  return json.list as { request_signature_key: string };
}

export async function notificarSignatario(requestSignatureKey: string, mensagem?: string) {
  await call("/api/v1/notifications", {
    method: "POST",
    body: JSON.stringify({ request_signature_key: requestSignatureKey, message: mensagem ?? undefined }),
  });
}

export async function obterDocumento(documentKey: string) {
  const json = await call(`/api/v1/documents/${encodeURIComponent(documentKey)}`, { method: "GET" });
  return json.document as {
    key: string;
    status: string;
    downloads?: { signed_file_url?: string; original_file_url?: string };
    signers?: Array<{ key: string; signed_at?: string | null; email?: string }>;
  };
}

/** Baixa o PDF assinado. Retorna bytes prontos para upload no storage. */
export async function baixarAssinado(documentKey: string): Promise<Uint8Array | null> {
  const doc = await obterDocumento(documentKey);
  const url = doc.downloads?.signed_file_url;
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Clicksign download assinado falhou [${res.status}]`);
    return null;
  }
  return new Uint8Array(await res.arrayBuffer());
}
