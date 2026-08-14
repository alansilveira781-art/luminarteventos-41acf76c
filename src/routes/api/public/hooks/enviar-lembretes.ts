import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireProjectApiKey } from "@/lib/public-endpoint-auth";
import { lembreteVenceu } from "@/lib/lembretes";

export const VAPID_PUBLIC_KEY =
  "BLrAMB5j4yyM2glgoeCxm76pn4n21HHeRMy57LofyqmNSZlAvSELhsVjdLUBZGwQOb5LuwjwiAwyXlmmXRI2x08";

export const Route = createFileRoute("/api/public/hooks/enviar-lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireProjectApiKey(request);
        if (denied) return denied;

        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!privateKey) {
          return new Response("VAPID not configured", { status: 500 });
        }

        // Tarefas pendentes cujo horário do lembrete já passou e ainda não foram notificadas.
        const { data: tarefas, error } = await supabaseAdmin
          .from("lembretes_tarefas")
          .select("id, user_id, titulo, data_hora, dia_inteiro, lembrete_min, projeto_id, lembretes_projetos(nome)")
          .is("notificada_em", null)
          .eq("status", "pendente")
          .lte("data_hora", new Date(Date.now() + 60_000).toISOString());

        if (error) {
          console.error("[enviar-lembretes] erro ao buscar tarefas:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!tarefas || tarefas.length === 0) {
          return new Response(JSON.stringify({ sent: 0, total: 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const vapid = {
          subject: process.env.VAPID_SUBJECT || "mailto:contato@luminart.com",
          publicKey: VAPID_PUBLIC_KEY,
          privateKey,
        };

        const userIds = [...new Set(tarefas.map((t) => t.user_id as string))];
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth")
          .in("user_id", userIds);

        const subsByUser = new Map<string, typeof subs>();
        for (const s of subs ?? []) {
          const list = subsByUser.get(s.user_id as string) ?? [];
          list.push(s);
          subsByUser.set(s.user_id as string, list);
        }

        let sent = 0;
        const notifiedIds: string[] = [];
        const results: Array<{ id: string; ok: boolean; status?: number; error?: string }> = [];

        for (const t of tarefas) {
          const userSubs = subsByUser.get(t.user_id as string) ?? [];
          const projetoNome = (t.lembretes_projetos as any)?.nome;
          const hora = t.dia_inteiro ? "dia inteiro" : formatarHora(t.data_hora as string);
          const body = `${hora}${projetoNome ? ` · ${projetoNome}` : ""}`;
          const message = {
            data: {
              title: t.titulo as string,
              body,
              link: "/lembretes",
            },
            options: { ttl: 60 * 60 * 24, urgency: "high" as const },
          };

          notifiedIds.push(t.id as string);

          if (userSubs.length === 0) continue;

          await Promise.all(
            userSubs.map(async (s) => {
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
                  results.push({ id: s.id as string, ok: false, status: res.status, error: "expired-removed" });
                } else if (res.ok) {
                  sent++;
                  results.push({ id: s.id as string, ok: true, status: res.status });
                } else {
                  const body = await res.text().catch(() => "");
                  results.push({ id: s.id as string, ok: false, status: res.status, error: body.slice(0, 200) });
                }
              } catch (err) {
                results.push({
                  id: s.id as string,
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }),
          );
        }

        // Marca todas as tarefas processadas como notificadas para evitar reenvio.
        if (notifiedIds.length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from("lembretes_tarefas")
            .update({ notificada_em: new Date().toISOString() })
            .in("id", notifiedIds);
          if (updateError) {
            console.error("[enviar-lembretes] erro ao marcar notificadas:", updateError);
          }
        }

        return new Response(JSON.stringify({ sent, total: tarefas.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

function formatarHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
