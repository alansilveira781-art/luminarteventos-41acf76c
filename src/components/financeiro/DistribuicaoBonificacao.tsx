import { Fragment, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, History, Loader2, Lock, Plus, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProdutores,
  useAlcadas,
  useBonificacoes,
  useBonificacaoEventoMutations,
  useEventosRealizados,
  useFechamentoMes,
  useFechamentos,
  useFechamentoItens,
  useFecharMes,
  sugerirComplexidade,
  multiplicadorDaCategoria,
  type FechamentoItemRow,
} from "@/lib/comercial/bonificacao";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmtBRL = (v: number) =>
  v === 0 ? "R$ -" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type EventoBonif = {
  eventoId: string;
  nomeEvento: string;
  dataEvento: string | null;
  categoria: string;
  origemVenda: "vinculada" | "nome" | null;
  valorFinal: number;
  ano: number | null;
  mes: string | null;
};

type LinhaAtribuicao = {
  key: string;
  eventoId: string;
  produtorId: string | null;
  complexidade: number;
  bonifId?: string;
  dirty?: boolean;
};

export function DistribuicaoBonificacao() {
  const { user, isAdmin, modulos } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro_op" && m.is_admin);

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number | "Todos">(anoAtual);
  const [mes, setMes] = useState<string>(MESES[new Date().getMonth()]);

  const anosDisponiveis = useMemo(
    () => Array.from({ length: 6 }, (_, i) => anoAtual - i),
    [anoAtual],
  );

  const { data: produtoresData } = useProdutores(true);
  const { data: alcadasData } = useAlcadas();
  const { data: bonifData } = useBonificacoes(ano, mes);
  const { data: eventosData, isLoading, error } = useEventosRealizados(ano, mes);
  const { upsert, remove } = useBonificacaoEventoMutations();

  const { data: fechamentoMes } = useFechamentoMes(ano, mes);
  const fecharMes = useFecharMes();
  const isClosed = !!fechamentoMes;

  const [historicoOpen, setHistoricoOpen] = useState(false);

  const produtores = useMemo(() => produtoresData ?? [], [produtoresData]);
  const alcadas = useMemo(() => alcadasData ?? [], [alcadasData]);
  const bonifRows = useMemo(() => bonifData ?? [], [bonifData]);

  const eventos = useMemo<EventoBonif[]>(
    () =>
      (eventosData ?? []).map((e) => ({
        eventoId: e.id,
        nomeEvento: e.nome,
        dataEvento: e.dataFim,
        categoria: e.categoria || e.tipo || "",
        origemVenda: e.origemVenda,
        valorFinal: e.valorFinal,
        ano: e.ano,
        mes: e.mes,
      })),
    [eventosData],
  );

  const [linhasPorEvento, setLinhasPorEvento] = useState<Record<string, LinhaAtribuicao[]>>({});

  const bonifKey = useMemo(
    () => bonifRows.map((b) => `${b.id}:${b.evento_id}:${b.produtor_id}:${b.complexidade}`).join("|"),
    [bonifRows],
  );
  const eventosKey = useMemo(
    () => eventos.map((e) => `${e.eventoId}:${e.categoria}:${e.valorFinal}`).join("|"),
    [eventos],
  );
  const alcadasKey = useMemo(
    () => alcadas.map((a) => `${a.categoria}:${a.nivel}:${a.valor_ate}:${a.multiplicador}`).join("|"),
    [alcadas],
  );

  useEffect(() => {
    if (alcadas.length === 0) return;
    setLinhasPorEvento((prev) => {
      const next: Record<string, LinhaAtribuicao[]> = { ...prev };

      const salvasPorEvento = new Map<string, LinhaAtribuicao[]>();
      for (const b of bonifRows) {
        const eid = b.evento_id;
        if (!eid) continue;
        const arr = salvasPorEvento.get(eid) ?? [];
        arr.push({
          key: b.id,
          eventoId: eid,
          produtorId: b.produtor_id,
          complexidade: b.complexidade ?? 1,
          bonifId: b.id,
        });
        salvasPorEvento.set(eid, arr);
      }

      for (const [eid, linhasSalvas] of salvasPorEvento) {
        const atual = next[eid] ?? [];
        if (!atual.some((l) => l.bonifId)) next[eid] = linhasSalvas;
      }

      for (const e of eventos) {
        const existentes = next[e.eventoId];
        if (!existentes || existentes.length === 0) {
          next[e.eventoId] = [{
            key: `new-${e.eventoId}`,
            eventoId: e.eventoId,
            produtorId: null,
            complexidade: sugerirComplexidade(alcadas, e.categoria, e.valorFinal),
          }];
        } else {
          next[e.eventoId] = existentes.map((l) =>
            !l.produtorId && !l.bonifId && !l.dirty
              ? { ...l, complexidade: sugerirComplexidade(alcadas, e.categoria, e.valorFinal) }
              : l,
          );
        }
      }

      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonifKey, eventosKey, alcadasKey]);

  const valorBonificacao = (e: EventoBonif, complexidade: number) =>
    complexidade * multiplicadorDaCategoria(alcadas, e.categoria);

  const addLinha = (e: EventoBonif) => {
    setLinhasPorEvento((prev) => ({
      ...prev,
      [e.eventoId]: [
        ...(prev[e.eventoId] ?? []),
        {
          key: `new-${e.eventoId}-${Date.now()}`,
          eventoId: e.eventoId,
          produtorId: null,
          complexidade: sugerirComplexidade(alcadas, e.categoria, e.valorFinal),
        },
      ],
    }));
  };

  const updateLinha = (e: EventoBonif, key: string, patch: Partial<LinhaAtribuicao>) => {
    setLinhasPorEvento((prev) => ({
      ...prev,
      [e.eventoId]: (prev[e.eventoId] ?? []).map((l) => (l.key === key ? { ...l, ...patch, dirty: true } : l)),
    }));
  };

  const removeLinha = async (e: EventoBonif, l: LinhaAtribuicao) => {
    if (l.bonifId) {
      try {
        await remove.mutateAsync(l.bonifId);
        toast.success("Removido");
      } catch (err: any) {
        toast.error(err?.message || "Falha ao remover");
        return;
      }
    }
    setLinhasPorEvento((prev) => ({
      ...prev,
      [e.eventoId]: (prev[e.eventoId] ?? []).filter((x) => x.key !== l.key),
    }));
  };

  const salvarLinha = async (e: EventoBonif, l: LinhaAtribuicao) => {
    if (!l.produtorId) {
      toast.error("Selecione o produtor");
      return;
    }
    const produtor = produtores.find((p) => p.id === l.produtorId);
    try {
      await upsert.mutateAsync({
        id: l.bonifId,
        venda_id: null,
        evento_id: e.eventoId,
        nome_evento: e.nomeEvento,
        data_evento: e.dataEvento,
        categoria: e.categoria,
        produtor_id: l.produtorId,
        produtor_nome: produtor?.nome ?? null,
        complexidade: l.complexidade,
        valor_final: valorBonificacao(e, l.complexidade),
        ano: e.ano,
        mes: e.mes,
      });
      toast.success("Salvo");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar");
    }
  };

  const porProdutor = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    for (const e of eventos) {
      for (const l of linhasPorEvento[e.eventoId] ?? []) {
        if (!l.produtorId) continue;
        const nome = produtores.find((p) => p.id === l.produtorId)?.nome || "?";
        const prev = map.get(l.produtorId) ?? { nome, total: 0 };
        prev.total += valorBonificacao(e, l.complexidade);
        map.set(l.produtorId, prev);
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, linhasPorEvento, produtores, alcadas]);

  const totalGeralMes = useMemo(
    () => porProdutor.reduce((s, p) => s + p.total, 0),
    [porProdutor],
  );

  const handleFechar = async () => {
    if (ano === "Todos" || !mes || mes === "Todos") {
      toast.error("Selecione um Ano e Mês específicos para fechar.");
      return;
    }
    if (isClosed) {
      toast.error("Este mês já foi fechado e não pode ser salvo novamente.");
      return;
    }
    if (!isFinAdmin) {
      toast.error("Apenas administradores do Financeiro podem fechar o mês.");
      return;
    }
    const semProdutor = eventos.filter(
      (e) => !(linhasPorEvento[e.eventoId] ?? []).some((l) => !!l.produtorId),
    );
    if (semProdutor.length) {
      toast.error(
        `Existem ${semProdutor.length} evento(s) sem produtor: ${semProdutor
          .slice(0, 3).map((e) => e.nomeEvento).join(", ")}${semProdutor.length > 3 ? "…" : ""}`,
      );
      return;
    }
    if (!eventos.length) {
      toast.error("Não há eventos realizados no período para fechar.");
      return;
    }

    const itens: Array<Omit<FechamentoItemRow, "id" | "fechamento_id">> = [];
    for (const e of eventos) {
      for (const l of linhasPorEvento[e.eventoId] ?? []) {
        if (!l.produtorId) continue;
        const produtor = produtores.find((p) => p.id === l.produtorId);
        itens.push({
          venda_id: null,
          evento_id: e.eventoId,
          nome_evento: e.nomeEvento,
          data_evento: e.dataEvento,
          categoria: e.categoria,
          produtor_id: l.produtorId,
          produtor_nome: produtor?.nome ?? null,
          complexidade: l.complexidade,
          valor_final: valorBonificacao(e, l.complexidade),
        });
      }
    }

    try {
      await fecharMes.mutateAsync({
        ano: ano as number,
        mes,
        total_geral: totalGeralMes,
        fechado_por: user?.id ?? null,
        fechado_por_nome:
          (user?.user_metadata as any)?.full_name ||
          (user?.user_metadata as any)?.name ||
          user?.email ||
          null,
        itens,
      });
      toast.success("Mês fechado com sucesso");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao fechar o mês");
    }
  };

  return (
    <div className="print-area space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Distribuição Bonificação</h1>
        <p className="text-muted-foreground">
          {ano === "Todos" ? "Todos os anos" : ano} · {mes === "Todos" ? "Todos os meses" : mes}
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-[160px_200px_1fr] sm:items-end">
          <div className="space-y-1">
            <Label>Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(v === "Todos" ? "Todos" : Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setHistoricoOpen(true)}>
              <History className="h-4 w-4" /> Ver períodos anteriores
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            {isFinAdmin && (
              <Button
                size="sm"
                className="gap-2"
                onClick={handleFechar}
                disabled={isClosed || fecharMes.isPending || ano === "Todos" || mes === "Todos"}
                title={isClosed ? "Mês já fechado" : "Fechar e salvar o mês"}
              >
                <Save className="h-4 w-4" /> {isClosed ? "Mês fechado" : "Salvar"}
              </Button>
            )}
          </div>
        </div>
        {isClosed && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
            <Lock className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Este mês foi fechado em{" "}
              {new Date(fechamentoMes!.fechado_em).toLocaleString("pt-BR")} por{" "}
              <strong>{fechamentoMes!.fechado_por_nome || "—"}</strong>. Valores estão em modo somente leitura.
            </span>
          </div>
        )}
      </Card>

      {isLoading && (
        <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos realizados…
        </Card>
      )}
      {error && (
        <Card className="p-6 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>Não foi possível carregar os dados. {(error as Error).message}</span>
        </Card>
      )}

      {!isLoading && !error && isClosed && (
        <FechamentoReadonlyBody fechamentoId={fechamentoMes!.id} />
      )}

      {!isLoading && !error && !isClosed && (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Nome do evento</th>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-left px-3 py-2">Produtor</th>
                    <th className="text-left px-3 py-2 w-28">Complexidade</th>
                    <th className="text-right px-3 py-2">Valor Final</th>
                    <th className="text-right px-3 py-2 print:hidden">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhum evento realizado no período.
                      </td>
                    </tr>
                  )}
                  {eventos.map((e) => {
                    const linhas = linhasPorEvento[e.eventoId] ?? [];
                    return (
                      <Fragment key={e.eventoId}>
                        {linhas.map((l, idx) => (
                          <tr key={l.key} className="border-t border-border/50 align-top">
                            {idx === 0 ? (
                              <>
                                <td className="px-3 py-2" rowSpan={linhas.length}>
                                  <span>{e.nomeEvento}</span>
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {e.origemVenda === "vinculada"
                                      ? "venda vinculada"
                                      : e.origemVenda === "nome"
                                        ? "casado por nome"
                                        : "sem venda"}
                                  </span>
                                </td>
                                <td className="px-3 py-2" rowSpan={linhas.length}>
                                  {e.dataEvento ? new Date(e.dataEvento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="px-3 py-2" rowSpan={linhas.length}>{e.categoria || "—"}</td>
                              </>
                            ) : null}
                            <td className="px-3 py-2">
                              <Select
                                value={l.produtorId ?? ""}
                                onValueChange={(v) => updateLinha(e, l.key, { produtorId: v })}
                              >
                                <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Selecionar produtor" /></SelectTrigger>
                                <SelectContent>
                                  {produtores.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={1}
                                max={6}
                                className="h-8 w-20"
                                value={l.complexidade}
                                onChange={(ev) => {
                                  const n = Math.max(1, Math.min(6, Number(ev.target.value) || 1));
                                  updateLinha(e, l.key, { complexidade: n });
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtBRL(valorBonificacao(e, l.complexidade))}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap print:hidden">
                              <Button size="sm" variant="outline" onClick={() => salvarLinha(e, l)} disabled={upsert.isPending}>
                                Salvar
                              </Button>
                              {idx === linhas.length - 1 && (
                                <Button size="sm" variant="ghost" className="ml-1" onClick={() => addLinha(e)} title="Adicionar produtor">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                              {linhas.length > 1 || l.bonifId ? (
                                <Button size="sm" variant="ghost" className="ml-1 text-destructive" onClick={() => removeLinha(e, l)} title="Remover">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Valor a pagar por produtor</h3>
            {porProdutor.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produtor atribuído no período.</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {porProdutor.map((p) => (
                  <span key={p.nome} className="tabular-nums">
                    <strong>{p.nome}</strong> — {fmtBRL(p.total)}
                  </span>
                ))}
                <span className="ml-auto tabular-nums text-muted-foreground">
                  Total: <strong>{fmtBRL(totalGeralMes)}</strong>
                </span>
              </div>
            )}
          </Card>
        </>
      )}

      <HistoricoFechamentosDialog open={historicoOpen} onOpenChange={setHistoricoOpen} />
    </div>
  );
}

/* -------------------- Visão somente leitura do mês fechado -------------------- */

function FechamentoReadonlyBody({ fechamentoId }: { fechamentoId: string }) {
  const { data, isLoading } = useFechamentoItens(fechamentoId);
  const itens = data ?? [];

  const porEvento = useMemo(() => {
    const map = new Map<string, FechamentoItemRow[]>();
    for (const i of itens) {
      const key = (i as any).evento_id || i.venda_id || i.nome_evento || i.id;
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    }
    return [...map.entries()].map(([k, arr]) => ({ key: k, itens: arr }));
  }, [itens]);

  const porProdutor = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    for (const i of itens) {
      const nome = i.produtor_nome || "?";
      const key = i.produtor_id || nome;
      const prev = map.get(key) ?? { nome, total: 0 };
      prev.total += Number(i.valor_final || 0);
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [itens]);

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando fechamento…
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome do evento</th>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-left px-3 py-2">Produtor</th>
                <th className="text-left px-3 py-2 w-28">Complexidade</th>
                <th className="text-right px-3 py-2">Valor Final</th>
              </tr>
            </thead>
            <tbody>
              {porEvento.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum item no fechamento.
                  </td>
                </tr>
              )}
              {porEvento.map((grp) => (
                <Fragment key={grp.key}>
                  {grp.itens.map((i, idx) => (
                    <tr key={i.id} className="border-t border-border/50 align-top">
                      {idx === 0 ? (
                        <>
                          <td className="px-3 py-2" rowSpan={grp.itens.length}>{i.nome_evento || "-"}</td>
                          <td className="px-3 py-2" rowSpan={grp.itens.length}>
                            {i.data_evento ? new Date(i.data_evento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                          </td>
                          <td className="px-3 py-2" rowSpan={grp.itens.length}>{i.categoria || "—"}</td>
                        </>
                      ) : null}
                      <td className="px-3 py-2">{i.produtor_nome || "—"}</td>
                      <td className="px-3 py-2">{i.complexidade ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(Number(i.valor_final || 0))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Valor a pagar por produtor</h3>
        {porProdutor.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produtor no fechamento.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {porProdutor.map((p) => (
              <span key={p.nome} className="tabular-nums">
                <strong>{p.nome}</strong> — {fmtBRL(p.total)}
              </span>
            ))}
            <span className="ml-auto tabular-nums text-muted-foreground">
              Total: <strong>{fmtBRL(porProdutor.reduce((s, p) => s + p.total, 0))}</strong>
            </span>
          </div>
        )}
      </Card>
    </>
  );
}

/* -------------------- Dialog: períodos anteriores -------------------- */

function HistoricoFechamentosDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, isLoading } = useFechamentos();
  const fechamentos = data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = fechamentos.find((f) => f.id === selectedId) || null;

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Períodos anteriores — Bonificação</DialogTitle>
          <DialogDescription>
            Fechamentos mensais salvos. Selecione um período para consultar em modo somente leitura.
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : fechamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum fechamento salvo ainda.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Ano</th>
                      <th className="text-left px-3 py-2">Mês</th>
                      <th className="text-left px-3 py-2">Fechado em</th>
                      <th className="text-left px-3 py-2">Por</th>
                      <th className="text-right px-3 py-2">Total geral</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechamentos.map((f) => (
                      <tr key={f.id} className="border-t border-border/50">
                        <td className="px-3 py-2">{f.ano}</td>
                        <td className="px-3 py-2 capitalize">{f.mes}</td>
                        <td className="px-3 py-2">{new Date(f.fechado_em).toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2">{f.fechado_por_nome || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(Number(f.total_geral || 0))}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedId(f.id)}>
                            Consultar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="print-area space-y-4">
            <style>{`
              @media print {
                body * { visibility: hidden; }
                .print-area, .print-area * { visibility: visible !important; }
                .print-area { position: absolute; inset: 0; padding: 0; }
                .print\\:hidden { display: none !important; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            `}</style>
            <div className="flex items-center justify-between gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>
                ← Voltar
              </Button>
              <div className="text-sm text-muted-foreground">
                <strong>{selected.ano}</strong> · <span className="capitalize">{selected.mes}</span> · Fechado em{" "}
                {new Date(selected.fechado_em).toLocaleString("pt-BR")} por{" "}
                <strong>{selected.fechado_por_nome || "—"}</strong>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
            <div className="hidden print:block mb-4">
              <h1 className="text-2xl font-bold">Distribuição Bonificação — {selected.ano} / {selected.mes}</h1>
              <p className="text-muted-foreground">
                Fechado em {new Date(selected.fechado_em).toLocaleString("pt-BR")} por{" "}
                {selected.fechado_por_nome || "—"}
              </p>
            </div>
            <FechamentoReadonlyBody fechamentoId={selected.id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
