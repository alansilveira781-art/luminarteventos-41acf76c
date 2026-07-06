import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Corrida = {
  id: string;
  data_solicitacao: string;
  hora_solicitacao: string | null;
  nome: string | null;
  sobrenome: string | null;
  servico: string | null;
  cidade: string | null;
  endereco_partida: string | null;
  endereco_destino: string | null;
  valor: number;
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtN = (n: number) => n.toLocaleString("pt-BR");

export function UberDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["uber-corridas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uber_corridas")
        .select("id, data_solicitacao, hora_solicitacao, nome, sobrenome, servico, cidade, endereco_partida, endereco_destino, valor")
        .order("data_solicitacao", { ascending: false })
        .limit(50000);
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, valor: Number(r.valor) })) as Corrida[];
    },
    staleTime: 30 * 1000,
  });

  const trips = data ?? [];

  const kpis = useMemo(() => {
    const total = trips.reduce((s, t) => s + (t.valor ?? 0), 0);
    const count = trips.length;
    const ticket = count ? total / count : 0;
    return { total, count, ticket };
  }, [trips]);

  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    trips.forEach((t) => {
      const k = t.data_solicitacao.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + (t.valor ?? 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }));
  }, [trips]);

  const porServico = useMemo(() => {
    const map = new Map<string, number>();
    trips.forEach((t) => {
      const k = (t.servico || "—").trim();
      map.set(k, (map.get(k) ?? 0) + (t.valor ?? 0));
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor);
  }, [trips]);

  const topPessoas = useMemo(() => {
    const map = new Map<string, { nome: string; viagens: number; total: number }>();
    trips.forEach((t) => {
      const nome = [t.nome, t.sobrenome].filter(Boolean).join(" ").trim() || "—";
      const cur = map.get(nome) ?? { nome, viagens: 0, total: 0 };
      cur.viagens += 1;
      cur.total += t.valor ?? 0;
      map.set(nome, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [trips]);

  const solicitantesUnicos = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      const nome = [t.nome, t.sobrenome].filter(Boolean).join(" ").trim();
      if (nome) set.add(nome);
    });
    return set.size;
  }, [trips]);

  const enderecos = useMemo(() => {
    const map = new Map<string, number>();
    trips.forEach((t) => {
      [t.endereco_partida, t.endereco_destino].forEach((a) => {
        if (!a) return;
        const k = a.trim().toLowerCase();
        map.set(k, (map.get(k) ?? 0) + 1);
      });
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(map.entries())
      .map(([endereco, count]) => ({ endereco, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [trips]);

  // Mês atual = mês mais recente presente na base; anterior = mês imediatamente anterior a esse
  const comparacoes = useMemo(() => {
    if (!trips.length) return null;
    const meses = Array.from(new Set(trips.map((t) => t.data_solicitacao.slice(0, 7)))).sort();
    const ymCur = meses[meses.length - 1];
    const [y, m] = ymCur.split("-").map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const ymPrev = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const hasPrev = trips.some((t) => t.data_solicitacao.startsWith(ymPrev));

    const sumBy = (pref: string) =>
      trips.filter((t) => t.data_solicitacao.startsWith(pref)).reduce((s, t) => s + (t.valor ?? 0), 0);

    const yCur = String(y);
    const yPrev = String(y - 1);
    const hasYearPrev = trips.some((t) => t.data_solicitacao.startsWith(yPrev));

    return {
      mesLabel: ymCur,
      mesPrevLabel: hasPrev ? ymPrev : null,
      mesAtual: sumBy(ymCur),
      mesAnterior: hasPrev ? sumBy(ymPrev) : null,
      anoAtual: sumBy(yCur),
      anoAnterior: hasYearPrev ? sumBy(yPrev) : null,
    };
  }, [trips]);

  if (isLoading) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        Carregando corridas...
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-sm font-semibold mb-2 text-destructive">Erro ao carregar corridas</div>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </Card>
    );
  }

  if (!trips.length) {
    return (
      <Card className="p-12 text-center">
        <div className="text-sm font-semibold mb-1">Sem corridas na base</div>
        <p className="text-sm text-muted-foreground">
          Importe uma planilha da Uber Business na aba <strong>Uber</strong> do menu Financeiro.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gasto total" value={fmt(kpis.total)} />
        <Stat label="Nº de corridas" value={fmtN(kpis.count)} />
        <Stat label="Ticket médio" value={fmt(kpis.ticket)} />
        <Stat label="Solicitantes únicos" value={fmtN(solicitantesUnicos)} />
      </div>

      {comparacoes && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CompareCard
            label={`Mês ${comparacoes.mesLabel}${comparacoes.mesPrevLabel ? ` vs ${comparacoes.mesPrevLabel}` : ""}`}
            cur={comparacoes.mesAtual}
            prev={comparacoes.mesAnterior}
          />
          <CompareCard label="Ano atual vs anterior" cur={comparacoes.anoAtual} prev={comparacoes.anoAnterior} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Gasto mensal (R$)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Bar dataKey="valor" fill="#0f172a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gasto por serviço">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porServico} dataKey="valor" nameKey="nome" outerRadius={90} label>
                {porServico.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Top solicitantes</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Nome</th>
                  <th className="text-right py-2">Viagens</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-right py-2">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {topPessoas.map((s) => (
                  <tr key={s.nome} className="border-b last:border-0">
                    <td className="py-2">{s.nome}</td>
                    <td className="text-right">{s.viagens}</td>
                    <td className="text-right">{fmt(s.total)}</td>
                    <td className="text-right">{fmt(s.total / s.viagens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Endereços recorrentes</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Endereço</th>
                  <th className="text-right py-2">Vezes</th>
                  <th className="text-right py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {enderecos.map((e) => (
                  <tr key={e.endereco} className="border-b last:border-0">
                    <td className="py-2 max-w-md truncate" title={e.endereco}>{e.endereco}</td>
                    <td className="text-right">{e.count}</td>
                    <td className="text-right">{e.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function CompareCard({ label, cur, prev }: { label: string; cur: number; prev: number | null }) {
  const hasPrev = prev !== null && prev > 0;
  const delta = hasPrev ? ((cur - (prev as number)) / (prev as number)) * 100 : null;
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{fmt(cur)}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {prev === null ? (
          <>Sem período anterior na base — <span>—</span></>
        ) : (
          <>
            Anterior: {fmt(prev)} •{" "}
            {delta === null ? (
              <span>—</span>
            ) : (
              <span className={up ? "text-emerald-600" : "text-red-600"}>
                {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </Card>
  );
}
