import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection } from "@/components/FormSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { QuantidadeInput } from "@/components/QuantidadeInput";
import { CheckCircle2, X, Link2Off, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { saidaTipoLabels } from "@/lib/labels";
import { EMPRESAS } from "@/lib/empresas";
import { toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { ensureValidSession, describeSupabaseError } from "@/lib/supabase-guard";
import { matchTokens } from "@/lib/utils";

export const Route = createFileRoute("/estoque/solicitacoes-saida")({
  head: () => ({
    meta: [
      { title: "Solicitações de saída — Estoque Luminart" },
      { name: "description", content: "Valide as retiradas de material solicitadas pelo formulário público." },
      { property: "og:title", content: "Solicitações de saída — Estoque Luminart" },
      { property: "og:description", content: "Validação de retiradas de material do estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SolicitacoesSaidaPage,
});

const statusLabels: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-warning/15 text-warning border border-warning/30" },
  validada: { label: "Validada", className: "bg-success/15 text-success border border-success/30" },
  recusada: { label: "Recusada", className: "bg-destructive/15 text-destructive border border-destructive/30" },
};

function StatusPill({ status }: { status: string }) {
  const s = statusLabels[status] ?? statusLabels["pendente"]!;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}>{s.label}</span>;
}

function SolicitacoesSaidaPage() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth();
  const isAdmin = isModuleAdmin("estoque");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [aberta, setAberta] = useState<any | null>(null);

  const { data: solicitacoes, isLoading } = useQuery({
    queryKey: ["solicitacoes-saida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_solicitacoes_saida" as any)
        .select("*, itens:estoque_solicitacoes_saida_itens(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 15_000,
  });

  const { data: itens } = useQuery({
    queryKey: ["itens-select-saida"],
    queryFn: async () =>
      (
        await supabase
          .from("itens")
          .select("id,codigo,nome,unidade,quantidade_atual")
          .order("nome")
      ).data ?? [],
    staleTime: 30_000,
  });

  const { data: solicitantes } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () =>
      (await supabase.from("solicitantes").select("*").eq("status", "ativo").order("nome")).data ?? [],
    staleTime: 60_000,
  });

  const lista = useMemo(() => {
    let arr = (solicitacoes ?? []) as any[];
    if (statusFilter !== "todos") arr = arr.filter((s) => s.status === statusFilter);
    if (q.trim()) {
      arr = arr.filter((s) =>
        matchTokens(
          [
            s.numero,
            s.solicitante_nome,
            s.evento_projeto,
            s.finalidade_livre,
            s.observacoes,
            ...(s.itens ?? []).map((i: any) => i.descricao),
          ].join(" "),
          q,
        ),
      );
    }
    return arr;
  }, [solicitacoes, statusFilter, q]);

  const recusarMut = useMutation({
    mutationFn: async (p: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from("estoque_solicitacoes_saida" as any)
        .update({ status: "recusada", motivo_recusa: p.motivo })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacoes-saida"] });
      toast.success("Solicitação recusada");
      setAberta(null);
    },
    onError: (e: any) => toast.error(describeSupabaseError(e)),
  });

  const validarMut = useMutation({
    mutationFn: async (p: {
      solicitacao: any;
      meta: any;
      linhas: Array<{ item_id: string; quantidade: number }>;
    }) => {
      await ensureValidSession();
      const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
      for (const l of p.linhas) {
        const it = (itens ?? []).find((x: any) => x.id === l.item_id);
        if (!it) throw new Error("Item inválido");
        if (round2(l.quantidade) > round2(it.quantidade_atual)) {
          throw new Error(`Estoque insuficiente para ${it.nome}. Disponível: ${round2(it.quantidade_atual)} ${it.unidade}`);
        }
      }
      const { data: numData, error: numErr } = await supabase.rpc("next_requisicao_numero" as any);
      if (numErr) throw numErr;
      const requisicao_numero = numData as number;
      const inserts = p.linhas.map((l) => ({
        ...p.meta,
        tipo: "saida" as const,
        item_id: l.item_id,
        quantidade: l.quantidade,
        requisicao_numero,
      }));
      const { data: inseridos, error } = await supabase.from("movimentacoes").insert(inserts).select("id");
      if (error) throw error;
      if (!inseridos || inseridos.length !== inserts.length) {
        throw new Error("O lançamento não foi confirmado pelo banco.");
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error: upErr } = await supabase
        .from("estoque_solicitacoes_saida" as any)
        .update({
          status: "validada",
          validado_por: userData?.user?.id ?? null,
          validado_em: new Date().toISOString(),
          requisicao_numero,
        })
        .eq("id", p.solicitacao.id);
      if (upErr) throw upErr;
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["solicitacoes-saida"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      toast.success("Saída validada e lançada no estoque");
      setAberta(null);
    },
    onError: (e: any) => toast.error(describeSupabaseError(e)),
  });

  const linkPublico = typeof window !== "undefined" ? `${window.location.origin}/solicitar-saida` : "/solicitar-saida";

  return (
    <>
      <PageHeader
        title="Solicitações de saída"
        description="Retiradas de material enviadas pelo formulário público, aguardando validação"
        actions={
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(linkPublico);
              toast.success("Link do formulário copiado");
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Copiar link do formulário
          </Button>
        }
      />

      <Card className="p-3 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nº, solicitante, material, evento…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="validada">Validadas</SelectItem>
            <SelectItem value="recusada">Recusadas</SelectItem>
            <SelectItem value="todos">Todas</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nº</th>
                <th className="px-4 py-3 text-left font-medium">Data retirada</th>
                <th className="px-4 py-3 text-left font-medium">Solicitante</th>
                <th className="px-4 py-3 text-left font-medium">Materiais</th>
                <th className="px-4 py-3 text-left font-medium">Evento / Finalidade</th>
                <th className="px-4 py-3 text-left font-medium">Situação</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : lista.length ? (
                lista.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setAberta(s)}>
                    <td className="px-4 py-3 font-mono text-xs">SOL-{String(s.numero ?? 0).padStart(4, "0")}</td>
                    <td className="px-4 py-3">{s.data_retirada?.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3">{s.solicitante_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(s.itens ?? []).map((i: any) => `${i.descricao} (${Number(i.quantidade)})`).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">{s.is_evento ? (s.evento_projeto ?? "—") : (s.finalidade_livre ?? "—")}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={s.status === "pendente" ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAberta(s);
                        }}
                      >
                        {s.status === "pendente" ? "Validar saída" : "Visualizar"}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma solicitação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!aberta} onOpenChange={(v) => !v && setAberta(null)}>
        <DialogContent className="max-w-[min(1300px,98vw)] w-[98vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Solicitação SOL-{String(aberta?.numero ?? 0).padStart(4, "0")}
            </DialogTitle>
          </DialogHeader>
          {aberta && (
            <ValidacaoForm
              key={aberta.id}
              solicitacao={aberta}
              itens={itens ?? []}
              solicitantes={solicitantes ?? []}
              readOnly={aberta.status !== "pendente"}
              podeRecusar={isAdmin || aberta.status === "pendente"}
              submitting={validarMut.isPending || recusarMut.isPending}
              onValidar={(meta, linhas) => validarMut.mutate({ solicitacao: aberta, meta, linhas })}
              onRecusar={(motivo) => recusarMut.mutate({ id: aberta.id, motivo })}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type LinhaValidacao = { id: string; descricao: string; item_id: string; quantidade: string };

function ValidacaoForm({
  solicitacao,
  itens,
  solicitantes,
  readOnly,
  podeRecusar,
  submitting,
  onValidar,
  onRecusar,
}: {
  solicitacao: any;
  itens: any[];
  solicitantes: any[];
  readOnly: boolean;
  podeRecusar: boolean;
  submitting: boolean;
  onValidar: (meta: any, linhas: Array<{ item_id: string; quantidade: number }>) => void;
  onRecusar: (motivo: string) => void;
}) {
  const [meta, setMeta] = useState({
    data_movimento: toBRTInputDateTime(
      solicitacao.data_retirada ? new Date(`${solicitacao.data_retirada}T12:00:00`) : undefined,
    ),
    saida_tipo: solicitacao.is_evento ? "evento" : "consumo",
    empresa: "",
    solicitante_id: solicitacao.solicitante_id ?? "",
    evento_projeto: solicitacao.evento_projeto ?? "",
    finalidade: solicitacao.finalidade_livre ?? "",
    sera_devolvido: solicitacao.is_evento ? "sim" : "nao",
    data_prevista_devolucao: "",
    observacoes: solicitacao.observacoes ?? "",
  });
  const [linhas, setLinhas] = useState<LinhaValidacao[]>(() =>
    (solicitacao.itens ?? []).map((i: any) => ({
      id: i.id,
      descricao: i.descricao,
      item_id: i.item_id ?? "",
      quantidade: String(Number(i.quantidade) || 0),
    })),
  );
  const [motivo, setMotivo] = useState("");

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));
  const setL = (i: number, patch: Partial<LinhaValidacao>) =>
    setLinhas((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const isEvento = meta.saida_tipo === "evento";
  const todosAssociados = linhas.length > 0 && linhas.every((l) => l.item_id && Number(l.quantidade) > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!todosAssociados) return toast.error("Associe todos os materiais a um item do estoque");
    if (isEvento && !meta.evento_projeto) return toast.error("Evento/Projeto é obrigatório");
    if (!meta.empresa) return toast.error("Empresa é obrigatória");
    if (meta.sera_devolvido === "sim" && !meta.data_prevista_devolucao) {
      return toast.error("Informe a data prevista de devolução");
    }
    onValidar(
      {
        data_movimento: fromBRTInputDateTime(meta.data_movimento),
        saida_tipo: meta.saida_tipo,
        empresa: meta.empresa || null,
        solicitante_id: meta.solicitante_id || null,
        evento_projeto: isEvento ? meta.evento_projeto : null,
        finalidade: meta.finalidade || null,
        data_prevista_devolucao: meta.sera_devolvido === "sim" ? meta.data_prevista_devolucao || null : null,
        saida_status: meta.sera_devolvido === "sim" ? "aberta" : "finalizada",
        observacoes: meta.observacoes || null,
      },
      linhas.map((l) => ({ item_id: l.item_id, quantidade: Number(l.quantidade) })),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="p-4 grid gap-3 sm:grid-cols-4 text-sm bg-muted/30">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Data de retirada</p>
          <p>{solicitacao.data_retirada?.split("-").reverse().join("/")}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Solicitante</p>
          <p>{solicitacao.solicitante_nome ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">É para evento?</p>
          <p>{solicitacao.is_evento ? "Sim" : "Não"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {solicitacao.is_evento ? "Evento / Projeto" : "Finalidade"}
          </p>
          <p>{solicitacao.is_evento ? (solicitacao.evento_projeto ?? "—") : (solicitacao.finalidade_livre ?? "—")}</p>
        </div>
        {solicitacao.observacoes && (
          <div className="sm:col-span-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Observações do solicitante</p>
            <p className="whitespace-pre-wrap">{solicitacao.observacoes}</p>
          </div>
        )}
        {solicitacao.status === "recusada" && (
          <div className="sm:col-span-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Motivo da recusa</p>
            <p>{solicitacao.motivo_recusa ?? "—"}</p>
          </div>
        )}
        {solicitacao.status === "validada" && (
          <div className="sm:col-span-4 text-muted-foreground">
            Saída lançada
            {solicitacao.requisicao_numero != null
              ? ` na requisição REQ-${String(solicitacao.requisicao_numero).padStart(4, "0")}`
              : ""}
            .
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Materiais informados</h3>
        <Card className="p-3 space-y-3">
          {linhas.map((l, i) => {
            const it = itens.find((x: any) => x.id === l.item_id);
            return (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</label>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{l.descricao}</div>
                </div>
                <div className="col-span-5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Item do estoque*
                  </label>
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                      <ItemSearchSelect
                        itens={itens}
                        value={l.item_id}
                        onChange={(v: string) => setL(i, { item_id: v })}
                        showStock
                        disabled={readOnly}
                      />
                    </div>
                    {!readOnly && l.item_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Desassociar item"
                        onClick={() => setL(i, { item_id: "" })}
                      >
                        <Link2Off className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 min-h-[14px]">
                    {it ? `Disponível: ${Number(it.quantidade_atual)} ${it.unidade}` : "Não associado"}
                  </p>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantidade</label>
                  <QuantidadeInput
                    value={Number(l.quantidade) || 0}
                    onChange={(n) => setL(i, { quantidade: String(n) })}
                    disabled={readOnly}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Dados da saída</h3>
        <FormSection>
          <FormField label="Data*">
            <Input
              required
              type="datetime-local"
              disabled={readOnly}
              value={meta.data_movimento}
              onChange={(e) => setM("data_movimento", e.target.value)}
            />
          </FormField>
          <FormField label="Tipo*">
            <Select value={meta.saida_tipo} onValueChange={(v) => setM("saida_tipo", v)} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(saidaTipoLabels).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Empresa*">
            <Select value={meta.empresa} onValueChange={(v) => setM("empresa", v)} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {EMPRESAS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {isEvento && (
            <FormField label="Evento / Projeto*" wide>
              <EventoSheetCombobox
                value={meta.evento_projeto}
                onChange={(v: string | null) => setM("evento_projeto", v ?? "")}
              />
            </FormField>
          )}
          <FormField label="Solicitante">
            <EntitySearchSelect
              options={solicitantes}
              value={meta.solicitante_id}
              onChange={(v: string) => setM("solicitante_id", v)}
              placeholder="—"
              searchPlaceholder="Buscar por nome ou apelido…"
            />
          </FormField>
          <FormField label="Será devolvido?*">
            <Select
              value={meta.sera_devolvido}
              onValueChange={(v) => {
                setM("sera_devolvido", v);
                if (v === "nao") setM("data_prevista_devolucao", "");
              }}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {meta.sera_devolvido === "sim" && (
            <FormField label="Data prevista de devolução*">
              <Input
                type="date"
                disabled={readOnly}
                value={meta.data_prevista_devolucao}
                onChange={(e) => setM("data_prevista_devolucao", e.target.value)}
              />
            </FormField>
          )}
          <FormField label="Finalidade / detalhes" wide>
            <Input disabled={readOnly} value={meta.finalidade} onChange={(e) => setM("finalidade", e.target.value)} />
          </FormField>
          <FormField label="Observações" wide>
            <Textarea
              rows={2}
              disabled={readOnly}
              value={meta.observacoes}
              onChange={(e) => setM("observacoes", e.target.value)}
            />
          </FormField>
        </FormSection>
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
          {podeRecusar && (
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Motivo da recusa</label>
                <Input
                  className="sm:w-72"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => {
                  if (!confirm("Recusar esta solicitação?")) return;
                  onRecusar(motivo.trim());
                }}
              >
                <X className="h-4 w-4 mr-1" /> Recusar
              </Button>
            </div>
          )}
          <Button type="submit" size="lg" disabled={submitting || !todosAssociados}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {submitting ? "Validando…" : "Validar saída"}
          </Button>
        </div>
      )}
    </form>
  );
}
