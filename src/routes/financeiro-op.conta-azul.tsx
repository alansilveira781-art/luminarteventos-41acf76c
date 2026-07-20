import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Link2, RefreshCw, Unplug, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/financeiro-op/conta-azul")({
  component: ContaAzulPage,
});

const RECURSOS = [
  { key: "plano_contas", label: "Plano de Contas" },
  { key: "centros_custo", label: "Centros de Custo" },
  { key: "contas_pagar", label: "Contas a Pagar" },
  { key: "contas_receber", label: "Contas a Receber" },
  { key: "extrato", label: "Extrato Bancário" },
] as const;
type RecursoKey = (typeof RECURSOS)[number]["key"];

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function ContaAzulPage() {
  const qc = useQueryClient();
  const { isAdmin, isModuleAdmin } = useAuth();
  const canManage = isAdmin || isModuleAdmin("financeiro");

  const [defaults] = useState(() => {
    const today = new Date();
    const from = new Date(today);
    from.setMonth(from.getMonth() - 6);
    const to = new Date(today);
    to.setMonth(to.getMonth() + 12);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  });
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect" | "reproc">(null);
  const [progress, setProgress] = useState<{ current: RecursoKey | null; done: number }>({
    current: null,
    done: 0,
  });
  type ReprocResult = {
    tentados: number;
    corrigidos: number;
    falhas: number;
    restantes: number;
    concluido: boolean;
    modo: "suspeitos" | "todos";
  };
  const [reprocMode, setReprocMode] = useState<"suspeitos" | "todos" | null>(null);
  const [reprocProgress, setReprocProgress] = useState<ReprocResult | null>(null);
  const [reprocLastResult, setReprocLastResult] = useState<ReprocResult | null>(null);
  const [reprocTotals, setReprocTotals] = useState<{ corrigidos: number; falhas: number; lotes: number }>({
    corrigidos: 0,
    falhas: 0,
    lotes: 0,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast.success("Conta Azul conectado com sucesso!");
      window.history.replaceState({}, "", window.location.pathname);
      qc.invalidateQueries({ queryKey: ["ca-status"] });
    } else if (params.get("error")) {
      toast.error(params.get("error")!);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [qc]);

  const status = useQuery({
    queryKey: ["ca-status"],
    enabled: canManage,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch("/api/contaazul/status", { headers: await authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ connected: boolean; expires_at?: string; scope?: string | null }>;
    },
  });

  async function handleConnect() {
    try {
      setBusy("connect");
      const res = await fetch("/api/contaazul/oauth/prepare", {
        method: "POST",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch (e: any) {
      toast.error(`Erro ao iniciar conexão: ${e?.message ?? e}`);
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Tem certeza que deseja desconectar o Conta Azul?")) return;
    try {
      setBusy("disconnect");
      const res = await fetch("/api/contaazul/status", {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Conta Azul desconectado");
      qc.invalidateQueries({ queryKey: ["ca-status"] });
    } catch (e: any) {
      toast.error(`Erro ao desconectar: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleSync(modo: "incremental" | "completo") {
    setBusy("sync");
    setProgress({ current: null, done: 0 });
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    let total = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < RECURSOS.length; i++) {
        const r = RECURSOS[i];
        setProgress({ current: r.key, done: i });
        try {
          const res = await fetch("/api/contaazul/sync", {
            method: "POST",
            headers,
            body: JSON.stringify({ from, to, recurso: r.key, modo }),
          });
          if (!res.ok) throw new Error(await res.text());
          const { qtd } = (await res.json()) as { qtd: number };
          total += qtd ?? 0;
        } catch (e: any) {
          const raw = String(e?.message ?? e);
          const friendly = /503|instabilidade|temporariamente/i.test(raw)
            ? `${r.label}: Conta Azul instável no momento (503). Tente novamente em alguns minutos.`
            : `${r.label}: ${raw}`;
          errors.push(friendly);
        }
      }
      if (errors.length > 0) {
        toast.error(`Sincronização parcial (${total} reg.). ${errors.join(" | ")}`);
      } else {
        toast.success(`Sincronização concluída — ${total} registros`);
      }
    } finally {
      setBusy(null);
      setProgress({ current: null, done: 0 });
    }
  }

  async function handleReprocessarRateios(
    modo: "suspeitos" | "todos",
    opts: { auto?: boolean } = {},
  ) {
    setBusy("reproc");
    setReprocMode(modo);
    if (!opts.auto) setReprocTotals({ corrigidos: 0, falhas: 0, lotes: 0 });
    else setReprocTotals({ corrigidos: 0, falhas: 0, lotes: 0 });
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    try {
      let lastResult: ReprocResult | null = null;
      // Loop: modo "todos" com opts.auto=true continua chamando até concluido.
      // Demais casos: um único lote.
      // Limite de segurança de 200 lotes para evitar loop infinito.
      for (let i = 0; i < 200; i++) {
        const res = await fetch("/api/contaazul/reprocessar-rateios", {
          method: "POST",
          headers,
          body: JSON.stringify({ modo, limite: 40 }),
        });
        if (!res.ok) throw new Error(await res.text());
        const r = (await res.json()) as ReprocResult;
        lastResult = r;
        setReprocProgress(r);
        setReprocTotals((t) => ({
          corrigidos: t.corrigidos + r.corrigidos,
          falhas: t.falhas + r.falhas,
          lotes: t.lotes + 1,
        }));
        if (r.concluido || modo !== "todos" || !opts.auto) break;
        // Proteção: se um lote não processou nada, parar para não gastar recursos.
        if (r.tentados === 0) break;

      }
      setReprocLastResult(lastResult);
      if (lastResult?.concluido) {
        toast.success(`Reprocessamento concluído (${lastResult.corrigidos} corrigidos, ${lastResult.falhas} falhas)`);
      } else if (lastResult) {
        toast.message(`Lote reprocessado (${lastResult.corrigidos} corrigidos). Restam ${lastResult.restantes}.`);
      }
    } catch (e: any) {
      toast.error(`Erro ao reprocessar: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(null);
    }
  }

  const connected = status.data?.connected;

  return (
    <>
      <PageHeader
        title="Conta Azul"
        description="Conecte sua conta e sincronize os dados financeiros."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" /> Conexão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canManage ? (
              <p className="text-sm text-muted-foreground">Apenas administradores do módulo Despesas podem gerenciar esta conexão.</p>
            ) : status.isLoading ? (
              <p className="text-sm text-muted-foreground">Verificando status…</p>
            ) : connected ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Conectado</span>
                </div>
                {status.data?.expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Token expira em {new Date(status.data.expires_at).toLocaleString("pt-BR")}
                  </p>
                )}
                <Button variant="outline" onClick={handleDisconnect} disabled={busy !== null}>
                  {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unplug className="h-4 w-4 mr-1" />}
                  Desconectar
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span>Não conectado</span>
                </div>
                <Button onClick={handleConnect} disabled={busy !== null}>
                  {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                  Conectar Conta Azul
                </Button>
                <p className="text-xs text-muted-foreground">
                  Você será redirecionado para o Conta Azul para autorizar o acesso.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> Sincronizar dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <Button onClick={() => handleSync("incremental")} disabled={!canManage || !connected || busy !== null} className="w-full">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar novidades
            </Button>
            <Button variant="outline" onClick={() => handleSync("completo")} disabled={!canManage || !connected || busy !== null} className="w-full">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronização completa
            </Button>
            {busy === "sync" && progress.current && (
              <p className="text-xs text-muted-foreground">
                Sincronizando {RECURSOS.find((r) => r.key === progress.current)?.label} ({progress.done + 1}/{RECURSOS.length})…
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Use a completa para a primeira carga ou para trazer lançamentos futuros; a de novidades traz só o que mudou.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> Reprocessar rateios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Recalcula as fatias de rateio buscando o detalhe de cada lançamento no Conta Azul.
              Use "Somente suspeitos" para corrigir apenas lançamentos com fatias idênticas (fallback antigo);
              "Reprocessar tudo" refaz todos os lançamentos rateados, em lotes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!canManage || !connected || busy !== null}
                onClick={() => handleReprocessarRateios("suspeitos")}
              >
                {busy === "reproc" && reprocMode === "suspeitos" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Somente suspeitos
              </Button>
              <Button
                disabled={!canManage || !connected || busy !== null}
                onClick={() => handleReprocessarRateios("todos", { auto: true })}
              >
                {busy === "reproc" && reprocMode === "todos" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Reprocessar tudo
              </Button>
              {reprocLastResult && !reprocLastResult.concluido && busy === null && (
                <Button
                  variant="secondary"
                  disabled={!canManage || !connected}
                  onClick={() => handleReprocessarRateios(reprocLastResult.modo, { auto: false })}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Continuar (restam {reprocLastResult.restantes})
                </Button>
              )}
            </div>
            {reprocProgress && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>
                  Lote atual: {reprocProgress.corrigidos} corrigidos · {reprocProgress.falhas} falhas ·
                  {" "}{reprocProgress.restantes} restantes
                </div>
                <div>Acumulado: {reprocTotals.corrigidos} corrigidos · {reprocTotals.falhas} falhas ({reprocTotals.lotes} lotes)</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

