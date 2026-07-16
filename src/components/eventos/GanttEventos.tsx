import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays, addMonths, addYears, subMonths, subYears, subDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, differenceInMilliseconds, isWeekend, eachDayOfInterval, eachMonthOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type EventoCal = {
  id: string;
  codigo: string | null;
  codigo_evento?: string | null;
  nome: string;
  local: string | null;
  cidade?: string | null;
  tipo: string | null;
  data_evento: string;
  data_evento_fim?: string | null;
  data_montagem: string | null;
  data_montagem_fim?: string | null;
  data_desmontagem: string | null;
  data_desmontagem_fim?: string | null;
  produtor?: string | null;
  observacoes?: string | null;
  cor: string | null;
  situacao?: string | null;
  hora_montagem?: string | null;
  hora_desmontagem?: string | null;
};

type Modo = "semanal" | "mensal" | "anual";

const COR_MONTAGEM = "#EF9F27";
const COR_EVENTO = "#378ADD";
const COR_DESMONTAGEM = "#888780";

function parseDay(iso: string): Date {
  const d = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, dd ?? 1);
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function situacaoStyle(s?: string | null): string {
  const v = (s ?? "").toLowerCase();
  if (v.startsWith("aprov") && !v.includes("em ")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30";
  if (v.includes("em apro")) return "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30";
  if (v.includes("reserv")) return "bg-slate-400/20 text-slate-700 dark:text-slate-200 border border-slate-400/30";
  return "bg-muted text-muted-foreground border border-border";
}

export function GanttEventos({
  eventos,
  onSelectEvento,
  readOnly = false,
  modoInicial = "mensal",
}: {
  eventos: EventoCal[];
  onSelectEvento?: (e: EventoCal) => void;
  readOnly?: boolean;
  modoInicial?: Modo;
}) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [ref, setRef] = useState<Date>(() => new Date());

  const { inicio, fim, ticks, tickLabel } = useMemo(() => {
    if (modo === "semanal") {
      const ini = startOfWeek(ref, { weekStartsOn: 0 });
      const f = endOfDay(endOfWeek(ref, { weekStartsOn: 0 }));
      const dias = eachDayOfInterval({ start: ini, end: f });
      return {
        inicio: ini,
        fim: f,
        ticks: dias,
        tickLabel: (d: Date) => format(d, "EEE d", { locale: ptBR }),
      };
    }
    if (modo === "mensal") {
      const ini = startOfMonth(ref);
      const f = endOfDay(endOfMonth(ref));
      const dias = eachDayOfInterval({ start: ini, end: f });
      // marcar ~a cada 3-4 dias
      const step = Math.max(1, Math.round(dias.length / 8));
      const t = dias.filter((_, i) => i % step === 0);
      return {
        inicio: ini,
        fim: f,
        ticks: t,
        tickLabel: (d: Date) => format(d, "d/MM"),
      };
    }
    const ini = startOfYear(ref);
    const f = endOfDay(endOfYear(ref));
    const meses = eachMonthOfInterval({ start: ini, end: f });
    return {
      inicio: ini,
      fim: f,
      ticks: meses,
      tickLabel: (d: Date) => format(d, "MMM", { locale: ptBR }),
    };
  }, [modo, ref]);

  const totalMs = differenceInMilliseconds(fim, inicio) || 1;

  const eventosOrdenados = useMemo(() => {
    return [...eventos]
      .filter((e) => {
        // manter apenas eventos com algum overlap na janela
        const starts: (string | null | undefined)[] = [e.data_montagem, e.data_evento, e.data_desmontagem];
        const ends: (string | null | undefined)[] = [
          e.data_montagem_fim ?? e.data_montagem,
          e.data_evento_fim ?? e.data_evento,
          e.data_desmontagem_fim ?? e.data_desmontagem,
        ];
        const s = starts.filter(Boolean).map((x) => parseDay(x as string));
        const en = ends.filter(Boolean).map((x) => endOfDay(parseDay(x as string)));
        if (s.length === 0) return false;
        const eStart = new Date(Math.min(...s.map((d) => d.getTime())));
        const eEnd = new Date(Math.max(...en.map((d) => d.getTime())));
        return eEnd >= inicio && eStart <= fim;
      })
      .sort((a, b) => (a.data_evento || "").localeCompare(b.data_evento || ""));
  }, [eventos, inicio, fim]);

  const navPrev = () => {
    if (modo === "semanal") setRef(subDays(ref, 7));
    else if (modo === "mensal") setRef(subMonths(ref, 1));
    else setRef(subYears(ref, 1));
  };
  const navNext = () => {
    if (modo === "semanal") setRef(addDays(ref, 7));
    else if (modo === "mensal") setRef(addMonths(ref, 1));
    else setRef(addYears(ref, 1));
  };

  const titulo = useMemo(() => {
    if (modo === "semanal") {
      const ini = startOfWeek(ref, { weekStartsOn: 0 });
      const f = endOfWeek(ref, { weekStartsOn: 0 });
      return `${format(ini, "d MMM", { locale: ptBR })} — ${format(f, "d MMM yyyy", { locale: ptBR })}`;
    }
    if (modo === "mensal") return format(ref, "MMMM 'de' yyyy", { locale: ptBR });
    return format(ref, "yyyy");
  }, [modo, ref]);

  // divisórias verticais
  const divisores = useMemo(() => {
    if (modo === "anual") {
      const meses = eachMonthOfInterval({ start: inicio, end: fim });
      return meses.map((d) => ({
        pct: ((d.getTime() - inicio.getTime()) / totalMs) * 100,
        strong: true,
      }));
    }
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    return dias.map((d) => ({
      pct: ((d.getTime() - inicio.getTime()) / totalMs) * 100,
      strong: isWeekend(d),
    }));
  }, [modo, inicio, fim, totalMs]);

  const nowPct = useMemo(() => {
    const t = Date.now();
    if (t < inicio.getTime() || t > fim.getTime()) return null;
    return ((t - inicio.getTime()) / totalMs) * 100;
  }, [inicio, fim, totalMs]);

  const LEFT_COL = 280;
  const rowHeight = 64;

  return (
    <div className="space-y-3">
      {/* Header controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border overflow-hidden">
          {(["semanal", "mensal", "anual"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`px-3 py-1.5 text-sm capitalize ${modo === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base sm:text-lg font-semibold capitalize min-w-[220px] text-center">
            {titulo}
          </div>
          <Button variant="outline" size="icon" onClick={navNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRef(new Date())}>Hoje</Button>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: COR_MONTAGEM }} /> Montagem</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: COR_EVENTO }} /> Evento</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: COR_DESMONTAGEM }} /> Desmontagem</span>
        </div>
      </div>

      {/* Gantt */}
      <div className="border rounded-lg overflow-x-auto bg-background">
        <div className="min-w-[970px]">
          {/* Eixo tempo */}
          <div className="flex sticky top-0 z-10 bg-muted/50 border-b">
            <div
              className="shrink-0 border-r bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              style={{ width: LEFT_COL }}
            >
              Evento
            </div>
            <div className="relative flex-1 h-9">
              {ticks.map((t, i) => {
                const pct = ((t.getTime() - inicio.getTime()) / totalMs) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center text-[11px] text-muted-foreground font-medium capitalize"
                    style={{ left: `${pct}%`, transform: "translateX(2px)" }}
                  >
                    {tickLabel(t)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linhas */}
          {eventosOrdenados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum evento no período selecionado.
            </div>
          ) : (
            eventosOrdenados.map((ev) => (
              <div
                key={ev.id}
                className="flex border-b hover:bg-muted/30 cursor-pointer"
                style={{ height: rowHeight }}
                onClick={() => onSelectEvento?.(ev)}
              >
                {/* Coluna fixa */}
                <div
                  className="shrink-0 border-r px-3 py-1.5 flex flex-col justify-center gap-0.5 bg-background"
                  style={{ width: LEFT_COL }}
                >
                  <div className="text-sm font-semibold truncate" title={ev.nome}>
                    {ev.codigo_evento ?? ev.nome}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ev.situacao && (
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${situacaoStyle(ev.situacao)}`}>
                        {ev.situacao}
                      </span>
                    )}
                    {ev.produtor && (
                      <span className="text-[10px] text-muted-foreground truncate" title={ev.produtor}>
                        {ev.produtor}
                      </span>
                    )}
                  </div>
                </div>

                {/* Track */}
                <div className="relative flex-1">
                  {/* divisórias */}
                  {divisores.map((d, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 border-l ${d.strong ? "border-border/70" : "border-border/20"}`}
                      style={{ left: `${d.pct}%` }}
                    />
                  ))}

                  {/* linha "agora" */}
                  {nowPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500/70 z-10"
                      style={{ left: `${nowPct}%` }}
                    />
                  )}

                  {/* Barras */}
                  <Barra
                    from={ev.data_montagem}
                    to={ev.data_montagem_fim ?? ev.data_montagem}
                    inicio={inicio}
                    fim={fim}
                    totalMs={totalMs}
                    color={COR_MONTAGEM}
                    label="Montagem"
                    hora={ev.hora_montagem}
                    horaPos="start"
                    top={6}
                  />
                  <Barra
                    from={ev.data_evento}
                    to={ev.data_evento_fim ?? ev.data_evento}
                    inicio={inicio}
                    fim={fim}
                    totalMs={totalMs}
                    color={COR_EVENTO}
                    label="Evento"
                    top={22}
                  />
                  <Barra
                    from={ev.data_desmontagem}
                    to={ev.data_desmontagem_fim ?? ev.data_desmontagem}
                    inicio={inicio}
                    fim={fim}
                    totalMs={totalMs}
                    color={COR_DESMONTAGEM}
                    label="Desmontagem"
                    hora={ev.hora_desmontagem}
                    horaPos="end"
                    top={38}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Barra({
  from, to, inicio, fim, totalMs, color, label, hora, horaPos, top,
}: {
  from: string | null | undefined;
  to: string | null | undefined;
  inicio: Date;
  fim: Date;
  totalMs: number;
  color: string;
  label: string;
  hora?: string | null;
  horaPos?: "start" | "end";
  top: number;
}) {
  if (!from) return null;
  const s0 = parseDay(from);
  const e0 = endOfDay(parseDay(to ?? from));
  if (e0 < inicio || s0 > fim) return null;
  const s = s0 < inicio ? inicio : s0;
  const e = e0 > fim ? fim : e0;
  const left = ((s.getTime() - inicio.getTime()) / totalMs) * 100;
  const width = Math.max(0.15, ((e.getTime() - s.getTime()) / totalMs) * 100);
  const clippedLeft = s0 < inicio;
  const clippedRight = e0 > fim;

  return (
    <div
      className="absolute h-3.5 rounded-sm flex items-center px-1 overflow-visible"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: 2,
        top,
        background: color,
        opacity: 0.92,
        borderTopLeftRadius: clippedLeft ? 0 : undefined,
        borderBottomLeftRadius: clippedLeft ? 0 : undefined,
        borderTopRightRadius: clippedRight ? 0 : undefined,
        borderBottomRightRadius: clippedRight ? 0 : undefined,
      }}
      title={`${label}: ${format(s0, "dd/MM")} → ${format(e0, "dd/MM")}${hora ? ` (${hora})` : ""}`}
    >
      {hora && horaPos === "start" && (
        <span className="absolute right-full mr-1 text-[10px] font-semibold text-foreground/80 whitespace-nowrap">
          {hora}
        </span>
      )}
      {hora && horaPos === "end" && (
        <span className="absolute left-full ml-1 text-[10px] font-semibold text-foreground/80 whitespace-nowrap">
          {hora}
        </span>
      )}
    </div>
  );
}
