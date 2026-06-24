import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireProjectApiKey } from "@/lib/public-endpoint-auth";

export const VAPID_PUBLIC_KEY =
  "BLlTDNBlWcPNSlscKsQamo6lkYcZba-1nBHzF0PeKovUqisCFaxOVHQuP-5KT9-F9wgjtXUFcuPAlOG2Wt2ks3k";

const BodySchema = z.object({
  notificacao_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireProjectApiKey(request);
        if (denied) return denied;

        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!privateKey) {
          return new Response("VAPID not configured", { status: 500 });
        }

        let payload: { notificacao_id: string };
        try {
          payload = BodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        // Buscar a notificação
        const { data: notif, error } = await supabaseAdmin
          .from("notificacoes")
          .select("id, user_id, titulo, mensagem, link")
          .eq("id", payload.notificacao_id)
          .single();

        if (error || !notif) {
          return new Response("Notification not found", { status: 404 });
        }

        // Buscar dispositivos do usuário
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", notif.user_id);

        if (!subs || subs.length === 0) {
          return new Response(JSON.stringify({ sent: 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const vapid = {
          subject: process.env.VAPID_SUBJECT || "mailto:contato@luminart.com",
          publicKey: VAPID_PUBLIC_KEY,
          privateKey,
        };

        const message = {
          data: {
            title: notif.titulo as string,
            body: (notif.mensagem as string) ?? "",
            link: (notif.link as string) ?? "/",
          },
          options: { ttl: 60 * 60 * 24, urgency: "high" as const },
        };

        let sent = 0;
        await Promise.all(
          subs.map(async (s) => {
            const subscription = {
              endpoint: s.endpoint as string,
              expirationTime: null,
              keys: { auth: s.auth as string, p256dh: s.p256dh as string },
            };
            try {
              const req = await buildPushPayload(message, subscription, vapid);
              const res = await fetch(s.endpoint as string, {
                method: req.method,
                headers: req.headers,
                body: req.body as BodyInit,
              });
              if (res.status === 404 || res.status === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
              } else if (res.ok) {
                sent++;
              }
            } catch {
              // ignora falhas individuais
            }
          }),
        );

        return new Response(JSON.stringify({ sent }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
