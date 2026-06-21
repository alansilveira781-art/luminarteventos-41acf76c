import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EMPRESAS } from "@/lib/empresas";

export const FORMAS_PAGAMENTO = [
  "À vista",
  "PIX",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Transferência",
  "Parcelado",
  "Outro",
] as const;

export type NovoContratoDefaults = {
  titulo?: string;
  cliente_nome?: string | null;
  cliente_documento?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  responsavel?: string | null;
  valor?: number | null;
  proposta_ref?: string | null;
};

/**
 * Abre o cadastro de um novo contrato no módulo Jurídico, acionado quando uma
 * venda é movida para "Fechamento" no Quadro de Vendas.
 */
export function NovoContratoDialog({
  open, onOpenChange, defaults, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults?: NovoContratoDefaults;
  userId: string | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      empresa: EMPRESAS[0],
      titulo: defaults?.titulo ?? "",
      cliente_nome: defaults?.cliente_nome ?? "",
      cliente_documento: defaults?.cliente_documento ?? "",
      cliente_email: defaults?.cliente_email ?? "",
      cliente_telefone: defaults?.cliente_telefone ?? "",
      responsavel: defaults?.responsavel ?? "",
      valor: defaults?.valor ?? "",
      proposta_ref: defaults?.proposta_ref ?? "",
      forma_pagamento: "",
      data_fechamento: new Date().toISOString().slice(0, 10),
      observacoes: "",
    });
  }, [open, defaults]);

  async function save() {
    if (!form.titulo) return toast.error("Informe o título");
    setSaving(true);
    const payload: any = {
      titulo: form.titulo,
      empresa: form.empresa || null,
      cliente_nome: form.cliente_nome || null,
      cliente_documento: form.cliente_documento || null,
      cliente_email: form.cliente_email || null,
      cliente_telefone: form.cliente_telefone || null,
      responsavel: form.responsavel || null,
      valor: form.valor ? Number(form.valor) : null,
      status: "entrada",
      observacoes: form.observacoes || null,
      data_fechamento: form.data_fechamento || null,
      proposta_ref: form.proposta_ref || null,
      forma_pagamento: form.forma_pagamento || null,
      created_by: userId,
    };
    const { error } = await (supabase as any).from("juridico_contratos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contrato criado no Jurídico");
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato — venda fechada</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Título *</Label>
            <Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Empresa</Label>
            <Select value={form.empresa ?? ""} onValueChange={(v) => setForm({ ...form, empresa: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={form.forma_pagamento ?? ""} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={form.cliente_nome ?? ""} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF/CNPJ</Label>
            <Input value={form.cliente_documento ?? ""} onChange={(e) => setForm({ ...form, cliente_documento: e.target.value })} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={form.cliente_email ?? ""} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.cliente_telefone ?? ""} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel ?? ""} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
          <div>
            <Label>Data de fechamento</Label>
            <Input type="date" value={form.data_fechamento ?? ""} onChange={(e) => setForm({ ...form, data_fechamento: e.target.value })} />
          </div>
          <div>
            <Label>Ref. proposta</Label>
            <Input value={form.proposta_ref ?? ""} onChange={(e) => setForm({ ...form, proposta_ref: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Pular por agora</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Criando…" : "Criar contrato"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
