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
import { Plus, Search, Trash2, ChevronsUpDown } from "lucide-react";
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
    queryKey: ["pat_itens_lite"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens").select("id,id_item,nome,unidade")
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

  const [meta, setMeta] = useState({
    data_movimento: new Date().toISOString().slice(0, 16),
    responsavel: "",
    condicao: "perfeito",
    observacoes: "",
  });

  // linhas: por id da saída, qtd a devolver
  const [qtds, setQtds] = useState<Record<string, string>>({});
  useEffect(() => { setQtds({}); }, [grupoKey]);

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!grupo) return toast.error("Selecione uma saída");
        const linhas: any[] = [];
        const idsParaChecar: { id: string; qtdSaida: number; jaDevolvido: number; novaDevolucao: number }[] = [];
        for (const s of grupo.itens) {
          const valor = Number(qtds[s.id] ?? 0);
          const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
          const saldo = Number(s.quantidade) - jaDev;
          if (valor <= 0) {
            idsParaChecar.push({ id: s.id, qtdSaida: Number(s.quantidade), jaDevolvido: jaDev, novaDevolucao: 0 });
            continue;
          }
          if (valor > saldo) return toast.error(`Quantidade maior que o saldo para ${(itemMap as any)[s.item_id ?? ""]?.nome ?? "item"} (saldo: ${saldo})`);
          linhas.push({
            tipo: "devolucao",
            item_id: s.item_id,
            quantidade: valor,
            data_movimento: meta.data_movimento ? new Date(meta.data_movimento).toISOString() : new Date().toISOString(),
            responsavel: meta.responsavel || null,
            evento_projeto: s.evento_projeto ?? null,
            condicao: meta.condicao || null,
            observacoes: meta.observacoes || null,
            saida_origem_id: s.id,
          });
          idsParaChecar.push({ id: s.id, qtdSaida: Number(s.quantidade), jaDevolvido: jaDev, novaDevolucao: valor });
        }
        if (!linhas.length) return toast.error("Informe ao menos uma quantidade a devolver");
        const idsFinalizar: string[] = [];
        const idsParciais: string[] = [];
        for (const r of idsParaChecar) {
          const totalDevolvido = r.jaDevolvido + r.novaDevolucao;
          if (totalDevolvido >= r.qtdSaida) idsFinalizar.push(r.id);
          else if (totalDevolvido > 0) idsParciais.push(r.id);
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
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-2">Itens da requisição</div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left py-1">Código</th>
                <th className="text-left py-1">Item</th>
                <th className="text-right py-1">Qtd saída</th>
                <th className="text-right py-1">Já devolvido</th>
                <th className="text-right py-1">Saldo</th>
                <th className="text-right py-1 w-32">Devolver agora</th>
              </tr>
            </thead>
            <tbody>
              {grupo.itens.map((s) => {
                const it: any = s.item_id ? (itemMap as any)[s.item_id] : null;
                const jaDev = devolvidoPorOrigem.get(s.id) ?? 0;
                const saldo = Number(s.quantidade) - jaDev;
                return (
                  <tr key={s.id} className="border-t border-border/40">
                    <td className="py-1 font-mono text-muted-foreground">{it?.id_item ?? "—"}</td>
                    <td className="py-1 font-medium">{it?.nome ?? "—"}</td>
                    <td className="py-1 text-right">{Number(s.quantidade)}</td>
                    <td className="py-1 text-right">{jaDev}</td>
                    <td className="py-1 text-right">{saldo}</td>
                    <td className="py-1 text-right">
                      <Input
                        type="number" min="0" max={saldo} step="0.01"
                        value={qtds[s.id] ?? ""}
                        onChange={(e) => setQtds((p) => ({ ...p, [s.id]: e.target.value }))}
                        className="h-7 text-right"
                        disabled={saldo <= 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></div>
        <div><Label>Responsável recebimento</Label><Input value={meta.responsavel} onChange={(e) => setM("responsavel", e.target.value)} placeholder="Quem recebeu de volta" /></div>
        <div className="col-span-2">
          <Label>Condição</Label>
          <Select value={meta.condicao} onValueChange={(v) => setM("condicao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDICOES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={meta.observacoes} onChange={(e) => setM("observacoes", e.target.value)} /></div>
      </div>

      <DialogFooter>
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
                    <div className="truncate text-xs text-muted-foreground">{g.itens.length} {g.itens.length === 1 ? "item" : "itens"}</div>
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
