import { useMemo, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear, format,
  addMonths, subMonths,
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

/** Período (início/fim) de um mês específico. */
export function periodoDoMes(ref: Date): Periodo {
  return { from: startOfMonth(ref), to: endOfMonth(ref) };
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

      {preset === "mes" && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const base = periodo.from ?? new Date();
              onChange("mes", periodoDoMes(subMonths(base, 1)));
            }}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-medium capitalize">
            {format(periodo.from ?? new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const base = periodo.from ?? new Date();
              onChange("mes", periodoDoMes(addMonths(base, 1)));
            }}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {preset === "personalizado" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="h-4 w-4 mr-1" />
              {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[95vw] p-0 overflow-hidden"
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={12}
          >
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
              numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
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

/** Converte uma Date para "AAAA-MM-DD" no fuso LOCAL (sem conversão para UTC). */
function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normaliza a data de uma linha para "AAAA-MM-DD", aceitando string ISO ou Date. */
function rowYmd(v: string | Date): string | null {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return toLocalYmd(v);
  }
  // String: pega os 10 primeiros caracteres se já estiver em ISO (AAAA-MM-DD...)
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Outros formatos (ex.: dd/MM/yyyy): tenta parsear e formata em local
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toLocalYmd(d);
}

export function filterByPeriodo<T>(rows: T[], periodo: Periodo, getDate: (row: T) => string | Date | null | undefined): T[] {
  if (!periodo.from && !periodo.to) return rows;
  // Bordas do intervalo como "AAAA-MM-DD" no fuso local
  const fromYmd = periodo.from ? toLocalYmd(periodo.from) : null;
  const toYmd = periodo.to ? toLocalYmd(periodo.to) : null;
  return rows.filter((r) => {
    const v = getDate(r);
    if (!v) return false;
    const ymd = rowYmd(v);
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  });
}
