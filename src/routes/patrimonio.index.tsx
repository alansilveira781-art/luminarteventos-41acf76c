import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Download, Upload, ImagePlus, X } from "lucide-react";
import { useRef } from "react";
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
import { SortableTh, useSort } from "@/components/SortableTh";

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
  const [bulkPhotosOpen, setBulkPhotosOpen] = useState(false);

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

  const { sort, toggleSort, applySort } = useSort();

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const base = (itens ?? []).filter((i) => {
      if (filterCat !== "__all" && i.categoria !== filterCat) return false;
      if (filterEstado !== "__all" && i.estado !== filterEstado) return false;
      if (filterLoc !== "__all" && i.localizacao !== filterLoc) return false;
      if (!nq) return true;
      return [i.nome, i.id_item, i.especificacao, i.localizacao, i.subcategoria]
        .some((v) => normalize(String(v ?? "")).includes(nq));
    });
    return applySort(base);
  }, [itens, q, filterCat, filterEstado, filterLoc, sort]);

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
          <>
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => setBulkPhotosOpen(true)}>
                <Upload className="h-4 w-4 mr-1" /> Importar fotos
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo item
              </Button>
            )}
          </>
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
            <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="text-left">
                <th className="px-2 py-2 w-14 bg-card">Foto</th>
                <SortableTh sort={sort} onToggle={toggleSort} k="cod" label="COD" className="bg-card w-16" />
                <SortableTh sort={sort} onToggle={toggleSort} k="id_item" label="ID" className="bg-card w-24" />
                <SortableTh sort={sort} onToggle={toggleSort} k="categoria" label="Categoria" className="bg-card" />
                <SortableTh sort={sort} onToggle={toggleSort} k="subcategoria" label="Subcategoria" className="bg-card" />
                <SortableTh sort={sort} onToggle={toggleSort} k="nome" label="Item" className="bg-card" />
                <SortableTh sort={sort} onToggle={toggleSort} k="dimensoes" label="Dimensões" className="bg-card" />
                <SortableTh sort={sort} onToggle={toggleSort} k="quantidade" label="Qtde" align="right" className="bg-card w-16" />
                <SortableTh sort={sort} onToggle={toggleSort} k="valor" label="Valor" align="right" className="bg-card w-24" />
                <SortableTh sort={sort} onToggle={toggleSort} k="estado" label="Estado" className="bg-card w-32" />
                <SortableTh sort={sort} onToggle={toggleSort} k="localizacao" label="Local" className="bg-card" />
                <th className="px-2 py-2 w-20 bg-card"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={12} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={12} className="p-4 text-center text-muted-foreground">Nenhum item.</td></tr>}
              {filtered.slice(0, 500).map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-2 py-1.5">
                    {i.imagem_url ? (
                      <a href={i.imagem_url} target="_blank" rel="noreferrer">
                        <img src={i.imagem_url} alt={i.nome} className="h-9 w-9 rounded object-cover border border-border" />
                      </a>
                    ) : (
                      <div className="h-9 w-9 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </td>
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
              {filtered.length > 500 && <tr><td colSpan={12} className="p-2 text-center text-xs text-muted-foreground">Mostrando 500 de {filtered.length}. Refine os filtros para ver mais.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <ItemDialog open={open} onOpenChange={setOpen} editing={editing} onSave={(p) => saveMut.mutate(p)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} all={itens ?? []} filtered={filtered} />
      <BulkPhotosDialog
        open={bulkPhotosOpen}
        onOpenChange={setBulkPhotosOpen}
        itens={itens ?? []}
        onDone={() => qc.invalidateQueries({ queryKey: ["pat_itens"] })}
      />
    </>
  );
}

const EXPORT_COLS: { key: keyof Pat; label: string }[] = [
  { key: "cod", label: "COD" },
  { key: "id_item", label: "ID" },
  { key: "categoria", label: "Categoria" },
  { key: "subcategoria", label: "Subcategoria" },
  { key: "nome", label: "Item" },
  { key: "especificacao", label: "Especificação" },
  { key: "dimensoes", label: "Dimensões" },
  { key: "quantidade", label: "Quantidade" },
  { key: "unidade", label: "Unidade" },
  { key: "valor", label: "Valor unitário" },
  { key: "estado", label: "Estado" },
  { key: "localizacao", label: "Local" },
  { key: "data_compra", label: "Data compra" },
  { key: "observacoes", label: "Observações" },
];

function ExportDialog({ open, onOpenChange, all, filtered }: {
  open: boolean; onOpenChange: (v: boolean) => void; all: Pat[]; filtered: Pat[];
}) {
  const [scope, setScope] = useState<"filtered" | "all">("filtered");
  const [format, setFormat] = useState<"csv" | "xls">("csv");
  const [cols, setCols] = useState<string[]>(EXPORT_COLS.map((c) => c.key as string));

  const toggle = (k: string) => setCols((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);

  const doExport = () => {
    const rows = scope === "all" ? all : filtered;
    const selected = EXPORT_COLS.filter((c) => cols.includes(c.key as string));
    if (!selected.length) return toast.error("Selecione ao menos uma coluna");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `inventario_patrimonio_${date}.${format === "csv" ? "csv" : "xls"}`;

    if (format === "csv") {
      const esc = (v: any) => {
        const s = v == null ? "" : String(v);
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [selected.map((c) => esc(c.label)).join(";")];
      rows.forEach((r) => lines.push(selected.map((c) => esc(r[c.key])).join(";")));
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      downloadBlob(blob, filename);
    } else {
      const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const head = selected.map((c) => `<th>${esc(c.label)}</th>`).join("");
      const body = rows.map((r) => `<tr>${selected.map((c) => `<td>${esc(r[c.key])}</td>`).join("")}</tr>`).join("");
      const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
      const blob = new Blob([html], { type: "application/vnd.ms-excel" });
      downloadBlob(blob, filename);
    }
    toast.success(`${rows.length} itens exportados`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Exportar relatório do inventário</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="filtered">Itens filtrados ({filtered.length})</SelectItem>
                  <SelectItem value="all">Todos os itens ({all.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel/Google Sheets)</SelectItem>
                  <SelectItem value="xls">Excel (.xls)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Colunas</Label>
              <div className="flex gap-2 text-xs">
                <button className="text-primary hover:underline" onClick={() => setCols(EXPORT_COLS.map((c) => c.key as string))}>Marcar todas</button>
                <button className="text-muted-foreground hover:underline" onClick={() => setCols([])}>Limpar</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md">
              {EXPORT_COLS.map((c) => (
                <label key={c.key as string} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={cols.includes(c.key as string)} onCheckedChange={() => toggle(c.key as string)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={doExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          <div className="col-span-2">
            <Label>Foto do item</Label>
            <PatFotoUpload value={f.imagem_url ?? ""} onChange={(url) => set("imagem_url", url)} />
          </div>
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

function PatFotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 5 MB).");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("pat-photos").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("pat-photos").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Foto enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="Prévia" className="h-24 w-24 rounded-md object-cover border border-border" />
        ) : (
          <div className="h-24 w-24 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground">
            <ImagePlus className="h-6 w-6" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "Enviando…" : value ? "Trocar imagem" : "Anexar imagem"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="h-4 w-4 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="ou cole uma URL https://…" className="text-xs" />
    </div>
  );
}
