import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { Target } from "lucide-react";

const brl = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function GaugeRealVsMeta({ valor, meta }: { valor: number; meta: number }) {
  const semMeta = !(meta > 0);
  const pct = semMeta ? 0 : Math.max(0, Math.min(100, (valor / meta) * 100));
  const data = [{ name: "real", value: pct, fill: "hsl(var(--primary))" }];

  return (
    <Card className="p-4 flex flex-col">
      <div className="text-sm font-medium text-foreground/80 mb-2">Real. VS Meta</div>
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={18}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-end justify-center pb-4">
          <div className="text-center">
            <div className="text-lg font-semibold">{brl(valor)}</div>
            <div className="text-xs text-muted-foreground">
              {semMeta ? "Realizado no período" : `${pct.toFixed(1)}% da meta`}
            </div>
          </div>
        </div>
      </div>
      {semMeta ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Nenhuma meta cadastrada para o período</span>
          <Link
            to="/comercial/metas"
            className="inline-flex items-center gap-1 text-primary hover:underline whitespace-nowrap"
          >
            <Target className="h-3 w-3" /> Cadastrar metas
          </Link>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>R$ 0</span>
          <span>{brl(meta)}</span>
        </div>
      )}
    </Card>
  );
}
