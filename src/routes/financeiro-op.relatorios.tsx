import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { useDreEstrutura } from "@/hooks/useDreEstrutura";
import {
  DRE_STRUCTURE, calcularDRECaixa, montarLinhasPorCentro,
  type DreGroupId, type DreLine, type RateioMin,
} from "@/lib/conta-azul/dre";
import {
  CATEGORIAS_CENTRO_CUSTO, CATEGORIA_LABEL, type CategoriaCentroCusto,
} from "@/lib/centro-custo-categorias";

const sb = supabase as any;

export const Route = createFileRoute("/financeiro-op/relatorios")({
  component: RelatoriosPage,
});

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

function RelatoriosPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="print:hidden">
        <PageHeader title="Relatórios — Financeiro Op" description="Análises e classificação de eventos" />
      </div>
      <Tabs defaultValue="analises" className="print:hidden">
        <TabsList>
          <TabsTrigger value="analises">Análises</TabsTrigger>
          <TabsTrigger value="classificacao">Classificação de Eventos</TabsTrigger>
        </TabsList>
        <TabsContent value="analises"><AnalisesReport /></TabsContent>
        <TabsContent value="classificacao"><ClassificacaoEventos /></TabsContent>
      </Tabs>
    </div>
  );
}


/* -------------------- Classificação de Eventos -------------------- */

type EventoCC = {
  id: string;
  external_id: string;
  nome: string;
  categoria: CategoriaCentroCusto | null;
  ativo: boolean;
  removido_em: string | null;
};

function ClassificacaoEventos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [soNaoClassificados, setSoNaoClassificados] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos_centros_custo"],
    queryFn: async (): Promise<EventoCC[]> => {
      const { data, error } = await sb
        .from("eventos_centros_custo")
        .select("id, external_id, nome, categoria, ativo, removido_em")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EventoCC[];
    },
  });

  const setCategoria = useMutation({
    mutationFn: async ({ id, categoria }: { id: string; categoria: CategoriaCentroCusto | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb
        .from("eventos_centros_custo")
        .update({ categoria, classificado_por: u?.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos_centros_custo"] });
      toast.success("Classificação atualizada");
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const filtrados = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      if (!mostrarInativos && !e.ativo) return false;
      if (soNaoClassificados && e.categoria) return false;
      if (needle && !e.nome.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [eventos, busca, soNaoClassificados, mostrarInativos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 w-[280px]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={soNaoClassificados} onCheckedChange={(v) => setSoNaoClassificados(!!v)} />
          Somente não classificados
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={mostrarInativos} onCheckedChange={(v) => setMostrarInativos(!!v)} />
          Mostrar removidos
        </label>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} de {eventos.length}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Evento / Centro de Custo</th>
                <th className="text-left px-3 py-2 font-medium w-[220px]">Categoria</th>
                <th className="text-left px-3 py-2 font-medium w-[120px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2">{e.nome}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={e.categoria ?? "__none__"}
                      onValueChange={(v) =>
                        setCategoria.mutate({
                          id: e.id,
                          categoria: v === "__none__" ? null : (v as CategoriaCentroCusto),
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem classificação</SelectItem>
                        {CATEGORIAS_CENTRO_CUSTO.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    {e.ativo ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Removido</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------- Análises — Comparação entre eventos -------------------- */

type PlanoConta = { external_id: string; nome: string };

function AnalisesReport() {
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaCentroCusto>("corporativo");
  const [pagPorCat, setPagPorCat] = useState<Record<string, number>>({});
  const PAGE_SIZE = 4;

  const dreEstrutura = useDreEstrutura().data ?? DRE_STRUCTURE;

  // Reset pagination on filter changes.
  const filterKey = categoriaFiltro;
  useMemo(() => { setPagPorCat({}); }, [filterKey]);


  const eventos = useQuery({
    queryKey: ["eventos_centros_custo", "analises"],
    queryFn: async (): Promise<EventoCC[]> => {
      const { data, error } = await sb
        .from("eventos_centros_custo")
        .select("id, external_id, nome, categoria, ativo, removido_em")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EventoCC[];
    },
  });

  const planos = useQuery({
    queryKey: ["ca-plano", "analises"],
    queryFn: async (): Promise<PlanoConta[]> => {
      const { data } = await sb.from("ca_plano_contas").select("external_id,nome");
      return (data ?? []) as PlanoConta[];
    },
  });

  const evExtIds = useMemo(
    () => (eventos.data ?? []).map((e) => e.external_id),
    [eventos.data],
  );
  const evKey = useMemo(() => [...evExtIds].sort().join(","), [evExtIds]);

  const fetchPaged = async <T,>(build: (from: number, to: number) => any): Promise<T[]> => {
    const all: T[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await build(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as T[]));
      if (data.length < pageSize) break;
    }
    return all;
  };

  // Todos os rateios cujos centros são eventos classificáveis (base dos números).
  const rateios = useQuery({
    queryKey: ["ca-rateios", "analises", evKey],
    enabled: evExtIds.length > 0,
    queryFn: async (): Promise<RateioMin[]> => {
      const out: RateioMin[] = [];
      for (let i = 0; i < evExtIds.length; i += 300) {
        const chunk = evExtIds.slice(i, i + 300);
        const rows = await fetchPaged<RateioMin & { centro_custo_external_id: string }>((from, to) =>
          sb
            .from("ca_lancamento_rateios")
            .select("lancamento_external_id,tipo,categoria_external_id,valor,ordem,centro_custo_external_id")
            .in("centro_custo_external_id", chunk)
            .range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  });

  const rateiosData = rateios.data ?? [];
  // Rateios agrupados por centro para lookup rápido.
  const rateiosPorCentro = useMemo(() => {
    const m = new Map<string, RateioMin[]>();
    (rateiosData as any[]).forEach((r) => {
      const arr = m.get(r.centro_custo_external_id) ?? [];
      arr.push(r);
      m.set(r.centro_custo_external_id, arr);
    });
    return m;
  }, [rateiosData]);

  const lancPagarIds = useMemo(
    () => Array.from(new Set(rateiosData.filter((r) => r.tipo === "pagar").map((r) => r.lancamento_external_id))),
    [rateiosData],
  );
  const lancReceberIds = useMemo(
    () => Array.from(new Set(rateiosData.filter((r) => r.tipo === "receber").map((r) => r.lancamento_external_id))),
    [rateiosData],
  );
  const pagarKey = useMemo(() => [...lancPagarIds].sort().join(","), [lancPagarIds]);
  const receberKey = useMemo(() => [...lancReceberIds].sort().join(","), [lancReceberIds]);

  const pagarParents = useQuery({
    queryKey: ["ca-pagar-parents", "analises", pagarKey],
    enabled: lancPagarIds.length > 0,
    queryFn: async () => {
      const cols = "external_id,descricao,fornecedor_nome,data_vencimento,data_pagamento,status,observacoes";
      const out: any[] = [];
      for (let i = 0; i < lancPagarIds.length; i += 300) {
        const chunk = lancPagarIds.slice(i, i + 300);
        const rows = await fetchPaged<any>((from, to) =>
          sb.from("ca_contas_pagar").select(cols).in("external_id", chunk).range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  });
  const receberParents = useQuery({
    queryKey: ["ca-receber-parents", "analises", receberKey],
    enabled: lancReceberIds.length > 0,
    queryFn: async () => {
      const cols = "external_id,descricao,cliente_nome,data_vencimento,data_pagamento,status,observacoes";
      const out: any[] = [];
      for (let i = 0; i < lancReceberIds.length; i += 300) {
        const chunk = lancReceberIds.slice(i, i + 300);
        const rows = await fetchPaged<any>((from, to) =>
          sb.from("ca_contas_receber").select(cols).in("external_id", chunk).range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  });

  const planoMap = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    (planos.data ?? []).forEach((p) => m.set(p.external_id, { nome: p.nome }));
    return m;
  }, [planos.data]);

  const loading =
    eventos.isLoading ||
    planos.isLoading ||
    (rateios.fetchStatus !== "idle" && rateios.isLoading) ||
    (pagarParents.fetchStatus !== "idle" && pagarParents.isLoading) ||
    (receberParents.fetchStatus !== "idle" && receberParents.isLoading);

  const linhasCard: DreLine[] = useMemo(() => {
    const sums = dreEstrutura.filter((l) => l.kind === "sum");
    const lu = dreEstrutura.find((l) => l.id === "LU");
    return lu ? [...sums, lu] : sums;
  }, [dreEstrutura]);
  const idsCard = useMemo(() => linhasCard.map((l) => l.id as DreGroupId), [linhasCard]);

  // Cache de totais por evento — invalidado quando dados/período mudam.
  const totaisPorEvento = useMemo(() => {
    const cache = new Map<string, Partial<Record<DreGroupId, number>>>();
    if (loading) return cache;
    const pParents = pagarParents.data ?? [];
    const rParents = receberParents.data ?? [];
    (eventos.data ?? []).forEach((e) => {
      const rat = rateiosPorCentro.get(e.external_id) ?? [];
      if (rat.length === 0) { cache.set(e.external_id, {}); return; }
      const { pagarRows, receberRows } = montarLinhasPorCentro(rat, pParents, rParents, e.external_id);
      const { totais } = calcularDRECaixa(
        pagarRows, receberRows, planoMap, 0, 0, dreEstrutura, e.external_id, undefined, "caixa",
      );
      cache.set(e.external_id, totais);
    });
    return cache;
  }, [loading, eventos.data, rateiosPorCentro, pagarParents.data, receberParents.data, planoMap, dreEstrutura]);


  const gruposCategoria = useMemo(() => {
    const evs = eventos.data ?? [];
    const map = new Map<CategoriaCentroCusto | "sc", EventoCC[]>();
    evs.forEach((e) => {
      const key = (e.categoria ?? "sc") as CategoriaCentroCusto | "sc";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [eventos.data]);

  const totaisDe = (id: string) => totaisPorEvento.get(id) ?? {};
  const temMovimento = (id: string) =>
    Object.values(totaisDe(id)).some((v) => Math.abs(v ?? 0) > 0.005);

  const somarTotais = (evs: EventoCC[]) => {
    const acc: Partial<Record<DreGroupId, number>> = {};
    evs.forEach((e) => {
      const t = totaisDe(e.external_id);
      idsCard.forEach((k) => { acc[k] = (acc[k] ?? 0) + (t[k] ?? 0); });
      acc.RB = (acc.RB ?? 0) + (t.RB ?? 0);
      acc.RN = (acc.RN ?? 0) + (t.RN ?? 0);
      acc.LU = (acc.LU ?? 0) + (t.LU ?? 0);
    });
    return acc;
  };




  

  const renderCard = (e: EventoCC) => {
    const totais = totaisDe(e.external_id);
    return (
      <Card key={e.id} className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="font-semibold text-sm leading-tight">{e.nome}</div>
          {!e.ativo && <Badge variant="destructive" className="shrink-0">Removido</Badge>}
        </div>
        <div className="space-y-1 text-sm">
          {linhasCard.map((line) => {
            const k = line.id as DreGroupId;
            const v = totais[k] ?? 0;
            const isLucro = k === "LU";
            const base = totais.RB ?? 0;
            const pct = base !== 0 ? (v / base) * 100 : null;
            const pctStr = pct === null ? "—" : `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
            return (
              <div
                key={k}
                className={`flex items-baseline justify-between gap-2 py-0.5 ${isLucro ? "mt-1 border-t pt-1 font-bold" : "border-b border-dashed last:border-0"}`}
              >
                <span className={`text-xs ${isLucro ? "text-foreground" : "text-muted-foreground"}`}>{line.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className={`tabular-nums text-[10px] ${isLucro ? "text-muted-foreground font-semibold" : "text-muted-foreground"}`}>{pctStr}</span>
                  <span className={`tabular-nums text-xs ${v < 0 ? "text-red-600" : ""} ${isLucro ? "font-bold" : ""}`}>{brl(v)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  const renderSecao = (key: string, titulo: React.ReactNode, evsAll: EventoCC[], extraHeader?: React.ReactNode) => {
    const total = evsAll.length;
    if (total === 0) return null;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(pagPorCat[key] ?? 1, pageCount);
    const start = (page - 1) * PAGE_SIZE;
    const visiveis = evsAll.slice(start, start + PAGE_SIZE);
    const setPage = (p: number) => setPagPorCat((s) => ({ ...s, [key]: Math.min(pageCount, Math.max(1, p)) }));
    return (
      <div key={key} className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2 gap-3 flex-wrap">
          <h2 className="text-lg font-bold">{titulo}</h2>
          {extraHeader}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visiveis.map(renderCard)}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">{total} eventos</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {pageCount}</span>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={categoriaFiltro} onValueChange={(v) => setCategoriaFiltro(v as CategoriaCentroCusto)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS_CENTRO_CUSTO.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          {(() => {
            const cat = categoriaFiltro;
            const evs = (gruposCategoria.get(cat) ?? []).filter((e) => e.ativo || temMovimento(e.external_id));
            if (evs.length === 0) {
              return (
                <div className="text-sm text-muted-foreground text-center py-10 border rounded-lg bg-muted/30">
                  Nenhum evento com movimento financeiro nesta categoria.
                </div>
              );
            }
            const totalCat = somarTotais(evs);
            return renderSecao(
              cat,
              CATEGORIA_LABEL[cat],
              evs,
              <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                {(() => {
                  const rb = totalCat.RB ?? 0;
                  const rn = totalCat.RN ?? 0;
                  const lu = totalCat.LU ?? 0;
                  const pct = (v: number) => rb !== 0 ? ` (${((v / rb) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)` : "";
                  return (
                    <>
                      <span>Receita: <span className="text-foreground font-medium">{brl(rb)}</span></span>
                      <span>Resultado: <span className={`font-medium ${rn < 0 ? "text-red-600" : "text-foreground"}`}>{brl(rn)}{pct(rn)}</span></span>
                      <span>Lucro: <span className={`font-medium ${lu < 0 ? "text-red-600" : "text-foreground"}`}>{brl(lu)}{pct(lu)}</span></span>
                    </>
                  );
                })()}
              </div>,
            );
          })()}
        </>
      )}


    </div>
  );
}

