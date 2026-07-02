import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, AlertTriangle, Download, FileBarChart, CalendarRange } from "lucide-react";
import { listVendasDb } from "@/lib/comercial/vendas-db.functions";
import { getAno, getMes, cleanText } from "@/lib/comercial/vendas-metrics";
import { RelatorioVendasPeriodo } from "@/components/comercial/RelatorioVendasPeriodo";

export const Route = createFileRoute("/comercial/relatorios")({
  component: RelatoriosPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmtBRL = (v: number) =>
  v === 0
    ? "R$ -"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type LinhaVenda = {
  consultor: string;
  evento: string;
  local: string;
  tipo: string;
  valorFinal: number;
  valorComissao: number;
};

type Grupo = {
  consultor: string;
  linhas: LinhaVenda[];
  totalFinal: number;
  totalComissao: number;
};

function RelatoriosPage() {
  const [relatorioAtivo, setRelatorioAtivo] = useState<"comissao" | "periodo">("comissao");
  const [ano, setAno] = useState<number | "Todos">("Todos");
  const [mes, setMes] = useState<string>("Todos");


  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-db", "relatorios"],
    queryFn: () => listVendasDb(),
    staleTime: 30 * 1000,
  });

  const rows = data?.rows ?? [];

  // Ano/mês pela DATA DE REGISTRO (quando a venda foi fechada), com fallback para evento.
  const MESES_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const anoDoRegistro = (r: typeof rows[number]): number | null => {
    const iso = r.dataRegistro || r.dataEvento || null;
    if (iso && /^\d{4}/.test(iso)) {
      const y = Number(iso.slice(0, 4));
      if (y > 1900 && y < 2100) return y;
    }
    return getAno(r); // fallback
  };
  const mesDoRegistro = (r: typeof rows[number]): string | null => {
    const iso = r.dataRegistro || r.dataEvento || null;
    if (iso && /^\d{4}-\d{2}/.test(iso)) {
      const m = Number(iso.slice(5, 7));
      if (m >= 1 && m <= 12) return MESES_PT[m - 1];
    }
    return (getMes(r) ?? "").toLowerCase() || null; // fallback
  };

  const anosDisponiveis = useMemo(() => {
    const s = new Set<number>();
    for (const r of rows) {
      const a = anoDoRegistro(r);
      if (a) s.add(a);
    }
    return [...s].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtradas = useMemo(() => {
    const mesAlvo = mes === "Todos" ? null : mes.toLowerCase();
    return rows.filter((r) => {
      if (ano !== "Todos" && anoDoRegistro(r) !== ano) return false;
      if (mesAlvo) {
        const m = (mesDoRegistro(r) ?? "").toLowerCase();
        if (m !== mesAlvo) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ano, mes]);

  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, LinhaVenda[]>();
    for (const r of filtradas) {
      const consultor = cleanText(r.consultor) || "(vazio)";
      const linha: LinhaVenda = {
        consultor,
        evento: cleanText(r.nomeEvento) || "-",
        local: cleanText(r.local) || "-",
        tipo: cleanText(r.tipo) || "-",
        valorFinal: Number(r.valorFinal || 0),
        valorComissao: Number(r.valorComissao || 0),
      };
      const arr = map.get(consultor) ?? [];
      arr.push(linha);
      map.set(consultor, arr);
    }
    const nomes = [...map.keys()].sort((a, b) => {
      if (a === "(vazio)") return 1;
      if (b === "(vazio)") return -1;
      return a.localeCompare(b, "pt-BR");
    });
    return nomes.map((consultor) => {
      const linhas = map.get(consultor)!;
      const totalFinal = linhas.reduce((s, l) => s + l.valorFinal, 0);
      const totalComissao = linhas.reduce((s, l) => s + l.valorComissao, 0);
      return { consultor, linhas, totalFinal, totalComissao };
    });
  }, [filtradas]);

  const totalGeral = useMemo(
    () => ({
      final: grupos.reduce((s, g) => s + g.totalFinal, 0),
      comissao: grupos.reduce((s, g) => s + g.totalComissao, 0),
      qtd: filtradas.length,
    }),
    [grupos, filtradas.length],
  );

  const exportarCSV = () => {
    const linhas: string[] = ["Consultor;Evento;Local;Tipo;Vr. Final;Vr. Comissao"];
    for (const g of grupos) {
      for (const l of g.linhas) {
        linhas.push(
          [l.consultor, l.evento, l.local, l.tipo, l.valorFinal.toFixed(2), l.valorComissao.toFixed(2)].join(";"),
        );
      }
      linhas.push(
        [`${g.consultor} Total`, "", "", "", g.totalFinal.toFixed(2), g.totalComissao.toFixed(2)].join(";"),
      );
    }
    linhas.push(
      ["TOTAL GERAL", "", "", "", totalGeral.final.toFixed(2), totalGeral.comissao.toFixed(2)].join(";"),
    );
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `distribuicao-comissao-${ano}-${mes}.csv`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Relatórios"
        description="Relatórios operacionais do Comercial."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={relatorioAtivo === "comissao" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setRelatorioAtivo("comissao")}
        >
          <FileBarChart className="h-4 w-4" /> Distribuição de Comissão
        </Button>
        <Button
          variant={relatorioAtivo === "periodo" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setRelatorioAtivo("periodo")}
        >
          <CalendarRange className="h-4 w-4" /> Vendas por Período
        </Button>
      </div>

      {relatorioAtivo === "periodo" && (
        <RelatorioVendasPeriodo rows={rows} isLoading={isLoading} error={error} />
      )}

      {relatorioAtivo === "comissao" && (
        <>


      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_200px_1fr] sm:items-end">
          <div className="space-y-1">
            <Label>Ano</Label>
            <Select
              value={String(ano)}
              onValueChange={(v) => setAno(v === "Todos" ? "Todos" : Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportarCSV}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando vendas…
        </Card>
      )}
      {error && (
        <Card className="p-6 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>
            Não foi possível carregar os dados. {(error as Error)?.message ?? data?.error}
          </span>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Vendas no período
              </p>
              <p className="text-2xl font-semibold mt-1">{totalGeral.qtd}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Valor final total
              </p>
              <p className="text-2xl font-semibold mt-1">{fmtBRL(totalGeral.final)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Comissão total
              </p>
              <p className="text-2xl font-semibold mt-1">{fmtBRL(totalGeral.comissao)}</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Consultor</th>
                    <th className="text-left px-3 py-2">Evento</th>
                    <th className="text-left px-3 py-2">Local</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-right px-3 py-2">Vr. Final</th>
                    <th className="text-right px-3 py-2">Vr. Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhuma venda no filtro selecionado.
                      </td>
                    </tr>
                  )}
                  {grupos.map((g) => (
                    <Fragment key={g.consultor}>
                      {g.linhas.map((l, i) => (
                        <tr key={`${g.consultor}-${i}`} className="border-t border-border/50">
                          <td className="px-3 py-2">{l.consultor}</td>
                          <td className="px-3 py-2">{l.evento}</td>
                          <td className="px-3 py-2">{l.local}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="font-normal">
                              {l.tipo}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtBRL(l.valorFinal)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtBRL(l.valorComissao)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/40 font-semibold border-t border-border">
                        <td className="px-3 py-2" colSpan={4}>
                          {g.consultor} Total
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtBRL(g.totalFinal)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtBRL(g.totalComissao)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
                {grupos.length > 0 && (
                  <tfoot>
                    <tr className="bg-primary/10 font-semibold border-t-2 border-primary/40">
                      <td className="px-3 py-2" colSpan={4}>
                        TOTAL GERAL
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtBRL(totalGeral.final)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtBRL(totalGeral.comissao)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
        </>
      )}
    </div>

  );
}
