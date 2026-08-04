import { useMemo } from "react";
import { corDoSetor, fmtData, type Ordem, type Setor } from "@/lib/operacao";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function parseDate(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v);
  return isNaN(d.getTime()) ? null : startOfDay(d);
}
const DAY = 24 * 60 * 60 * 1000;

export function GanttOrdens({
  ordens,
  setores,
  onOpen,
}: {
  ordens: Ordem[];
  setores: Setor[];
  onOpen: (id: string) => void;
}) {
  const linhas = useMemo(() => {
    return ordens
      .map((o) => {
        const ini = parseDate(o.data_inicio) ?? parseDate(o.created_at);
        const fim = parseDate(o.prazo);
        return { ordem: o, ini, fim };
      })
      .filter((l) => l.ini && l.fim) as { ordem: Ordem; ini: Date; fim: Date }[];
  }, [ordens]);

  const semPrazo = useMemo(() => ordens.filter((o) => !o.prazo), [ordens]);

  const { min, max, dias } = useMemo(() => {
    const hoje = startOfDay(new Date());
    if (linhas.length === 0) return { min: hoje, max: hoje, dias: 1 };
    let mn = linhas[0].ini.getTime();
    let mx = linhas[0].fim.getTime();
    for (const l of linhas) {
      mn = Math.min(mn, l.ini.getTime());
      mx = Math.max(mx, l.fim.getTime());
    }
    mn = Math.min(mn, hoje.getTime());
    mx = Math.max(mx, hoje.getTime());
    const dias = Math.max(1, Math.round((mx - mn) / DAY) + 1);
    return { min: new Date(mn), max: new Date(mx), dias };
  }, [linhas]);

  const hojePct = ((startOfDay(new Date()).getTime() - min.getTime()) / (dias * DAY)) * 100;

  const meses = useMemo(() => {
    const out: { label: string; leftPct: number; widthPct: number }[] = [];
    const cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) {
      const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const ini = Math.max(cur.getTime(), min.getTime());
      const fim = Math.min(fimMes.getTime(), max.getTime());
      out.push({
        label: cur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        leftPct: ((ini - min.getTime()) / (dias * DAY)) * 100,
        widthPct: ((fim - ini + DAY) / (dias * DAY)) * 100,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [min, max, dias]);

  if (linhas.length === 0 && semPrazo.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhuma ordem para exibir.</div>;
  }

  return (
    <div className="space-y-4">
      {linhas.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="flex border-b bg-muted/40">
              <div className="w-[260px] shrink-0 px-3 py-2 text-xs font-medium">Ordem</div>
              <div className="relative flex-1 h-8">
                {meses.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l text-[10px] text-muted-foreground px-1 pt-2 truncate"
                    style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {linhas.map(({ ordem, ini, fim }) => {
              const left = ((ini.getTime() - min.getTime()) / (dias * DAY)) * 100;
              const width = Math.max(
                1.2,
                ((fim.getTime() - ini.getTime() + DAY) / (dias * DAY)) * 100,
              );
              const atrasada =
                fim.getTime() < startOfDay(new Date()).getTime() &&
                ordem.status !== "finalizada" &&
                ordem.status !== "cancelada";
              return (
                <div key={ordem.id} className="flex border-b last:border-b-0 hover:bg-muted/30">
                  <button
                    onClick={() => onOpen(ordem.id)}
                    className="w-[260px] shrink-0 px-3 py-2 text-left"
                  >
                    <div className="text-xs font-mono text-muted-foreground">OP-{ordem.numero}</div>
                    <div className="text-sm truncate">{ordem.titulo}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {setores.find((s) => s.id === ordem.setor_id)?.nome ?? "—"}
                    </div>
                  </button>
                  <div className="relative flex-1 h-[54px]">
                    {hojePct >= 0 && hojePct <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-primary/60"
                        style={{ left: `${hojePct}%` }}
                      />
                    )}
                    <div
                      onClick={() => onOpen(ordem.id)}
                      title={`${fmtData(ordem.data_inicio ?? ordem.created_at)} → ${fmtData(ordem.prazo)}`}
                      className={`absolute top-1/2 -translate-y-1/2 h-5 rounded cursor-pointer ${corDoSetor(
                        setores,
                        ordem.setor_id,
                      )} ${atrasada ? "ring-2 ring-destructive" : ""}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {semPrazo.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="text-sm font-medium mb-2">Sem prazo definido</div>
          <div className="flex flex-wrap gap-2">
            {semPrazo.map((o) => (
              <button
                key={o.id}
                onClick={() => onOpen(o.id)}
                className="text-xs rounded border px-2 py-1 hover:bg-accent"
              >
                OP-{o.numero} · {o.titulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
