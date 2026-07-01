import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Trash2, ChevronsUpDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { normalize, cn } from "@/lib/utils";
import { ComboboxCreatable } from "@/components/ComboboxCreatable";

type Mov = {
  id: string; tipo: string; item_id: string | null; quantidade: number;
  data_movimento: string; responsavel: string | null; evento_projeto: string | null;
  finalidade: string | null; observacoes: string | null; condicao: string | null;
  data_prevista_devolucao: string | null; requisicao_numero: number | null;
  saida_status: string | null; saida_origem_id: string | null;
};

const CONDICOES = ["perfeito", "danificado", "quebrado", "faltando_peca", "em_manutencao"];

export function PatrimonioDevolucoes() {
  const qc = useQueryClient();
  const { isModuleAdmin, user } = useAuth();
  const isAdmin = isModuleAdmin("patrimonio");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: itens } = useQuery({
    queryKey: ["pat_itens_lite_dev"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens").select("id,id_item,nome,especificacao,dimensoes,unidade,categoria,subcategoria")
          .order("nome").range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }
      return all;
    },
  });
  const itemMap = useMemo(() => Object.fromEntries((itens ?? []).map((i: any) => [i.id, i])), [itens]);

  const { data: devolucoes, isLoading } = useQuery({
    queryKey: ["pat_movs", "devolucao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes").select("*").eq("tipo", "devolucao")
        .order("data_movimento", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Mov[];
    },
  });

  const { data: saidasAbertas } = useQuery({
    queryKey: ["pat_saidas_abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes").select("*").eq("tipo", "saida")
        .in("saida_status", ["aberta", "parcialmente_devolvida"])
        .order("data_movimento", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Mov[];
    },
  });

  const { data: devolvidoPorOrigem } = useQuery({
    queryKey: ["pat_devolvido_por_origem"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pat_movimentacoes").select("saida_origem_id, quantidade")
        .eq("tipo", "devolucao").not("saida_origem_id", "is", null);
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        m.set(r.saida_origem_id, (m.get(r.saida_origem_id) ?? 0) + Number(r.quantidade));
      });
      return m;
    },
  });

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const list = (devolucoes ?? []).filter((m) => {
      if (!nq) return true;
      const it: any = m.item_id ? (itemMap as any)[m.item_id] : null;
      return [it?.nome, it?.id_item, m.responsavel, m.evento_projeto, m.observacoes, m.condicao]
        .some((v) => normalize(String(v ?? "")).includes(nq));
    });
    return list;
  }, [devolucoes, q, itemMap]);

  const saveMut = useMutation({
    mutationFn: async (payload: { linhas: any[]; idsFinalizar: string[]; idsParciais: string[] }) => {
      if (!payload.linhas.length) throw new Error("Informe a quantidade devolvida de pelo menos um item");
      const inserts = payload.linhas.map((l) => ({ ...l, created_by: user?.id ?? null }));
      const { error } = await supabase.from("pat_movimentacoes").insert(inserts);
      if (error) throw error;
      if (payload.idsFinalizar.length) {
        await supabase.from("pat_movimentacoes").update({ saida_status: "finalizada" }).in("id", payload.idsFinalizar);
      }
      if (payload.idsParciais.length) {
        await supabase.from("pat_movimentacoes").update({ saida_status: "parcialmente_devolvida" }).in("id", payload.idsParciais);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pat_movs", "devolucao"] });
      qc.invalidateQueries({ queryKey: ["pat_movs", "saida"] });
      qc.invalidateQueries({ queryKey: ["pat_saidas_abertas"] });
      qc.invalidateQueries({ queryKey: ["pat_devolvido_por_origem"] });
      toast.success("Devolução registrada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pat_movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pat_movs", "devolucao"] });
      qc.invalidateQueries({ queryKey: ["pat_saidas_abertas"] });
      qc.invalidateQueries({ queryKey: ["pat_devolvido_por_origem"] });
      toast.success("Devolução excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Devoluções de Patrimônio"
        description="Registro de itens retornando ao patrimônio após uma saída"
        actions={isAdmin && (
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova devolução</Button>
        )}
      />

      <Card className="p-3 mb-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por item, responsável, evento, condição…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="w-full text-xs">
            <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="text-left">
                <th className="px-2 py-2 w-28">Data</th>
                <th className="px-2 py-2 w-24">Código</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2 text-right w-16">Qtd</th>
                <th className="px-2 py-2">Responsável</th>
                <th className="px-2 py-2">Evento / Projeto</th>
                <th className="px-2 py-2">Condição</th>
                <th className="px-2 py-2">Obs</th>
                <th className="px-2 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhuma devolução.</td></tr>}
              {filtered.map((m) => {
                const it: any = m.item_id ? (itemMap as any)[m.item_id] : null;
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-2 py-1.5">{new Date(m.data_movimento).toLocaleDateString("pt-BR")}</td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{it?.id_item ?? "—"}</td>
                    <td className="px-2 py-1.5 font-medium">{it?.nome ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">+{Number(m.quantidade)}</td>
                    <td className="px-2 py-1.5">{m.responsavel ?? "—"}</td>
                    <td className="px-2 py-1.5">{m.evento_projeto ?? "—"}</td>
                    <td className="px-2 py-1.5">{m.condicao?.replace("_", " ") ?? "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{m.observacoes ?? ""}</td>
                    <td className="px-2 py-1.5">
                      {isAdmin && (
                        <button className="h-6 w-6 rounded hover:bg-muted text-rose-600 inline-flex items-center justify-center" onClick={() => { if (confirm("Excluir devolução?")) delMut.mutate(m.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[min(1100px,96vw)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova devolução</DialogTitle></DialogHeader>
          <DevolucaoForm
            saidas={saidasAbertas ?? []}
            devolvidoPorOrigem={devolvidoPorOrigem ?? new Map()}
            itemMap={itemMap}
            onSubmit={(payload) => saveMut.mutate(payload)}
            submitting={saveMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type GrupoVisual = {
  key: string;
  nome: string;
  especificacao: string;
  unidade: string;
  linhas: Array<{ saida: Mov; jaDev: number; saldo: number }>;
  totalSaida: number;
  totalJaDev: number;
  totalSaldo: number;
};

function DevolucaoForm({ saidas, devolvidoPorOrigem, itemMap, onSubmit, submitting }: {
  saidas: Mov[];
  devolvidoPorOrigem: Map<string, number>;
  itemMap: Record<string, any>;
  onSubmit: (p: { linhas: any[]; idsFinalizar: string[]; idsParciais: string[] }) => void;
  submitting: boolean;
}) {
  // Agrupa saídas por requisição
  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; numero: number | null; data: string; responsavel: string | null; evento: string | null; itens: Mov[]; searchKey: string }>();
    for (const s of saidas) {
      const key = s.requisicao_numero != null ? `req-${s.requisicao_numero}` : `solo-${s.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key, numero: s.requisicao_numero ?? null,
          data: s.data_movimento, responsavel: s.responsavel, evento: s.evento_projeto,
          itens: [], searchKey: "",
        });
      }
      map.get(key)!.itens.push(s);
    }
    const arr = Array.from(map.values());
    for (const g of arr) {
      g.searchKey = [
        g.numero != null ? `REQ-${String(g.numero).padStart(4, "0")}` : "",
        new Date(g.data).toLocaleDateString("pt-BR"),
        g.responsavel ?? "", g.evento ?? "",
        g.itens.map((i) => `${(itemMap as any)[i.item_id ?? ""]?.id_item ?? ""} ${(itemMap as any)[i.item_id ?? ""]?.nome ?? ""}`).join(" "),
      ].join(" ");
    }
    return arr.sort((a, b) => b.data.localeCompare(a.data));
  }, [saidas, itemMap]);

  const [grupoKey, setGrupoKey] = useState<string>("");
  const grupo = grupos.find((g) => g.key === grupoKey) ?? null;

  // Agrupa peças do grupo selecionado por "grupo de item" (nome + especificação)
  const gruposVisuais: GrupoVisual[] = useMemo(() => {
    if (!grupo) return [];
    const map = new Map<string, GrupoVisual>();
    for (const s of grupo.itens) {
      const it: any = s.item_id ? (itemMap as any)[s.item_id] : null;
      const key = [
        normalize(it?.nome ?? ""), normalize(it?.especificacao ?? ""),
        normalize(it?.dimensoes ?? ""), normalize(it?.unidade ?? ""),
      ].join("|");
      if (!map.has(key)) {
        map.set(key, {
          key, nome: it?.nome ?? "—",
          especificacao: it?.especificacao ?? "",
          unidade: it?.unidade ?? "",
          linhas: [],
          totalSaida: 0, totalJaDev: 0, totalSaldo: 0,
        });
      }
      const g = map.get(key)!;
      const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
      const saldo = Math.max(0, Number(s.quantidade) - jaDev);
      g.linhas.push({ saida: s, jaDev, saldo });
      g.totalSaida += Number(s.quantidade);
      g.totalJaDev += jaDev;
      g.totalSaldo += saldo;
    }
    // ordena linhas por data_movimento (mais antigas primeiro → devolve elas primeiro)
    for (const g of map.values()) {
      g.linhas.sort((a, b) => a.saida.data_movimento.localeCompare(b.saida.data_movimento));
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [grupo, itemMap, devolvidoPorOrigem]);

  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    responsavel: "",
    condicao: "perfeito",
    observacoes: "",
  });

  // Qtds a devolver por chave de grupo visual
  const [qtdsGrupo, setQtdsGrupo] = useState<Record<string, string>>({});
  useEffect(() => { setQtdsGrupo({}); }, [grupoKey]);

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));

  // Mesma fonte de "Responsável" do formulário de Saída
  const { data: solicitantes = [] } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("nome").eq("status", "ativo").order("nome")).data ?? [],
  });
  const responsavelOptions = useMemo(
    () => Array.from(new Set((solicitantes as any[]).map((s) => s.nome).filter(Boolean))),
    [solicitantes],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!grupo) return toast.error("Selecione uma saída");
        const linhas: any[] = [];
        const novaDevPorSaidaId = new Map<string, number>();

        for (const gv of gruposVisuais) {
          const desejado = Math.floor(Number(qtdsGrupo[gv.key] ?? 0));
          if (desejado <= 0) continue;
          if (desejado > gv.totalSaldo) return toast.error(`Quantidade maior que o saldo para ${gv.nome} (saldo: ${gv.totalSaldo})`);
          // distribui entre as linhas (saídas) — mais antigas primeiro
          let restante = desejado;
          for (const ln of gv.linhas) {
            if (restante <= 0) break;
            if (ln.saldo <= 0) continue;
            const usar = Math.min(ln.saldo, restante);
            linhas.push({
              tipo: "devolucao",
              item_id: ln.saida.item_id,
              quantidade: usar,
              data_movimento: meta.data_movimento ? new Date(meta.data_movimento).toISOString() : new Date().toISOString(),
              responsavel: meta.responsavel || null,
              evento_projeto: ln.saida.evento_projeto ?? null,
              condicao: meta.condicao || null,
              observacoes: meta.observacoes || null,
              saida_origem_id: ln.saida.id,
            });
            novaDevPorSaidaId.set(ln.saida.id, (novaDevPorSaidaId.get(ln.saida.id) ?? 0) + usar);
            restante -= usar;
          }
        }

        if (!linhas.length) return toast.error("Informe ao menos uma quantidade a devolver");

        const idsFinalizar: string[] = [];
        const idsParciais: string[] = [];
        for (const s of grupo.itens) {
          const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
          const novo = novaDevPorSaidaId.get(s.id) ?? 0;
          const total = jaDev + novo;
          if (total >= Number(s.quantidade)) idsFinalizar.push(s.id);
          else if (total > 0) idsParciais.push(s.id);
        }
        onSubmit({ linhas, idsFinalizar, idsParciais });
      }}
      className="space-y-4"
    >
      <div>
        <Label>Saída de origem*</Label>
        <SaidaCombobox grupos={grupos} value={grupoKey} onChange={setGrupoKey} />
      </div>

      {grupo && (
        <Card className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div><span className="text-muted-foreground">REQ:</span> <span className="font-mono">{grupo.numero != null ? `REQ-${String(grupo.numero).padStart(4, "0")}` : "—"}</span></div>
            <div><span className="text-muted-foreground">Data:</span> {new Date(grupo.data).toLocaleDateString("pt-BR")}</div>
            <div className="truncate"><span className="text-muted-foreground">Responsável:</span> {grupo.responsavel ?? "—"}</div>
            <div className="truncate"><span className="text-muted-foreground">Evento:</span> {grupo.evento ?? "—"}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1 min-w-[200px]">Item</th>
                  <th className="text-left py-1">Especificação</th>
                  <th className="text-right py-1 w-20">Saída</th>
                  <th className="text-right py-1 w-24">Já devolv.</th>
                  <th className="text-right py-1 w-20">Saldo</th>
                  <th className="text-left py-1 pl-2 w-12">UN</th>
                  <th className="text-right py-1 w-28">Devolver agora</th>
                </tr>
              </thead>
              <tbody>
                {gruposVisuais.map((gv) => (
                  <tr key={gv.key} className="border-t border-border/40 align-middle">
                    <td className="py-1 font-medium truncate">{gv.nome}</td>
                    <td className="py-1 text-muted-foreground truncate">{gv.especificacao}</td>
                    <td className="py-1 text-right tabular-nums">{gv.totalSaida}</td>
                    <td className="py-1 text-right tabular-nums">{gv.totalJaDev}</td>
                    <td className="py-1 text-right tabular-nums">{gv.totalSaldo}</td>
                    <td className="py-1 pl-2 text-muted-foreground">{gv.unidade}</td>
                    <td className="py-1 text-right">
                      <Input
                        type="number" min="0" max={gv.totalSaldo} step="1"
                        value={qtdsGrupo[gv.key] ?? ""}
                        onChange={(e) => setQtdsGrupo((p) => ({ ...p, [gv.key]: e.target.value }))}
                        className="h-7 text-right w-24 ml-auto"
                        disabled={gv.totalSaldo <= 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></div>
        <div>
          <Label>Responsável recebimento</Label>
          <ComboboxCreatable
            options={responsavelOptions}
            value={meta.responsavel}
            onChange={(v) => setM("responsavel", v)}
            placeholder="Quem recebeu de volta"
            searchPlaceholder="Buscar solicitante ou digitar novo…"
          />
        </div>
        <div className="col-span-2">
          <Label>Condição</Label>
          <Select value={meta.condicao} onValueChange={(v) => setM("condicao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDICOES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={meta.observacoes} onChange={(e) => setM("observacoes", e.target.value)} /></div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={!grupo}
          onClick={() => {
            if (!grupo) return;
            imprimirFormularioDevolucao({
              grupo,
              gruposVisuais,
              qtdsGrupo,
              meta,
            });
          }}
        >
          <Printer className="h-4 w-4 mr-1" /> Imprimir formulário
        </Button>
        <Button type="submit" disabled={submitting || !grupo}>{submitting ? "Salvando…" : "Registrar devolução"}</Button>
      </DialogFooter>

    </form>
  );
}

function SaidaCombobox({ grupos, value, onChange }: {
  grupos: Array<{ key: string; numero: number | null; data: string; responsavel: string | null; evento: string | null; itens: Mov[]; searchKey: string }>;
  value: string;
  onChange: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = grupos.find((g) => g.key === value);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return grupos;
    return grupos.filter((g) => {
      const h = normalize(g.searchKey);
      return terms.every((t) => h.includes(t));
    });
  }, [grupos, search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label = (g: typeof grupos[number]) => {
    const num = g.numero != null ? `REQ-${String(g.numero).padStart(4, "0")} · ` : "";
    return `${num}${new Date(g.data).toLocaleDateString("pt-BR")} · ${g.responsavel ?? "s/ resp."}${g.evento ? " · " + g.evento : ""}`;
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button" variant="outline" role="combobox"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((c) => !c)}
      >
        <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
          {selected ? label(selected) : "Selecione uma saída em aberto…"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[400px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por REQ, evento, responsável, item…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma saída em aberto.</div>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.key} type="button"
                  className="flex w-full items-start rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent"
                  onPointerDown={(e) => { e.preventDefault(); onChange(g.key); setOpen(false); setSearch(""); }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{label(g)}</div>
                    <div className="truncate text-xs text-muted-foreground">{g.itens.length} {g.itens.length === 1 ? "peça" : "peças"}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function imprimirFormularioDevolucao({
  grupo,
  gruposVisuais,
  qtdsGrupo,
  meta,
}: {
  grupo: { numero: number | null; data: string; responsavel: string | null; evento: string | null };
  gruposVisuais: GrupoVisual[];
  qtdsGrupo: Record<string, string>;
  meta: { data_movimento: string; responsavel: string; condicao: string; observacoes: string };
}) {
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const req = grupo.numero != null ? `REQ-${String(grupo.numero).padStart(4, "0")}` : "—";
  const dataSaida = new Date(grupo.data).toLocaleDateString("pt-BR");
  const dataDev = meta.data_movimento
    ? new Date(meta.data_movimento).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR");

  const linhas = gruposVisuais
    .map((gv) => {
      const solic = qtdsGrupo[gv.key] ? Math.floor(Number(qtdsGrupo[gv.key])) : "";
      return `
        <tr>
          <td>${esc(gv.nome)}</td>
          <td class="muted">${esc(gv.especificacao)}</td>
          <td class="num">${gv.totalSaida}</td>
          <td class="num">${gv.totalJaDev}</td>
          <td class="num">${gv.totalSaldo}</td>
          <td>${esc(gv.unidade)}</td>
          <td class="num">${solic}</td>
          <td class="fill"></td>
          <td class="fill"></td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Formulário de Devolução — ${esc(req)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 24px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 12px; }
  .grid div { border-bottom: 1px solid #ddd; padding: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 6px 6px; vertical-align: top; }
  th { background: #f2f2f2; text-align: left; font-size: 11px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.muted { color: #666; }
  td.fill { min-width: 80px; height: 26px; }
  .obs { margin-top: 16px; }
  .obs .box { border: 1px solid #999; height: 60px; }
  .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig .line { border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <h1>Formulário de Devolução de Patrimônio</h1>
  <div class="sub">Preencha as quantidades devolvidas fisicamente e a condição de cada peça.</div>
  <div class="grid">
    <div><strong>Saída (REQ):</strong> ${esc(req)}</div>
    <div><strong>Data da saída:</strong> ${esc(dataSaida)}</div>
    <div><strong>Responsável (saída):</strong> ${esc(grupo.responsavel ?? "—")}</div>
    <div><strong>Evento / Projeto:</strong> ${esc(grupo.evento ?? "—")}</div>
    <div><strong>Data da devolução:</strong> ${esc(dataDev)}</div>
    <div><strong>Recebido por:</strong> ${esc(meta.responsavel || "________________________")}</div>
    <div><strong>Condição prevista:</strong> ${esc((meta.condicao || "").replace("_", " "))}</div>
    <div><strong>Impresso em:</strong> ${new Date().toLocaleString("pt-BR")}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Especificação</th>
        <th style="width:60px">Saída</th>
        <th style="width:72px">Já dev.</th>
        <th style="width:60px">Saldo</th>
        <th style="width:44px">UN</th>
        <th style="width:80px">Sistema</th>
        <th style="width:80px">Físico</th>
        <th>Condição / Obs.</th>
      </tr>
    </thead>
    <tbody>${linhas || `<tr><td colspan="9" style="text-align:center;color:#888">Sem itens</td></tr>`}</tbody>
  </table>

  <div class="obs">
    <div><strong>Observações gerais:</strong></div>
    <div class="box">${esc(meta.observacoes || "")}</div>
  </div>

  <div class="sig">
    <div class="line">Entregue por</div>
    <div class="line">Recebido por</div>
  </div>

  <script>window.onload = () => { window.focus(); window.print(); };</script>
</body></html>`;

  // Estratégia principal: iframe oculto (evita bloqueio de pop-up do navegador/preview)
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const cleanup = () => {
      setTimeout(() => {
        try { iframe.remove(); } catch { /* noop */ }
      }, 500);
    };

    iframe.onload = () => {
      const cw = iframe.contentWindow;
      if (!cw) { cleanup(); return; }
      try {
        cw.focus();
        cw.onafterprint = cleanup;
        cw.print();
        // fallback caso onafterprint não dispare
        setTimeout(cleanup, 60_000);
      } catch {
        cleanup();
      }
    };

    const doc = iframe.contentDocument;
    if (!doc) throw new Error("iframe sem contentDocument");
    // Remove o script auto-print embutido no HTML — controlamos via onload
    const htmlSemAutoPrint = html.replace(
      /<script>window\.onload[\s\S]*?<\/script>/,
      "",
    );
    doc.open();
    doc.write(htmlSemAutoPrint);
    doc.close();
    return;
  } catch {
    // Fallback: tenta pop-up
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      toast.error("Não foi possível abrir a janela de impressão. Libere pop-ups e tente novamente.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

