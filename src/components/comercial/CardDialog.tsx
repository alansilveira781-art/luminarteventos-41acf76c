import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CARD_STATUSES, type CardStatus, type ComercialCard } from "@/lib/comercial/types";
import { createCard, updateCard, deleteCard, upsertCliente, addConsultor, useComercial } from "@/lib/comercial/store";
import { NumberInput } from "@/components/comercial/NumberInput";
import { MoneyInput } from "@/components/MoneyInput";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  card?: ComercialCard | null;
  defaultStatus?: CardStatus;
};

const NEW_CONSULTOR = "__novo__";

const empty = {
  clienteNome: "",
  clienteTelefone: "",
  clienteEmail: "",
  eventoNome: "",
  eventoDataInicio: "",
  eventoDataFim: "",
  valorEstimado: 0,
  responsavel: "",
  observacoes: "",
  status: "lead" as CardStatus,
  dataEnvio: "",
};

export function CardDialog({ open, onOpenChange, card, defaultStatus }: Props) {
  const { consultores } = useComercial();
  const [form, setForm] = useState(empty);
  const [novoConsultorOpen, setNovoConsultorOpen] = useState(false);
  const [novoConsultor, setNovoConsultor] = useState("");

  useEffect(() => {
    if (open) {
      if (card) {
        setForm({
          clienteNome: card.clienteNome,
          clienteTelefone: "",
          clienteEmail: "",
          eventoNome: card.eventoNome,
          eventoDataInicio: card.eventoDataInicio ?? "",
          eventoDataFim: card.eventoDataFim ?? "",
          valorEstimado: card.valorEstimado,
          responsavel: card.responsavel,
          observacoes: card.observacoes,
          status: card.status,
          dataEnvio: card.dataEnvio ?? "",
        });
      } else {
        setForm({ ...empty, status: defaultStatus ?? "lead" });
      }
    }
  }, [open, card, defaultStatus]);

  function save() {
    if (!form.clienteNome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (form.eventoDataInicio && form.eventoDataFim && form.eventoDataFim < form.eventoDataInicio) {
      toast.error("A data final não pode ser anterior à data inicial");
      return;
    }
    if (form.status === "orcamento_enviado" && !form.dataEnvio) {
      toast.error("Informe a data de envio para mover para Orçamento Enviado");
      return;
    }
    const payload: Partial<ComercialCard> = {
      clienteNome: form.clienteNome,
      eventoNome: form.eventoNome,
      eventoDataInicio: form.eventoDataInicio,
      eventoDataFim: form.eventoDataFim || form.eventoDataInicio,
      valorEstimado: Number(form.valorEstimado) || 0,
      responsavel: form.responsavel,
      observacoes: form.observacoes,
      status: form.status,
      dataEnvio: form.status === "orcamento_enviado" ? form.dataEnvio : (card?.dataEnvio ?? null),
    };

    if (card) {
      updateCard(card.id, payload);
      toast.success("Card atualizado");
    } else {
      let clienteId: string | null = null;
      if (form.clienteNome.trim()) {
        const c = upsertCliente({
          nome: form.clienteNome.trim(),
          telefone: form.clienteTelefone.trim(),
          email: form.clienteEmail.trim(),
        });
        clienteId = c.id;
      }
      createCard({
        clienteId,
        clienteNome: payload.clienteNome!,
        eventoNome: payload.eventoNome!,
        eventoDataInicio: payload.eventoDataInicio!,
        eventoDataFim: payload.eventoDataFim!,
        valorEstimado: payload.valorEstimado!,
        responsavel: payload.responsavel!,
        observacoes: payload.observacoes!,
        status: payload.status,
        dataEnvio: payload.dataEnvio,
      });
      toast.success("Lead criado");
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!card) return;
    if (!confirm("Excluir este card?")) return;
    deleteCard(card.id);
    toast.success("Card excluído");
    onOpenChange(false);
  }

  function onConsultorChange(v: string) {
    if (v === NEW_CONSULTOR) {
      setNovoConsultor("");
      setNovoConsultorOpen(true);
      return;
    }
    setForm({ ...form, responsavel: v });
  }

  function confirmarNovoConsultor() {
    const n = novoConsultor.trim();
    if (!n) return;
    addConsultor(n);
    setForm({ ...form, responsavel: n });
    setNovoConsultorOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{card ? "Editar card" : "Novo lead"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome do cliente *</Label>
              <Input value={form.clienteNome} onChange={(e) => setForm({ ...form, clienteNome: e.target.value })} />
            </div>
            {!card && (
              <>
                <div>
                  <Label>Telefone do cliente</Label>
                  <Input value={form.clienteTelefone} onChange={(e) => setForm({ ...form, clienteTelefone: e.target.value })} />
                </div>
                <div>
                  <Label>Email do cliente</Label>
                  <Input value={form.clienteEmail} onChange={(e) => setForm({ ...form, clienteEmail: e.target.value })} />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Label>Nome do evento</Label>
              <Input value={form.eventoNome} onChange={(e) => setForm({ ...form, eventoNome: e.target.value })} />
            </div>
            <div>
              <Label>Data início</Label>
              <Input
                type="date"
                value={form.eventoDataInicio}
                onChange={(e) => setForm({ ...form, eventoDataInicio: e.target.value })}
              />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input
                type="date"
                value={form.eventoDataFim}
                onChange={(e) => setForm({ ...form, eventoDataFim: e.target.value })}
              />
            </div>
            <div>
              <Label>Valor estimado (R$)</Label>
              <MoneyInput
                value={form.valorEstimado}
                onChange={(n) => setForm({ ...form, valorEstimado: n })}
              />
            </div>
            <div>
              <Label>Consultor(a)</Label>
              <Select value={form.responsavel || undefined} onValueChange={onConsultorChange}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {consultores.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value={NEW_CONSULTOR}>+ Adicionar consultor(a)…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Status</Label>
              <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3">
                <span className={`h-2 w-2 rounded-full ${CARD_STATUSES.find((s) => s.key === form.status)?.color ?? "bg-slate-400"}`} />
                <span className="text-sm">
                  {CARD_STATUSES.find((s) => s.key === form.status)?.label ?? form.status}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                  somente leitura
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                O status muda arrastando o card no quadro, respeitando as regras de avanço.
              </p>
            </div>
            {form.status === "orcamento_enviado" && (
              <div className="sm:col-span-2">
                <Label>Data de envio *</Label>
                <Input
                  type="date"
                  value={form.dataEnvio}
                  onChange={(e) => setForm({ ...form, dataEnvio: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Obrigatória para mover o card para "Orçamento Enviado".
                </p>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Observações rápidas</Label>
              <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {card && (
              <Button variant="destructive" onClick={handleDelete} className="mr-auto">
                Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novoConsultorOpen} onOpenChange={setNovoConsultorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo consultor(a)</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input
              value={novoConsultor}
              onChange={(e) => setNovoConsultor(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") confirmarNovoConsultor(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoConsultorOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarNovoConsultor} disabled={!novoConsultor.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
