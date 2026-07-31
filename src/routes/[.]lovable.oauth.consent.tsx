import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import logo from "@/assets/luminart-logo.png";

type OAuthDetails = {
  client?: { name?: string; client_uri?: string; redirect_uris?: string[] } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Requisição de autorização inválida (authorization_id ausente).");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Não foi possível carregar a autorização</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </Card>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "Aplicativo externo";
  const redirectUri = details?.client?.redirect_uris?.[0];

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um endereço de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Luminart" className="h-14 w-14 object-contain" />
          <h1 className="mt-4 text-lg font-semibold">
            Conectar {clientName} ao Grupo Luminart
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Isso permite que {clientName} use este sistema como você, através das ferramentas habilitadas.
          </p>
        </div>

        <div className="mt-6 space-y-2 rounded-md border bg-muted/40 p-4 text-sm">
          <p className="font-medium">O que será compartilhado</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Seu perfil básico e e-mail</li>
            <li>Consultas de eventos, compras, despesas, estoque e resumos financeiros</li>
          </ul>
          {redirectUri && (
            <p className="pt-2 text-xs text-muted-foreground break-all">Retorno: {redirectUri}</p>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Isso não ignora as permissões do sistema: só é possível ver o que a sua conta já pode ver.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Processando…" : "Aprovar conexão"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Cancelar conexão
          </Button>
        </div>
      </Card>
    </div>
  );
}
