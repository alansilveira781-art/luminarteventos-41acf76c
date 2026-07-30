import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/MoneyInput";
import { SelectCreatable } from "@/components/SelectCreatable";
import { Plus, Trash2 } from "lucide-react";
import {
  formatBRL,
  pagamentosBatem,
  somaPagamentos,
  type PagamentoLinha,
} from "@/lib/pagamentos";

/**
 * Grade de formas de pagamento: permite dividir a compra/despesa em vários
 * cartões, cada um com seu parcelamento e valor.
 */
export function PagamentosGrid({
  pagamentos,
  onChange,
  total,
  disabled,
}: {
  pagamentos: PagamentoLinha[];
  onChange: (rows: PagamentoLinha[]) => void;
  total: number;
  disabled?: boolean;
}) {
  const soma = somaPagamentos(pagamentos);
  const restante = Number(total || 0) - soma;
  const ok = pagamentosBatem(pagamentos, total);

  const update = (idx: number, patch: Partial<PagamentoLinha>) =>
    onChange(pagamentos.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const add = () =>
    onChange([
      ...pagamentos,
      { forma: null, parcelamento: null, valor: Math.max(restante, 0) },
    ]);

  const remove = (idx: number) => onChange(pagamentos.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Formas de pagamento</span>
        {!disabled && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar forma
          </Button>
        )}
      </div>

      {pagamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma forma de pagamento informada.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] gap-2 text-xs text-muted-foreground px-1">
            <span>Forma de pagamento / cartão</span>
            <span>Parcelamento</span>
            <span>Valor</span>
            <span />
          </div>
          {pagamentos.map((p, idx) => (
            <div
              key={p.id ?? idx}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] gap-2 items-center"
            >
              {disabled ? (
                <Input value={p.forma ?? ""} readOnly />
              ) : (
                <SelectCreatable
                  table="condicoes_pagamento"
                  value={p.forma}
                  onChange={(v) => update(idx, { forma: v })}
                  placeholder="Cartão / forma…"
                />
              )}
              {disabled ? (
                <Input value={p.parcelamento ?? ""} readOnly />
              ) : (
                <SelectCreatable
                  table="parcelamentos"
                  value={p.parcelamento}
                  onChange={(v) => update(idx, { parcelamento: v })}
                  placeholder="Parcelas…"
                />
              )}
              <MoneyInput
                value={p.valor}
                onChange={(v) => update(idx, { valor: v })}
                disabled={disabled}
              />
              {disabled ? (
                <span />
              ) : (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="Usar valor restante"
                    onClick={() => update(idx, { valor: Number(p.valor || 0) + restante })}
                  >
                    ={formatBRL(Math.max(restante, 0)).replace("R$", "").trim()}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(idx)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pagamentos.length > 0 && (
        <div
          className={`text-sm tabular-nums ${ok ? "text-muted-foreground" : "text-destructive font-medium"}`}
        >
          Soma das formas: {formatBRL(soma)} · Valor total: {formatBRL(total)}
          {!ok && ` · Diferença: ${formatBRL(restante)}`}
        </div>
      )}
    </div>
  );
}
