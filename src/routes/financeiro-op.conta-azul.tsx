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
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect" | "reproc" | "recorte">(null);
  const [progress, setProgress] = useState<{ current: RecursoKey | null; done: number }>({
    current: null,
    done: 0,
  });
  type ReprocResult = {
    tentados: number;
    corrigidos: number;
    falhas: number;
    detalhes?: string[];
    restantes: number;
    concluido: boolean;
    modo: "suspeitos" | "todos" | "periodo" | "liquidacoes";
  };
  const [reprocMode, setReprocMode] = useState<"suspeitos" | "todos" | "periodo" | "liquidacoes" | null>(null);
  const [reprocProgress, setReprocProgress] = useState<ReprocResult | null>(null);
  const [reprocLastResult, setReprocLastResult] = useState<ReprocResult | null>(null);
  const [reprocTotals, setReprocTotals] = useState<{ corrigidos: number; falhas: number; lotes: number }>({
    corrigidos: 0,
    falhas: 0,
    lotes: 0,
  });
  const RECORTE_2026 = { from: "2026-01-01", to: "2026-12-31" };
  const [histFrom, setHistFrom] = useState("2023-01-01");
  const [histTo, setHistTo] = useState("2025-12-31");
  const [recorteLabel, setRecorteLabel] = useState<string | null>(null);

  type ConfDiv = {
    id: string;
    tipo: "pagar" | "receber";
    descricao: string | null;
    data_vencimento: string | null;
    pago_api: number;
    baixas_db: number;
    diferenca: number;
    existe_no_banco: boolean;
  };
  type ConfResumo = {
    tipo: "pagar" | "receber";
    ano: number;
    titulos_pagos: number;
    pago_api: number;
    baixas_db: number;
    divergentes: number;
    diferenca: number;
  };
  const anoAtual = new Date().getFullYear();
  const [confDe, setConfDe] = useState(String(anoAtual - 3));
  const [confAte, setConfAte] = useState(String(anoAtual + 1));
  const [confBusy, setConfBusy] = useState<null | "conferir" | "corrigir">(null);
  const [confEtapa, setConfEtapa] = useState<string | null>(null);
  const [confResumo, setConfResumo] = useState<ConfResumo[]>([]);
  const [confDivs, setConfDivs] = useState<ConfDiv[]>([]);
  const [confIds, setConfIds] = useState<{ pagar: string[]; receber: string[] }>({ pagar: [], receber: [] });

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

  async function handleConferir() {
    setConfBusy("conferir");
    setConfResumo([]);
    setConfDivs([]);
    setConfIds({ pagar: [], receber: [] });
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const de = Number(confDe);
      const ate = Number(confAte);
      if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate) {
        toast.error("Informe um intervalo de anos válido.");
        return;
      }
      const resumo: ConfResumo[] = [];
      const divs: ConfDiv[] = [];
      const ids: { pagar: string[]; receber: string[] } = { pagar: [], receber: [] };
      for (const tipo of ["receber", "pagar"] as const) {
        for (let ano = de; ano <= ate; ano++) {
          setConfEtapa(`${tipo === "receber" ? "Recebimentos" : "Pagamentos"} — vencimentos de ${ano}`);
          const res = await fetch("/api/contaazul/conferencia", {
            method: "POST",
            headers,
            body: JSON.stringify({
              acao: "conferir",
              tipo,
              vencDe: `${ano}-01-01`,
              vencAte: `${ano}-12-31`,
            }),
          });
          if (!res.ok) throw new Error(await res.text());
          const r = await res.json();
          resumo.push({
            tipo,
            ano,
            titulos_pagos: r.titulos_pagos,
            pago_api: r.pago_api,
            baixas_db: r.baixas_db,
            divergentes: r.divergentes,
            diferenca: r.diferenca,
          });
          divs.push(...(r.amostra ?? []));
          ids[tipo].push(...(r.ids ?? []));
          setConfResumo([...resumo]);
        }
      }
      setConfDivs(divs);
      setConfIds(ids);
      const totalDiv = resumo.reduce((s, r) => s + r.divergentes, 0);
      if (totalDiv === 0) toast.success("Nenhuma divergência: banco em dia com o Conta Azul.");
      else
        toast.message(
          `${totalDiv} lançamento(s) divergentes — diferença de ${fmtBRL(resumo.reduce((s, r) => s + r.diferenca, 0))}.`,
        );
    } catch (e: any) {
      toast.error(`Erro na conferência: ${String(e?.message ?? e)}`);
    } finally {
      setConfBusy(null);
      setConfEtapa(null);
    }
  }

  async function handleCorrigirDivergencias() {
    setConfBusy("corrigir");
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      let corrigidos = 0;
      let falhas = 0;
      for (const tipo of ["receber", "pagar"] as const) {
        let fila = [...confIds[tipo]];
        while (fila.length > 0) {
          setConfEtapa(`Importando ${tipo === "receber" ? "recebimentos" : "pagamentos"} — restam ${fila.length}`);
          const res = await fetch("/api/contaazul/conferencia", {
            method: "POST",
            headers,
            body: JSON.stringify({ acao: "corrigir", tipo, ids: fila.slice(0, 40) }),
          });
          if (!res.ok) throw new Error(await res.text());
          const r = await res.json();
          corrigidos += r.corrigidos ?? 0;
          falhas += r.falhas ?? 0;
          fila = fila.slice(40);
        }
      }
      toast.success(`Correção concluída — ${corrigidos} lançamentos atualizados${falhas ? `, ${falhas} falhas` : ""}.`);
      setConfDivs([]);
      setConfIds({ pagar: [], receber: [] });
      await qc.invalidateQueries({ queryKey: ["painel-financeiro"] });
    } catch (e: any) {
      toast.error(`Erro ao corrigir: ${String(e?.message ?? e)}`);
    } finally {
      setConfBusy(null);
      setConfEtapa(null);
    }
  }


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

  async function runSyncRange(
    rangeFrom: string,
    rangeTo: string,
    modo: "incremental" | "completo",
  ): Promise<{ total: number; errors: string[] }> {
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    let total = 0;
    const errors: string[] = [];
    for (let i = 0; i < RECURSOS.length; i++) {
      const r = RECURSOS[i];
      setProgress({ current: r.key, done: i });
      try {
        const res = await fetch("/api/contaazul/sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ from: rangeFrom, to: rangeTo, recurso: r.key, modo }),
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
    return { total, errors };
  }

  async function handleSync(modo: "incremental" | "completo") {
    setBusy("sync");
    setProgress({ current: null, done: 0 });
    try {
      const { total, errors } = await runSyncRange(from, to, modo);
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

  async function runReprocessLoop(
    body: Record<string, unknown>,
    modoLabel: "suspeitos" | "todos" | "periodo" | "liquidacoes",
    autoLoop: boolean,
  ): Promise<ReprocResult | null> {
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    setReprocMode(modoLabel);
    setReprocTotals({ corrigidos: 0, falhas: 0, lotes: 0 });
    let lastResult: ReprocResult | null = null;
    for (let i = 0; i < 200; i++) {
      const res = await fetch("/api/contaazul/reprocessar-rateios", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, limite: 40 }),
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
      if (r.concluido || !autoLoop) break;
      if (r.tentados === 0) break;
    }
    return lastResult;
  }

  async function handleReprocessarRateios(
    modo: "suspeitos" | "todos",
    opts: { auto?: boolean } = {},
  ) {
    setBusy("reproc");
    try {
      const lastResult = await runReprocessLoop({ modo }, modo, modo === "todos" && !!opts.auto);
      setReprocLastResult(lastResult);
      const detalhe = lastResult?.detalhes?.[0] ? ` ${lastResult.detalhes[0]}` : "";
      if (lastResult?.concluido) {
        toast.success(`Reprocessamento concluído (${lastResult.corrigidos} corrigidos, ${lastResult.falhas} falhas)`);
      } else if (lastResult && lastResult.tentados === 0) {
        toast.message("Nenhum lançamento encontrado para reprocessar neste lote.");
      } else if (lastResult && lastResult.corrigidos === 0 && lastResult.falhas > 0) {
        toast.error(`Lote sem correções (${lastResult.falhas} falhas).${detalhe}`);
      } else if (lastResult) {
        toast.message(`Lote reprocessado (${lastResult.corrigidos} corrigidos, ${lastResult.falhas} falhas). Restam ${lastResult.restantes}.${detalhe}`);
      }
    } catch (e: any) {
      toast.error(`Erro ao reprocessar: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleReprocessarLiquidacoes() {
    setBusy("reproc");
    try {
      const lastResult = await runReprocessLoop({ modo: "liquidacoes", from, to }, "liquidacoes", true);
      setReprocLastResult(lastResult);
      if (lastResult?.concluido) toast.success("Liquidações reconciliadas com o Conta Azul.");
      else if (lastResult) toast.message(`Liquidações: restam ${lastResult.restantes} lançamentos para conferir.`);
      await qc.invalidateQueries({ queryKey: ["ca-baixas"] });
      await qc.invalidateQueries({ queryKey: ["ca-pagar"] });
      await qc.invalidateQueries({ queryKey: ["ca-receber"] });
      await qc.invalidateQueries({ queryKey: ["ca-rateios-caixa"] });
      await qc.invalidateQueries({ queryKey: ["painel-financeiro"] });
    } catch (e: any) {
      toast.error(`Erro ao reconciliar liquidações: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleRecorte(rangeFrom: string, rangeTo: string, label: string) {
    if (rangeFrom > rangeTo) {
      toast.error("Data inicial deve ser anterior à final.");
      return;
    }
    setBusy("recorte");
    setRecorteLabel(label);
    setProgress({ current: null, done: 0 });
    try {
      const { total, errors } = await runSyncRange(rangeFrom, rangeTo, "completo");
      if (errors.length > 0) {
        toast.error(`Sincronização parcial (${total} reg.). ${errors.join(" | ")}`);
      } else {
        toast.success(`Sincronização (${label}) concluída — ${total} registros. Iniciando reprocesso de rateios…`);
      }
      setProgress({ current: null, done: 0 });
      const last = await runReprocessLoop(
        { modo: "periodo", from: rangeFrom, to: rangeTo },
        "periodo",
        true,
      );
      setReprocLastResult(last);
      if (last?.concluido) {
        toast.success(`Rateios (${label}): ${last.corrigidos} corrigidos, ${last.falhas} falhas`);
      } else if (last) {
        toast.message(`Rateios (${label}): ${last.corrigidos} corrigidos, ${last.falhas} falhas. Restam ${last.restantes}.`);
      }
    } catch (e: any) {
      toast.error(`Erro no recorte: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(null);
      setProgress({ current: null, done: 0 });
      setRecorteLabel(null);
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
              <p className="text-sm text-muted-foreground">Apenas administradores do módulo Aquisições podem gerenciar esta conexão.</p>
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
              <CheckCircle2 className="h-4 w-4" /> Conferência de liquidações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Compara, título a título, o valor liquidado no Conta Azul com as baixas gravadas aqui — inclusive
              parcelas vencidas em outros anos que foram pagas dentro do período analisado (a causa das diferenças
              de valor recebido por mês). A varredura percorre todos os vencimentos do intervalo de anos abaixo.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <div className="space-y-1">
                <Label className="text-xs">Vencimentos de (ano)</Label>
                <Input inputMode="numeric" value={confDe} onChange={(e) => setConfDe(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">até (ano)</Label>
                <Input inputMode="numeric" value={confAte} onChange={(e) => setConfAte(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canManage || !connected || busy !== null || confBusy !== null} onClick={handleConferir}>
                {confBusy === "conferir" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Conferir liquidações
              </Button>
              {(confIds.pagar.length > 0 || confIds.receber.length > 0) && (
                <Button
                  variant="outline"
                  disabled={!canManage || !connected || confBusy !== null}
                  onClick={handleCorrigirDivergencias}
                >
                  {confBusy === "corrigir" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Corrigir {confIds.pagar.length + confIds.receber.length} divergência(s)
                </Button>
              )}
            </div>
            {confEtapa && <p className="text-xs text-muted-foreground">{confEtapa}…</p>}

            {confResumo.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-left">Vencimentos</th>
                      <th className="p-2 text-right">Liquidado (Conta Azul)</th>
                      <th className="p-2 text-right">Registrado aqui</th>
                      <th className="p-2 text-right">Diferença</th>
                      <th className="p-2 text-right">Títulos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confResumo
                      .filter((r) => r.titulos_pagos > 0)
                      .map((r) => (
                        <tr key={`${r.tipo}-${r.ano}`} className="border-t">
                          <td className="p-2">{r.tipo === "receber" ? "Recebimentos" : "Pagamentos"}</td>
                          <td className="p-2">{r.ano}</td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL(r.pago_api)}</td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL(r.baixas_db)}</td>
                          <td
                            className={`p-2 text-right tabular-nums ${Math.abs(r.diferenca) > 0.02 ? "text-destructive font-medium" : ""}`}
                          >
                            {fmtBRL(r.diferenca)}
                          </td>
                          <td className="p-2 text-right tabular-nums">{r.divergentes}/{r.titulos_pagos}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {confDivs.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium">Lançamentos divergentes (amostra)</div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-left">Vencimento</th>
                        <th className="p-2 text-right">Conta Azul</th>
                        <th className="p-2 text-right">Aqui</th>
                        <th className="p-2 text-left">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confDivs.map((d) => (
                        <tr key={`${d.tipo}-${d.id}`} className="border-t">
                          <td className="p-2">{d.descricao ?? d.id}</td>
                          <td className="p-2">
                            {d.data_vencimento
                              ? new Date(`${d.data_vencimento}T12:00:00`).toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL(d.pago_api)}</td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL(d.baixas_db)}</td>
                          <td className="p-2">{d.existe_no_banco ? "Baixa incompleta" : "Título ausente"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>



        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> Recortes rápidos (sincronismo + rateios)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Cada recorte roda a sincronização completa dos 5 recursos no período e, na sequência, reprocessa
              automaticamente os rateios de todos os lançamentos com vencimento na janela — buscando o detalhe
              atualizado no Conta Azul pelo token conectado.
            </p>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Ano de 2026</div>
                  <div className="text-xs text-muted-foreground">01/01/2026 → 31/12/2026</div>
                </div>
                <Button
                  disabled={!canManage || !connected || busy !== null}
                  onClick={() => handleRecorte(RECORTE_2026.from, RECORTE_2026.to, "2026")}
                >
                  {busy === "recorte" && recorteLabel === "2026" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Sincronizar 2026
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Histórico (antes de 2026)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">De</Label>
                  <Input
                    type="date"
                    max="2025-12-31"
                    value={histFrom}
                    onChange={(e) => setHistFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Input
                    type="date"
                    max="2025-12-31"
                    value={histTo}
                    onChange={(e) => setHistTo(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={!canManage || !connected || busy !== null || !histFrom || !histTo || histTo >= "2026-01-01"}
                onClick={() => handleRecorte(histFrom, histTo, `${histFrom} → ${histTo}`)}
              >
                {busy === "recorte" && recorteLabel && recorteLabel !== "2026" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sincronizar histórico
              </Button>
              {histTo >= "2026-01-01" && (
                <p className="text-xs text-destructive">A data final deve ser anterior a 01/01/2026.</p>
              )}
            </div>

            {busy === "recorte" && progress.current && (
              <p className="text-xs text-muted-foreground">
                Sincronizando {RECURSOS.find((r) => r.key === progress.current)?.label} ({progress.done + 1}/{RECURSOS.length})…
              </p>
            )}
            {busy === "recorte" && reprocMode === "periodo" && reprocProgress && (
              <p className="text-xs text-muted-foreground">
                Reprocessando rateios: {reprocTotals.corrigidos} corrigidos · {reprocTotals.falhas} falhas ·
                {" "}{reprocProgress.restantes} restantes
              </p>
            )}
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
                disabled={!canManage || !connected || busy !== null}
                onClick={handleReprocessarLiquidacoes}
              >
                {busy === "reproc" && reprocMode === "liquidacoes" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Reconciliar recebidos e pagos
              </Button>
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
              {reprocLastResult && !reprocLastResult.concluido && busy === null && reprocLastResult.modo !== "periodo" && (
                <Button
                  variant="secondary"
                  disabled={!canManage || !connected}
                  onClick={() => handleReprocessarRateios(reprocLastResult.modo as "suspeitos" | "todos", { auto: false })}
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
                {reprocProgress.detalhes?.length ? (
                  <div>Detalhe: {reprocProgress.detalhes[0]}</div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

