import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/MoneyInput";
import { SelectCreatable } from "@/components/SelectCreatable";
import { Plus, Trash2 } from "lucide-react";
import {
  exigeControleParcelas,
  formatBRL,
  hojeISO,
  pagamentosBatem,
  sincronizarParcelas,
  somaPagamentos,
  somaParcelas,
  type PagamentoLinha,
  type ParcelaLinha,
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
    onChange(
      pagamentos.map((p, i) => {
        if (i !== idx) return p;
        return sincronizarParcelas({ ...p, ...patch });
      }),
    );

  const updateParcela = (idx: number, pIdx: number, patch: Partial<ParcelaLinha>) =>
    onChange(
      pagamentos.map((p, i) => {
        if (i !== idx) return p;
        const parcelas = (p.parcelas ?? []).map((x, j) =>
          j === pIdx ? { ...x, ...patch } : x,
        );
        const next = { ...p, parcelas };
        next.valor = somaParcelas(next);
        return next;
      }),
    );

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
        <div className="space-y-3">
          {pagamentos.map((p, idx) => {
            const exigeParcelas = exigeControleParcelas(p);
            return (
            <div
              key={p.id ?? idx}
              className="rounded-lg border border-border bg-card p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Forma {idx + 1}
                </span>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    {Math.abs(restante) > 0.005 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update(idx, { valor: Number(p.valor || 0) + restante })
                        }
                      >
                        Usar restante ({formatBRL(restante)})
                      </Button>
                    )}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground">
                    Forma de pagamento / cartão
                  </label>
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
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Parcelamento</label>
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
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {exigeParcelas ? "Valor (soma das parcelas)" : "Valor"}
                  </label>
                  <MoneyInput
                    value={p.valor}
                    onChange={(v) => update(idx, { valor: v })}
                    disabled={disabled || exigeParcelas}
                  />
                </div>
              </div>

              {exigeParcelas && (
                <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Parcelas ({(p.parcelas ?? []).length})
                  </div>
                  {(p.parcelas ?? []).map((parc, pIdx) => (
                    <div
                      key={pIdx}
                      className="rounded-md border border-border bg-card p-2 space-y-2"
                    >
                      <div className="text-xs font-medium text-foreground">
                        Parcela {pIdx + 1}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Data prevista *
                          </label>
                          <Input
                            type="date"
                            className={
                              !(parc.data_pagamento ?? "").trim()
                                ? "border-destructive"
                                : undefined
                            }
                            value={parc.data_pagamento ?? ""}
                            readOnly={disabled}
                            onChange={(e) =>
                              updateParcela(idx, pIdx, {
                                data_pagamento: e.target.value || null,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Valor *</label>
                          <MoneyInput
                            value={parc.valor}
                            onChange={(v) => updateParcela(idx, pIdx, { valor: v })}
                            disabled={disabled}
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs text-muted-foreground">Situação *</label>
                          <div
                            className={`flex gap-2 ${
                              parc.pago === undefined || parc.pago === null
                                ? "rounded-md border border-destructive p-1"
                                : ""
                            }`}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant={parc.pago === true ? "default" : "outline"}
                              disabled={disabled}
                              onClick={() =>
                                updateParcela(idx, pIdx, {
                                  pago: true,
                                  pago_em: parc.pago_em ?? hojeISO(),
                                })
                              }
                            >
                              Pago
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={parc.pago === false ? "default" : "outline"}
                              disabled={disabled}
                              onClick={() =>
                                updateParcela(idx, pIdx, { pago: false, pago_em: null })
                              }
                            >
                              Em aberto
                            </Button>
                            {parc.pago && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">em</span>
                                <Input
                                  type="date"
                                  className="h-9 w-[150px]"
                                  disabled={disabled}
                                  value={parc.pago_em ?? ""}
                                  onChange={(e) =>
                                    updateParcela(idx, pIdx, {
                                      pago_em: e.target.value || null,
                                    })
                                  }
                                />
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
            );
          })}
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
