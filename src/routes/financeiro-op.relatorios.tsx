import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PeriodoFilter, PERIODO_MES_DEFAULT, type Periodo, type PeriodoPreset,
} from "@/components/PeriodoFilter";
import { fetchAllRows } from "@/lib/fetch-all";

const sb = supabase as any;

export const Route = createFileRoute("/financeiro/relatorios")({
  component: RelatoriosPage,
});

const STATUS_INCLUIDOS = ["finalizado", "a_receber"] as const;

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

type Row = {
  tipo: "COMPRA" | "DEMANDA";
  numero: number | null;
  id: string;
  titulo: string | null;
  solicitante: string | null;
  comprador: string | null;
  descritivo_fallback: string | null;
  valor_total: number | null;
  itens: { descricao: string | null; quantidade: number | null }[];
};

function RelatoriosPage() {
  const [cartao, setCartao] = useState<string>("");
  const [preset, setPreset] = useState<PeriodoPreset>(PERIODO_MES_DEFAULT.preset);
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_MES_DEFAULT.periodo);

  const { data: cartoes = [] } = useQuery({
    queryKey: ["condicoes_pagamento"],
    queryFn: async () => {
      const { data, error } = await sb.from("condicoes_pagamento").select("nome").order("nome");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.nome as string).filter(Boolean);
    },
  });

  const periodoLabel = useMemo(() => {
    if (!periodo.from && !periodo.to) return "Todos os períodos";
    const f = periodo.from ? format(periodo.from, "dd/MM/yyyy") : "…";
    const t = periodo.to ? format(periodo.to, "dd/MM/yyyy") : "…";
    return `${f} a ${t}`;
  }, [periodo]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["financeiro-relatorio-cartoes", cartao, periodo.from?.toISOString() ?? "", periodo.to?.toISOString() ?? ""],
    enabled: !!cartao,
    queryFn: async (): Promise<Row[]> => {
      const fromYmd = periodo.from ? format(periodo.from, "yyyy-MM-dd") : null;
      const toYmd = periodo.to ? format(periodo.to, "yyyy-MM-dd") : null;

      const buildFilter = (q: any, dateCol: string) => {
        let x = q
          .eq("condicao_pagamento", cartao)
          .in("status", STATUS_INCLUIDOS as unknown as string[]);
        if (fromYmd) x = x.gte(dateCol, fromYmd);
        if (toYmd) x = x.lte(dateCol, toYmd);
        return x;
      };

      const [comprasRes, demandasRes] = await Promise.all([
        buildFilter(
          sb.from("compras").select("id, numero, titulo, solicitante, comprador, observacoes, valor_total, data_compra"),
          "data_compra",
        ),
        buildFilter(
          sb.from("demandas").select("id, numero, titulo, solicitante, comprador, descritivo, observacoes, valor_total, data_solicitacao"),
          "data_solicitacao",
        ),
      ]);
      if (comprasRes.error) throw comprasRes.error;
      if (demandasRes.error) throw demandasRes.error;

      const compras = (comprasRes.data ?? []) as any[];
      const demandas = (demandasRes.data ?? []) as any[];

      const compraIds = compras.map((c) => c.id);
      const demandaIds = demandas.map((d) => d.id);

      const [compraItens, demandaItens] = await Promise.all([
        compraIds.length
          ? sb.from("compra_itens").select("compra_id, descricao, quantidade").in("compra_id", compraIds)
          : Promise.resolve({ data: [], error: null }),
        demandaIds.length
          ? sb.from("demanda_itens").select("demanda_id, descricao, quantidade").in("demanda_id", demandaIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if ((compraItens as any).error) throw (compraItens as any).error;
      if ((demandaItens as any).error) throw (demandaItens as any).error;

      const groupC = new Map<string, { descricao: string | null; quantidade: number | null }[]>();
      for (const it of ((compraItens as any).data ?? []) as any[]) {
        const arr = groupC.get(it.compra_id) ?? [];
        arr.push({ descricao: it.descricao, quantidade: it.quantidade });
        groupC.set(it.compra_id, arr);
      }
      const groupD = new Map<string, { descricao: string | null; quantidade: number | null }[]>();
      for (const it of ((demandaItens as any).data ?? []) as any[]) {
        const arr = groupD.get(it.demanda_id) ?? [];
        arr.push({ descricao: it.descricao, quantidade: it.quantidade });
        groupD.set(it.demanda_id, arr);
      }

      const cRows: Row[] = compras.map((c) => ({
        tipo: "COMPRA",
        numero: c.numero,
        id: c.id,
        titulo: c.titulo,
        solicitante: c.solicitante,
        comprador: c.comprador,
        descritivo_fallback: c.observacoes ?? c.titulo ?? null,
        valor_total: c.valor_total,
        itens: groupC.get(c.id) ?? [],
      }));
      const dRows: Row[] = demandas.map((d) => ({
        tipo: "DEMANDA",
        numero: d.numero,
        id: d.id,
        titulo: d.titulo,
        solicitante: d.solicitante,
        comprador: d.comprador,
        descritivo_fallback: d.descritivo ?? d.observacoes ?? d.titulo ?? null,
        valor_total: d.valor_total,
        itens: groupD.get(d.id) ?? [],
      }));

      return [...cRows, ...dRows].sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1;
        return (b.numero ?? 0) - (a.numero ?? 0);
      });
    },
  });

  const totalGeral = rows.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const totalCompras = rows.filter((r) => r.tipo === "COMPRA").reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const totalDemandas = rows.filter((r) => r.tipo === "DEMANDA").reduce((s, r) => s + Number(r.valor_total ?? 0), 0);

  const emitido = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="print:hidden">
        <PageHeader title="Relatórios — Despesas" description="Relatórios do módulo Financeiro" />
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Cartão (condição de pagamento)</label>
          <Select value={cartao} onValueChange={setCartao}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione um cartão…" />
            </SelectTrigger>
            <SelectContent>
              {cartoes.map((n: string) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Período</label>
          <PeriodoFilter
            preset={preset}
            periodo={periodo}
            onChange={(p, per) => { setPreset(p); setPeriodo(per); }}
          />
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!cartao || rows.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Luminart Eventos</h1>
        <div className="text-sm">Relatório de Cartão — {cartao || "—"}</div>
        <div className="text-sm">Período: {periodoLabel}</div>
        <div className="text-xs text-muted-foreground">Emitido em {emitido}</div>
      </div>

      {!cartao ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground print:hidden">
          Selecione um cartão para gerar o relatório.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum registro finalizado ou a receber para este cartão no período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border print:border-0 print:overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 print:bg-transparent">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Título</th>
                <th className="text-left px-3 py-2 font-medium">Solicitante</th>
                <th className="text-left px-3 py-2 font-medium">Comprador</th>
                <th className="text-left px-3 py-2 font-medium">Itens ou Descritivo</th>
                <th className="text-right px-3 py-2 font-medium">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                    {r.tipo}-{r.numero ?? "—"}
                  </td>
                  <td className="px-3 py-2">{r.titulo ?? "—"}</td>
                  <td className="px-3 py-2">{r.solicitante ?? "—"}</td>
                  <td className="px-3 py-2">{r.comprador ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.itens.length > 0 ? (
                      <ul className="space-y-0.5">
                        {r.itens.map((it, i) => (
                          <li key={i}>
                            {Number(it.quantidade ?? 0)}x {it.descricao ?? "—"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="whitespace-pre-wrap">{r.descritivo_fallback ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{brl(r.valor_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 print:bg-transparent">
                <td colSpan={5} className="px-3 py-2 text-right text-xs text-muted-foreground">
                  Subtotal Compras: {brl(totalCompras)} · Subtotal Despesas: {brl(totalDemandas)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">&nbsp;</td>
              </tr>
              <tr className="border-t bg-muted/60 print:bg-transparent">
                <td colSpan={5} className="px-3 py-2 text-right font-semibold">Total geral</td>
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{brl(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
