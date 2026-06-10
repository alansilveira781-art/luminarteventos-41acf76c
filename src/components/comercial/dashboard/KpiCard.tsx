import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

const brl = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi`
    : v >= 1_000
    ? `R$ ${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mil`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const num = (v: number) => v.toLocaleString("pt-BR");

export function KpiCard({
  titulo,
  valor,
  Icon,
  isMoney = true,
  anterior,
  pct,
  pctLabel = "% LY",
  anteriorLabel = "Período Anterior",
}: {
  titulo: string;
  valor: number;
  Icon: LucideIcon;
  isMoney?: boolean;
  anterior?: number;
  pct?: number;
  pctLabel?: string;
  anteriorLabel?: string;
}) {
  const fmt = (v: number) => (isMoney ? brl(v) : num(v));
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold italic text-foreground/80">{titulo}</div>
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-foreground/80">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{fmt(valor)}</div>
      {anterior !== undefined && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-6 text-xs">
          <div>
            <div className="text-muted-foreground">{anteriorLabel}</div>
            <div className="font-medium text-foreground">{fmt(anterior)}</div>
          </div>
          {pct !== undefined && (
            <div>
              <div className="text-muted-foreground">{pctLabel}</div>
              <div className={`font-medium ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
