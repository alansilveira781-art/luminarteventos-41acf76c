import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/MoneyInput";
import { SelectCreatable } from "@/components/SelectCreatable";
import { Plus, Trash2 } from "lucide-react";
import {
  formatBRL,
  hojeISO,
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
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 text-xs text-muted-foreground px-1">
            <span>Forma de pagamento / cartão</span>
            <span>Parcelamento</span>
            <span>Data prevista</span>
            <span>Valor</span>
            <span>Pago</span>
            <span />
          </div>
          {pagamentos.map((p, idx) => (
            <div
              key={p.id ?? idx}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center"
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
              <Input
                type="date"
                value={p.data_pagamento ?? ""}
                readOnly={disabled}
                onChange={(e) => update(idx, { data_pagamento: e.target.value || null })}
              />
              <MoneyInput
                value={p.valor}
                onChange={(v) => update(idx, { valor: v })}
                disabled={disabled}
              />
              <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={!!p.pago}
                  disabled={disabled}
                  onChange={(e) =>
                    update(idx, {
                      pago: e.target.checked,
                      pago_em: e.target.checked ? (p.pago_em ?? hojeISO()) : null,
                    })
                  }
                />
                <span className="md:hidden">Pago</span>
                {p.pago && p.pago_em && (
                  <span className="text-muted-foreground">
                    {p.pago_em.slice(8, 10)}/{p.pago_em.slice(5, 7)}
                  </span>
                )}
              </label>
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
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Soma das formas: <span className="font-medium tabular-nums text-foreground">{formatBRL(soma)}</span>
            </div>
            <div className="text-base font-semibold tabular-nums">
              Valor total: {formatBRL(total)}
            </div>
          </div>
          {!ok && (
            <div className="mt-1 text-sm font-medium text-destructive tabular-nums">
              Diferença: {formatBRL(restante)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
