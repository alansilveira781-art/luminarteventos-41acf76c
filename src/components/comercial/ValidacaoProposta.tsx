import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type Ambiente,
  type ItemAmbiente,
  type DescricaoItem,
  type CustoExtra,
  type Proposta,
  ambienteSubtotal,
  descricaoSubtotal,
  propostaTotal,
} from "@/lib/comercial/types";
import { updateProposta } from "@/lib/comercial/store";
import { NumberInput } from "@/components/comercial/NumberInput";
import { MoneyInput } from "@/components/MoneyInput";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposta: Proposta | null;
};

export function ValidacaoProposta({ open, onOpenChange, proposta }: Props) {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [custos, setCustos] = useState<{ frete: number; montagem: number; desmontagem: number; outros: CustoExtra[] }>({
    frete: 0, montagem: 0, desmontagem: 0, outros: [],
  });

  useEffect(() => {
    if (!open || !proposta) return;
    setAmbientes(JSON.parse(JSON.stringify(proposta.ambientes || [])));
    setCustos(JSON.parse(JSON.stringify(proposta.custos || { frete: 0, montagem: 0, desmontagem: 0, outros: [] })));
  }, [open, proposta]);

  const propostaEditada = useMemo<Proposta | null>(() => {
    if (!proposta) return null;
    return { ...proposta, ambientes, custos };
  }, [proposta, ambientes, custos]);

  const total = propostaEditada ? propostaTotal(propostaEditada) : 0;

  function patchDescricao(aIdx: number, iIdx: number, dIdx: number, patch: Partial<DescricaoItem>) {
    setAmbientes((prev) => prev.map((a, i) => {
      if (i !== aIdx) return a;
      return {
        ...a,
        itens: a.itens.map((it, j) => {
          if (j !== iIdx) return it;
          return { ...it, descricoes: it.descricoes.map((d, k) => (k === dIdx ? { ...d, ...patch } : d)) };
        }),
      };
    }));
  }

  function salvar() {
    if (!proposta) return;
    updateProposta(proposta.id, { ambientes, custos });
    toast.success("Proposta atualizada");
    onOpenChange(false);
  }

  if (!proposta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validar proposta #{proposta.numero} — {proposta.cliente.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {ambientes.map((amb, aIdx) => (
            <div key={amb.id} className="rounded-lg border border-border bg-muted/10">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="font-semibold text-sm">{amb.nome || `Ambiente ${aIdx + 1}`}</div>
                <div className="text-sm font-medium">{brl(ambienteSubtotal(amb))}</div>
              </div>
              <div className="p-3 space-y-3">
                {amb.itens.map((item: ItemAmbiente, iIdx) => (
                  <div key={item.id} className="rounded border border-border bg-card">
                    <div className="p-2 border-b border-border font-medium text-sm">
                      {item.nome || "Item"}
                    </div>
                    <div className="p-2 space-y-2">
                      {item.descricoes.map((d, dIdx) => (
                        <DescricaoValidacaoRow
                          key={d.id}
                          d={d}
                          onPatch={(patch) => patchDescricao(aIdx, iIdx, dIdx, patch)}
                        />
                      ))}
                      {item.descricoes.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          Sem descrições
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Custos */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Ajuda de custo</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Frete (R$)</Label><MoneyInput value={custos.frete} onChange={(n) => setCustos({ ...custos, frete: n })} /></div>
              <div><Label>Montagem (R$)</Label><MoneyInput value={custos.montagem} onChange={(n) => setCustos({ ...custos, montagem: n })} /></div>
              <div><Label>Desmontagem (R$)</Label><MoneyInput value={custos.desmontagem} onChange={(n) => setCustos({ ...custos, desmontagem: n })} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Outros custos</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCustos({ ...custos, outros: [...custos.outros, { descricao: "", valor: 0 }] })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {custos.outros.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Descrição"
                      value={c.descricao}
                      onChange={(e) => setCustos({ ...custos, outros: custos.outros.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x) })}
                    />
                    <MoneyInput
                      className="w-40"
                      value={c.valor}
                      onChange={(n) => setCustos({ ...custos, outros: custos.outros.map((x, j) => j === i ? { ...x, valor: n } : x) })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCustos({ ...custos, outros: custos.outros.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {custos.outros.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-2">Nenhum custo adicional</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end text-lg font-semibold">
            Total: {brl(total)}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DescricaoValidacaoRow({
  d, onPatch,
}: { d: DescricaoItem; onPatch: (p: Partial<DescricaoItem>) => void }) {
  return (
    <div className="rounded border border-border bg-muted/10 p-2">
      <div className="text-sm font-medium mb-2">{d.descricao || "—"}</div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-6 items-end">
        {(d.tipoMedida === "dimensional" || d.tipoMedida === "area") && (
          <div>
            <Label className="text-[10px]">Largura (m)</Label>
            <NumberInput className="h-8 text-sm" step="0.01" value={d.largura ?? 0} onChange={(n) => onPatch({ largura: n })} />
          </div>
        )}
        {d.tipoMedida === "dimensional" && (
          <div>
            <Label className="text-[10px]">Altura (m)</Label>
            <NumberInput className="h-8 text-sm" step="0.01" value={d.altura ?? 0} onChange={(n) => onPatch({ altura: n })} />
          </div>
        )}
        {(d.tipoMedida === "dimensional" || d.tipoMedida === "area" || d.tipoMedida === "linear") && (
          <div>
            <Label className="text-[10px]">Comprimento (m)</Label>
            <NumberInput className="h-8 text-sm" step="0.01" value={d.comprimento ?? 0} onChange={(n) => onPatch({ comprimento: n })} />
          </div>
        )}
        <div>
          <Label className="text-[10px]">Qtde</Label>
          <NumberInput className="h-8 text-sm" value={d.quantidade} onChange={(n) => onPatch({ quantidade: n })} />
        </div>
        <div>
          <Label className="text-[10px]">
            Valor un.{d.tipoMedida === "area" ? " (/m²)" : d.tipoMedida === "linear" ? " (/m)" : ""}
          </Label>
          <MoneyInput className="h-8 text-sm" value={d.valorUnitario} onChange={(n) => onPatch({ valorUnitario: n })} />
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">Subtotal</div>
          <div className="text-sm font-medium">{brl(descricaoSubtotal(d))}</div>
        </div>
      </div>
    </div>
  );
}
