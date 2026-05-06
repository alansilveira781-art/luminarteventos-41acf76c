import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormSection } from "@/components/FormSection";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { COMPRA_STATUSES, type CompraStatus } from "@/lib/compras";

const sb = supabase as any;

export type CompraItem = {
  id?: string;
  item_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  valor_unitario?: number | null;
};

export type Compra = {
  id?: string;
  status: CompraStatus;
  titulo?: string | null;
  solicitante?: string | null;
  fornecedor?: string | null;
  documento?: string | null;
  comprador?: string | null;
  data_solicitacao?: string | null;
  data_compra?: string | null;
  parcelamento?: string | null;
  condicao_pagamento?: string | null;
  valor_total?: number | null;
  observacoes?: string | null;
  motivo_negacao?: string | null;
};

export function CompraDialog({
  open,
  onOpenChange,
  compraId,
  defaultStatus = "solicitacao",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compraId?: string | null;
  defaultStatus?: CompraStatus;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Compra>({ status: defaultStatus });
  const [itens, setItens] = useState<CompraItem[]>([]);

  const { data: estoqueItens = [] } = useQuery({
    queryKey: ["itens-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("itens")
        .select("id,nome,codigo,codigo_proprio,unidade")
        .order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!compraId) {
      setForm({ status: defaultStatus, data_solicitacao: new Date().toISOString().slice(0, 10) });
      setItens([]);
      return;
    }
    (async () => {
      const { data: c } = await sb.from("compras").select("*").eq("id", compraId).maybeSingle();
      if (c) setForm(c as any);
      const { data: is } = await sb.from("compra_itens").select("*").eq("compra_id", compraId);
      setItens((is ?? []) as any);
    })();
  }, [open, compraId, defaultStatus]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      let id = compraId;
      if (id) {
        const { error } = await sb.from("compras").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("compras").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      // Replace items
      await sb.from("compra_itens").delete().eq("compra_id", id);
      if (itens.length) {
        const rows = itens.map((it) => ({
          compra_id: id,
          item_id: it.item_id || null,
          descricao: it.descricao,
          quantidade: it.quantidade || 0,
          unidade: it.unidade || null,
          valor_unitario: it.valor_unitario ?? null,
        }));
        const { error } = await sb.from("compra_itens").insert(rows);
        if (error) throw error;
      }
      return id;
    },
    onSuccess: () => {
      toast.success("Compra salva");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  function addItem() {
    setItens((prev) => [...prev, { descricao: "", quantidade: 1 }]);
  }

  function updateItem(idx: number, patch: Partial<CompraItem>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{compraId ? "Editar compra" : "Nova compra"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormSection title="Dados gerais">
            <FormField label="Título / Descrição">
              <Input
                value={form.titulo ?? ""}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex.: Compra de tintas"
              />
            </FormField>
            <FormField label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as CompraStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPRA_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Solicitante">
              <Input value={form.solicitante ?? ""} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} />
            </FormField>
            <FormField label="Comprador">
              <Input value={form.comprador ?? ""} onChange={(e) => setForm({ ...form, comprador: e.target.value })} />
            </FormField>
            <FormField label="Fornecedor">
              <Input value={form.fornecedor ?? ""} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            </FormField>
            <FormField label="CNPJ / CPF">
              <Input value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </FormField>
            <FormField label="Data da solicitação">
              <Input type="date" value={form.data_solicitacao ?? ""} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} />
            </FormField>
            <FormField label="Data da compra">
              <Input type="date" value={form.data_compra ?? ""} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} />
            </FormField>
            <FormField label="Parcelamento">
              <Input value={form.parcelamento ?? ""} onChange={(e) => setForm({ ...form, parcelamento: e.target.value })} placeholder="Ex.: 3x" />
            </FormField>
            <FormField label="Condição de pagamento">
              <Input value={form.condicao_pagamento ?? ""} onChange={(e) => setForm({ ...form, condicao_pagamento: e.target.value })} placeholder="Ex.: Boleto 30 dias" />
            </FormField>
            <FormField label="Valor total">
              <Input type="number" step="0.01" value={form.valor_total ?? ""} onChange={(e) => setForm({ ...form, valor_total: e.target.value === "" ? null : Number(e.target.value) })} />
            </FormField>
          </FormSection>

          <FormSection title="Itens da compra">
            <div className="sm:col-span-2 space-y-2">
              {itens.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>
              )}
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
                          updateItem(idx, {
                            item_id: id,
                            descricao: found?.nome ?? it.descricao,
                            unidade: found?.unidade ?? it.unidade,
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição (livre)</label>
                      <Input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} placeholder="Item novo / não cadastrado" />
                    </div>
                  </div>
                  <div className="grid gap-2 grid-cols-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Qtd</label>
                      <Input type="number" step="0.01" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Unidade</label>
                      <Input value={it.unidade ?? ""} onChange={(e) => updateItem(idx, { unidade: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor unit.</label>
                      <Input type="number" step="0.01" value={it.valor_unitario ?? ""} onChange={(e) => updateItem(idx, { valor_unitario: e.target.value === "" ? null : Number(e.target.value) })} />
                    </div>
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
            </div>
          </FormSection>

          <FormSection title="Observações">
            <div className="sm:col-span-2">
              <Textarea
                rows={3}
                value={form.observacoes ?? ""}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
            {form.status === "negada" && (
              <div className="sm:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Motivo da negação</label>
                <Textarea
                  rows={2}
                  value={form.motivo_negacao ?? ""}
                  onChange={(e) => setForm({ ...form, motivo_negacao: e.target.value })}
                />
              </div>
            )}
          </FormSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
