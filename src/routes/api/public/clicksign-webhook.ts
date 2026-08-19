import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/clicksign-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CLICKSIGN_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook não configurado", { status: 500 });

        const raw = await request.text();
        const header = request.headers.get("content-hmac") ?? request.headers.get("Content-Hmac") ?? "";
        const recebido = header.replace(/^sha256=/i, "").trim();
        const esperado = createHmac("sha256", secret).update(raw).digest("hex");

        const a = Buffer.from(recebido, "utf8");
        const b = Buffer.from(esperado, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Assinatura inválida", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const evento = String(payload?.event?.name ?? "");
        const documentKey = payload?.document?.key ?? payload?.event?.data?.document?.key;
        if (!documentKey) return new Response("ok");

        const { sincronizarDocumento, marcarRecusa } = await import("@/lib/juridico/clicksign-sync.server");

        try {
          if (evento === "refusal" || evento === "document_refused") {
            const motivo = payload?.event?.data?.refusal?.reason ?? payload?.event?.data?.user?.email;
            await marcarRecusa(documentKey, motivo ? `Recusado: ${motivo}` : undefined);
          } else {
            await sincronizarDocumento(documentKey);
          }
        } catch (e: any) {
          console.error("Erro ao processar webhook Clicksign:", e?.message ?? e);
          return new Response("Erro interno", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
