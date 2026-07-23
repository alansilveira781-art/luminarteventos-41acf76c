import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormSection } from "@/components/FormSection";
import { Trash2, Save, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
type XLSXNs = typeof import("xlsx");
let _xlsxPromise: Promise<XLSXNs> | null = null;
const loadXLSX = () => (_xlsxPromise ??= import("xlsx"));
import { toast } from "sonner";
import { format } from "date-fns";
import { EMPRESAS } from "@/lib/empresas";
import { calcularImpostosPresumido, MESES, mesIndex, type Aliquota } from "@/lib/contabil/calculo";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/apuracoes")({
  component: ApuracoesPage,
});

const fmtBRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2];

function ApuracoesPage() {
  const qc = useQueryClient();
  const [ano, setAno] = useState<number>(2026);
  const [mes, setMes] = useState<string>("Março");
  const [empresa, setEmpresa] = useState<string>(EMPRESAS[0]);
  const [regime, setRegime] = useState<"caixa" | "competencia">("caixa");

  const mIdx = mesIndex(mes);
  const periodoInicio = useMemo(() => new Date(ano, mIdx, 1).toISOString().slice(0, 10), [ano, mIdx]);
  const periodoFim = useMemo(() => new Date(ano, mIdx + 1, 0).toISOString().slice(0, 10), [ano, mIdx]);
  const vencimento = useMemo(() => {
    const d = new Date(ano, mIdx + 1, 1);
    return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
  }, [ano, mIdx]);

  const { data: aliquotas } = useQuery({
    queryKey: ["contabil-aliquotas-apuracao", empresa],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_configuracao_aliquotas")
        .select("imposto, aliquota, base_calculo, aliquota_adicional, observacoes")
        .eq("empresa", empresa)
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as Aliquota[];
    },
  });

  const { data: recebimentos } = useQuery({
    queryKey: ["contabil-recebimentos-mes", empresa, periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_recebimentos")
        .select("id, numero_nf, valor_recebido, data_recebimento, banco, nota_id, observacoes")
        .eq("empresa", empresa)
        .gte("data_recebimento", periodoInicio)
        .lte("data_recebimento", periodoFim)
        .order("data_recebimento");
      if (error) throw error;
      return data as Array<{ id: string; numero_nf: string | null; valor_recebido: number; data_recebimento: string; banco: string | null; nota_id: string | null; observacoes: string | null }>;
    },
  });

  const { data: notasEmitidas } = useQuery({
    queryKey: ["contabil-notas-emitidas-mes", empresa, periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_notas_fiscais")
        .select("id, numero, nome_evento, valor_bruto, data_emissao, tomador_nome")
        .eq("empresa", empresa)
        .gte("data_emissao", periodoInicio)
        .lte("data_emissao", periodoFim)
        .order("data_emissao");
      if (error) throw error;
      return data as Array<{ id: string; numero: string | null; nome_evento: string | null; valor_bruto: number; data_emissao: string; tomador_nome: string | null }>;
    },
  });

  const { data: notasMap } = useQuery({
    queryKey: ["contabil-notas-map", empresa],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_notas_fiscais")
        .select("id, numero, nome_evento, numero_evento")
        .eq("empresa", empresa);
      if (error) throw error;
      const map = new Map<string, { numero: string | null; nome_evento: string | null }>();
      const byNum = new Map<string, { numero: string | null; nome_evento: string | null }>();
      for (const n of data ?? []) {
        map.set(n.id, { numero: n.numero, nome_evento: n.nome_evento });
        if (n.numero) byNum.set(String(n.numero), { numero: n.numero, nome_evento: n.nome_evento });
      }
      return { map, byNum };
    },
  });

  const faturamentoCaixa = (recebimentos ?? []).reduce((s, r) => s + Number(r.valor_recebido || 0), 0);
  const faturamentoCompetencia = (notasEmitidas ?? []).reduce((s, n) => s + Number(n.valor_bruto || 0), 0);
  const faturamento = regime === "caixa" ? faturamentoCaixa : faturamentoCompetencia;
  const apuracao = useMemo(() => calcularImpostosPresumido(faturamento, aliquotas ?? []), [faturamento, aliquotas]);


  const { data: historico } = useQuery({
    queryKey: ["contabil-apuracoes-hist"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_consultas_impostos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<any>;
    },
  });

  const salvarMut = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: `Apuração ${mes}/${ano} — ${empresa}`,
        empresa,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        parametros: { ano, mes, empresa, regime, vencimento },
        resultado: {
          regime,
          vencimento,
          faturamento: apuracao.faturamento,
          basePresumida: apuracao.basePresumida,
          totalImpostos: apuracao.totalImpostos,
          itens: apuracao.itens,
          recebimentos: regime === "caixa" ? (recebimentos ?? []).map((r) => ({
            numero_nf: r.numero_nf,
            valor_recebido: r.valor_recebido,
            data_recebimento: r.data_recebimento,
          })) : [],
          notas: regime === "competencia" ? (notasEmitidas ?? []).map((n) => ({
            numero: n.numero,
            valor_bruto: n.valor_bruto,
            data_emissao: n.data_emissao,
            nome_evento: n.nome_evento,
          })) : [],
        },
        status: "concluida",
      };
      const { error } = await sb.from("contabil_consultas_impostos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-apuracoes-hist"] });
      toast.success("Apuração registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contabil_consultas_impostos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-apuracoes-hist"] });
      toast.success("Removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const buildRows = () => {
    const rows: Array<{ data: string; nf: string; evento: string; valor: number; banco: string }> = [];
    if (regime === "caixa") {
      for (const r of recebimentos ?? []) {
        const notaLinked = r.nota_id ? notasMap?.map.get(r.nota_id) : null;
        const nf = String(r.numero_nf ?? notaLinked?.numero ?? "—");
        const ev = (notaLinked?.nome_evento
          || (r.numero_nf && notasMap?.byNum.get(String(r.numero_nf))?.nome_evento)
          || "—") as string;
        rows.push({
          data: format(new Date(r.data_recebimento), "dd/MM/yyyy"),
          nf, evento: ev, valor: Number(r.valor_recebido || 0), banco: r.banco ?? "—",
        });
      }
    } else {
      for (const n of notasEmitidas ?? []) {
        rows.push({
          data: format(new Date(n.data_emissao), "dd/MM/yyyy"),
          nf: String(n.numero ?? "—"),
          evento: (n.nome_evento ?? n.tomador_nome ?? "—") as string,
          valor: Number(n.valor_bruto || 0),
          banco: "—",
        });
      }
    }
    return rows;
  };

  const exportarExcel = async () => {
    const rows = buildRows();
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const header = [
      ["Rascunho de Apuração"],
      ["Empresa", empresa],
      ["Referência", `${mes}/${ano}`],
      ["Regime", regime === "caixa" ? "Caixa" : "Competência"],
      ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Data", "Nº NF", "Evento", "Valor", "Banco"],
    ];
    const body = rows.map(r => [r.data, r.nf, r.evento, r.valor, r.banco]);
    const footer = [[], ["", "", `Faturamento (${regime === "caixa" ? "caixa" : "competência"})`, faturamento, ""]];
    const ws1 = XLSX.utils.aoa_to_sheet([...header, ...body, ...footer]);
    ws1["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Lançamentos");

    const impostos: any[][] = [["Imposto", "Valor"]];
    for (const i of (apuracao.itens ?? [])) impostos.push([i.imposto, Number(i.valor || 0)]);
    impostos.push(["Total", Number(apuracao.totalImpostos || 0)]);
    const ws2 = XLSX.utils.aoa_to_sheet(impostos);
    ws2["!cols"] = [{ wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Impostos");

    const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    XLSX.writeFile(wb, `apuracao-${safe(empresa)}-${safe(mes)}-${ano}.xlsx`);
  };

  const exportarPDF = () => {
    const rows = buildRows();

    const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const impostosRows = (apuracao.itens ?? []).map((i: any) =>
      `<tr><td>${esc(i.imposto)}</td><td style="text-align:right">${fmtBRL(Number(i.valor || 0))}</td></tr>`
    ).join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Rascunho de Apuração — ${esc(empresa)} ${esc(mes)}/${ano}</title>
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
  .impostos { margin-top: 20px; max-width: 320px; }
  .impostos th, .impostos td { border-bottom: 1px solid #eee; }
  .foot { margin-top: 24px; font-size: 10px; color: #666; }
  @media print { body { margin: 12mm; } .noprint { display: none; } }
</style></head><body>
<h1>Rascunho de Apuração</h1>
<div class="meta">
  <span><b>Empresa:</b> ${esc(empresa)}</span>
  <span><b>Referência:</b> ${esc(mes)}/${ano}</span>
  <span><b>Regime:</b> ${regime === "caixa" ? "Caixa" : "Competência"}</span>
  <span><b>Gerado em:</b> ${format(new Date(), "dd/MM/yyyy HH:mm")}</span>
</div>
<table>
  <thead><tr>
    <th>Data</th><th>Nº NF</th><th>Evento</th><th class="num">Valor</th><th>Banco</th>
  </tr></thead>
  <tbody>
    ${rows.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:#666">Nenhum registro no período.</td></tr>`
      : rows.map(r => `<tr><td>${esc(r.data)}</td><td>${esc(r.nf)}</td><td>${esc(r.evento)}</td><td class="num">${fmtBRL(r.valor)}</td><td>${esc(r.banco)}</td></tr>`).join("")}
  </tbody>
  <tfoot><tr>
    <td colspan="3">Faturamento (${regime === "caixa" ? "caixa" : "competência"})</td>
    <td class="num">${fmtBRL(faturamento)}</td>
    <td></td>
  </tr></tfoot>
</table>
${impostosRows ? `<table class="impostos"><thead><tr><th>Imposto</th><th class="num">Valor</th></tr></thead><tbody>${impostosRows}<tr><td><b>Total</b></td><td class="num"><b>${fmtBRL(Number(apuracao.totalImpostos || 0))}</b></td></tr></tbody></table>` : ""}
<div class="foot">Documento de rascunho — não possui valor fiscal.</div>
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
        title="Apurações de impostos"
        description="Apuração de PIS, COFINS, IRPJ e CSLL (Lucro Presumido). Selecione o mês de referência: no regime de caixa, soma os valores recebidos no mês; no de competência, soma as notas emitidas. O imposto apurado é pago no mês seguinte."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">Salva no histórico abaixo</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" title="Exportar rascunho da apuração">
                  <Download className="h-4 w-4 mr-1" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportarPDF}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarExcel}>Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending || faturamento <= 0} title="Salva esta apuração no card 'Apurações registradas' abaixo">
              <Save className="h-4 w-4 mr-1" /> Registrar apuração
            </Button>
          </div>
        }
      />


      <Card className="p-4 mb-4">
        <FormSection>
          <FormField label="Ano">
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={regime === "caixa" ? "Mês de referência (recebimento)" : "Mês de referência (emissão)"}>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Empresa">
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Regime de apuração">
            <Select value={regime} onValueChange={(v) => setRegime(v as "caixa" | "competencia")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="caixa">Caixa (valor recebido)</SelectItem>
                <SelectItem value="competencia">Competência (valor emitido)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {regime === "caixa"
                ? "Imposto incide sobre o que foi recebido no mês de referência."
                : "Imposto incide sobre as notas emitidas no mês de referência, mesmo que ainda não recebidas."}
            </p>
          </FormField>
        </FormSection>
        <div className="mt-3 text-xs text-muted-foreground">
          {regime === "caixa" ? "Referência (recebimentos de): " : "Referência (notas emitidas em): "}
          <strong className="text-foreground">{mes}/{ano}</strong> · Imposto a pagar em: <strong className="text-foreground">{vencimento}</strong>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex justify-between items-center">
            <div className="text-sm font-semibold">
              {regime === "caixa" ? "Recebimentos do mês de referência" : "Notas emitidas no mês de referência"}
            </div>
            <div className="text-xs text-muted-foreground">
              {regime === "caixa" ? (recebimentos ?? []).length : (notasEmitidas ?? []).length} registros
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Nº NF</th>
                <th className="px-4 py-2 text-left">Evento</th>
                <th className="px-4 py-2 text-right">{regime === "caixa" ? "Recebido" : "Valor bruto"}</th>
              </tr>
            </thead>
            <tbody>
              {regime === "caixa" ? (
                (recebimentos ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Nenhum recebimento no período.</td></tr>
                ) : (recebimentos ?? []).map((r) => {
                  const notaLinked = r.nota_id ? notasMap?.map.get(r.nota_id) : null;
                  const numeroNF = r.numero_nf
                    ?? notaLinked?.numero
                    ?? "—";
                  const ev = notaLinked?.nome_evento
                    || (r.numero_nf && notasMap?.byNum.get(String(r.numero_nf))?.nome_evento)
                    || "—";
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 text-xs">{format(new Date(r.data_recebimento), "dd/MM/yyyy")}</td>
                      <td className="px-4 py-2 font-mono text-xs">{numeroNF}</td>
                      <td className="px-4 py-2">{ev}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(Number(r.valor_recebido))}</td>
                    </tr>
                  );
                })
              ) : (
                (notasEmitidas ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Nenhuma nota emitida no período.</td></tr>
                ) : (notasEmitidas ?? []).map((n) => (
                  <tr key={n.id} className="border-t border-border">
                    <td className="px-4 py-2 text-xs">{format(new Date(n.data_emissao), "dd/MM/yyyy")}</td>
                    <td className="px-4 py-2 font-mono text-xs">{n.numero ?? "—"}</td>
                    <td className="px-4 py-2">{n.nome_evento ?? n.tomador_nome ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(Number(n.valor_bruto))}</td>
                  </tr>
                ))
              )}
              <tr className="border-t-2 border-border bg-muted/30">
                <td colSpan={3} className="px-4 py-2 text-sm font-semibold">
                  Faturamento ({regime === "caixa" ? "caixa" : "competência"}) — base do imposto
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(faturamento)}</td>
              </tr>
            </tbody>
          </table>
        </Card>


        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">
            Impostos apurados — Base presumida (32%): <span className="tabular-nums">{fmtBRL(apuracao.basePresumida)}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Imposto</th>
                <th className="px-2 py-2 text-right">Base</th>
                <th className="px-2 py-2 text-right">Alíq.</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Adic.</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {apuracao.itens.map((i) => (
                <tr key={i.imposto} className="border-t border-border">
                  <td className="px-2 py-2 font-medium whitespace-nowrap">{i.imposto}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(i.base)}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{i.aliquota.toFixed(2)}%</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(i.valor)}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{i.adicional ? fmtBRL(i.adicional) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium whitespace-nowrap">{fmtBRL(i.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/30">
                <td colSpan={5} className="px-2 py-2 text-sm font-semibold">Total a pagar</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{fmtBRL(apuracao.totalImpostos)}</td>
              </tr>
            </tbody>
          </table>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
            <strong>IRPJ:</strong> apurado {fmtBRL(apuracao.irpjDetalhe.irpjNormal)}
            {" — "}Limite mensal {fmtBRL(apuracao.irpjDetalhe.limite)}
            {" — "}Excedente {fmtBRL(apuracao.irpjDetalhe.excedente)}
            {" — "}Adicional ({apuracao.irpjDetalhe.aliquotaAdicional.toFixed(2)}%): <span className="font-medium text-foreground">{fmtBRL(apuracao.irpjDetalhe.adicional)}</span>
          </div>
          {(!aliquotas || aliquotas.length === 0) && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              Nenhuma alíquota configurada para {empresa}. Configure em <strong>Configuração</strong>.
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">
          Apurações registradas
          <span className="ml-2 text-xs font-normal text-muted-foreground">Histórico interno — não envia para Financeiro/Contas a Pagar</span>
        </div>
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Competência</th>
              <th className="px-4 py-2 text-left">Vencimento</th>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2 text-left">Regime</th>
              <th className="px-4 py-2 text-right">Faturamento</th>
              <th className="px-4 py-2 text-right">Total impostos</th>
              <th className="px-4 py-2 text-left">Registrado em</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(historico ?? []).length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground text-xs">Nenhuma apuração registrada.</td></tr>
            ) : (historico ?? []).map((h) => (
              <tr key={h.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2 whitespace-nowrap">{h.parametros?.mes}/{h.parametros?.ano}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">{h.parametros?.vencimento ?? h.resultado?.vencimento ?? "—"}</td>
                <td className="px-4 py-2">{h.empresa ?? "—"}</td>
                <td className="px-4 py-2 text-xs capitalize">{h.parametros?.regime ?? h.resultado?.regime ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(Number(h.resultado?.faturamento ?? 0))}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap">{fmtBRL(Number(h.resultado?.totalImpostos ?? 0))}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover apuração?")) delMut.mutate(h.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </>
  );
}
