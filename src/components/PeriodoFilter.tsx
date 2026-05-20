import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Periodo = { from: Date | null; to: Date | null };
export type PeriodoPreset = "hoje" | "semana" | "mes" | "ano" | "personalizado" | "todos";

export function periodoFromPreset(p: PeriodoPreset): Periodo {
  const now = new Date();
  switch (p) {
    case "hoje": return { from: startOfDay(now), to: endOfDay(now) };
    case "semana": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "mes": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "ano": return { from: startOfYear(now), to: endOfYear(now) };
    default: return { from: null, to: null };
  }
}

export const PERIODO_MES_DEFAULT: { preset: PeriodoPreset; periodo: Periodo } = {
  preset: "mes",
  periodo: periodoFromPreset("mes"),
};

type Props = {
  preset: PeriodoPreset;
  periodo: Periodo;
  onChange: (preset: PeriodoPreset, periodo: Periodo) => void;
  className?: string;
};

export function PeriodoFilter({ preset, periodo, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: periodo.from ?? undefined,
    to: periodo.to ?? undefined,
  });

  const label = useMemo(() => {
    if (preset !== "personalizado") return null;
    if (periodo.from && periodo.to)
      return `${format(periodo.from, "dd/MM/yy")} – ${format(periodo.to, "dd/MM/yy")}`;
    return "Selecionar";
  }, [preset, periodo]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        value={preset}
        onValueChange={(v) => {
          const next = v as PeriodoPreset;
          if (next === "personalizado") {
            onChange(next, { from: range.from ?? null, to: range.to ?? null });
            setOpen(true);
          } else {
            onChange(next, periodoFromPreset(next));
          }
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hoje">Hoje</SelectItem>
          <SelectItem value="semana">Esta semana</SelectItem>
          <SelectItem value="mes">Este mês</SelectItem>
          <SelectItem value="ano">Este ano</SelectItem>
          <SelectItem value="personalizado">Personalizado</SelectItem>
          <SelectItem value="todos">Todos</SelectItem>
        </SelectContent>
      </Select>

      {preset === "personalizado" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="h-4 w-4 mr-1" />
              {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range as any}
              onSelect={(r: any) => {
                const next = { from: r?.from, to: r?.to };
                setRange(next);
                onChange("personalizado", {
                  from: next.from ? startOfDay(next.from) : null,
                  to: next.to ? endOfDay(next.to) : null,
                });
              }}
              numberOfMonths={2}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function filterByPeriodo<T>(rows: T[], periodo: Periodo, getDate: (row: T) => string | Date | null | undefined): T[] {
  if (!periodo.from && !periodo.to) return rows;
  const fromMs = periodo.from?.getTime() ?? -Infinity;
  const toMs = periodo.to?.getTime() ?? Infinity;
  return rows.filter((r) => {
    const v = getDate(r);
    if (!v) return false;
    const t = typeof v === "string" ? new Date(v).getTime() : v.getTime();
    if (isNaN(t)) return false;
    return t >= fromMs && t <= toMs;
  });
}
