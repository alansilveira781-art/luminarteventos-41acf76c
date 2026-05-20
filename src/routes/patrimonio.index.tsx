import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/patrimonio/")({ component: PatrimonioInventario });

const ESTADOS = ["OTIMO", "BOM", "EM MANUTENCAO", "DANIFICADO"];
const UNIDADES = ["UNIDADE", "M²", "METRAGEM", "PAR", "PEÇA"];
const CATEGORIAS = ["ACERVO", "IMOBILIZADO", "ILUMINACAO", "ESTOQUE", "MAQUINARIOS", "FERRAMENTAS", "VEICULOS", "ESTRUTURAS", "AMBIENTE", "DECORACAO"];

type Pat = {
  id: string; cod: number | null; id_item: string | null;
  categoria: string | null; subcategoria: string | null; data_compra: string | null;
  nome: string; especificacao: string | null; dimensoes: string | null;
  quantidade: number; valor: number; estado: string; unidade: string;
  localizacao: string | null; imagem_url: string | null; observacoes: string | null;
};

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PatrimonioInventario() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth();
  const isAdmin = isModuleAdmin("patrimonio");
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("__all");
  const [filterEstado, setFilterEstado] = useState<string>("__all");
  const [filterLoc, setFilterLoc] = useState<string>("__all");
  const [editing, setEditing] = useState<Pat | null>(null);
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["pat_itens"],
    queryFn: async () => {
      const all: Pat[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens")
          .select("*")
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

  const locs = useMemo(() => {
    const s = new Set<string>();
    (itens ?? []).forEach((i) => i.localizacao && s.add(i.localizacao));
    return Array.from(s).sort();
  }, [itens]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    return (itens ?? []).filter((i) => {
      if (filterCat !== "__all" && i.categoria !== filterCat) return false;
      if (filterEstado !== "__all" && i.estado !== filterEstado) return false;
      if (filterLoc !== "__all" && i.localizacao !== filterLoc) return false;
      if (!nq) return true;
      return [i.nome, i.id_item, i.especificacao, i.localizacao, i.subcategoria]
        .some((v) => normalize(String(v ?? "")).includes(nq));
    });
  }, [itens, q, filterCat, filterEstado, filterLoc]);

  const totals = useMemo(() => {
    const t = { count: filtered.length, valor: 0, qtd: 0 };
    filtered.forEach((i) => { t.valor += Number(i.valor || 0) * Number(i.quantidade || 1); t.qtd += Number(i.quantidade || 0); });
    return t;
  }, [filtered]);

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("pat_itens").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        // gera id_item se categoria informada
        if (!rest.id_item && rest.categoria) {
          const prefix = rest.categoria.slice(0, 3).toUpperCase();
          const { data } = await supabase
            .from("pat_itens")
            .select("id_item")
            .ilike("id_item", `${prefix}-%`)
            .order("id_item", { ascending: false })
            .limit(1);
          const last = data?.[0]?.id_item ?? `${prefix}-0000`;
          const n = parseInt(String(last).split("-")[1] || "0", 10) + 1;
          rest.id_item = `${prefix}-${String(n).padStart(4, "0")}`;
        }
        const { error } = await supabase.from("pat_itens").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pat_itens"] });
      toast.success("Salvo");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pat_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pat_itens"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Inventário de Patrimônio"
        description={`${totals.count} itens · ${totals.qtd.toLocaleString("pt-BR")} un · ${brl(totals.valor)}`}
        actions={
          isAdmin && (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo item
            </Button>
          )
        }
      />

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome, ID, local…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas categorias</SelectItem>
              {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos estados</SelectItem>
              {ESTADOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLoc} onValueChange={setFilterLoc}>
            <SelectTrigger><SelectValue placeholder="Local" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos locais</SelectItem>
              {locs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 w-16">COD</th>
                <th className="px-2 py-2 w-24">ID</th>
                <th className="px-2 py-2">Categoria</th>
                <th className="px-2 py-2">Subcategoria</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Dimensões</th>
                <th className="px-2 py-2 text-right w-16">Qtde</th>
                <th className="px-2 py-2 text-right w-24">Valor</th>
                <th className="px-2 py-2 w-32">Estado</th>
                <th className="px-2 py-2">Local</th>
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">Nenhum item.</td></tr>}
              {filtered.slice(0, 500).map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-2 py-1.5">{i.cod}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{i.id_item}</td>
                  <td className="px-2 py-1.5">{i.categoria}</td>
                  <td className="px-2 py-1.5">{i.subcategoria}</td>
                  <td className="px-2 py-1.5 font-medium">{i.nome}{i.especificacao && <span className="text-muted-foreground"> · {i.especificacao}</span>}</td>
                  <td className="px-2 py-1.5">{i.dimensoes}</td>
                  <td className="px-2 py-1.5 text-right">{i.quantidade}</td>
                  <td className="px-2 py-1.5 text-right">{brl(i.valor)}</td>
                  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    i.estado === "OTIMO" ? "bg-emerald-500/10 text-emerald-600" :
                    i.estado === "BOM" ? "bg-blue-500/10 text-blue-600" :
                    i.estado === "EM MANUTENCAO" ? "bg-amber-500/10 text-amber-600" :
                    "bg-rose-500/10 text-rose-600"
                  }`}>{i.estado}</span></td>
                  <td className="px-2 py-1.5">{i.localizacao}</td>
                  <td className="px-2 py-1.5">
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button className="h-6 w-6 rounded hover:bg-muted inline-flex items-center justify-center" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-3 w-3" /></button>
                        <button className="h-6 w-6 rounded hover:bg-muted text-rose-600 inline-flex items-center justify-center" onClick={() => { if (confirm("Remover?")) delMut.mutate(i.id); }}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length > 500 && <tr><td colSpan={11} className="p-2 text-center text-xs text-muted-foreground">Mostrando 500 de {filtered.length}. Refine os filtros para ver mais.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <ItemDialog open={open} onOpenChange={setOpen} editing={editing} onSave={(p) => saveMut.mutate(p)} />
    </>
  );
}

function ItemDialog({ open, onOpenChange, editing, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Pat | null; onSave: (p: any) => void;
}) {
  const [f, setF] = useState<any>({});
  useMemo(() => { setF(editing ?? { estado: "BOM", unidade: "UNIDADE", quantidade: 1, valor: 0 }); }, [editing, open]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></div>
          <div><Label>Categoria</Label>
            <Select value={f.categoria ?? ""} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Subcategoria</Label><Input value={f.subcategoria ?? ""} onChange={(e) => set("subcategoria", e.target.value)} /></div>
          <div><Label>Especificação</Label><Input value={f.especificacao ?? ""} onChange={(e) => set("especificacao", e.target.value)} /></div>
          <div><Label>Dimensões</Label><Input value={f.dimensoes ?? ""} onChange={(e) => set("dimensoes", e.target.value)} /></div>
          <div><Label>Quantidade</Label><Input type="number" step="0.01" value={f.quantidade ?? 1} onChange={(e) => set("quantidade", Number(e.target.value))} /></div>
          <div><Label>Unidade</Label>
            <Select value={f.unidade ?? "UNIDADE"} onValueChange={(v) => set("unidade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNIDADES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.valor ?? 0} onChange={(e) => set("valor", Number(e.target.value))} /></div>
          <div><Label>Estado</Label>
            <Select value={f.estado ?? "BOM"} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data de compra</Label><Input type="date" value={f.data_compra ?? ""} onChange={(e) => set("data_compra", e.target.value || null)} /></div>
          <div className="col-span-2"><Label>Local</Label><Input value={f.localizacao ?? ""} onChange={(e) => set("localizacao", e.target.value)} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { if (!f.nome) return toast.error("Informe o nome"); onSave(f); }}>{editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
