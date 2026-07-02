import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  format, isSameMonth, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type EventoCal = {
  id: string;
  codigo: string | null;
  nome: string;
  local: string | null;
  tipo: string | null;
  data_evento: string;
  data_montagem: string | null;
  data_desmontagem: string | null;
  cor: string | null;
};

type Fase = "montagem" | "evento" | "desmontagem";

const faseLabel: Record<Fase, string> = {
  montagem: "Montagem",
  evento: "Evento",
  desmontagem: "Desmontagem",
};

const faseStyle: Record<Fase, string> = {
  montagem: "border-l-2 border-amber-500 bg-amber-500/10",
  evento: "border-l-2 border-primary bg-primary/10",
  desmontagem: "border-l-2 border-slate-400 bg-slate-400/10",
};

export function CalendarioEventos({
  eventos,
  onSelectEvento,
  readOnly = false,
}: {
  eventos: EventoCal[];
  onSelectEvento?: (e: EventoCal) => void;
  readOnly?: boolean;
}) {
  const [mesRef, setMesRef] = useState(() => new Date());

  const dias = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mesRef), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesRef), { weekStartsOn: 0 });
    const arr: Date[] = [];
    let d = ini;
    while (d <= fim) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [mesRef]);

  const porDia = useMemo(() => {
    const map = new Map<string, { ev: EventoCal; fase: Fase }[]>();
    const push = (iso: string | null, ev: EventoCal, fase: Fase) => {
      if (!iso) return;
      const key = iso.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push({ ev, fase });
      map.set(key, arr);
    };
    for (const ev of eventos) {
      push(ev.data_montagem, ev, "montagem");
      push(ev.data_evento, ev, "evento");
      push(ev.data_desmontagem, ev, "desmontagem");
    }
    return map;
  }, [eventos]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setMesRef(subMonths(mesRef, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold capitalize">
          {format(mesRef, "MMMM 'de' yyyy", { locale: ptBR })}
        </div>
        <Button variant="outline" size="icon" onClick={() => setMesRef(addMonths(mesRef, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="bg-muted text-center text-xs font-medium py-2 text-muted-foreground">
            {d}
          </div>
        ))}
        {dias.map((dia) => {
          const key = format(dia, "yyyy-MM-dd");
          const doMes = isSameMonth(dia, mesRef);
          const hoje = isSameDay(dia, new Date());
          const itens = porDia.get(key) ?? [];
          return (
            <div
              key={key}
              className={`bg-background min-h-[110px] p-1 flex flex-col gap-1 ${doMes ? "" : "opacity-40"}`}
            >
              <div className={`text-xs font-medium ${hoje ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {format(dia, "d")}
              </div>
              <div className="flex-1 space-y-0.5">
                {itens.slice(0, 4).map((it, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => !readOnly && onSelectEvento?.(it.ev)}
                    className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate ${faseStyle[it.fase]} ${readOnly ? "cursor-default" : "hover:opacity-80"}`}
                    title={`${it.ev.nome} — ${faseLabel[it.fase]}${it.ev.local ? ` (${it.ev.local})` : ""}`}
                  >
                    {faseLabel[it.fase].slice(0, 3)}: {it.ev.nome}
                  </button>
                ))}
                {itens.length > 4 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{itens.length - 4} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/40 border-l-2 border-amber-500" /> Montagem</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-primary/40 border-l-2 border-primary" /> Evento</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-slate-400/40 border-l-2 border-slate-400" /> Desmontagem</span>
      </div>
    </div>
  );
}
