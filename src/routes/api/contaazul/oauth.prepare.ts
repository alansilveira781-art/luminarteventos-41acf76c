import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "crypto";
import { buildAuthorizeUrl } from "@/lib/conta-azul/client.server";
import { requireAdminOfModule } from "@/lib/conta-azul/auth-check.server";

function getRedirectUri(request: Request) {
  const url = new URL(request.url);
  return `${url.origin}/api/contaazul/oauth/callback`;
}

export const Route = createFileRoute("/api/contaazul/oauth/prepare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await requireAdminOfModule(request, "financeiro");
        if ("error" in guard) {
          return new Response(JSON.stringify({ error: guard.error }), {
            status: guard.status,
            headers: { "Content-Type": "application/json" },
          });
        }
        const state = randomBytes(24).toString("hex");
        setCookie("ca_oauth_state", state, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });
        const redirectUri = getRedirectUri(request);
        const authorizeUrl = buildAuthorizeUrl(redirectUri, state);
        return new Response(JSON.stringify({ url: authorizeUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
