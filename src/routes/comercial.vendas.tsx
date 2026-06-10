import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertTriangle, CloudDownload, Download, Loader2, RefreshCw, ShieldAlert, Upload,
} from "lucide-react";
import {
  listVendasDb, getLastSync, syncVendasFromDropbox, syncVendasFromUpload,
} from "@/lib/comercial/vendas-db.functions";
import type { VendaRow } from "@/lib/comercial/vendas.functions";

export const Route = createFileRoute("/comercial/vendas")({
  component: VendasPage,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return "—"; }
}

const PAGE_SIZE = 50;

function unique<T>(arr: (T | null | undefined)[]): T[] {
  const s = new Set<T>();
  for (const v of arr) if (v !== null && v !== undefined && v !== ("" as unknown)) s.add(v as T);
  return [...s];
}

function VendasPage() {
  const { isAdmin, isModuleAdmin, loading: authLoading } = useAuth();
  const canView = isAdmin || isModuleAdmin("comercial");

  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  const [empresa, setEmpresa] = useState<string>("Todos");
  const [ano, setAno] = useState<string>("Todos");
  const [mes, setMes] = useState<string>("Todos");
  const [consultor, setConsultor] = useState<string>("Todos");
  const [classificacao, setClassificacao] = useState<string>("Todos");
  const [busca, setBusca] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-db"],
    queryFn: () => listVendasDb(),
    staleTime: 5 * 60 * 1000,
    enabled: canView,
  });
  const { data: lastSync } = useQuery({
    queryKey: ["comercial-vendas-last-sync"],
    queryFn: () => getLastSync(),
    staleTime: 30 * 1000,
    enabled: canView,
  });

  const rows = data?.rows ?? [];

  const opts = useMemo(() => {
    return {
      empresas: unique(rows.map((r) => r.empresa)).sort(),
      anos: unique(rows.map((r) => r.anoEvento ?? r.ano))
        .filter((v): v is number => typeof v === "number")
        .sort((a, b) => b - a),
      meses: unique(rows.map((r) => r.mesEvento ?? r.mes)).sort(),
      consultores: unique(rows.map((r) => r.consultor)).sort(),
      classificacoes: unique(rows.map((r) => r.classificacao)).sort(),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (empresa !== "Todos" && (r.empresa ?? "") !== empresa) return false;
      if (ano !== "Todos") {
        const a = r.anoEvento ?? r.ano;
        if (String(a ?? "") !== ano) return false;
      }
      if (mes !== "Todos") {
        const m1 = (r.mesEvento ?? "").toLowerCase();
        const m2 = (r.mes ?? "").toLowerCase();
        if (m1 !== mes.toLowerCase() && m2 !== mes.toLowerCase()) return false;
      }
      if (consultor !== "Todos" && (r.consultor ?? "") !== consultor) return false;
      if (classificacao !== "Todos" && (r.classificacao ?? "") !== classificacao) return false;
      if (q) {
        const blob = `${r.nomeEvento ?? ""} ${r.local ?? ""} ${r.cidade ?? ""} ${r.salao ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, empresa, ano, mes, consultor, classificacao, busca]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.dataEvento ?? "").localeCompare(a.dataEvento ?? "")),
    [filtered],
  );

  const totalValor = useMemo(() => sorted.reduce((s, r) => s + (r.valorFinal || 0), 0), [sorted]);
  const totalDesc = useMemo(() => sorted.reduce((s, r) => s + (r.desconto || 0), 0), [sorted]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] }),
      qc.invalidateQueries({ queryKey: ["comercial-vendas-last-sync"] }),
    ]);
  }

  async function handleSyncDropbox() {
    setSyncing(true);
    const t = toast.loading("Sincronizando com Dropbox...");
    try {
      const r = await syncVendasFromDropbox();
      if (r.ok) {
        toast.success(
          `Sincronizado: ${r.rows_total} linhas (novas: ${r.rows_inserted}, atualizadas: ${r.rows_updated})`,
          { id: t },
        );
        await refreshAll();
      } else {
        toast.error(r.error ?? "Falha ao sincronizar", { id: t });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado", { id: t });
    } finally {
      setSyncing(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncing(true);
    const t = toast.loading(`Importando ${file.name}...`);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const view = new Uint8Array(buf);
      const CHUNK = 0x8000;
      for (let i = 0; i < view.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(view.subarray(i, i + CHUNK)));
      }
      const base64 = btoa(bin);
      const r = await syncVendasFromUpload({ data: { base64 } });
      if (r.ok) {
        toast.success(
          `Importado: ${r.rows_total} linhas (novas: ${r.rows_inserted}, atualizadas: ${r.rows_updated})`,
          { id: t },
        );
        await refreshAll();
      } else {
        toast.error(r.error ?? "Falha ao importar", { id: t });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado", { id: t });
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function exportCsv() {
    const headers = [
      "Data Evento", "Data Registro", "Nome do Evento", "Empresa", "Local",
      "Cidade", "Estado", "Salão", "Tipo Evento", "Classificação",
      "Consultor", "Gestor", "Cerimonial", "Decorador",
      "Quantidade", "Valor Proposta", "Desconto", "Valor Final", "Valor BV",
    ];
    const esc = (v: string | number | null) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(";")];
    for (const r of sorted) {
      lines.push([
        r.dataEvento ?? "", r.dataRegistro ?? "", r.nomeEvento ?? "", r.empresa ?? "",
        r.local ?? "", r.cidade ?? "", r.estado ?? "", r.salao ?? "",
        r.tipoEvento ?? "", r.classificacao ?? "",
        r.consultor ?? "", r.gestor ?? "", r.cerimonial ?? "", r.decorador ?? "",
        r.quantidade, r.valorProposta, r.desconto, r.valorFinal, r.valorBV,
      ].map(esc).join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFiltros() {
    setEmpresa("Todos"); setAno("Todos"); setMes("Todos");
    setConsultor("Todos"); setClassificacao("Todos"); setBusca(""); setPage(1);
  }

  if (authLoading) {
    return (
      <div className="p-6">
        <Card className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="p-6 flex items-start gap-3 text-sm border-amber-500/40 bg-amber-500/5">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-medium text-amber-700 dark:text-amber-400">Acesso restrito</div>
            <div className="text-muted-foreground mt-1">
              Apenas administradores podem visualizar os registros de vendas.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Vendas"
        description={`Vendas fechadas · Última sincronização: ${formatWhen(lastSync?.finished_at ?? lastSync?.started_at)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
            />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sorted.length}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={syncing}>
              <Upload className="h-4 w-4 mr-2" /> Importar .xlsx
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncDropbox} disabled={syncing}>
              <CloudDownload className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} /> Sincronizar agora
            </Button>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <FiltroSelect label="Empresa" value={empresa} onChange={(v) => { setEmpresa(v); setPage(1); }} options={opts.empresas} />
          <FiltroSelect label="Ano" value={ano} onChange={(v) => { setAno(v); setPage(1); }} options={opts.anos.map(String)} />
          <FiltroSelect label="Mês" value={mes} onChange={(v) => { setMes(v); setPage(1); }} options={opts.meses} />
          <FiltroSelect label="Consultor" value={consultor} onChange={(v) => { setConsultor(v); setPage(1); }} options={opts.consultores} />
          <FiltroSelect label="Classificação" value={classificacao} onChange={(v) => { setClassificacao(v); setPage(1); }} options={opts.classificacoes} />
          <div className="space-y-1">
            <Label className="text-[11px] uppercase">Buscar</Label>
            <Input
              placeholder="Evento, local, cidade..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{sorted.length.toLocaleString("pt-BR")} registros</span>
          <button className="underline hover:text-foreground" onClick={resetFiltros}>Limpar filtros</button>
        </div>
      </Card>

      {isLoading && (
        <Card className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando vendas...
        </Card>
      )}

      {!isLoading && (error || data?.error) && (
        <Card className="p-6 flex items-start gap-3 text-sm border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <div className="font-medium text-destructive">Não foi possível carregar os dados</div>
            <div className="text-muted-foreground mt-1">{(error as Error)?.message ?? data?.error}</div>
          </div>
        </Card>
      )}

      {!isLoading && !data?.error && data && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>Data Evento</Th>
                  <Th>Nome do Evento</Th>
                  <Th>Empresa</Th>
                  <Th>Local/Cidade</Th>
                  <Th>Consultor</Th>
                  <Th>Cerimonial</Th>
                  <Th>Decorador</Th>
                  <Th>Classificação</Th>
                  <Th className="text-right">Qtde</Th>
                  <Th className="text-right">Desconto</Th>
                  <Th className="text-right">Valor Final</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
                {pageRows.map((r, i) => (
                  <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                    <Td>{formatDate(r.dataEvento)}</Td>
                    <Td className="font-medium">{r.nomeEvento ?? "—"}</Td>
                    <Td>{r.empresa ?? "—"}</Td>
                    <Td>
                      <div>{r.local ?? "—"}</div>
                      {r.cidade && <div className="text-xs text-muted-foreground">{r.cidade}{r.estado ? ` / ${r.estado}` : ""}</div>}
                    </Td>
                    <Td>{r.consultor ?? "—"}</Td>
                    <Td>{r.cerimonial ?? "—"}</Td>
                    <Td>{r.decorador ?? "—"}</Td>
                    <Td>{r.classificacao ?? "—"}</Td>
                    <Td className="text-right">{(r.quantidade || 0).toLocaleString("pt-BR")}</Td>
                    <Td className="text-right">{brl(r.desconto || 0)}</Td>
                    <Td className="text-right font-semibold">{brl(r.valorFinal || 0)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t-2 border-border">
                <tr>
                  <Td colSpan={8} className="font-semibold">Totais ({sorted.length.toLocaleString("pt-BR")} registros)</Td>
                  <Td className="text-right" />
                  <Td className="text-right font-semibold">{brl(totalDesc)}</Td>
                  <Td className="text-right font-semibold">{brl(totalValor)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-sm">
            <div className="text-muted-foreground">
              Página {curPage} de {totalPages} · {PAGE_SIZE} por página
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={curPage === 1}>«</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={curPage === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={curPage === totalPages}>Próxima</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={curPage === totalPages}>»</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FiltroSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Todos">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
