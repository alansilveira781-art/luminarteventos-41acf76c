import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PeriodoFilter, PERIODO_MES_DEFAULT, type Periodo, type PeriodoPreset,
} from "@/components/PeriodoFilter";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetch-all";
import CartoesReport from "@/components/compras/CartoesReport";
import AnalisesFornecedorReport from "@/components/compras/AnalisesFornecedorReport";
import { TablePagination } from "@/components/TablePagination";

import {
  CA_EXPORT_HEADERS, formatarDataBR, linhaParaPlanilha, linhasDoCard, normForma,
  type CardMin, type LinhaExport, type PagamentoMin,
} from "@/lib/conta-azul/exportacao-cards";

const sb = supabase as any;

export const Route = createFileRoute("/compras/relatorios")({
  component: RelatoriosComprasPage,
});

const TODAS = "__todas__";
const SEM_FORMA = "__sem_forma__";
const SEM_CATEGORIA = "__sem_categoria__";
const PAGE_SIZE = 25;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

function RelatoriosComprasPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Relatórios — Compras"
        description="Exportação dos cards de Compras e Despesas no modelo de importação do Conta Azul"
      />
      <Tabs defaultValue="conta-azul">
        <TabsList>
          <TabsTrigger value="conta-azul">Importação Conta Azul</TabsTrigger>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
          <TabsTrigger value="analises">Análises</TabsTrigger>
        </TabsList>
        <TabsContent value="conta-azul">
          <ContaAzulExport />
        </TabsContent>
        <TabsContent value="cartoes">
          <CartoesReport />
        </TabsContent>
        <TabsContent value="analises">
          <AnalisesFornecedorReport />
        </TabsContent>
      </Tabs>

    </div>
  );
}

function ContaAzulExport() {
  const qc = useQueryClient();
  const [cartao, setCartao] = useState<string>(TODAS);
  const [preset, setPreset] = useState<PeriodoPreset>(PERIODO_MES_DEFAULT.preset);
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_MES_DEFAULT.periodo);
  const [page, setPage] = useState(1);

  /* -------- formas de pagamento usadas nos cards -------- */
  const { data: formas = [] } = useQuery({
    queryKey: ["compras-relatorio-formas"],
    queryFn: async (): Promise<{ key: string; label: string }[]> => {
      const [pc, pd] = await Promise.all([
        fetchAllRows<any>("compra_pagamentos", "forma"),
        fetchAllRows<any>("demanda_pagamentos", "forma"),
      ]);
      const map = new Map<string, string>();
      for (const n of [...pc, ...pd].map((r) => r.forma)) {
        if (!n || !String(n).trim()) continue;
        const k = normForma(n);
        if (!map.has(k)) map.set(k, String(n).trim());
      }
      return [...map.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });

  /* -------- categorias ativas do Conta Azul -------- */
  const { data: categorias = [] } = useQuery({
    queryKey: ["compras-relatorio-categorias-ca"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb
        .from("ca_plano_contas")
        .select("nome, ativo, tipo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return [...new Set(((data ?? []) as any[]).map((r) => String(r.nome ?? "").trim()).filter(Boolean))];
    },
  });

  /* -------- cards -------- */
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["compras-relatorio-cards-ca"],
    queryFn: async (): Promise<CardMin[]> => {
      const [compras, demandas, pagC, pagD, itens, fornecedores] = await Promise.all([
        fetchAllRows<any>(
          "compras",
          "id, numero, titulo, fornecedor, fornecedor_id, documento, observacoes, valor_total, data_compra, data_solicitacao, created_at, categoria_conta_azul",
        ),
        fetchAllRows<any>(
          "demandas",
          "id, numero, titulo, fornecedor, fornecedor_id, documento, observacoes, valor_total, data_compra, data_solicitacao, created_at, evento_projeto, categoria_conta_azul",
        ),
        fetchAllRows<any>(
          "compra_pagamentos",
          "compra_id, forma, parcelamento, valor, data_pagamento, pago, pago_em, ordem",
        ),
        fetchAllRows<any>(
          "demanda_pagamentos",
          "demanda_id, forma, parcelamento, valor, data_pagamento, pago, pago_em, ordem",
        ),
        fetchAllRows<any>("compra_itens", "compra_id, evento_projeto"),
        fetchAllRows<any>("compras_fornecedores", "id, documento"),
      ]);

      const docFornecedor = new Map<string, string>();
      for (const f of fornecedores) if (f?.id) docFornecedor.set(f.id, f.documento ?? "");

      const eventoPorCompra = new Map<string, string>();
      for (const it of itens) {
        const ev = String(it.evento_projeto ?? "").trim();
        if (ev && !eventoPorCompra.has(it.compra_id)) eventoPorCompra.set(it.compra_id, ev);
      }

      const pagPorCompra = new Map<string, PagamentoMin[]>();
      for (const p of pagC) {
        const arr = pagPorCompra.get(p.compra_id) ?? [];
        arr.push(p as PagamentoMin);
        pagPorCompra.set(p.compra_id, arr);
      }
      const pagPorDemanda = new Map<string, PagamentoMin[]>();
      for (const p of pagD) {
        const arr = pagPorDemanda.get(p.demanda_id) ?? [];
        arr.push(p as PagamentoMin);
        pagPorDemanda.set(p.demanda_id, arr);
      }

      const doc = (c: any) => c.documento || docFornecedor.get(c.fornecedor_id ?? "") || "";

      const out: CardMin[] = [
        ...compras.map((c) => ({
          tipo: "COMPRA" as const,
          id: c.id,
          numero: c.numero ?? null,
          titulo: c.titulo ?? null,
          fornecedor: c.fornecedor ?? null,
          documento: doc(c),
          observacoes: c.observacoes ?? null,
          evento_projeto: eventoPorCompra.get(c.id) ?? null,
          valor_total: c.valor_total ?? null,
          data_compra: c.data_compra ?? null,
          data_solicitacao: c.data_solicitacao ?? null,
          created_at: c.created_at ?? null,
          categoria: c.categoria_conta_azul ?? null,
          pagamentos: pagPorCompra.get(c.id) ?? [],
        })),
        ...demandas.map((d) => ({
          tipo: "DESPESA" as const,
          id: d.id,
          numero: d.numero ?? null,
          titulo: d.titulo ?? null,
          fornecedor: d.fornecedor ?? null,
          documento: doc(d),
          observacoes: d.observacoes ?? null,
          evento_projeto: d.evento_projeto ?? null,
          valor_total: d.valor_total ?? null,
          data_compra: d.data_compra ?? null,
          data_solicitacao: d.data_solicitacao ?? null,
          created_at: d.created_at ?? null,
          categoria: d.categoria_conta_azul ?? null,
          pagamentos: pagPorDemanda.get(d.id) ?? [],
        })),
      ];
      return out;
    },
  });

  /* -------- linhas filtradas -------- */
  const linhas: LinhaExport[] = useMemo(() => {
    const from = periodo.from ? format(periodo.from, "yyyy-MM-dd") : null;
    const to = periodo.to ? format(periodo.to, "yyyy-MM-dd") : null;
    const filtro =
      cartao === TODAS
        ? undefined
        : cartao === SEM_FORMA
          ? (f: string | null) => normForma(f) === ""
          : (f: string | null) => normForma(f) === cartao;

    const out: LinhaExport[] = [];
    for (const card of cards) {
      const geradas = linhasDoCard(card, filtro);
      for (const l of geradas) {
        const comp = l.competencia ?? "";
        if (from && (!comp || comp < from)) continue;
        if (to && (!comp || comp > to)) continue;
        out.push(l);
      }
    }
    return out.sort((a, b) => (a.competencia ?? "").localeCompare(b.competencia ?? ""));
  }, [cards, cartao, periodo]);

  const total = linhas.reduce((s, l) => s + l.valor, 0);

  const pageCount = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE));
  const pageAtual = Math.min(page, pageCount);
  const inicio = (pageAtual - 1) * PAGE_SIZE;
  const linhasPagina = linhas.slice(inicio, inicio + PAGE_SIZE);

  /* -------- gravar categoria no card -------- */
  const salvarCategoria = useMutation({
    mutationFn: async ({ tipo, id, categoria }: { tipo: "COMPRA" | "DESPESA"; id: string; categoria: string | null }) => {
      const tabela = tipo === "COMPRA" ? "compras" : "demandas";
      const { error } = await sb.from(tabela).update({ categoria_conta_azul: categoria }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compras-relatorio-cards-ca"] }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a categoria."),
  });

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const aoa = [[...CA_EXPORT_HEADERS], ...linhas.map(linhaParaPlanilha)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 28 },
      { wch: 52 }, { wch: 32 }, { wch: 20 }, { wch: 28 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const slug = (s: string) => s.replace(/[^\w]+/g, "-").toLowerCase();
    const label = cartao === TODAS ? "todas" : cartao === SEM_FORMA ? "sem-forma" : cartao;
    XLSX.writeFile(wb, `conta-azul-${slug(label)}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Cartão / forma de pagamento</label>
          <Select value={cartao} onValueChange={(v) => { setCartao(v); setPage(1); }}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as formas</SelectItem>
              <SelectItem value={SEM_FORMA}>Sem forma informada</SelectItem>
              {formas.map((f) => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Período (data de competência)</label>
          <PeriodoFilter
            preset={preset}
            periodo={periodo}
            onChange={(p, per) => { setPreset(p); setPeriodo(per); setPage(1); }}
          />
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportar} disabled={linhas.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento no filtro selecionado.
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {linhas.length} lançamento(s) · Total {brl(total)}
          </div>
          <div className="overflow-auto rounded-lg border max-h-[calc(100vh-260px)]">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[18%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-muted/50">
                <tr className="h-10">
                  {CA_EXPORT_HEADERS.map((h) => (
                    <th key={h} className="text-left px-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasPagina.map((l, i) => (
                  <tr key={`${l.cardKey}-${inicio + i}`} className="h-11 border-t">
                    <td className="px-3 whitespace-nowrap">{formatarDataBR(l.competencia) || "—"}</td>
                    <td className="px-3 whitespace-nowrap">{formatarDataBR(l.vencimento) || "—"}</td>
                    <td className="px-3 whitespace-nowrap">{formatarDataBR(l.pagamento) || "—"}</td>
                    <td className="px-3 text-right tabular-nums whitespace-nowrap">{brl(l.valor)}</td>
                    <td className="px-3">
                      <Select
                        value={l.categoria ?? SEM_CATEGORIA}
                        onValueChange={(v) =>
                          salvarCategoria.mutate({
                            tipo: l.tipo,
                            id: l.cardId,
                            categoria: v === SEM_CATEGORIA ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Selecionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_CATEGORIA}>— Sem categoria —</SelectItem>
                          {categorias.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 truncate" title={l.descricao}>
                      {l.descricao}
                      {l.parcelaLabel !== "1/1" && (
                        <span className="ml-1 text-xs text-muted-foreground">({l.parcelaLabel})</span>
                      )}
                    </td>
                    <td className="px-3 truncate" title={l.fornecedor}>{l.fornecedor || "—"}</td>
                    <td className="px-3 truncate whitespace-nowrap" title={l.documento}>{l.documento || "—"}</td>
                    <td className="px-3 truncate" title={l.centroCusto}>{l.centroCusto || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {inicio + 1}–{Math.min(inicio + PAGE_SIZE, linhas.length)} de {linhas.length}
            </span>
            <TablePagination page={pageAtual} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
