import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  decimais?: number;
  max?: number;
  min?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
};

/**
 * Input de quantidade seguro: nunca aceita notação científica, sinais,
 * múltiplos pontos ou valores acima do teto. Mantém o valor como string
 * durante a digitação (permite estados intermediários tipo "1.").
 */
export const QuantidadeInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      value,
      onChange,
      decimais = 2,
      max = 1_000_000,
      min,
      onKeyDown,
      onBlur,
      onFocus,
      className,
      placeholder,
      disabled,
      required,
      id,
      name,
    },
    ref,
  ) => {
    function sanitize(raw: string): string {
      let s = (raw ?? "").replace(/,/g, ".").replace(/[^\d.]/g, "");
      const firstDot = s.indexOf(".");
      if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
      }
      if (decimais <= 0) {
        s = s.replace(/\./g, "");
      } else if (firstDot !== -1) {
        const [intPart, decPart = ""] = s.split(".");
        s = intPart + "." + decPart.slice(0, decimais);
      }
      // remove zeros à esquerda redundantes ("007" -> "7"), mas mantém "0", "0.x" e ""
      if (/^0\d/.test(s)) s = s.replace(/^0+/, "");
      if (s !== "" && s !== ".") {
        const n = Number(s);
        if (Number.isFinite(n) && n > max) {
          return String(max);
        }
      }
      return s;
    }

    return (
      <Input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value ?? ""}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        required={required}
        onKeyDown={(e) => {
          if (["e", "E", "+", "-"].includes(e.key)) {
            e.preventDefault();
            return;
          }
          onKeyDown?.(e);
        }}
        onFocus={onFocus}
        onBlur={(e) => {
          // normaliza "1." -> "1" e respeita min se vier
          let v = value ?? "";
          if (v.endsWith(".")) v = v.slice(0, -1);
          if (v !== "" && min != null) {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0 && n < min) v = String(min);
          }
          if (v !== (value ?? "")) onChange(v);
          onBlur?.(e);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text == null) return;
          e.preventDefault();
          onChange(sanitize(text));
        }}
        onChange={(e) => onChange(sanitize(e.target.value))}
      />
    );
  },
);
QuantidadeInput.displayName = "QuantidadeInput";
