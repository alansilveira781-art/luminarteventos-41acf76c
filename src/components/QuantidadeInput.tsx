import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

const DECIMAIS = 2;
const FATOR = 10 ** DECIMAIS;

type Props = {
  value: number | null | undefined;
  onChange: (value: number) => void;
  max?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

function toDigits(value: number | null | undefined): string {
  if (!value || value <= 0) return "";
  return String(Math.round(value * FATOR));
}

function format(digits: string): string {
  const padded = (digits || "0").padStart(DECIMAIS + 1, "0");
  const intPart = padded.slice(0, padded.length - DECIMAIS).replace(/^0+(?=\d)/, "");
  const decPart = padded.slice(padded.length - DECIMAIS);
  const intBR = Number(intPart).toLocaleString("pt-BR");
  return `${intBR},${decPart}`;
}

function toValue(digits: string): number {
  if (digits === "") return 0;
  return Number(digits) / FATOR;
}

export const QuantidadeInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, max = 1_000_000, onKeyDown, className, disabled }, ref) => {
    const digits = toDigits(value);
    const display = format(digits);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "Tab") {
          onKeyDown?.(e);
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          const next = digits.slice(0, -1);
          onChange(toValue(next));
          return;
        }
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          const next = (digits + e.key).replace(/^0+(?=\d)/, "");
          const v = toValue(next);
          if (v > max) return;
          onChange(v);
          return;
        }
        if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
          e.preventDefault();
          return;
        }
        onKeyDown?.(e);
      },
      [digits, max, onChange, onKeyDown]
    );

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        className={`text-right tabular-nums ${className ?? ""}`}
        value={display}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        onFocus={(e) => e.currentTarget.select()}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
          const next = (digits + pasted).replace(/^0+(?=\d)/, "");
          const v = toValue(next);
          if (v <= max) onChange(v);
        }}
      />
    );
  }
);
QuantidadeInput.displayName = "QuantidadeInput";
