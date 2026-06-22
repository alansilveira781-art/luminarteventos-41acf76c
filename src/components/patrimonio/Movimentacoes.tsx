import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, ChevronRight, ChevronDown } from "lucide-react";
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
import { toast } from "sonner";
import { normalize } from "@/lib/utils";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { ComboboxCreatable } from "@/components/ComboboxCreatable";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { PatItemInfoHover } from "@/components/patrimonio/PatItemInfoHover";
import { PatGroupSelect, PatItemSelect, buildPatGroups, buildPatItemOptions, allocateFromGroup, type PatItem, type PatGroup, type PatItemOption } from "@/components/patrimonio/PatGroupSelect";

type Mov = {
  id: string; tipo: string; item_id: string | null; quantidade: number;
  data_movimento: string; responsavel: string | null; evento_projeto: string | null;
  finalidade: string | null; observacoes: string | null; condicao: string | null;
  data_prevista_devolucao: string | null;
  requisicao_numero: number | null;
  saida_status: string | null;
  saida_origem_id: string | null;
};

const FINALIDADES = ["Evento", "Manutenção", "Empréstimo", "Descarte", "Transferência", "Outro"];
const CONDICOES = ["perfeito", "danificado", "quebrado", "faltando_peca", "em_manutencao"];

type LinhaSaida = { item_id: string; quantidade: string };
type LinhaEntrada = { item_id: string; quantidade: string };

export function PatrimonioMovimentacoes({ tipo, titulo, descricao }: {
  tipo: "entrada" | "saida"; titulo: string; descricao: string;
}) {
  const qc = useQueryClient();
  const { isModuleAdmin, user } = useAuth();
  const isAdmin = isModuleAdmin("patrimonio");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const { data: itens } = useQuery({
    queryKey: ["pat_itens_full"],
    queryFn: async () => {
      const all: PatItem[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens")
          .select("id,id_item,cod,nome,especificacao,dimensoes,categoria,subcategoria,localizacao,unidade,quantidade,estado")
          .order("nome").range(from, from + 999);
        if (error) throw error;
        all.push(...((data ?? []) as any));
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const itemMap = useMemo(() => Object.fromEntries((itens ?? []).map((i: any) => [i.id, i])), [itens]);

  const { data: movs, isLoading } = useQuery({
    queryKey: ["pat_movs", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes").select("*").eq("tipo", tipo)
        .order("data_movimento", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Mov[];
    },
  });

  // Saídas em aberto/parcialmente devolvidas — usado p/ calcular "em uso" por item
  const { data: saidasAbertas } = useQuery({
    queryKey: ["pat_saidas_abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes").select("id,item_id,quantidade,saida_status")
        .eq("tipo", "saida").in("saida_status", ["aberta", "parcialmente_devolvida"]);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; item_id: string | null; quantidade: number; saida_status: string | null }>;
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

  // Qtd "em uso" por item_id
  const emUsoPorItem = useMemo(() => {
    const m = new Map<string, number>();
    (saidasAbertas ?? []).forEach((s) => {
      if (!s.item_id) return;
      const jaDev = devolvidoPorOrigem?.get(s.id) ?? 0;
      const restante = Math.max(0, Number(s.quantidade) - jaDev);
      if (restante > 0) m.set(s.item_id, (m.get(s.item_id) ?? 0) + restante);
    });
    return m;
  }, [saidasAbertas, devolvidoPorOrigem]);

  // Filtragem linha a linha
  const filteredMovs = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return movs ?? [];
    return (movs ?? []).filter((m) => {
      const item = m.item_id ? (itemMap as any)[m.item_id] : null;
      return [item?.nome, item?.id_item, m.responsavel, m.evento_projeto, m.finalidade, m.observacoes]
        .some((v) => normalize(String(v ?? "")).includes(nq));
    });
  }, [movs, q, itemMap]);

  // SAÍDA: agrupar por requisicao_numero
  const grupos = useMemo(() => {
    if (tipo !== "saida") return [];
    const map = new Map<string, any>();
    for (const m of filteredMovs) {
      const key = m.requisicao_numero != null ? `req-${m.requisicao_numero}` : `solo-${m.id}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          numero: m.requisicao_numero,
          data_movimento: m.data_movimento,
          responsavel: m.responsavel,
          evento_projeto: m.evento_projeto,
          finalidade: m.finalidade,
          data_prevista_devolucao: m.data_prevista_devolucao,
          observacoes: m.observacoes,
          linhas: [] as Mov[],
          qtd_total: 0,
        });
      }
      const g = map.get(key)!;
      g.linhas.push(m);
      g.qtd_total += Number(m.quantidade);
    }
    return Array.from(map.values());
  }, [filteredMovs, tipo]);

  // Salvar
  const saveMut = useMutation({
    mutationFn: async (p: { meta: any; rows: Array<{ item_id: string; quantidade: number }>; editingGroup?: any }) => {
      if (tipo === "entrada") {
        const linha = p.rows[0];
        const payload = { ...p.meta, tipo: "entrada", item_id: linha.item_id, quantidade: linha.quantidade, created_by: user?.id ?? null };
        if (p.editingGroup?.linhas?.[0]?.id) {
          const { error } = await supabase.from("pat_movimentacoes").update(payload).eq("id", p.editingGroup.linhas[0].id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("pat_movimentacoes").insert(payload);
          if (error) throw error;
        }
        return;
      }
      // saída multi-itens
      let requisicao_numero: number | null = p.editingGroup?.numero ?? null;
      if (p.editingGroup) {
        const ids = (p.editingGroup.linhas as Mov[]).map((l) => l.id);
        const { data: dev } = await supabase.from("pat_movimentacoes").select("id").in("saida_origem_id", ids).eq("tipo", "devolucao").limit(1);
        if (dev && dev.length) throw new Error("Esta requisição já tem devoluções vinculadas. Exclua as devoluções antes de editar.");
        const { error: delErr } = await supabase.from("pat_movimentacoes").delete().in("id", ids);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.rpc("next_pat_requisicao_numero" as any);
        if (error) throw error;
        requisicao_numero = data as number;
      }
      const inserts = p.rows.map((l) => ({
        ...p.meta,
        tipo: "saida",
        item_id: l.item_id,
        quantidade: l.quantidade,
        requisicao_numero,
        saida_status: "aberta",
        created_by: user?.id ?? null,
      }));
      const { error } = await supabase.from("pat_movimentacoes").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pat_movs", tipo] });
      qc.invalidateQueries({ queryKey: ["pat_saidas_abertas"] });
      qc.invalidateQueries({ queryKey: ["pat_devolvido_por_origem"] });
      toast.success("Salvo");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delGroupMut = useMutation({
    mutationFn: async (grupo: any) => {
      const linhas: Mov[] = grupo.linhas ?? [grupo];
      const ids = linhas.map((l) => l.id);
      if (tipo === "saida") {
        await supabase.from("pat_movimentacoes").delete().in("saida_origem_id", ids).eq("tipo", "devolucao");
      }
      const { error } = await supabase.from("pat_movimentacoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pat_movs", tipo] });
      qc.invalidateQueries({ queryKey: ["pat_movs", "devolucao"] });
      qc.invalidateQueries({ queryKey: ["pat_saidas_abertas"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title={titulo}
        description={descricao}
        actions={
          isAdmin && (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova {tipo === "entrada" ? "entrada" : "saída"}
            </Button>
          )
        }
      />

      <Card className="p-3 mb-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por item, responsável, evento…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          {tipo === "saida" ? (
            <table className="w-full text-xs">
              <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr className="text-left">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2 w-24">REQ</th>
                  <th className="px-2 py-2 w-28">Data</th>
                  <th className="px-2 py-2">Responsável</th>
                  <th className="px-2 py-2">Evento / Projeto</th>
                  <th className="px-2 py-2">Finalidade</th>
                  <th className="px-2 py-2 text-right w-16">Itens</th>
                  <th className="px-2 py-2 text-right w-20">Qtd total</th>
                  <th className="px-2 py-2 w-28">Prev. devol.</th>
                  <th className="px-2 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && grupos.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhuma saída.</td></tr>}
                {grupos.map((g: any) => {
                  const isOpen = !!expandido[g.id];
                  // Agrupar linhas (peças) por grupo de item para exibição resumida
                  const porGrupo = new Map<string, { nome: string; especificacao: string; unidade: string; qtd: number; ids: string[] }>();
                  for (const l of g.linhas as Mov[]) {
                    const it: any = l.item_id ? (itemMap as any)[l.item_id] : null;
                    const gk = [normalize(it?.nome ?? ""), normalize(it?.especificacao ?? ""), normalize(it?.dimensoes ?? ""), normalize(it?.unidade ?? "")].join("|");
                    if (!porGrupo.has(gk)) {
                      porGrupo.set(gk, { nome: it?.nome ?? "—", especificacao: it?.especificacao ?? "", unidade: it?.unidade ?? "", qtd: 0, ids: [] });
                    }
                    const e = porGrupo.get(gk)!;
                    e.qtd += Number(l.quantidade);
                    if (it?.id_item) e.ids.push(it.id_item);
                  }
                  const itensAgrupados = Array.from(porGrupo.values());
                  return (
                    <>
                      <tr key={g.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-1 py-1.5">
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => setExpandido((p) => ({ ...p, [g.id]: !p[g.id] }))}>
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        </td>
                        <td className="px-2 py-1.5 font-mono">{g.numero != null ? `REQ-${String(g.numero).padStart(4, "0")}` : "—"}</td>
                        <td className="px-2 py-1.5">{new Date(g.data_movimento).toLocaleDateString("pt-BR")}</td>
                        <td className="px-2 py-1.5">{g.responsavel ?? "—"}</td>
                        <td className="px-2 py-1.5">{g.evento_projeto ?? "—"}</td>
                        <td className="px-2 py-1.5">{g.finalidade ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right">{itensAgrupados.length}</td>
                        <td className="px-2 py-1.5 text-right">{g.qtd_total}</td>
                        <td className="px-2 py-1.5">{g.data_prevista_devolucao ? new Date(g.data_prevista_devolucao + "T00:00").toLocaleDateString("pt-BR") : ""}</td>
                        <td className="px-2 py-1.5">
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button className="h-6 w-6 rounded hover:bg-muted inline-flex items-center justify-center" onClick={() => { setEditing(g); setOpen(true); }}><Pencil className="h-3 w-3" /></button>
                              <button className="h-6 w-6 rounded hover:bg-muted text-rose-600 inline-flex items-center justify-center" onClick={() => { if (confirm("Remover toda a requisição?")) delGroupMut.mutate(g); }}><Trash2 className="h-3 w-3" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${g.id}-exp`} className="bg-muted/20">
                          <td colSpan={10} className="px-6 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="text-left py-1">Item</th>
                                  <th className="text-left py-1">Especificação</th>
                                  <th className="text-right py-1 w-20">Qtd</th>
                                  <th className="text-left py-1 pl-2 w-20">UN</th>
                                  <th className="text-left py-1 pl-2">Códigos</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itensAgrupados.map((row, idx) => (
                                  <tr key={idx} className="border-t border-border/40 align-top">
                                    <td className="py-1 font-medium">{row.nome}</td>
                                    <td className="py-1 text-muted-foreground">{row.especificacao}</td>
                                    <td className="py-1 text-right tabular-nums">{row.qtd}</td>
                                    <td className="py-1 pl-2 text-muted-foreground">{row.unidade}</td>
                                    <td className="py-1 pl-2 font-mono text-[11px] text-muted-foreground">{row.ids.join(", ")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr className="text-left">
                  <th className="px-2 py-2 w-28">Data</th>
                  <th className="px-2 py-2 w-24">Código</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2 text-right w-16">Qtd</th>
                  <th className="px-2 py-2">Responsável</th>
                  <th className="px-2 py-2">Evento / Projeto</th>
                  <th className="px-2 py-2">Finalidade</th>
                  <th className="px-2 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && filteredMovs.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhuma movimentação.</td></tr>}
                {filteredMovs.map((m: Mov) => {
                  const it: any = m.item_id ? (itemMap as any)[m.item_id] : null;
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-2 py-1.5">{new Date(m.data_movimento).toLocaleDateString("pt-BR")}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{it?.id_item ?? "—"}</td>
                      <td className="px-2 py-1.5"><span className="font-medium">{it?.nome ?? "—"}</span></td>
                      <td className="px-2 py-1.5 text-right">{m.quantidade}</td>
                      <td className="px-2 py-1.5">{m.responsavel}</td>
                      <td className="px-2 py-1.5">{m.evento_projeto}</td>
                      <td className="px-2 py-1.5">{m.finalidade}</td>
                      <td className="px-2 py-1.5">
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button className="h-6 w-6 rounded hover:bg-muted inline-flex items-center justify-center" onClick={() => { setEditing({ ...m, linhas: [m] }); setOpen(true); }}><Pencil className="h-3 w-3" /></button>
                            <button className="h-6 w-6 rounded hover:bg-muted text-rose-600 inline-flex items-center justify-center" onClick={() => { if (confirm("Remover?")) delGroupMut.mutate({ linhas: [m] }); }}><Trash2 className="h-3 w-3" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-5xl w-[min(1100px,96vw)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} {tipo === "entrada" ? "entrada" : "saída"}</DialogTitle></DialogHeader>
          <MovForm
            tipo={tipo}
            editing={editing}
            itens={(itens ?? []) as PatItem[]}
            emUsoPorItem={emUsoPorItem}
            onSubmit={(meta, rows) => saveMut.mutate({ meta, rows, editingGroup: editing })}
            submitting={saveMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function MovForm({ tipo, editing, itens, emUsoPorItem, onSubmit, submitting }: {
  tipo: "entrada" | "saida";
  editing: any | null;
  itens: PatItem[];
  emUsoPorItem: Map<string, number>;
  onSubmit: (meta: any, rows: Array<{ item_id: string; quantidade: number }>) => void;
  submitting: boolean;
}) {
  const isSaida = tipo === "saida";
  const first: Mov | null = editing?.linhas?.[0] ?? null;
  const [meta, setMeta] = useState({
    data_movimento: first?.data_movimento
      ? first.data_movimento.slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    responsavel: first?.responsavel ?? "",
    evento_projeto: first?.evento_projeto ?? "",
    finalidade: first?.finalidade ?? "",
    data_prevista_devolucao: first?.data_prevista_devolucao ?? "",
    condicao: first?.condicao ?? "",
    observacoes: first?.observacoes ?? "",
  });

  // IDs em uso pelas peças que estamos editando (não devem contar como "ocupadas" na re-alocação)
  const excludeIds = useMemo(() => {
    const s = new Set<string>();
    if (editing?.linhas) for (const l of editing.linhas as Mov[]) if (l.item_id) s.add(l.item_id);
    return s;
  }, [editing]);

  const itemMap = useMemo(() => Object.fromEntries(itens.map((i) => [i.id, i])), [itens]);

  // Grupos para saída (recalculado dinamicamente)
  const groups: PatGroup[] = useMemo(
    () => buildPatGroups(itens, emUsoPorItem, excludeIds),
    [itens, emUsoPorItem, excludeIds],
  );

  // Linhas — SAÍDA agora também usa item_id (peça a peça)
  const [linhasSaida, setLinhasSaida] = useState<LinhaSaida[]>(() => {
    if (!isSaida || !editing?.linhas?.length) return [{ item_id: "", quantidade: "1" }];
    return (editing.linhas as Mov[]).map((l) => ({
      item_id: l.item_id ?? "",
      quantidade: String(l.quantidade),
    }));
  });

  const [linhasEntrada, setLinhasEntrada] = useState<LinhaEntrada[]>(() => {
    if (isSaida) return [{ item_id: "", quantidade: "1" }];
    if (editing?.linhas?.length) {
      return editing.linhas.map((l: Mov) => ({ item_id: l.item_id ?? "", quantidade: String(l.quantidade) }));
    }
    return [{ item_id: "", quantidade: "1" }];
  });

  const setM = (k: string, v: any) => setMeta((p) => ({ ...p, [k]: v }));

  const addLinhaSaida = () => setLinhasSaida((a) => [...a, { item_id: "", quantidade: "1" }]);
  const remLinhaSaida = (i: number) => setLinhasSaida((a) => (a.length === 1 ? a : a.filter((_, idx) => idx !== i)));
  const setLS = (i: number, k: keyof LinhaSaida, v: string) => setLinhasSaida((arr) => {
    const novo = [...arr]; novo[i] = { ...novo[i], [k]: v }; return novo;
  });
  const setLE = (i: number, k: keyof LinhaEntrada, v: string) => setLinhasEntrada((arr) => {
    const novo = [...arr]; novo[i] = { ...novo[i], [k]: v }; return novo;
  });

  // Solicitantes
  const { data: solicitantes = [] } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("nome").eq("status", "ativo").order("nome")).data ?? [],
  });
  const responsavelOptions = useMemo(
    () => Array.from(new Set((solicitantes as any[]).map((s) => s.nome).filter(Boolean))),
    [solicitantes],
  );

  const itemOptionsEntrada = useMemo(
    () => itens.map((i) => ({
      id: i.id,
      nome: i.nome,
      codigo: i.id_item ?? "",
      codigo_proprio: i.cod != null ? String(i.cod) : null,
      unidade: i.unidade ?? undefined,
      quantidade_atual: i.quantidade ?? undefined,
    })),
    [itens],
  );

  // Opções item-a-item para SAÍDA (uma linha por peça, com livre/em uso)
  const itemOptionsSaida: PatItemOption[] = useMemo(
    () => buildPatItemOptions(itens, emUsoPorItem, excludeIds),
    [itens, emUsoPorItem, excludeIds],
  );
  const itemOptionsById = useMemo(
    () => new Map(itemOptionsSaida.map((o) => [o.id, o])),
    [itemOptionsSaida],
  );

  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const focusQty = (i: number) => {
    setTimeout(() => { const el = qtyRefs.current[i]; if (el) { el.focus(); el.select(); } }, 30);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const metaPayload = {
          data_movimento: meta.data_movimento ? new Date(meta.data_movimento).toISOString() : new Date().toISOString(),
          responsavel: meta.responsavel || null,
          evento_projeto: meta.evento_projeto || null,
          finalidade: meta.finalidade || null,
          data_prevista_devolucao: isSaida ? (meta.data_prevista_devolucao || null) : null,
          condicao: !isSaida ? (meta.condicao || null) : null,
          observacoes: meta.observacoes || null,
        };

        if (!isSaida) {
          const validas = linhasEntrada.filter((l) => l.item_id && Number(l.quantidade) > 0);
          if (!validas.length) return toast.error("Selecione um item");
          onSubmit(metaPayload, validas.map((l) => ({ item_id: l.item_id, quantidade: Number(l.quantidade) })));
          return;
        }

        // SAÍDA: aloca peças por grupo
        const rows: Array<{ item_id: string; quantidade: number }> = [];
        for (const l of linhasSaida) {
          if (!l.groupKey || Number(l.quantidade) <= 0) continue;
          const g = groups.find((gg) => gg.key === l.groupKey);
          if (!g) return toast.error("Grupo de item inválido");
          const qtdReq = Math.floor(Number(l.quantidade));
          if (qtdReq > g.disponivel) return toast.error(`Disponível insuficiente para ${g.nome} (disp: ${g.disponivel})`);
          const ids = allocateFromGroup(g, qtdReq, emUsoPorItem, excludeIds);
          if (ids.length < qtdReq) return toast.error(`Não foi possível alocar ${qtdReq} de ${g.nome}`);
          for (const id of ids) rows.push({ item_id: id, quantidade: 1 });
        }
        if (!rows.length) return toast.error("Adicione pelo menos um item");
        onSubmit(metaPayload, rows);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="datetime-local" value={meta.data_movimento} onChange={(e) => setM("data_movimento", e.target.value)} /></div>
        <div>
          <Label>Responsável</Label>
          <ComboboxCreatable
            options={responsavelOptions}
            value={meta.responsavel}
            onChange={(v) => setM("responsavel", v)}
            placeholder="Selecione ou digite…"
            searchPlaceholder="Buscar solicitante ou digitar novo…"
          />
        </div>
        <div>
          <Label>Evento / Projeto</Label>
          <EventoSheetCombobox value={meta.evento_projeto} onChange={(v) => setM("evento_projeto", v ?? "")} />
        </div>
        <div>
          <Label>Finalidade</Label>
          <ComboboxCreatable
            options={FINALIDADES}
            value={meta.finalidade}
            onChange={(v) => setM("finalidade", v)}
            placeholder="Motivo da movimentação"
            searchPlaceholder="Buscar ou digitar…"
          />
        </div>
        {isSaida && (
          <div>
            <Label>Previsão de devolução</Label>
            <Input type="date" value={meta.data_prevista_devolucao ?? ""} onChange={(e) => setM("data_prevista_devolucao", e.target.value || null)} />
          </div>
        )}
        {!isSaida && (
          <div>
            <Label>Condição do item recebido</Label>
            <Select value={meta.condicao ?? ""} onValueChange={(v) => setM("condicao", v)}>
              <SelectTrigger><SelectValue placeholder="Estado em que retornou" /></SelectTrigger>
              <SelectContent>{CONDICOES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={meta.observacoes ?? ""} onChange={(e) => setM("observacoes", e.target.value)} /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Itens {isSaida ? "da saída" : "da entrada"}</h3>
          {isSaida && (
            <Button type="button" size="sm" variant="outline" onClick={addLinhaSaida}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar item
            </Button>
          )}
        </div>
        <Card className="p-3 space-y-2">
          {isSaida ? (
            linhasSaida.map((l, i) => {
              const grupo = groups.find((g) => g.key === l.groupKey);
              return (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[260px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Item (grupo)
                    </label>
                    <PatGroupSelect
                      groups={groups}
                      value={l.groupKey}
                      onChange={(key) => setLS(i, "groupKey", key)}
                      onAfterSelect={() => focusQty(i)}
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Quantidade {grupo ? `(máx. ${grupo.disponivel})` : ""}
                    </label>
                    <Input
                      ref={(el) => { qtyRefs.current[i] = el; }}
                      type="number" min="1" step="1"
                      max={grupo?.disponivel ?? undefined}
                      value={l.quantidade}
                      onChange={(e) => setLS(i, "quantidade", e.target.value)}
                    />
                  </div>
                  <div className="w-9">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remLinhaSaida(i)} disabled={linhasSaida.length === 1} title="Remover">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            linhasEntrada.map((l, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[260px]">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1 h-[14px]">
                    Item
                    {l.item_id && <PatItemInfoHover itemId={l.item_id} />}
                  </label>
                  <ItemSearchSelect
                    itens={itemOptionsEntrada}
                    value={l.item_id}
                    onChange={(id) => setLE(i, "item_id", id)}
                    placeholder="Buscar por COD, ID ou nome…"
                    showStock
                    onAfterSelect={() => focusQty(i)}
                  />
                </div>
                <div className="w-28">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1 h-[14px]">Quantidade</label>
                  <Input
                    ref={(el) => { qtyRefs.current[i] = el; }}
                    type="number" min="0.01" step="0.01"
                    value={l.quantidade}
                    onChange={(e) => setLE(i, "quantidade", e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : (editing ? "Salvar alterações" : "Registrar")}</Button>
      </DialogFooter>
    </form>
  );
}
