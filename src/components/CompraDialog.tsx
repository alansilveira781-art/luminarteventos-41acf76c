import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FormField, FormSection } from "@/components/FormSection";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { SelectCreatable } from "@/components/SelectCreatable";
import { MentionInput, renderCommentText } from "@/components/MentionInput";
import { Plus, Trash2, Upload, Download, FileIcon, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { AnexoViewer, baixarAnexo } from "@/components/AnexoViewer";
import { MoneyInput } from "@/components/MoneyInput";
import { toast } from "sonner";
import { ensureValidSession, describeSupabaseError } from "@/lib/supabase-guard";
import { COMPRA_STATUSES, TIPO_COMPRA_OPTIONS, canMoveCompra, canEditCompra, canDeleteCompra, moveBlockedMessage, nextCompraStatus, type CompraStatus } from "@/lib/compras";
import { EMPRESAS } from "@/lib/empresas";
import { useAuth } from "@/contexts/AuthContext";
import { notifyResponsiblesForStatus, notifyMentions } from "@/lib/notify";
import { CopiarLinkButton } from "@/components/CopiarLinkButton";

import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { PagamentosGrid } from "@/components/PagamentosGrid";
import { PrazoDot } from "@/components/PrazoDot";
import { prazoVigente } from "@/lib/prazo";
import { EventoInfoCard } from "@/components/compras/EventoInfoCard";
import { agruparPagamentos, expandirPagamentos, pagamentosBatem, resumoPagamentos, validarPagamentos, type PagamentoLinha } from "@/lib/pagamentos";



const sb = supabase as any;

export type CompraItem = {
  id?: string;
  item_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  cotacao?: string | null;
  desconto_percentual?: number | null;
  valor_unitario?: number | null;
  evento_projeto?: string | null;
  ipi?: number | null;
  frete?: number | null;
  outros?: number | null;
};

export type Compra = {
  id?: string;
  numero?: number | null;
  status: CompraStatus;
  titulo?: string | null;
  solicitante?: string | null;
  solicitante_id?: string | null;
  fornecedor?: string | null;
  fornecedor_id?: string | null;
  documento?: string | null;
  comprador?: string | null;
  data_solicitacao?: string | null;
  data_compra?: string | null;
  data_servico?: string | null;
  prazo?: string | null;
  prazo_aprovacao?: string | null;

  parcelamento?: string | null;
  condicao_pagamento?: string | null;
  valor_total?: number | null;
  observacoes?: string | null;
  motivo_negacao?: string | null;
  tipo_compra?: string | null;
  numero_nf?: string | null;
  numeros_nf?: string[] | null;
  empresa_faturada?: string | null;
  tem_nf?: boolean | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  created_by?: string | null;
};

export type AdvanceOpts = { approve?: boolean; deny?: boolean };

export function CompraDialog({
  open,
  onOpenChange,
  compraId,
  defaultStatus = "solicitacao",
  onAdvance,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compraId?: string | null;
  defaultStatus?: CompraStatus;
  onAdvance?: (compra: Compra & { id: string }, opts?: AdvanceOpts) => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const { user, isAdmin: isGlobalAdmin, modulos } = useAuth();
  const [form, setForm] = useState<Compra>({ status: defaultStatus });
  const [itens, setItens] = useState<CompraItem[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoLinha[]>([]);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingComprovantes, setPendingComprovantes] = useState<File[]>([]);
  const [statusInicial, setStatusInicial] = useState<CompraStatus>(defaultStatus);
  const isAdmin = isGlobalAdmin || modulos.some((m) => m.slug === "compras" && m.is_admin);
  // canEdit é calculado abaixo, após `responsavelDoStatus` estar disponível.
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [motivoExclusao, setMotivoExclusao] = useState("");

  const { data: estoqueItens = [] } = useQuery({
    queryKey: ["itens-min"],
    queryFn: async () => {
      const { data } = await supabase.from("itens").select("id,nome,codigo,codigo_proprio,unidade").order("nome");
      return data ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["compras-fornecedores-min"],
    queryFn: async () => {
      const { data } = await sb.from("compras_fornecedores").select("id,nome,documento").eq("status", "ativo").order("nome");
      return (data ?? []) as { id: string; nome: string; documento: string | null }[];
    },
  });

  const { data: solicitantes = [] } = useQuery({
    queryKey: ["compras-solicitantes-min"],
    queryFn: async () => {
      const { data } = await sb.from("compras_solicitantes").select("id,nome").eq("status", "ativo").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: statusDefaults = [] } = useQuery({
    queryKey: ["compras_status_defaults"],
    queryFn: async () => {
      const { data } = await sb
        .from("compras_status_defaults")
        .select("status, responsavel_id, responsavel_nome");
      return (data ?? []) as { status: string; responsavel_id: string | null; responsavel_nome: string | null }[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const responsavelDoStatus = (status?: CompraStatus | null): string | null => {
    if (!status) return null;
    const def = statusDefaults.find((d) => d.status === status && d.responsavel_id);
    return def?.responsavel_id ?? null;
  };

  const statusRespId = responsavelDoStatus(form.status);
  const canEdit = !compraId || canEditCompra(form as any, user?.id, isAdmin, user?.email, statusRespId);
  const editBlockedMsg = canEdit ? null : moveBlockedMessage(form as any);
  // Permissão de exclusão é avaliada contra o status persistido (statusInicial),
  // não contra o valor atual do dropdown no formulário — evita que mudar o Status
  // no form desabilite o botão silenciosamente.
  const statusRespIdPersistido = responsavelDoStatus(statusInicial);
  const canDelete = !compraId
    ? false
    : canDeleteCompra(
        { ...(form as any), status: statusInicial },
        user?.id,
        isAdmin,
        statusRespIdPersistido,
      );

  const statusMoveBlockedMessage = (target?: CompraStatus | null) => {
    if (!target) return "Movimentação não permitida para este card.";
    const targetLabel = COMPRA_STATUSES.find((s) => s.key === target)?.label ?? target;
    const respNomeDest = statusDefaults.find((d) => d.status === target)?.responsavel_nome;
    return respNomeDest
      ? `Apenas ${respNomeDest} ou o responsável pelo status atual pode mover para "${targetLabel}".`
      : `Apenas o responsável pelo status atual pode mover para "${targetLabel}".`;
  };

  const statusOptions = useMemo(() => {
    if (!compraId) return COMPRA_STATUSES;
    const respAtual = responsavelDoStatus(statusInicial);
    return COMPRA_STATUSES.filter((s) =>
      s.key === statusInicial
      || s.key === form.status
      || canMoveCompra(form as any, user?.id, isAdmin, user?.email, s.key, statusInicial, responsavelDoStatus(s.key), respAtual),
    );
  }, [compraId, form, isAdmin, statusDefaults, statusInicial, user?.email, user?.id]);




  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
      setPendingComprovantes([]);
      return;
    }
    setPendingFiles([]);
    setPendingComprovantes([]);
    if (!compraId) {
      setForm({ status: defaultStatus, data_solicitacao: new Date().toISOString().slice(0, 10), tem_nf: true, numeros_nf: [] });
      setItens([]);
      setPagamentos([]);
      setStatusInicial(defaultStatus);
      return;
    }
    (async () => {
      const { data: c } = await sb.from("compras").select("*").eq("id", compraId).maybeSingle();
      if (c) {
        const raw = (c as any).numeros_nf as string[] | null | undefined;
        const legacy = (c as any).numero_nf as string | null | undefined;
        const numeros_nf = raw && raw.length > 0 ? raw : (legacy ? [legacy] : []);
        setForm({ ...(c as any), tem_nf: (c as any).tem_nf ?? true, numeros_nf });
        setStatusInicial(c.status as CompraStatus);
      }
      const { data: is } = await sb.from("compra_itens").select("*").eq("compra_id", compraId);
      setItens((is ?? []) as any);
      const { data: pgs } = await sb
        .from("compra_pagamentos")
        .select("id,forma,parcelamento,valor,ordem,data_pagamento,pago,pago_em")
        .eq("compra_id", compraId)
        .order("ordem");
      const rows = agruparPagamentos((pgs ?? []) as any[]);
      if (rows.length === 0 && c && ((c as any).condicao_pagamento || (c as any).parcelamento)) {
        rows.push({
          forma: (c as any).condicao_pagamento ?? null,
          parcelamento: (c as any).parcelamento ?? null,
          valor: Number((c as any).valor_total ?? 0),
          data_pagamento: null,
          pago: false,
          pago_em: null,
        });
      }
      setPagamentos(rows);

    })();

  }, [open, compraId, defaultStatus]);

  // Soma automática do valor total
  const totalCalc = useMemo(
    () => itens.reduce((s, it) => {
      const subtotal = Number(it.quantidade || 0) * Number(it.valor_unitario || 0);
      return s + subtotal + Number(it.ipi || 0) + Number(it.frete || 0) + Number(it.outros || 0);
    }, 0),
    [itens],
  );
  useEffect(() => {
    setForm((f) => ({ ...f, valor_total: totalCalc }));
  }, [totalCalc]);

  const save = useMutation({
    mutationFn: async () => {
      await ensureValidSession();
      const nfList = (form.numeros_nf ?? []).map((n) => (n ?? "").trim()).filter(Boolean);
      if (form.status === "a_receber") {
        if (!form.tipo_compra) {
          throw new Error("Defina o tipo da compra antes de salvar como Compras a Receber.");
        }
        if (form.tem_nf && nfList.length === 0) {
          throw new Error("Adicione pelo menos uma NF antes de mover para Compras a Receber (ou desmarque \"Tem NF\").");
        }
        if (!form.empresa_faturada) {
          throw new Error("Informe a empresa faturada antes de mover para Compras a Receber.");
        }
      }
      const pagamentosLimpos = pagamentos.filter(
        (p) => (p.forma ?? "").trim() || (p.parcelamento ?? "").trim() || Number(p.valor || 0) !== 0,
      );
      if (pagamentosLimpos.length > 0 && !pagamentosBatem(pagamentosLimpos, totalCalc)) {
        throw new Error(
          "A soma das formas de pagamento precisa ser igual ao valor total da compra.",
        );
      }
      const pendencias = validarPagamentos(pagamentosLimpos);
      if (pendencias.length > 0) {
        throw new Error(
          "Informe a data prevista e a situação de cada parcela do PIX parcelado.\n"
            + pendencias.join("\n"),
        );
      }
      const resumo = resumoPagamentos(pagamentosLimpos);
      const payload: any = {
        ...form,
        valor_total: totalCalc,
        condicao_pagamento: resumo.condicao_pagamento,
        parcelamento: resumo.parcelamento,
        numeros_nf: form.tem_nf === false ? [] : nfList,
        numero_nf: form.tem_nf === false ? null : (nfList[0] ?? null),
      };


      let id = compraId;
      if (id) {
        const { data: upd, error } = await sb.from("compras").update(payload).eq("id", id).select("id");
        if (error) throw error;
        if (!upd || upd.length === 0) throw new Error("Compra não foi atualizada (sem permissão ou registro removido).");
      } else {
        const { data, error } = await sb.from("compras").insert(payload).select("id").single();
        if (error) throw error;
        if (!data?.id) throw new Error("Compra não foi confirmada pelo banco.");
        id = data.id;
      }
      await sb.from("compra_itens").delete().eq("compra_id", id);
      if (itens.length) {
        const rows = itens.map((it) => ({
          compra_id: id,
          item_id: it.item_id || null,
          descricao: it.descricao,
          quantidade: it.quantidade || 0,
          unidade: it.unidade || null,
          cotacao: it.cotacao || null,
          desconto_percentual: it.desconto_percentual ?? null,
          valor_unitario: it.valor_unitario ?? null,
          evento_projeto: it.evento_projeto || null,
          ipi: Number(it.ipi || 0),
          frete: Number(it.frete || 0),
          outros: Number(it.outros || 0),
        }));
        const { data: ins, error } = await sb.from("compra_itens").insert(rows).select("id");
        if (error) throw error;
        if (!ins || ins.length !== rows.length) {
          throw new Error("Itens da compra não foram totalmente confirmados pelo banco.");
        }
      }
      await sb.from("compra_pagamentos").delete().eq("compra_id", id);
      if (pagamentosLimpos.length) {
        const pagRows = expandirPagamentos(pagamentosLimpos).map((p) => ({
          compra_id: id,
          ...p,
        }));

        const { error: pagErr } = await sb.from("compra_pagamentos").insert(pagRows);
        if (pagErr) throw pagErr;
      }

      // Upload de anexos/comprovantes pendentes (anexados antes de salvar)
      const pendentes: Array<{ file: File; tipo: string }> = [
        ...pendingFiles.map((file) => ({ file, tipo: "anexo" })),
        ...pendingComprovantes.map((file) => ({ file, tipo: "comprovante" })),
      ];
      if (id && pendentes.length > 0) {
        for (const { file, tipo } of pendentes) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${id}/${Date.now()}_${safeName}`;
          const { error: upErr } = await sb.storage.from("compra-anexos").upload(path, file, {
            contentType: file.type || undefined,
          });
          if (upErr) throw upErr;
          const { error: insErr } = await sb.from("compra_anexos").insert({
            compra_id: id,
            nome: file.name,
            path,
            mime_type: file.type || null,
            tamanho: file.size,
            tipo,
            uploaded_by: user?.id ?? null,
          });
          if (insErr) throw insErr;
        }
      }
      // Notificar responsáveis quando status muda
      if (form.status !== statusInicial) {
        await notifyResponsiblesForStatus(form.status, id!, form.titulo || form.fornecedor || "Compra");
      }
      return id;
    },
    onSuccess: async () => {
      toast.success("Compra salva");
      setPendingFiles([]);
      setPendingComprovantes([]);
      await qc.refetchQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = describeSupabaseError(e) || "";
      if (/row-level security|permission denied|policy/i.test(msg) || e?.code === "42501") {
        toast.error(editBlockedMsg ?? "Apenas o responsável, o criador do card ou um admin pode editá-lo.");
      } else {
        toast.error(msg || "Erro ao salvar");
      }
    },
  });

  function addItem() { setItens((p) => [...p, { descricao: "", quantidade: 1 }]); }
  function updateItem(idx: number, patch: Partial<CompraItem>) {
    setItens((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function updateCotacaoOrDesconto(idx: number, patch: Partial<CompraItem>) {
    setItens((p) => p.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      const desc = Number(next.desconto_percentual ?? 0);
      let bruto = parseFloat(String(next.cotacao ?? "").replace(",", "."));
      // Sem cotação informada: o valor unitário atual vira o preço cheio de
      // referência (revertendo um desconto anterior para não descontar em cima de desconto).
      if (!Number.isFinite(bruto)) {
        const atual = Number(it.valor_unitario ?? 0);
        if (!atual) return next;
        const descAnterior = Number(it.desconto_percentual ?? 0);
        bruto = descAnterior && descAnterior < 100 ? atual / (1 - descAnterior / 100) : atual;
        next.cotacao = String(Number(bruto.toFixed(4))).replace(".", ",");
      }
      next.valor_unitario = Number((bruto * (1 - (desc || 0) / 100)).toFixed(4));
      return next;
    }));
  }

  function removeItem(idx: number) { setItens((p) => p.filter((_, i) => i !== idx)); }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {(form as any).numero != null && (
          <div className="-mt-2 -mx-6 px-6 pb-2 pr-12 text-xs font-mono text-muted-foreground border-b border-border">
            COMPRA-{(form as any).numero}
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{compraId ? "Editar compra" : "Nova compra"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="itens">Itens</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-4">
            <FormSection>
              <FormField label="Título / Descrição">
                <Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Compra de tintas" />
              </FormField>
              <FormField label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CompraStatus })} disabled={!isGlobalAdmin && (!!compraId || !canEdit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(isGlobalAdmin ? COMPRA_STATUSES : statusOptions).map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Tipo de compra">
                <Select value={form.tipo_compra ?? ""} onValueChange={(v) => setForm({ ...form, tipo_compra: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {TIPO_COMPRA_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Tem Nota Fiscal (NF)?">
                <label className="flex items-center gap-2 h-10 text-sm">
                  <input
                    type="checkbox"
                    checked={form.tem_nf !== false}
                    onChange={(e) => setForm({
                      ...form,
                      tem_nf: e.target.checked,
                      numero_nf: e.target.checked ? form.numero_nf : null,
                      numeros_nf: e.target.checked ? (form.numeros_nf ?? []) : [],
                    })}
                    className="h-4 w-4"
                  />
                  <span className="text-muted-foreground">Marque se esta compra terá NF</span>
                </label>
              </FormField>
              {form.tem_nf !== false && (
                <FormField label="Notas Fiscais" wide>
                  <div className="space-y-2">
                    {(form.numeros_nf ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma NF adicionada.</p>
                    )}
                    {(form.numeros_nf ?? []).map((nf, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={nf}
                          onChange={(e) => {
                            const next = [...(form.numeros_nf ?? [])];
                            next[idx] = e.target.value;
                            setForm({ ...form, numeros_nf: next, numero_nf: next[0]?.trim() || null });
                          }}
                          placeholder="Ex.: 12345"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const next = (form.numeros_nf ?? []).filter((_, i) => i !== idx);
                            setForm({ ...form, numeros_nf: next, numero_nf: next[0]?.trim() || null });
                          }}
                          aria-label="Remover NF"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = [...(form.numeros_nf ?? []), ""];
                        setForm({ ...form, numeros_nf: next });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar NF
                    </Button>
                  </div>
                </FormField>
              )}
              <FormField label="Empresa faturada">
                <Select
                  value={form.empresa_faturada ?? ""}
                  onValueChange={(v) => setForm({ ...form, empresa_faturada: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Solicitante">
                <SelectCreatable
                  table="compras_solicitantes"
                  value={form.solicitante}
                  onChange={(v) => {
                    const s = solicitantes.find((x) => x.nome === v);
                    setForm({ ...form, solicitante: v, solicitante_id: s?.id ?? null });
                  }}
                />
              </FormField>
              <FormField label="Comprador">
                <SelectCreatable table="compradores" value={form.comprador}
                  onChange={(v) => setForm({ ...form, comprador: v })} />
              </FormField>
              <FormField label="Fornecedor">
                <SelectCreatable
                  table="compras_fornecedores"
                  value={form.fornecedor}
                  onChange={(v) => {
                    const f = fornecedores.find((x) => x.nome === v);
                    setForm({
                      ...form,
                      fornecedor: v,
                      fornecedor_id: f?.id ?? null,
                      documento: f?.documento ?? form.documento,
                    });
                  }}
                />
              </FormField>
              <FormField label="CNPJ / CPF">
                <Input value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
              </FormField>
              <FormField label="Data da solicitação">
                <Input type="date" value={form.data_solicitacao ?? ""} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} />
              </FormField>
              {(() => {
                const status = String(form.status ?? "");
                const posAprovacao = ["aprovada", "em_andamento", "a_receber", "finalizado"].includes(
                  status,
                );
                return (
                  <FormField label="Prazo">
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        disabled={posAprovacao}
                        value={prazoVigente(form as any) ?? ""}
                        onChange={(e) => setForm({ ...form, prazo: e.target.value || null } as any)}
                      />
                      <PrazoDot prazo={prazoVigente(form as any)} status={status} />
                    </div>
                    {posAprovacao && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        O prazo fica travado após a aprovação.
                      </p>
                    )}
                  </FormField>
                );
              })()}

              {form.tipo_compra === "servico" ? (
                <FormField label="Data do serviço">
                  <Input type="date" value={form.data_servico ?? ""} onChange={(e) => setForm({ ...form, data_servico: e.target.value })} />
                </FormField>
              ) : (
                <FormField label="Data da compra">
                  <Input type="date" value={form.data_compra ?? ""} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} />
                </FormField>
              )}
            </FormSection>

            <EventoInfoCard eventos={itens.map((it) => it.evento_projeto ?? "")} />


            <div className="mt-6 space-y-4">
              <PagamentosGrid
                pagamentos={pagamentos}
                onChange={setPagamentos}
                total={totalCalc}
                disabled={!canEdit}
              />

              <FormField label="Valor total (R$)" wide>
                <div className="flex h-10 items-center justify-between rounded-md border border-input bg-muted/50 px-3 text-sm">
                  <span className="font-semibold tabular-nums">
                    {totalCalc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    calculado pelos itens
                  </span>
                </div>
              </FormField>

              <FormField label="Observações" wide>
                <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </FormField>
              {form.status === "negada" && (
                <FormField label="Motivo da negação" wide>
                  <Textarea rows={2} value={form.motivo_negacao ?? ""} onChange={(e) => setForm({ ...form, motivo_negacao: e.target.value })} />
                </FormField>
              )}
            </div>


            <div className="mt-2 border-t border-border pt-4">
              <Tabs defaultValue="comentarios">
                <TabsList>
                  <TabsTrigger value="comentarios">Comentários</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent value="comentarios" className="pt-4">
                  {compraId ? (
                    <Comentarios compraId={compraId} userId={user?.id} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Salve a compra para habilitar os comentários.</p>
                  )}
                </TabsContent>
                <TabsContent value="historico" className="pt-4">
                  {compraId ? (
                    <Historico compraId={compraId} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">O histórico será criado automaticamente após salvar a compra.</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="itens" className="space-y-2 pt-4">
            {itens.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>}
            {itens.map((it, idx) => (
              <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Item do estoque (opcional)</label>
                    <ItemSearchSelect
                      itens={estoqueItens as any}
                      value={it.item_id ?? ""}
                      onChange={(id) => {
                        const found: any = (estoqueItens as any[]).find((x) => x.id === id);
                        updateItem(idx, { item_id: id, descricao: found?.nome ?? it.descricao, unidade: found?.unidade ?? it.unidade });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição (livre)</label>
                    <Input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} placeholder="Item novo / não cadastrado" />
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Qtd</label>
                    <Input type="number" step="0.01" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Unidade</label>
                    <Input value={it.unidade ?? ""} onChange={(e) => updateItem(idx, { unidade: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cotação</label>
                    <Input
                      value={it.cotacao ?? ""}
                      onChange={(e) => updateCotacaoOrDesconto(idx, { cotacao: e.target.value })}
                      placeholder="Ex: 12,50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Desc. %</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={it.desconto_percentual ?? ""}
                      onChange={(e) => updateCotacaoOrDesconto(idx, { desconto_percentual: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor unit.</label>
                    <MoneyInput value={it.valor_unitario ?? 0} onChange={(n) => updateItem(idx, { valor_unitario: n || null })} />
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">IPI</label>
                    <MoneyInput value={it.ipi ?? 0} onChange={(n) => updateItem(idx, { ipi: n || 0 })} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Frete</label>
                    <MoneyInput value={it.frete ?? 0} onChange={(n) => updateItem(idx, { frete: n || 0 })} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Outros</label>
                    <MoneyInput value={it.outros ?? 0} onChange={(n) => updateItem(idx, { outros: n || 0 })} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Subtotal</label>
                    <Input
                      value={(
                        Number(it.quantidade || 0) * Number(it.valor_unitario || 0)
                        + Number(it.ipi || 0) + Number(it.frete || 0) + Number(it.outros || 0)
                      ).toFixed(2)}
                      readOnly
                      className="bg-muted/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Evento / Projeto <span className="text-destructive">*</span>
                  </label>
                  <EventoSheetCombobox
                    value={it.evento_projeto ?? null}
                    onChange={(v) => updateItem(idx, { evento_projeto: v })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
            </Button>
            <div className="text-right text-sm font-medium pt-2">
              Total: {totalCalc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </TabsContent>

          <TabsContent value="anexos" className="space-y-6 pt-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anexos
              </div>
              {compraId ? (
                <Anexos compraId={compraId} userId={user?.id} tipo="anexo" />
              ) : (
                <PendingAnexos files={pendingFiles} onChange={setPendingFiles} />
              )}
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comprovantes
              </div>
              {compraId ? (
                <Anexos compraId={compraId} userId={user?.id} tipo="comprovante" />
              ) : (
                <PendingAnexos
                  files={pendingComprovantes}
                  onChange={setPendingComprovantes}
                  label="Clique para anexar comprovantes"
                />
              )}
            </div>
          </TabsContent>

        </Tabs>

        <DialogFooter className="sm:justify-between">
          <div>
            {compraId && (
              <Button
                variant="destructive"
                disabled={!canDelete}
                title={canDelete ? undefined : "Sem permissão para excluir este card."}
                onClick={() => {
                  if (!canDelete) { toast.error("Sem permissão para excluir este card."); return; }
                  setMotivoExclusao("");
                  setExcluirOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            {compraId && (
              <span className="ml-2 inline-block align-middle">
                <CopiarLinkButton path={`/compras?id=${compraId}`} />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              if (!compraId || !onAdvance) return null;
              const blocked = moveBlockedMessage(form);
              const respAtual = responsavelDoStatus(form.status);
              if (form.status === "pendente_aprovacao") {
                const canMove = canMoveCompra(form as any, user?.id, isAdmin, user?.email, "aprovada", form.status as any, responsavelDoStatus("aprovada"), respAtual);
                const canDeny = canMoveCompra(form as any, user?.id, isAdmin, user?.email, "negada", form.status as any, responsavelDoStatus("negada"), respAtual);
                const approvalBlocked = respAtual ? "Apenas o responsável por Pendente Aprovação pode aprovar ou reprovar este card." : blocked;
                return (
                  <>
                    <Button
                      onClick={() => canMove && onAdvance({ ...form, id: compraId }, { approve: true })}
                      disabled={!canMove}
                      title={canMove ? undefined : approvalBlocked}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar compra
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => canDeny && onAdvance({ ...form, id: compraId }, { deny: true })}
                      disabled={!canDeny}
                      title={canDeny ? undefined : approvalBlocked}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reprovar compra
                    </Button>
                  </>
                );
              }
              const nextKey = nextCompraStatus(form.status);
              const nextLabel = nextKey ? COMPRA_STATUSES.find((s) => s.key === nextKey)?.label ?? null : null;
              if (!nextLabel) return null;
              const canMove = canMoveCompra(form as any, user?.id, isAdmin, user?.email, nextKey ?? undefined, form.status as any, responsavelDoStatus(nextKey), respAtual);
              const missingTipo = nextKey === "a_receber" && !form.tipo_compra;
              const disabled = !canMove || missingTipo;
              const title = canMove
                ? (missingTipo ? "Defina o tipo da compra antes de avançar para Compras a Receber." : undefined)
                : statusMoveBlockedMessage(nextKey);
              return (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (missingTipo) {
                      toast.error("Defina o tipo da compra antes de avançar para Compras a Receber.");
                      return;
                    }
                    if (canMove) onAdvance({ ...form, id: compraId });
                  }}
                  disabled={disabled}
                  title={title}
                >
                  Avançar para "{nextLabel}" <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              );

            })()}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !canEdit}
              title={editBlockedMsg ?? undefined}
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {excluirOpen && compraId && (
      <Dialog open={excluirOpen} onOpenChange={(v) => { if (!v) setExcluirOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. Informe o motivo da exclusão.
            </p>
            <div>
              <label className="text-xs font-medium">Motivo da exclusão *</label>
              <Textarea
                autoFocus
                value={motivoExclusao}
                onChange={(e) => setMotivoExclusao(e.target.value)}
                placeholder="Ex: card duplicado, criado por engano, cancelado pelo solicitante…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!motivoExclusao.trim()}
              onClick={async () => {
                try {
                  const { data: snap } = await sb.from("compras").select("*").eq("id", compraId).maybeSingle();
                  const { error: histErr } = await sb.from("compras_exclusoes").insert({
                    compra_id: compraId,
                    compra_numero: snap?.numero ?? null,
                    titulo: snap?.titulo ?? form.titulo ?? null,
                    fornecedor: snap?.fornecedor ?? form.fornecedor ?? null,
                    valor_total: snap?.valor_total ?? null,
                    status_no_momento: snap?.status ?? form.status ?? null,
                    dados_json: snap ?? null,
                    motivo: motivoExclusao.trim(),
                    excluido_por: user?.id ?? null,
                    excluido_por_nome: (user as any)?.user_metadata?.full_name ?? user?.email ?? null,
                  });
                  if (histErr) throw histErr;

                  await sb.from("compra_itens").delete().eq("compra_id", compraId);
                  await sb.from("compra_comentarios").delete().eq("compra_id", compraId);
                  await sb.from("compra_historico").delete().eq("compra_id", compraId);
                  const { error } = await sb.from("compras").delete().eq("id", compraId);
                  if (error) throw error;

                  toast.success("Compra excluída.");
                  qc.invalidateQueries({ queryKey: ["compras"] });
                  qc.invalidateQueries({ queryKey: ["compras-receber"] });
                  setExcluirOpen(false);
                  onOpenChange(false);
                } catch (e: any) {
                  const msg = e?.message ?? "";
                  if (/row-level security|permission denied|policy/i.test(msg) || e?.code === "42501") {
                    toast.error("Sem permissão para excluir este card.");
                  } else {
                    toast.error(msg || "Erro ao excluir");
                  }
                }
              }}
            >
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

function Comentarios({ compraId, userId }: { compraId: string; userId?: string }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<string[]>([]);

  const { data: comentarios = [] } = useQuery({
    queryKey: ["compra-coments", compraId],
    queryFn: async () => {
      const { data } = await sb.from("compra_comentarios").select("*").eq("compra_id", compraId).order("created_at");
      return (data ?? []) as any[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("id,display_name,email");
      return (data ?? []).map((u: any) => ({ id: u.id, nome: u.display_name || u.email || "Usuário" }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!texto.trim()) return;
      const meName = (users.find((u: any) => u.id === userId) as any)?.nome ?? null;
      const { error } = await sb.from("compra_comentarios").insert({
        compra_id: compraId, user_id: userId, user_nome: meName, texto: texto.trim(), mencoes,
      });
      if (error) throw error;
      if (mencoes.length) {
        await notifyMentions(mencoes, compraId, texto.trim());
      }
      setTexto(""); setMencoes([]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compra-coments", compraId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
        {comentarios.map((c) => (
          <div key={c.id} className="rounded-md border border-border p-2.5 bg-muted/30">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-medium">{c.user_nome ?? "—"}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{renderCommentText(c.texto)}</div>
          </div>
        ))}
      </div>
      <MentionInput value={texto} onChange={(v, m) => { setTexto(v); setMencoes(m); }} users={users as any} onSubmit={() => post.mutate()} />
      <div className="flex justify-end">
        <Button size="sm" disabled={!texto.trim() || post.isPending} onClick={() => post.mutate()}>Comentar</Button>
      </div>
    </div>
  );
}

function Historico({ compraId }: { compraId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["compra-hist", compraId],
    queryFn: async () => {
      const { data } = await sb.from("compra_historico").select("*").eq("compra_id", compraId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const labels: Record<string, string> = COMPRA_STATUSES.reduce((a, s) => ({ ...a, [s.key]: s.label }), {});
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {data.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico.</p>}
      {data.map((h) => (
        <div key={h.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
          <div className="font-medium">
            {h.user_nome ?? "Sistema"}{" "}
            {h.acao === "criou" && <span>criou a compra como <b>{labels[h.status_novo] ?? h.status_novo}</b></span>}
            {h.acao === "mudou_status" && <span>mudou status de <b>{labels[h.status_anterior] ?? h.status_anterior}</b> para <b>{labels[h.status_novo] ?? h.status_novo}</b></span>}
          </div>
          <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
        </div>
      ))}
    </div>
  );
}

function Anexos({
  compraId,
  userId,
  tipo = "anexo",
}: {
  compraId: string;
  userId?: string;
  tipo?: "anexo" | "comprovante";
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const isComprovante = tipo === "comprovante";

  const { data: anexos = [] } = useQuery({
    queryKey: ["compra-anexos", compraId, tipo],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compra_anexos")
        .select("*")
        .eq("compra_id", compraId)
        .eq("tipo", tipo)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${compraId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await sb.storage.from("compra-anexos").upload(path, file, {
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await sb.from("compra_anexos").insert({
          compra_id: compraId,
          nome: file.name,
          path,
          mime_type: file.type || null,
          tamanho: file.size,
          tipo,
          uploaded_by: userId ?? null,
        });
        if (insErr) throw insErr;
      }
      toast.success(isComprovante ? "Comprovantes enviados" : "Anexos enviados");
      qc.invalidateQueries({ queryKey: ["compra-anexos", compraId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(a: any) {
    await baixarAnexo("compra-anexos", a.path, a.nome);
  }


  async function handleDelete(a: any) {
    if (!confirm(`Remover anexo "${a.nome}"?`)) return;
    try {
      await sb.storage.from("compra-anexos").remove([a.path]);
      const { error } = await sb.from("compra_anexos").delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["compra-anexos", compraId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    }
  }

  function fmtSize(n?: number | null) {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {uploading
            ? "Enviando…"
            : isComprovante
              ? "Clique para anexar comprovantes (PDF, imagens, etc.)"
              : "Clique para anexar arquivos (PDF, Excel, imagens, etc.)"}
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {isComprovante ? "Nenhum comprovante." : "Nenhum anexo."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {anexos.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                type="button"
                className="flex-1 min-w-0 text-left hover:underline"
                onClick={() => setPreview(a)}
              >
                <div className="truncate font-medium">{a.nome}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtSize(a.tamanho)} · {new Date(a.created_at).toLocaleString("pt-BR")}
                </div>
              </button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(a)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(a)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <AnexoViewer
        bucket="compra-anexos"
        anexo={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
    </div>
  );
}

function PendingAnexos({
  files,
  onChange,
  label = "Clique para anexar arquivos (PDF, Excel, imagens, etc.)",
}: {
  files: File[];
  onChange: (f: File[]) => void;
  label?: string;
}) {
  function fmtSize(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground italic">
        Os arquivos serão enviados quando você salvar a compra.
      </p>
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            if (list.length) onChange([...files, ...list]);
            e.target.value = "";
          }}
        />
      </label>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum anexo selecionado.</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtSize(f.size)}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(files.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

