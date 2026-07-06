import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { fetchAllRows } from "@/lib/fetch-all";

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
  projeto: string | null;
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtN = (n: number) => n.toLocaleString("pt-BR");

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function mesLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  return `${MESES_PT[m - 1]}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(offsetMonths = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

function firstOfYearIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export function UberDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["uber-corridas-all"],
    queryFn: async () => {
      const rows = await fetchAllRows<Corrida>(
        "uber_corridas",
        "id, data_solicitacao, hora_solicitacao, nome, sobrenome, servico, cidade, endereco_partida, endereco_destino, valor, projeto",
        { orderBy: { column: "data_solicitacao", ascending: false } },
      );
      return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
    },
    staleTime: 30 * 1000,
  });

  const allTrips = data ?? [];

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [solicitante, setSolicitante] = useState("__all__");
  const [projeto, setProjeto] = useState("__all__");

  const solicitantesOptions = useMemo(() => {
    const set = new Set<string>();
    allTrips.forEach((t) => {
      const nome = [t.nome, t.sobrenome].filter(Boolean).join(" ").trim();
      if (nome) set.add(nome);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allTrips]);

  const projetosOptions = useMemo(() => {
    const set = new Set<string>();
    allTrips.forEach((t) => {
      const p = (t.projeto || "").trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allTrips]);

  const trips = useMemo(() => {
    return allTrips.filter((t) => {
      if (dateFrom && t.data_solicitacao < dateFrom) return false;
      if (dateTo && t.data_solicitacao > dateTo) return false;
      if (solicitante !== "__all__") {
        const nome = [t.nome, t.sobrenome].filter(Boolean).join(" ").trim();
        if (nome !== solicitante) return false;
      }
      if (projeto !== "__all__") {
        if ((t.projeto || "").trim() !== projeto) return false;
      }
      return true;
    });
  }, [allTrips, dateFrom, dateTo, solicitante, projeto]);

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

  const agrupadoPessoaData = useMemo(() => {
    const pessoas = new Map<
      string,
      {
        pessoa: string;
        total: number;
        qtd: number;
        datas: Map<string, { total: number; corridas: typeof trips }>;
      }
    >();
    for (const t of trips) {
      const pessoa = [t.nome, t.sobrenome].filter(Boolean).join(" ").trim() || "—";
      const data = t.data_solicitacao;
      if (!pessoas.has(pessoa)) pessoas.set(pessoa, { pessoa, total: 0, qtd: 0, datas: new Map() });
      const p = pessoas.get(pessoa)!;
      p.total += t.valor ?? 0;
      p.qtd += 1;
      if (!p.datas.has(data)) p.datas.set(data, { total: 0, corridas: [] });
      const d = p.datas.get(data)!;
      d.total += t.valor ?? 0;
      d.corridas.push(t);
    }
    return Array.from(pessoas.values())
      .sort((a, b) => b.total - a.total)
      .map((p) => ({
        ...p,
        datas: Array.from(p.datas.entries())
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([data, v]) => ({ data, ...v })),
      }));
  }, [trips]);

  // Mês atual = mês mais recente presente no recorte; anterior = mês imediatamente anterior a esse
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
      mesLabel: mesLabel(ymCur),
      mesPrevLabel: hasPrev ? mesLabel(ymPrev) : null,
      mesAtual: sumBy(ymCur),
      mesAnterior: hasPrev ? sumBy(ymPrev) : null,
      anoAtual: sumBy(yCur),
      anoAnterior: hasYearPrev ? sumBy(yPrev) : null,
      yCur,
      yPrev,
    };
  }, [trips]);

  function limparFiltros() {
    setDateFrom(""); setDateTo(""); setSolicitante("__all__"); setProjeto("__all__");
  }
  function setEsteMes() { setDateFrom(firstOfMonthIso(0)); setDateTo(todayIso()); }
  function setUltimos3() { setDateFrom(firstOfMonthIso(-2)); setDateTo(todayIso()); }
  function setEsteAno() { setDateFrom(firstOfYearIso()); setDateTo(todayIso()); }

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

  if (!allTrips.length) {
    return (
      <Card className="p-12 text-center">
        <div className="text-sm font-semibold mb-1">Sem corridas na base</div>
        <p className="text-sm text-muted-foreground">
          Importe uma planilha da Uber Business na aba <strong>Uber</strong> do menu Financeiro.
        </p>
      </Card>
    );
  }

  const periodoLabel = (() => {
    const parts: string[] = [];
    if (dateFrom || dateTo) {
      parts.push(`Período: ${dateFrom || "início"} até ${dateTo || "hoje"}`);
    }
    if (solicitante !== "__all__") parts.push(`Solicitante: ${solicitante}`);
    if (projeto !== "__all__") parts.push(`Projeto: ${projeto}`);
    return parts.length ? parts.join(" · ") : "Base completa";
  })();

  return (
    <div className="space-y-4 print-area">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; padding: 0; }
        }
      `}</style>

      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold">Dashboard Uber — Grupo Luminart</h1>
        <p className="text-sm text-muted-foreground">{periodoLabel}</p>
        <p className="text-xs text-muted-foreground">
          Emitido em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">De</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Até</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Solicitante</label>
            <Select value={solicitante} onValueChange={setSolicitante}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {solicitantesOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground block mb-1">Projeto</label>
            <Select value={projeto} onValueChange={setProjeto}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {projetosOptions.length === 0 && (
                  <SelectItem value="__none__" disabled>Sem projetos importados</SelectItem>
                )}
                {projetosOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <Button size="sm" variant="outline" onClick={setEsteMes}>Este mês</Button>
            <Button size="sm" variant="outline" onClick={setUltimos3}>Últimos 3 meses</Button>
            <Button size="sm" variant="outline" onClick={setEsteAno}>Este ano</Button>
            <Button size="sm" variant="ghost" onClick={limparFiltros}>Tudo</Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:print:break-inside-avoid">
        <Stat label="Gasto total" value={fmt(kpis.total)} />
        <Stat label="Nº de corridas" value={fmtN(kpis.count)} />
        <Stat label="Ticket médio" value={fmt(kpis.ticket)} />
        <Stat label="Solicitantes únicos" value={fmtN(solicitantesUnicos)} />
      </div>

      {comparacoes && (
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:print:break-inside-avoid">
          <CompareCard
            label={`${comparacoes.mesLabel}${comparacoes.mesPrevLabel ? ` vs ${comparacoes.mesPrevLabel}` : ""}`}
            cur={comparacoes.mesAtual}
            prev={comparacoes.mesAnterior}
          />
          <CompareCard
            label={`${comparacoes.yCur} vs ${comparacoes.yPrev}`}
            cur={comparacoes.anoAtual}
            prev={comparacoes.anoAnterior}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:print:break-inside-avoid">
        <ChartCard title="Gasto mensal (R$)">
          <div className="h-[260px] print:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={11} tickFormatter={mesLabel} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(l: any) => mesLabel(String(l))} />
                <Bar dataKey="valor" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Gasto por serviço">
          <div className="h-[260px] print:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porServico} dataKey="valor" nameKey="nome" outerRadius={90} label>
                  {porServico.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:print:break-inside-avoid">
        <Card className="p-4 print:break-inside-avoid">
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

        <Card className="p-4 print:break-inside-avoid">
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

      <Card className="p-4 print:break-inside-avoid">
        <div className="text-sm font-semibold mb-3">Corridas por pessoa</div>
        <Accordion type="multiple" className="w-full">
          {agrupadoPessoaData.map((p) => (
            <AccordionItem key={p.pessoa} value={p.pessoa} className="print:break-inside-avoid">
              <AccordionTrigger>
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-medium">{p.pessoa}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.qtd} corrida(s) · {fmt(p.total)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Accordion type="multiple" className="w-full pl-4">
                  {p.datas.map((d) => (
                    <AccordionItem key={d.data} value={`${p.pessoa}-${d.data}`} className="print:break-inside-avoid">
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-4">
                          <span>
                            {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmt(d.total)}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr className="border-b">
                                <th className="text-left py-2">Hora</th>
                                <th className="text-left py-2">Projeto</th>
                                <th className="text-left py-2">Serviço</th>
                                <th className="text-right py-2">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.corridas
                                .slice()
                                .sort((a, b) => (a.hora_solicitacao || "").localeCompare(b.hora_solicitacao || ""))
                                .map((c) => (
                                  <tr key={c.id} className="border-b last:border-0">
                                    <td className="py-2">{c.hora_solicitacao || "—"}</td>
                                    <td className="py-2">{c.projeto || "—"}</td>
                                    <td className="py-2">{c.servico || "—"}</td>
                                    <td className="text-right py-2">{fmt(c.valor)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
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
    <Card className={`p-4 print:break-inside-avoid ${className}`}>
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </Card>
  );
}
