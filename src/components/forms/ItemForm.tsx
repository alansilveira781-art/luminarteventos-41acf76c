import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const itemStatuses = [
  { v: "disponivel", l: "Disponível" },
  { v: "baixo_estoque", l: "Baixo estoque" },
  { v: "sem_estoque", l: "Sem estoque" },
  { v: "em_manutencao", l: "Em manutenção" },
  { v: "inativo", l: "Inativo" },
];

export function ItemForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: any;
  onSubmit: (payload: any) => void;
  submitting?: boolean;
}) {
  const qc = useQueryClient();
  const [novaCategoriaOpen, setNovaCategoriaOpen] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");

  const { data: categorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("nome").order("nome")).data ?? [],
  });

  const criarCategoria = useMutation({
    mutationFn: async (nome: string) => {
      const n = nome.trim();
      if (!n) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("categorias").insert({ nome: n });
      if (error) throw error;
      return n;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      set("categoria", n);
      setNovaCategoria("");
      setNovaCategoriaOpen(false);
      toast.success("Categoria criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    codigo: initial?.codigo ?? "",
    nome: initial?.nome ?? "",
    categoria: initial?.categoria ?? "",
    descricao: initial?.descricao ?? "",
    unidade: initial?.unidade ?? "un",
    valor_unitario: initial?.valor_unitario ?? "",
    quantidade_atual: initial?.quantidade_atual ?? 0,
    quantidade_minima: initial?.quantidade_minima ?? 0,
    localizacao: initial?.localizacao ?? "",
    status: initial?.status ?? "disponivel",
    observacoes: initial?.observacoes ?? "",
    foto_url: initial?.foto_url ?? "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          quantidade_atual: Number(form.quantidade_atual),
          quantidade_minima: Number(form.quantidade_minima),
          valor_unitario: form.valor_unitario === "" ? null : Number(form.valor_unitario),
          subcategoria: null,
        });
      }}
      className="space-y-4"
    >
      <FormSection>
        <FormField label="Código*"><Input required value={form.codigo} onChange={(e) => set("codigo", e.target.value)} /></FormField>
        <FormField label="Nome*"><Input required value={form.nome} onChange={(e) => set("nome", e.target.value)} /></FormField>
        <FormField label="Categoria">
          <div className="flex gap-2">
            <Select value={form.categoria || undefined} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {(categorias ?? []).map((c: any) => (
                  <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={() => setNovaCategoriaOpen(true)} title="Nova categoria">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </FormField>
        <FormField label="Valor unitário (R$)"><Input type="number" min="0" step="0.01" value={form.valor_unitario} onChange={(e) => set("valor_unitario", e.target.value)} placeholder="0.00" /></FormField>
        <FormField label="Unidade de medida"><Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="un, kg, m..." /></FormField>
        <FormField label="Localização física"><Input value={form.localizacao} onChange={(e) => set("localizacao", e.target.value)} /></FormField>
        <FormField label={initial ? "Quantidade atual (ajuste)" : "Quantidade inicial"}><Input type="number" min={0} step="0.01" value={form.quantidade_atual} onChange={(e) => set("quantidade_atual", e.target.value)} /></FormField>
        <FormField label="Quantidade mínima"><Input type="number" min={0} step="0.01" value={form.quantidade_minima} onChange={(e) => set("quantidade_minima", e.target.value)} /></FormField>
        <FormField label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{itemStatuses.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="URL da foto"><Input value={form.foto_url} onChange={(e) => set("foto_url", e.target.value)} placeholder="https://..." /></FormField>
        <FormField label="Descrição" wide><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></FormField>
        <FormField label="Observações" wide><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : "Salvar item"}</Button></FormActions>
      </FormSection>

      <Dialog open={novaCategoriaOpen} onOpenChange={setNovaCategoriaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome da categoria"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setNovaCategoriaOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={() => criarCategoria.mutate(novaCategoria)} disabled={criarCategoria.isPending}>
                {criarCategoria.isPending ? "Criando…" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
