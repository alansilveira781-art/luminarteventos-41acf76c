import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (value: number) => void;
  /** Se true, deixa de mostrar o prefixo R$ dentro do input. */
  hidePrefix?: boolean;
  /** Número de casas decimais (2 ou 4). Default: 2. */
  decimals?: 2 | 4;
};

function makeFormatter(decimals: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function centsToText(units: number, decimals: number): string {
  return makeFormatter(decimals).format(units / Math.pow(10, decimals));
}

function digitsToUnits(digits: string): number {
  if (!digits) return 0;
  const trimmed = digits.replace(/^0+/, "") || "0";
  return Number(trimmed);
}

function valueToUnits(value: number | null | undefined, decimals: number): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(Number(value) * Math.pow(10, decimals));
}

/**
 * Input monetário em R$ no formato "cents-as-you-type":
 * o usuário digita apenas dígitos e a vírgula fica fixa nas últimas casas.
 *
 * Ex.: digitar 12345 → exibe "123,45" → onChange(123.45).
 */
export function MoneyInput({
  value,
  onChange,
  hidePrefix,
  decimals = 2,
  className,
  onPaste,
  onKeyDown,
  ...rest
}: Props) {
  const [digits, setDigits] = useState<string>(() => String(valueToUnits(value, decimals)));
  const focused = useRef(false);

  // Mantém em sincronia quando o valor externo muda e o input não está focado.
  useEffect(() => {
    if (focused.current) return;
    const external = String(valueToUnits(value, decimals));
    if (external !== digits) setDigits(external);
  }, [value, decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (nextDigits: string) => {
    setDigits(nextDigits);
    onChange(digitsToUnits(nextDigits) / Math.pow(10, decimals));
  };

  function hasSelection(el: HTMLInputElement) {
    return el.selectionStart != null && el.selectionEnd != null && el.selectionStart !== el.selectionEnd;
  }

  return (
    <div className="relative">
      {!hidePrefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
      )}
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        {...rest}
        className={cn(hidePrefix ? "text-right tabular-nums" : "pl-9 text-right tabular-nums", className)}
        value={centsToText(digitsToUnits(digits), decimals)}
        onFocus={(e) => {
          focused.current = true;
          // Seleciona tudo no foco para permitir substituir digitando.
          requestAnimationFrame(() => {
            const el = e.target as HTMLInputElement;
            el.select();
          });
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          rest.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          const k = e.key;
          if (k === "Tab" || k === "Enter" || k.startsWith("Arrow") || k === "Home" || k === "End") return;

          const el = e.target as HTMLInputElement;
          const selected = hasSelection(el);

          if (k === "Backspace" || k === "Delete") {
            e.preventDefault();
            if (selected) {
              emit("");
            } else {
              emit(digits.slice(0, -1));
            }
            return;
          }

          if (/^[0-9]$/.test(k)) {
            e.preventDefault();
            if (selected) {
              // Substitui o valor pelo dígito apertado.
              emit(k);
              return;
            }
            if (digits.length >= 15) return;
            const next = (digits === "0" ? "" : digits) + k;
            emit(next);
            return;
          }

          if (k.length === 1) e.preventDefault();
        }}
        onPaste={(e) => {
          onPaste?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          const text = e.clipboardData.getData("text").trim();
          if (!text) return;
          const cleaned = text.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
          const num = Number(cleaned);
          if (!Number.isFinite(num)) return;
          emit(String(Math.max(0, Math.round(num * Math.pow(10, decimals)))));
        }}
        onChange={() => {
          // controlado via onKeyDown/onPaste
        }}
      />
    </div>
  );
}
