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

export const Route = createFileRoute("/financeiro/conta-azul")({
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
    const ninetyAgo = new Date(today);
    ninetyAgo.setDate(ninetyAgo.getDate() - 90);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(ninetyAgo), to: iso(today) };
  });
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null);
  const [progress, setProgress] = useState<{ current: RecursoKey | null; done: number }>({
    current: null,
    done: 0,
  });

  // Show toast from OAuth callback redirect
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

  const logs = useQuery({
    queryKey: ["ca-sync-log"],
    enabled: canManage,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ca_sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Array<{
        id: string;
        recurso: string;
        started_at: string;
        finished_at: string | null;
        status: string;
        mensagem: string | null;
        qtd_registros: number | null;
      }>;
    },
    refetchInterval: busy === "sync" ? 2000 : false,
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

  async function handleSync() {
    // Roda um recurso por request — evita timeouts e dá feedback de progresso.
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
            body: JSON.stringify({ from, to, recurso: r.key }),
          });
          if (!res.ok) throw new Error(await res.text());
          const { qtd } = (await res.json()) as { qtd: number };
          total += qtd ?? 0;
        } catch (e: any) {
          errors.push(`${r.label}: ${e?.message ?? e}`);
        }
        qc.invalidateQueries({ queryKey: ["ca-sync-log"] });
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

  const connected = status.data?.connected;

  return (
    <>
      <PageHeader
        title="Conta Azul"
        description="Conecte sua conta para sincronizar Plano de Contas, Centros de Custo, Contas a Pagar/Receber e Extrato."
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
            <Button onClick={handleSync} disabled={!canManage || !connected || busy !== null} className="w-full">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar agora
            </Button>
            {busy === "sync" && progress.current && (
              <p className="text-xs text-muted-foreground">
                Sincronizando {RECURSOS.find((r) => r.key === progress.current)?.label} ({progress.done + 1}/{RECURSOS.length})…
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Puxa Plano de Contas, Centros de Custo, Contas a Pagar, Contas a Receber e Extrato no período selecionado.
            </p>
          </CardContent>
        </Card>
      </div>

      <SyncAutomaticoCard canManage={canManage} />

      <CargaHistoricaCard canManage={canManage} connected={!!connected} />

      <SyncStateCard />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Histórico de sincronizações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Recurso</th>
                  <th className="text-left p-3">Início</th>
                  <th className="text-left p-3">Fim</th>
                  <th className="text-right p-3">Registros</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Nenhuma sincronização realizada ainda.
                    </td>
                  </tr>
                )}
                {(logs.data ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-3 font-medium">{l.recurso}</td>
                    <td className="p-3 text-muted-foreground">{new Date(l.started_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-muted-foreground">
                      {l.finished_at ? new Date(l.finished_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="p-3 text-right">{l.qtd_registros ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={
                          l.status === "ok"
                            ? "text-green-600"
                            : l.status === "erro"
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[300px] truncate" title={l.mensagem ?? ""}>
                      {l.mensagem ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SyncAutomaticoCard({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const sched = useQuery({
    queryKey: ["ca-schedule"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ca_sync_schedule").select("*").order("ordem");
      return (data ?? []) as Array<{ id: string; horario: string; ativo: boolean; ordem: number }>;
    },
  });
  const [rows, setRows] = useState<Array<{ horario: string; ativo: boolean }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sched.data) {
      setRows(sched.data.map((s) => ({ horario: String(s.horario).slice(0, 5), ativo: s.ativo })));
    }
  }, [sched.data]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/contaazul/schedule", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ horarios: rows.filter((r) => r.horario) }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Horários salvos");
      qc.invalidateQueries({ queryKey: ["ca-schedule"] });
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  function update(i: number, patch: Partial<{ horario: string; ativo: boolean }>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  const display = rows.length ? rows : [{ horario: "06:00", ativo: true }, { horario: "12:00", ativo: true }, { horario: "18:00", ativo: true }];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Sincronização automática (D-1)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Os horários abaixo (fuso América/Fortaleza) disparam uma sincronização incremental de D-1 até hoje. Máx. 3 horários.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {display.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="time" value={r.horario} onChange={(e) => update(i, { horario: e.target.value })} className="w-32" />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={r.ativo} onChange={(e) => update(i, { ativo: e.target.checked })} />
                Ativo
              </label>
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={!canManage || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Salvar horários
        </Button>
      </CardContent>
    </Card>
  );
}

function CargaHistoricaCard({ canManage, connected }: { canManage: boolean; connected: boolean }) {
  const [from, setFrom] = useState("2023-01-01");
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const job = useQuery({
    queryKey: ["ca-job", jobId],
    enabled: !!jobId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("ca_sync_jobs").select("*").eq("id", jobId).maybeSingle();
      return data as any;
    },
  });

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/contaazul/historico", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { jobId } = await res.json();
      setJobId(jobId);
      toast.success("Carga histórica iniciada em background");
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  const progress = job.data?.progress ?? {};
  const status = job.data?.status;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Carga histórica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button onClick={start} disabled={!canManage || !connected || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Rodar carga histórica
        </Button>
        {jobId && (
          <div className="text-xs text-muted-foreground">
            Status: <span className={status === "ok" ? "text-green-600" : status === "erro" ? "text-red-600" : ""}>{status ?? "em andamento"}</span>
            {progress.total_meses ? ` — ${progress.concluidos ?? 0}/${progress.total_meses} meses` : null}
            {progress.mes_atual ? ` (atual: ${progress.mes_atual})` : null}
            {job.data?.mensagem ? ` · ${job.data.mensagem}` : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SyncStateCard() {
  const state = useQuery({
    queryKey: ["ca-sync-state"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("ca_sync_state").select("*").order("recurso");
      return (data ?? []) as Array<any>;
    },
  });
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Última janela sincronizada (por recurso)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Recurso</th>
                <th className="text-left p-3">De</th>
                <th className="text-left p-3">Até</th>
                <th className="text-right p-3">Última carga</th>
                <th className="text-left p-3">Rodado em</th>
              </tr>
            </thead>
            <tbody>
              {(state.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma sincronização registrada.</td></tr>
              )}
              {(state.data ?? []).map((s) => (
                <tr key={s.recurso} className="border-t border-border">
                  <td className="p-3 font-medium">{s.recurso}</td>
                  <td className="p-3 text-muted-foreground">{s.last_synced_from ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.last_synced_to ?? "—"}</td>
                  <td className="p-3 text-right">{s.qtd_total ?? 0}</td>
                  <td className="p-3 text-muted-foreground">{s.last_run_at ? new Date(s.last_run_at).toLocaleString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
