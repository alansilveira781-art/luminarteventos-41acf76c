import { useEventosInfo, acharEvento, formatBRDate, type EventoInfo } from "@/lib/eventos-info";
import { CalendarDays, MapPin, User } from "lucide-react";

/**
 * Seção "Evento" — só aparece quando um evento/projeto foi informado
 * e foi possível localizá-lo no calendário ou na planilha.
 */
export function EventoInfoCard({ eventos: codigos }: { eventos: string[] }) {
  const { eventos } = useEventosInfo();
  const unicos = Array.from(new Set(codigos.map((c) => (c ?? "").trim()).filter(Boolean)));
  if (unicos.length === 0) return null;

  const encontrados = unicos
    .map((c) => ({ codigo: c, evento: acharEvento(eventos, c) }))
    .filter((x) => !!x.evento) as { codigo: string; evento: EventoInfo }[];

  if (encontrados.length === 0) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
        Evento
      </div>
      {encontrados.map(({ codigo, evento }) => (
        <div key={codigo} className="space-y-1.5">
          <div className="text-sm font-medium text-foreground">{evento.id}</div>
          {evento.nome && evento.nome !== evento.id && (
            <div className="text-xs text-muted-foreground">{evento.nome}</div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {formatBRDate(evento.dataInicio) || "—"}
              {formatBRDate(evento.dataFim) && formatBRDate(evento.dataFim) !== formatBRDate(evento.dataInicio)
                ? ` → ${formatBRDate(evento.dataFim)}`
                : ""}
            </span>
            {(evento.local || evento.uf) && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {[evento.local, evento.uf].filter(Boolean).join(" · ")}
              </span>
            )}
            {evento.produtor && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {evento.produtor}
              </span>
            )}
          </div>
          {(evento.montagemInicio || evento.desmontagemInicio) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {evento.montagemInicio && (
                <span>
                  Montagem: {formatBRDate(evento.montagemInicio)}
                  {formatBRDate(evento.montagemFim) ? ` → ${formatBRDate(evento.montagemFim)}` : ""}
                </span>
              )}
              {evento.desmontagemInicio && (
                <span>
                  Desmontagem: {formatBRDate(evento.desmontagemInicio)}
                  {formatBRDate(evento.desmontagemFim) ? ` → ${formatBRDate(evento.desmontagemFim)}` : ""}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
