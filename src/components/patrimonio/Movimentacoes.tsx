import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
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
import { DbComboboxCreatable } from "@/components/DbComboboxCreatable";


type Mov = {
  id: string; tipo: string; item_id: string | null; quantidade: number;
  data_movimento: string; responsavel: string | null; evento_projeto: string | null;
  finalidade: string | null; observacoes: string | null; condicao: string | null;
  data_prevista_devolucao: string | null;
};

const FINALIDADES = ["Evento", "Manutenção", "Empréstimo", "Descarte", "Transferência", "Outro"];
const CONDICOES = ["perfeito", "danificado", "quebrado", "faltando_peca", "em_manutencao"];

export function PatrimonioMovimentacoes({ tipo, titulo, descricao }: {
  tipo: "entrada" | "saida"; titulo: string; descricao: string;
}) {
  const qc = useQueryClient();
  const { isModuleAdmin, user } = useAuth();
  const isAdmin = isModuleAdmin("patrimonio");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mov | null>(null);

  const { data: itens } = useQuery({
    queryKey: ["pat_itens_lite"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens").select("id,id_item,nome,categoria,localizacao")
          .order("nome").range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const itemMap = useMemo(() => Object.fromEntries((itens ?? []).map((i) => [i.id, i])), [itens]);

  const { data: movs, isLoading } = useQuery({
    queryKey: ["pat_movs", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes").select("*").eq("tipo", tipo)
        .order("data_movimento", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Mov[];
    },
  });

  const filtered = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return movs ?? [];
    return (movs ?? []).filter((m) => {
      const item = m.item_id ? itemMap[m.item_id] : null;
      return [item?.nome, item?.id_item, m.responsavel, m.evento_projeto, m.finalidade, m.observacoes]
        .some((v) => normalize(String(v ?? "")).includes(nq));
    });
  }, [movs, q, itemMap]);

  const saveMut = useMutation({
    mutationFn: async (p: any) => {
      const { id, ...rest } = p;
      if (id) {
        const { error } = await supabase.from("pat_movimentacoes").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pat_movimentacoes").insert({ ...rest, tipo, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pat_movs", tipo] });
      toast.success("Salvo");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pat_movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pat_movs", tipo] }); toast.success("Removido"); },
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
          <table className="w-full text-xs">
            <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="text-left">
                <th className="px-2 py-2 w-28">Data</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2 text-right w-16">Qtde</th>
                <th className="px-2 py-2">Responsável</th>
                <th className="px-2 py-2">Evento / Projeto</th>
                <th className="px-2 py-2">Finalidade</th>
                {tipo === "saida" && <th className="px-2 py-2 w-28">Prev. devol.</th>}
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={tipo === "saida" ? 8 : 7} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={tipo === "saida" ? 8 : 7} className="p-4 text-center text-muted-foreground">Nenhuma movimentação.</td></tr>}
              {filtered.map((m) => {
                const item = m.item_id ? itemMap[m.item_id] : null;
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-2 py-1.5">{new Date(m.data_movimento).toLocaleDateString("pt-BR")}</td>
                    <td className="px-2 py-1.5"><span className="font-mono text-[10px] text-muted-foreground">{item?.id_item}</span> <span className="font-medium">{item?.nome ?? "—"}</span></td>
                    <td className="px-2 py-1.5 text-right">{m.quantidade}</td>
                    <td className="px-2 py-1.5">{m.responsavel}</td>
                    <td className="px-2 py-1.5">{m.evento_projeto}</td>
                    <td className="px-2 py-1.5">{m.finalidade}</td>
                    {tipo === "saida" && <td className="px-2 py-1.5">{m.data_prevista_devolucao ? new Date(m.data_prevista_devolucao + "T00:00").toLocaleDateString("pt-BR") : ""}</td>}
                    <td className="px-2 py-1.5">
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button className="h-6 w-6 rounded hover:bg-muted inline-flex items-center justify-center" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-3 w-3" /></button>
                          <button className="h-6 w-6 rounded hover:bg-muted text-rose-600 inline-flex items-center justify-center" onClick={() => { if (confirm("Remover?")) delMut.mutate(m.id); }}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <MovDialog open={open} onOpenChange={setOpen} editing={editing} tipo={tipo} itens={itens ?? []} onSave={(p) => saveMut.mutate(p)} />
    </>
  );
}

function MovDialog({ open, onOpenChange, editing, tipo, itens, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Mov | null;
  tipo: "entrada" | "saida"; itens: any[]; onSave: (p: any) => void;
}) {
  const [f, setF] = useState<any>({});
  useEffect(() => {
    setF(editing ?? {
      quantidade: 1,
      data_movimento: new Date().toISOString().slice(0, 16),
    });
  }, [editing, open]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  // Solicitantes do módulo estoque, usados como sugestão para "Responsável"
  const { data: solicitantes = [] } = useQuery({
    queryKey: ["solicitantes-select"],
    queryFn: async () => (await supabase.from("solicitantes").select("nome").eq("status", "ativo").order("nome")).data ?? [],
  });
  const responsavelOptions = useMemo(
    () => Array.from(new Set((solicitantes as any[]).map((s) => s.nome).filter(Boolean))),
    [solicitantes],
  );

  // Adapta itens do patrimônio ao formato do ItemSearchSelect
  const itemOptions = useMemo(
    () => (itens ?? []).map((i: any) => ({
      id: i.id,
      nome: i.nome,
      codigo: i.id_item ?? "",
      codigo_proprio: i.cod != null ? String(i.cod) : null,
      unidade: undefined,
      quantidade_atual: undefined,
    })),
    [itens],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} {tipo === "entrada" ? "entrada" : "saída"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Item *</Label>
            <ItemSearchSelect
              itens={itemOptions}
              value={f.item_id ?? ""}
              onChange={(id) => set("item_id", id)}
              placeholder="Buscar item por COD, ID ou nome…"
            />
          </div>
          <div><Label>Quantidade *</Label><Input type="number" step="0.01" value={f.quantidade ?? 1} onChange={(e) => set("quantidade", Number(e.target.value))} /></div>
          <div><Label>Data</Label><Input type="datetime-local" value={f.data_movimento?.slice(0, 16) ?? ""} onChange={(e) => set("data_movimento", e.target.value)} /></div>
          <div>
            <Label>Responsável</Label>
            <ComboboxCreatable
              options={responsavelOptions}
              value={f.responsavel ?? ""}
              onChange={(v) => set("responsavel", v)}
              placeholder="Selecione ou digite…"
              searchPlaceholder="Buscar solicitante ou digitar novo…"
            />
          </div>
          <div>
            <Label>Evento / Projeto</Label>
            <DbComboboxCreatable
              table="eventos_projetos"
              value={f.evento_projeto ?? ""}
              onChange={(v) => set("evento_projeto", v)}
              placeholder="Selecione ou cadastre…"
            />
          </div>
          <div className="col-span-2"><Label>Finalidade</Label>
            <ComboboxCreatable
              options={FINALIDADES}
              value={f.finalidade ?? ""}
              onChange={(v) => set("finalidade", v)}
              placeholder="Motivo da movimentação"
              searchPlaceholder="Buscar ou digitar…"
            />
          </div>

          {tipo === "saida" && (
            <div className="col-span-2"><Label>Previsão de devolução</Label><Input type="date" value={f.data_prevista_devolucao ?? ""} onChange={(e) => set("data_prevista_devolucao", e.target.value || null)} /></div>
          )}
          {tipo === "entrada" && (
            <div className="col-span-2"><Label>Condição do item recebido</Label>
              <Select value={f.condicao ?? ""} onValueChange={(v) => set("condicao", v)}>
                <SelectTrigger><SelectValue placeholder="Estado em que retornou" /></SelectTrigger>
                <SelectContent>{CONDICOES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => {
            if (!f.item_id) return toast.error("Selecione um item");
            if (!f.quantidade || f.quantidade <= 0) return toast.error("Informe a quantidade");
            const payload = { ...f, data_movimento: f.data_movimento ? new Date(f.data_movimento).toISOString() : new Date().toISOString() };
            onSave(payload);
          }}>{editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
