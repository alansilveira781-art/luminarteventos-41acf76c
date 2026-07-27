import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormSection } from "@/components/FormSection";
import { Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";

type XLSXNs = typeof import("xlsx");
let _xlsxPromise: Promise<XLSXNs> | null = null;
const loadXLSX = () => (_xlsxPromise ??= import("xlsx"));

const sb = supabase as any;

export const Route = createFileRoute("/contabil/relatorios")({
  component: RelatoriosPage,
});

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

type ItemImposto = { imposto: string; valor: number; adicional?: number; total?: number };
type ApuracaoSalva = {
  id: string;
  titulo: string;
  empresa: string;
  periodo_inicio: string;
  periodo_fim: string;
  resultado: {
    faturamento?: number;
    totalImpostos?: number;
    itens?: ItemImposto[];
  } | null;
};

function RelatoriosPage() {
  const [apuracaoId, setApuracaoId] = useState<string>("");
  const [impostoSel, setImpostoSel] = useState<string>("__todos__");

  const { data: apuracoes } = useQuery({
    queryKey: ["contabil-apuracoes-relatorio"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_consultas_impostos")
        .select("id, titulo, empresa, periodo_inicio, periodo_fim, resultado")
        .order("periodo_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApuracaoSalva[];
    },
  });

  const apuracao = useMemo(
    () => (apuracoes ?? []).find((a) => a.id === apuracaoId) ?? null,
    [apuracoes, apuracaoId],
  );

  const { data: recebimentos } = useQuery({
    enabled: !!apuracao,
    queryKey: [
      "contabil-recebimentos-rateio",
      apuracao?.empresa,
      apuracao?.periodo_inicio,
      apuracao?.periodo_fim,
    ],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_recebimentos")
        .select("id, nome_evento, valor_recebido, data_recebimento, numero_nf")
        .eq("empresa", apuracao!.empresa)
        .gte("data_recebimento", apuracao!.periodo_inicio)
        .lte("data_recebimento", apuracao!.periodo_fim);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        nome_evento: string | null;
        valor_recebido: number;
        data_recebimento: string;
        numero_nf: string | null;
      }>;
    },
  });

  const itensImposto: ItemImposto[] = (apuracao?.resultado?.itens ?? []).map((i) => ({
    imposto: i.imposto,
    valor: Number(i.total ?? i.valor ?? 0),
  }));

  const totalImpostoSelecionado = useMemo(() => {
    if (!apuracao) return 0;
    if (impostoSel === "__todos__") {
      return Number(apuracao.resultado?.totalImpostos ?? 0)
        || itensImposto.reduce((s, i) => s + i.valor, 0);
    }
    return itensImposto.find((i) => i.imposto === impostoSel)?.valor ?? 0;
  }, [apuracao, impostoSel, itensImposto]);

  // Agrupar por evento
  const eventos = useMemo(() => {
    const map = new Map<string, { evento: string; valor: number }>();
    for (const r of recebimentos ?? []) {
      const key = (r.nome_evento || "").trim() || "— Sem evento vinculado —";
      const cur = map.get(key) ?? { evento: key, valor: 0 };
      cur.valor += Number(r.valor_recebido || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [recebimentos]);

  const totalRecebido = eventos.reduce((s, e) => s + e.valor, 0);

  // Rateio proporcional com ajuste de resíduo na maior fatia
  const rateio = useMemo(() => {
    if (!totalRecebido || !totalImpostoSelecionado) {
      return eventos.map((e) => ({ ...e, pct: 0, imposto: 0 }));
    }
    const bruto = eventos.map((e) => {
      const pct = e.valor / totalRecebido;
      return { ...e, pct, imposto: Math.round(e.valor / totalRecebido * totalImpostoSelecionado * 100) / 100 };
    });
    const somaRateada = bruto.reduce((s, r) => s + r.imposto, 0);
    const diff = +(totalImpostoSelecionado - somaRateada).toFixed(2);
    if (diff !== 0 && bruto.length) {
      // aplica na maior fatia
      let idxMax = 0;
      for (let i = 1; i < bruto.length; i++) if (bruto[i].valor > bruto[idxMax].valor) idxMax = i;
      bruto[idxMax].imposto = +(bruto[idxMax].imposto + diff).toFixed(2);
    }
    return bruto;
  }, [eventos, totalRecebido, totalImpostoSelecionado]);

  const impostoLabel = impostoSel === "__todos__" ? "Total de Impostos" : impostoSel;

  const buildTitulo = () =>
    apuracao ? `Distribuição de ${impostoLabel} — ${apuracao.titulo}` : "Distribuição de Impostos";

  const exportarExcel = async () => {
    if (!apuracao) return;
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const header = [
      [buildTitulo()],
      ["Empresa", apuracao.empresa],
      ["Período", `${format(new Date(apuracao.periodo_inicio), "dd/MM/yyyy")} — ${format(new Date(apuracao.periodo_fim), "dd/MM/yyyy")}`],
      ["Imposto", impostoLabel],
      ["Valor apurado", totalImpostoSelecionado],
      ["Total recebido no período", totalRecebido],
      ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Evento", "Valor recebido", "% do total", `${impostoLabel} rateado`],
    ];
    const body = rateio.map((r) => [r.evento, r.valor, r.pct, r.imposto]);
    const footer = [[], ["Total", totalRecebido, 1, totalImpostoSelecionado]];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...body, ...footer]);
    ws["!cols"] = [{ wch: 46 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Distribuição");
    const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    XLSX.writeFile(wb, `distribuicao-${safe(impostoLabel)}-${safe(apuracao.empresa)}-${apuracao.periodo_inicio}.xlsx`);
  };

  const exportarPDF = () => {
    if (!apuracao) return;
    const esc = (s: string) =>
      String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const rowsHtml = rateio.map((r) =>
      `<tr><td>${esc(r.evento)}</td><td class="num">${fmtBRL(r.valor)}</td><td class="num">${fmtPct(r.pct)}</td><td class="num">${fmtBRL(r.imposto)}</td></tr>`
    ).join("");
    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(buildTitulo())}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
  .meta span { margin-right: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f4f5; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; border-top: 2px solid #333; }
  .foot { margin-top: 24px; font-size: 10px; color: #666; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<h1>${esc(buildTitulo())}</h1>
<div class="meta">
  <span><b>Empresa:</b> ${esc(apuracao.empresa)}</span>
  <span><b>Período:</b> ${format(new Date(apuracao.periodo_inicio), "dd/MM/yyyy")} — ${format(new Date(apuracao.periodo_fim), "dd/MM/yyyy")}</span>
  <span><b>Imposto:</b> ${esc(impostoLabel)} = ${fmtBRL(totalImpostoSelecionado)}</span>
</div>
<table>
  <thead><tr><th>Evento</th><th class="num">Valor recebido</th><th class="num">% do total</th><th class="num">${esc(impostoLabel)} rateado</th></tr></thead>
  <tbody>${rowsHtml || `<tr><td colspan="4" style="text-align:center;padding:16px;color:#666">Nenhum recebimento no período.</td></tr>`}</tbody>
  <tfoot><tr><td>Total</td><td class="num">${fmtBRL(totalRecebido)}</td><td class="num">100,00%</td><td class="num">${fmtBRL(totalImpostoSelecionado)}</td></tr></tfoot>
</table>
<div class="foot">Rateio proporcional aos valores recebidos no período da apuração.</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Bloqueado pelo navegador. Permita pop-ups."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Relatórios do módulo contábil. Comece por Distribuição de Impostos por evento."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!apuracao || rateio.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportarPDF}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportarExcel}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold mb-3">Distribuição de Impostos por evento</div>
        <FormSection>
          <FormField label="Apuração">
            <Select value={apuracaoId} onValueChange={setApuracaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma apuração salva…" /></SelectTrigger>
              <SelectContent>
                {(apuracoes ?? []).length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma apuração registrada. Crie uma em Contábil › Apurações de impostos.
                  </div>
                ) : (apuracoes ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Imposto">
            <Select value={impostoSel} onValueChange={setImpostoSel} disabled={!apuracao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos (total de impostos)</SelectItem>
                {itensImposto.map((i) => (
                  <SelectItem key={i.imposto} value={i.imposto}>{i.imposto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormSection>

        {apuracao && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-border px-3 py-2">
              <div className="text-muted-foreground">Empresa</div>
              <div className="font-medium text-foreground">{apuracao.empresa}</div>
            </div>
            <div className="rounded border border-border px-3 py-2">
              <div className="text-muted-foreground">Período</div>
              <div className="font-medium text-foreground">
                {format(new Date(apuracao.periodo_inicio), "dd/MM/yyyy")} — {format(new Date(apuracao.periodo_fim), "dd/MM/yyyy")}
              </div>
            </div>
            <div className="rounded border border-border px-3 py-2">
              <div className="text-muted-foreground">{impostoLabel} apurado</div>
              <div className="font-semibold text-foreground">{fmtBRL(totalImpostoSelecionado)}</div>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <div className="text-sm font-semibold">Rateio por evento</div>
          <div className="text-xs text-muted-foreground">
            {rateio.length} evento{rateio.length === 1 ? "" : "s"}
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Evento</th>
              <th className="px-4 py-2 text-right">Valor recebido</th>
              <th className="px-4 py-2 text-right">% do total</th>
              <th className="px-4 py-2 text-right">{impostoLabel} rateado</th>
            </tr>
          </thead>
          <tbody>
            {!apuracao ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Selecione uma apuração para ver o rateio.</td></tr>
            ) : rateio.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Nenhum recebimento encontrado no período desta apuração.</td></tr>
            ) : rateio.map((r) => (
              <tr key={r.evento} className="border-t border-border/60">
                <td className="px-4 py-2">{r.evento}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(r.valor)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtPct(r.pct)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtBRL(r.imposto)}</td>
              </tr>
            ))}
          </tbody>
          {rateio.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-foreground/40 bg-muted/30">
                <td className="px-4 py-2 font-semibold">Total</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(totalRecebido)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">100,00%</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(totalImpostoSelecionado)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </>
  );
}
