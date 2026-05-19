import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { EMPRESAS, EMPRESA_REGIME, REGIME_LABEL } from "@/lib/empresas";
import { toast } from "sonner";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/")({
  component: ContabilDashboard,
});

type Nota = {
  id: string;
  empresa: string;
  numero: string | null;
  tomador_nome: string;
  valor_bruto: number;
  valor_liquido: number | null;
  status: string;
  data_emissao: string | null;
  tipo_servico: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  cancelada: "Cancelada",
};

function ContabilDashboard() {
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("__all");
  const [periodo, setPeriodo] = useState<"30d" | "mes_atual" | "mes_anterior" | "ano">("mes_atual");

  const range = useMemo(() => {
    const now = new Date();
    if (periodo === "30d") return { ini: new Date(now.getTime() - 30 * 86400000), fim: now };
    if (periodo === "mes_atual") return { ini: startOfMonth(now), fim: endOfMonth(now) };
    if (periodo === "mes_anterior") {
      const m = subMonths(now, 1);
      return { ini: startOfMonth(m), fim: endOfMonth(m) };
    }
    return { ini: new Date(now.getFullYear(), 0, 1), fim: new Date(now.getFullYear(), 11, 31) };
  }, [periodo]);

  const { data: notas } = useQuery({
    queryKey: ["contabil-notas-dash", range, filtroEmpresa],
    queryFn: async () => {
      let q = sb
        .from("contabil_notas_fiscais")
        .select("id,empresa,numero,tomador_nome,valor_bruto,valor_liquido,status,data_emissao,tipo_servico")
        .gte("data_emissao", format(range.ini, "yyyy-MM-dd"))
        .lte("data_emissao", format(range.fim, "yyyy-MM-dd"))
        .order("data_emissao", { ascending: false });
      if (filtroEmpresa !== "__all") q = q.eq("empresa", filtroEmpresa);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Nota[];
    },
  });

  const totais = useMemo(() => {
    const list = notas ?? [];
    const porEmpresa = new Map<string, { bruto: number; liquido: number; qtd: number }>();
    let bruto = 0,
      liquido = 0,
      emitidas = 0;
    for (const n of list) {
      bruto += Number(n.valor_bruto || 0);
      liquido += Number(n.valor_liquido || 0);
      if (n.status === "emitida") emitidas++;
      const e = porEmpresa.get(n.empresa) ?? { bruto: 0, liquido: 0, qtd: 0 };
      e.bruto += Number(n.valor_bruto || 0);
      e.liquido += Number(n.valor_liquido || 0);
      e.qtd++;
      porEmpresa.set(n.empresa, e);
    }
    return { total: list.length, bruto, liquido, emitidas, porEmpresa };
  }, [notas]);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function exportarCSV() {
    const list = notas ?? [];
    if (!list.length) return toast.error("Sem dados para exportar");
    const header = ["Empresa", "Número", "Data emissão", "Tomador", "Tipo serviço", "Valor bruto", "Valor líquido", "Status"];
    const rows = list.map((n) => [
      n.empresa,
      n.numero ?? "",
      n.data_emissao ?? "",
      n.tomador_nome,
      n.tipo_servico ?? "",
      String(n.valor_bruto ?? 0).replace(".", ","),
      String(n.valor_liquido ?? 0).replace(".", ","),
      STATUS_LABEL[n.status] ?? n.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas-fiscais-${format(range.ini, "yyyy-MM-dd")}_a_${format(range.fim, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Contábil — Dashboard"
        description="Resumo de emissões de notas fiscais e exportação de relatórios"
        actions={
          <Button onClick={exportarCSV} variant="outline">
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Empresa</label>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas empresas</SelectItem>
              {EMPRESAS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Período</label>
          <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
              <SelectItem value="mes_anterior">Mês anterior</SelectItem>
              <SelectItem value="ano">Ano atual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Notas no período</div>
          <div className="text-2xl font-semibold mt-1">{totais.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Emitidas</div>
          <div className="text-2xl font-semibold mt-1">{totais.emitidas}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor bruto</div>
          <div className="text-2xl font-semibold mt-1">{fmtBRL(totais.bruto)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor líquido</div>
          <div className="text-2xl font-semibold mt-1">{fmtBRL(totais.liquido)}</div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Por empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {EMPRESAS.map((e) => {
            const t = totais.porEmpresa.get(e) ?? { bruto: 0, liquido: 0, qtd: 0 };
            return (
              <div key={e} className="border border-border rounded-md p-3">
                <div className="text-sm font-medium">{e}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {REGIME_LABEL[EMPRESA_REGIME[e]]}
                </div>
                <div className="text-xs flex justify-between"><span>Notas</span><span>{t.qtd}</span></div>
                <div className="text-xs flex justify-between"><span>Bruto</span><span>{fmtBRL(t.bruto)}</span></div>
                <div className="text-xs flex justify-between"><span>Líquido</span><span>{fmtBRL(t.liquido)}</span></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Últimas notas no período</h3>
        </div>
        <div className="overflow-auto max-h-[500px]">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Número</th>
                <th className="px-4 py-2">Empresa</th>
                <th className="px-4 py-2">Tomador</th>
                <th className="px-4 py-2 text-right">Bruto</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(notas ?? []).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma nota no período.</td></tr>
              ) : (notas ?? []).map((n) => (
                <tr key={n.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2 whitespace-nowrap">{n.data_emissao ? format(new Date(n.data_emissao), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{n.numero ?? "—"}</td>
                  <td className="px-4 py-2">{n.empresa}</td>
                  <td className="px-4 py-2">{n.tomador_nome}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(Number(n.valor_bruto || 0))}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[n.status] ?? n.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
