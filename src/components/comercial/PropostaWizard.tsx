import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { CATALOGO } from "@/lib/comercial/catalogo";
import { TIPOS_EVENTO, type ItemProposta, type CustoExtra, type Proposta } from "@/lib/comercial/types";
import { createProposta, updateProposta, upsertCliente } from "@/lib/comercial/store";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cardId?: string | null;
  defaults?: { clienteNome?: string; eventoNome?: string; eventoData?: string };
  proposta?: Proposta | null;
};

const STEPS = ["Cliente", "Evento", "Itens", "Custos", "Resumo"];
const uid = () => Math.random().toString(36).slice(2);

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PropostaWizard({ open, onOpenChange, cardId, defaults, proposta }: Props) {
  const [step, setStep] = useState(0);
  const [cliente, setCliente] = useState({ nome: "", telefone: "", email: "" });
  const [evento, setEvento] = useState({
    tipo: "" as Proposta["evento"]["tipo"],
    data: "",
    horarioInicio: "",
    horarioTermino: "",
    local: "",
    cidade: "",
    observacoes: "",
  });
  const [itens, setItens] = useState<ItemProposta[]>([]);
  const [custos, setCustos] = useState<{ frete: number; montagem: number; desmontagem: number; outros: CustoExtra[] }>({
    frete: 0, montagem: 0, desmontagem: 0, outros: [],
  });
  const [resumo, setResumo] = useState({ margem: 0, validade: "" });
  const [responsavel, setResponsavel] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (proposta) {
      setCliente(proposta.cliente);
      setEvento(proposta.evento);
      setItens(proposta.itens);
      setCustos(proposta.custos);
      setResumo(proposta.resumo);
      setResponsavel(proposta.responsavel);
    } else {
      setCliente({ nome: defaults?.clienteNome ?? "", telefone: "", email: "" });
      setEvento({ tipo: "", data: defaults?.eventoData ?? "", horarioInicio: "", horarioTermino: "", local: "", cidade: "", observacoes: "" });
      setItens([]);
      setCustos({ frete: 0, montagem: 0, desmontagem: 0, outros: [] });
      setResumo({ margem: 0, validade: "" });
      setResponsavel("");
    }
  }, [open, proposta, defaults]);

  const subtotalItens = useMemo(
    () => itens.reduce((s, i) => s + (i.quantidade || 0) * (i.valorUnitario || 0), 0),
    [itens],
  );
  const totalCustos = useMemo(
    () =>
      (custos.frete || 0) +
      (custos.montagem || 0) +
      (custos.desmontagem || 0) +
      custos.outros.reduce((s, c) => s + (c.valor || 0), 0),
    [custos],
  );
  const totalFinal = subtotalItens + totalCustos;

  function addCatalogo(idx: number) {
    const c = CATALOGO[idx];
    setItens([...itens, { id: uid(), nome: c.nome, unidade: c.unidade, quantidade: 1, valorUnitario: 0 }]);
  }

  function canNext() {
    if (step === 0) return cliente.nome.trim().length > 0;
    if (step === 1) return !!evento.tipo && !!evento.data;
    if (step === 2) return itens.length > 0;
    return true;
  }

  function finish() {
    if (!cliente.nome.trim()) return toast.error("Informe o cliente");
    if (itens.length === 0) return toast.error("Adicione ao menos um item");

    const c = upsertCliente(cliente);
    if (proposta) {
      updateProposta(proposta.id, {
        cliente, evento, itens, custos, resumo, responsavel, clienteId: c.id,
        status: "aguardando_aprovacao",
      });
      toast.success("Proposta atualizada e enviada para validação");
    } else {
      createProposta({
        cardId: cardId ?? null, clienteId: c.id, cliente, evento, itens, custos, resumo, responsavel,
      });
      toast.success("Proposta enviada para validação interna");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proposta ? `Editar proposta #${proposta.numero}` : "Criar proposta"}</DialogTitle>
        </DialogHeader>

        <div className="mb-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            {STEPS.map((s, i) => (
              <span key={s} className={i === step ? "text-foreground font-medium" : ""}>
                {i + 1}. {s}
              </span>
            ))}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </div>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={cliente.telefone} onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tipo de evento *</Label>
              <Select value={evento.tipo} onValueChange={(v) => setEvento({ ...evento, tipo: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_EVENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do evento *</Label>
              <Input type="date" value={evento.data} onChange={(e) => setEvento({ ...evento, data: e.target.value })} />
            </div>
            <div>
              <Label>Horário de início</Label>
              <Input type="time" value={evento.horarioInicio} onChange={(e) => setEvento({ ...evento, horarioInicio: e.target.value })} />
            </div>
            <div>
              <Label>Horário de término</Label>
              <Input type="time" value={evento.horarioTermino} onChange={(e) => setEvento({ ...evento, horarioTermino: e.target.value })} />
            </div>
            <div>
              <Label>Local</Label>
              <Input value={evento.local} onChange={(e) => setEvento({ ...evento, local: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={evento.cidade} onChange={(e) => setEvento({ ...evento, cidade: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={evento.observacoes} onChange={(e) => setEvento({ ...evento, observacoes: e.target.value })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Adicionar do catálogo</div>
              <div className="flex flex-wrap gap-2">
                {CATALOGO.map((c, i) => (
                  <Button key={c.nome} type="button" size="sm" variant="outline" onClick={() => addCatalogo(i)}>
                    <Plus className="h-3 w-3 mr-1" /> {c.nome}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2 w-20">Unid.</th>
                    <th className="text-right p-2 w-20">Qtd</th>
                    <th className="text-right p-2 w-32">Valor unit.</th>
                    <th className="text-right p-2 w-32">Subtotal</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {itens.length === 0 && (
                    <tr><td colSpan={6} className="p-3 text-center text-xs text-muted-foreground">Nenhum item adicionado</td></tr>
                  )}
                  {itens.map((it, i) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="p-2"><Input value={it.nome} onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></td>
                      <td className="p-2"><Input value={it.unidade} onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, unidade: e.target.value } : x))} /></td>
                      <td className="p-2"><Input type="number" className="text-right" value={it.quantidade} onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, quantidade: Number(e.target.value) } : x))} /></td>
                      <td className="p-2"><Input type="number" step="0.01" className="text-right" value={it.valorUnitario} onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, valorUnitario: Number(e.target.value) } : x))} /></td>
                      <td className="p-2 text-right font-medium">{brl((it.quantidade || 0) * (it.valorUnitario || 0))}</td>
                      <td className="p-2"><Button size="icon" variant="ghost" onClick={() => setItens(itens.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Frete (R$)</Label><Input type="number" step="0.01" value={custos.frete} onChange={(e) => setCustos({ ...custos, frete: Number(e.target.value) })} /></div>
              <div><Label>Montagem (R$)</Label><Input type="number" step="0.01" value={custos.montagem} onChange={(e) => setCustos({ ...custos, montagem: Number(e.target.value) })} /></div>
              <div><Label>Desmontagem (R$)</Label><Input type="number" step="0.01" value={custos.desmontagem} onChange={(e) => setCustos({ ...custos, desmontagem: Number(e.target.value) })} /></div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Outros custos</div>
                <Button size="sm" variant="outline" onClick={() => setCustos({ ...custos, outros: [...custos.outros, { descricao: "", valor: 0 }] })}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {custos.outros.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="Descrição" value={c.descricao} onChange={(e) => setCustos({ ...custos, outros: custos.outros.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x) })} />
                    <Input type="number" step="0.01" className="w-32 text-right" value={c.valor} onChange={(e) => setCustos({ ...custos, outros: custos.outros.map((x, j) => j === i ? { ...x, valor: Number(e.target.value) } : x) })} />
                    <Button size="icon" variant="ghost" onClick={() => setCustos({ ...custos, outros: custos.outros.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
                {custos.outros.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">Nenhum custo adicional</div>}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border divide-y divide-border">
              <Row label="Subtotal dos itens" value={brl(subtotalItens)} />
              <Row label="Total dos custos adicionais" value={brl(totalCustos)} />
              <Row label="Total final" value={brl(totalFinal)} bold />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Margem estimada (%)</Label><Input type="number" step="0.1" value={resumo.margem} onChange={(e) => setResumo({ ...resumo, margem: Number(e.target.value) })} /></div>
              <div><Label>Validade da proposta</Label><Input type="date" value={resumo.validade} onChange={(e) => setResumo({ ...resumo, validade: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Responsável pela criação</Label><Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish}>Enviar para validação</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between p-3 ${bold ? "text-base font-semibold" : "text-sm"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
