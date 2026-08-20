import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { normalize } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { gerarRelatorioPatrimonioPdf, gerarRelatorioPatrimonioConsolidadoPdf, gerarFolhaConferenciaPatrimonioPdf } from "@/lib/patrimonio/relatorio-pdf";

export const Route = createFileRoute("/patrimonio/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios de Patrimônio — Grupo Luminart" },
      { name: "description", content: "Filtre o patrimônio por categoria e subcategoria e exporte um relatório em PDF." },
      { property: "og:title", content: "Relatórios de Patrimônio — Grupo Luminart" },
      { property: "og:description", content: "Relatório estruturado do inventário de patrimônio em PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatrimonioRelatorios,
});

type Pat = {
  id: string;
  cod: number | null;
  id_item: string | null;
  categoria: string | null;
  subcategoria: string | null;
  nome: string;
  especificacao: string | null;
  quantidade: number;
  valor: number;
  estado: string;
  unidade: string;
  localizacao: string | null;
};

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function compareEspecThenNome(
  a: { nome: string; especificacao?: string | null },
  b: { nome: string; especificacao?: string | null },
) {
  const ea = (a.especificacao ?? "").trim();
  const eb = (b.especificacao ?? "").trim();
  const especCmp = ea.localeCompare(eb, "pt-BR", { numeric: true });
  if (especCmp !== 0) return especCmp;
  return a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
}

function PatrimonioRelatorios() {
  const [cat, setCat] = useState("__all");
  const [sub, setSub] = useState("__all");
  const [estado, setEstado] = useState("__all");
  const [loc, setLoc] = useState("__all");
  const [agrupar, setAgrupar] = useState<"categoria" | "subcategoria" | "nenhum">("categoria");
  const [modo, setModo] = useState<"detalhado" | "consolidado" | "conferencia">("detalhado");
  const [ordem, setOrdem] = useState<"quantidade" | "nome" | "especificacao">("especificacao");
  const [q, setQ] = useState("");
  const qd = useDebouncedValue(q, 300);
  const [gerando, setGerando] = useState(false);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["pat_itens_relatorio"],
    queryFn: async () => {
      const all: Pat[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens")
          .select("id,cod,id_item,categoria,subcategoria,nome,especificacao,quantidade,valor,estado,unidade,localizacao")
          .order("cod", { ascending: true, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as Pat[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const categorias = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => i.categoria && s.add(i.categoria));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens]);

  const subcategorias = useMemo(() => {
    const s = new Set<string>();
    itens
      .filter((i) => cat === "__all" || i.categoria === cat)
      .forEach((i) => i.subcategoria && s.add(i.subcategoria));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens, cat]);

  const estados = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => i.estado && s.add(i.estado));
    return [...s].sort();
  }, [itens]);

  const locais = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => i.localizacao && s.add(i.localizacao));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens]);

  const filtrados = useMemo(() => {
    const nq = normalize(qd);
    return itens.filter((i) => {
      if (cat !== "__all" && i.categoria !== cat) return false;
      if (sub !== "__all" && i.subcategoria !== sub) return false;
      if (estado !== "__all" && i.estado !== estado) return false;
      if (loc !== "__all" && i.localizacao !== loc) return false;
      if (!nq) return true;
      return [i.nome, i.especificacao, i.id_item, i.subcategoria, i.localizacao, i.cod != null ? String(i.cod) : ""]
        .some((v) => normalize(String(v ?? "")).includes(nq));
    });
  }, [itens, cat, sub, estado, loc, qd]);

  const consolidado = useMemo(() => {
    type G = {
      nomes: Map<string, number>;
      especs: Map<string, number>;
      categorias: Set<string>;
      subcategorias: Set<string>;
      registros: number;
      quantidade: number;
      valorTotal: number;
    };
    const map = new Map<string, G>();
    const norm = (v: unknown) => normalize(v ?? "").replace(/\s+/g, " ").trim();
    for (const i of filtrados) {
      const chave = `${norm(i.nome) || "—"}|${norm(i.especificacao)}`;
      let g = map.get(chave);
      if (!g) {
        g = { nomes: new Map(), especs: new Map(), categorias: new Set(), subcategorias: new Set(), registros: 0, quantidade: 0, valorTotal: 0 };
        map.set(chave, g);
      }
      const nome = (i.nome ?? "—").trim();
      g.nomes.set(nome, (g.nomes.get(nome) ?? 0) + 1);
      const esp = (i.especificacao ?? "").trim();
      if (esp) g.especs.set(esp, (g.especs.get(esp) ?? 0) + 1);
      if (i.categoria) g.categorias.add(i.categoria);
      if (i.subcategoria) g.subcategorias.add(i.subcategoria);
      const qtd = Number(i.quantidade || 0);
      g.registros += 1;
      g.quantidade += qtd;
      g.valorTotal += Number(i.valor || 0) * (qtd || 1);
    }
    const linhas = [...map.values()].map((g) => {
      const nome = [...g.nomes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      const especificacao = [...g.especs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const uniq = (s: Set<string>) => (s.size === 0 ? "—" : s.size === 1 ? [...s][0] : "Vários");
      return {
        nome,
        especificacao,
        categoria: uniq(g.categorias),
        subcategoria: uniq(g.subcategorias),
        registros: g.registros,
        quantidade: g.quantidade,
        valorTotal: g.valorTotal,
        valorMedio: g.quantidade > 0 ? g.valorTotal / g.quantidade : 0,
      };
    });
    linhas.sort((a, b) => {
      if (ordem === "quantidade") {
        return b.quantidade - a.quantidade || compareEspecThenNome(a, b);
      }
      if (ordem === "nome") {
        return a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }) || compareEspecThenNome(a, b);
      }
      return compareEspecThenNome(a, b);
    });
    return linhas;
  }, [filtrados, ordem]);

  const totais = useMemo(() => {
    let qtd = 0;
    let valor = 0;
    filtrados.forEach((i) => {
      qtd += Number(i.quantidade || 0);
      valor += Number(i.valor || 0) * Number(i.quantidade || 1);
    });
    return { count: filtrados.length, qtd, valor };
  }, [filtrados]);

  async function exportar() {
    if (filtrados.length === 0) {
      toast.error("Nenhum item para exportar com os filtros atuais.");
      return;
    }
    setGerando(true);
    const filtros = [
      cat === "__all" ? "Todas as categorias" : `Categoria: ${cat}`,
      sub === "__all" ? null : `Subcategoria: ${sub}`,
      estado === "__all" ? null : `Estado: ${estado}`,
      loc === "__all" ? null : `Localização: ${loc}`,
      qd ? `Busca: "${qd}"` : null,
    ].filter(Boolean) as string[];
    try {
      if (modo === "conferencia") {
        await gerarFolhaConferenciaPatrimonioPdf({ filtros, linhas: consolidado });
        toast.success("Folha de conferência gerada.");
        return;
      }
      if (modo === "consolidado") {
        await gerarRelatorioPatrimonioConsolidadoPdf({ filtros, linhas: consolidado });
        toast.success("Relatório gerado.");
        return;
      }
      await gerarRelatorioPatrimonioPdf({
        agruparPor: agrupar,
        filtros,
        itens: filtrados.map((i) => ({
          cod: i.cod,
          id_item: i.id_item,
          nome: i.nome,
          especificacao: i.especificacao,
          categoria: i.categoria,
          subcategoria: i.subcategoria,
          localizacao: i.localizacao,
          estado: i.estado,
          unidade: i.unidade,
          quantidade: Number(i.quantidade || 0),
          valor: Number(i.valor || 0),
        })),
      });
      toast.success("Relatório gerado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relatórios de Patrimônio"
        description={`${totais.count} itens · ${totais.qtd.toLocaleString("pt-BR")} un · ${brl(totais.valor)}`}
        actions={
          <Button onClick={exportar} disabled={gerando || isLoading}>
            {gerando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Exportar PDF
          </Button>
        }
      />

      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="space-y-1.5 xl:col-span-2">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, código, local…" className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select value={cat} onValueChange={(v) => { setCat(v); setSub("__all"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Subcategoria</Label>
          <Select value={sub} onValueChange={setSub}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {subcategorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {estados.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Localização</Label>
          <Select value={loc} onValueChange={setLoc}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {locais.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Visualização</Label>
          <Select
            value={modo}
            onValueChange={(v) => {
              const m = v as typeof modo;
              setModo(m);
              if (m === "conferencia") setOrdem("nome");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="detalhado">Detalhado</SelectItem>
              <SelectItem value="consolidado">Consolidado por nome</SelectItem>
              <SelectItem value="conferencia">Conferência (folha de contagem)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {modo === "detalhado" ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Agrupar no PDF por</Label>
            <Select value={agrupar} onValueChange={(v) => setAgrupar(v as typeof agrupar)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="categoria">Categoria</SelectItem>
                <SelectItem value="subcategoria">Subcategoria</SelectItem>
                <SelectItem value="nenhum">Sem agrupamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ordenar por</Label>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quantidade">Maior quantidade</SelectItem>
                <SelectItem value="nome">Nome (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {modo === "conferencia" ? (
        <Card className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-left">Categoria</th>
                <th className="px-2 py-2 text-right">Qtd. sistema</th>
                <th className="px-2 py-2 text-left w-40">Qtd. conferida</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : consolidado.length === 0 ? (
                <tr><td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">Nenhum item com os filtros atuais.</td></tr>
              ) : consolidado.map((l) => (
                <tr key={`${l.nome}|${l.especificacao}`} className="border-t border-border">
                  <td className="px-2 py-2 font-medium">
                    {l.nome}
                    {l.especificacao && <span className="font-normal text-muted-foreground"> · {l.especificacao}</span>}
                  </td>
                  <td className="px-2 py-2">{l.categoria}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{l.quantidade.toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-2">
                    <div className="h-6 rounded border border-dashed border-border bg-muted/20" aria-label="Espaço para anotar a quantidade conferida" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
            Folha para contagem física — exporte em PDF e preencha a coluna “Qtd. conferida” à mão.
          </div>
        </Card>
      ) : modo === "consolidado" ? (
        <Card className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-left">Categoria</th>
                <th className="px-2 py-2 text-left">Subcategoria</th>
                <th className="px-2 py-2 text-right">Registros</th>
                <th className="px-2 py-2 text-right">Qtd. total</th>
                <th className="px-2 py-2 text-right">Valor unit. médio</th>
                <th className="px-2 py-2 text-right">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : consolidado.length === 0 ? (
                <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">Nenhum item com os filtros atuais.</td></tr>
              ) : consolidado.map((l) => (
               <tr key={`${l.nome}|${l.especificacao}`} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">
                    {l.nome}
                    {l.especificacao && <span className="font-normal text-muted-foreground"> · {l.especificacao}</span>}
                  </td>
                  <td className="px-2 py-1.5">{l.categoria}</td>
                  <td className="px-2 py-1.5">{l.subcategoria}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.registros}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.quantidade.toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{brl(l.valorMedio)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{brl(l.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
      <Card className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left">Código</th>
              <th className="px-2 py-2 text-left">Item</th>
              <th className="px-2 py-2 text-left">Categoria</th>
              <th className="px-2 py-2 text-left">Subcategoria</th>
              <th className="px-2 py-2 text-left">Localização</th>
              <th className="px-2 py-2 text-left">Estado</th>
              <th className="px-2 py-2 text-right">Qtd.</th>
              <th className="px-2 py-2 text-right">Valor unit.</th>
              <th className="px-2 py-2 text-right">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">Nenhum item com os filtros atuais.</td></tr>
            ) : filtrados.slice(0, 300).map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-2 py-1.5 font-mono text-xs">{i.cod ?? i.id_item ?? "—"}</td>
                <td className="px-2 py-1.5">{i.nome}{i.especificacao && <span className="text-muted-foreground"> · {i.especificacao}</span>}</td>
                <td className="px-2 py-1.5">{i.categoria ?? "—"}</td>
                <td className="px-2 py-1.5">{i.subcategoria ?? "—"}</td>
                <td className="px-2 py-1.5">{i.localizacao ?? "—"}</td>
                <td className="px-2 py-1.5">{i.estado ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Number(i.quantidade || 0).toLocaleString("pt-BR")} {i.unidade}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{brl(i.valor)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{brl(Number(i.valor || 0) * Number(i.quantidade || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length > 300 && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
            Mostrando os 300 primeiros itens na prévia. O PDF inclui todos os {filtrados.length} itens.
          </div>
        )}
      </Card>
      )}
    </div>
  );
}
