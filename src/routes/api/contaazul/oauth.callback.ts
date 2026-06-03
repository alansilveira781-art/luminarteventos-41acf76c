import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import { exchangeCodeForTokens, saveTokens } from "@/lib/conta-azul/client.server";

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

export const Route = createFileRoute("/api/contaazul/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const base = `${url.origin}/financeiro/conta-azul`;
          const back = (msg: string, ok = false) =>
            redirect(`${base}?${ok ? "connected=1" : `error=${encodeURIComponent(msg)}`}`);

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          let cookieState: string | undefined;
          try {
            cookieState = getCookie("ca_oauth_state");
            deleteCookie("ca_oauth_state", { path: "/" });
          } catch {
            // ignore cookie errors
          }

          if (error) return back(`Autorização negada: ${error}`);
          if (!code || !state) return back("Resposta inválida do Conta Azul");
          if (!cookieState || cookieState !== state) {
            return back("Sessão expirada. Clique novamente em 'Conectar' dentro do app para iniciar o fluxo.");
          }

          try {
            const redirectUri = `${url.origin}/api/contaazul/oauth/callback`;
            const tokens = await exchangeCodeForTokens(code, redirectUri);
            await saveTokens(tokens);
            return back("ok", true);
          } catch (e: any) {
            console.error("[contaazul/oauth/callback] token exchange failed", e);
            return back(String(e?.message ?? e));
          }
        } catch (e: any) {
          console.error("[contaazul/oauth/callback] unhandled error", e);
          // Last-resort fallback: never let h3 swallow this into a 500 JSON.
          try {
            const origin = new URL(request.url).origin;
            return redirect(
              `${origin}/financeiro/conta-azul?error=${encodeURIComponent(
                "Falha inesperada no callback. Tente conectar novamente.",
              )}`,
            );
          } catch {
            return new Response("Falha inesperada no callback do Conta Azul.", {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
        }
      },
    },
  },
});
