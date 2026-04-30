import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormActions, FormField, FormSection } from "@/components/FormSection";

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
  const [form, setForm] = useState({
    codigo: initial?.codigo ?? "",
    nome: initial?.nome ?? "",
    categoria: initial?.categoria ?? "",
    subcategoria: initial?.subcategoria ?? "",
    descricao: initial?.descricao ?? "",
    unidade: initial?.unidade ?? "un",
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
        });
      }}
      className="space-y-4"
    >
      <FormSection>
        <FormField label="Código*"><Input required value={form.codigo} onChange={(e) => set("codigo", e.target.value)} /></FormField>
        <FormField label="Nome*"><Input required value={form.nome} onChange={(e) => set("nome", e.target.value)} /></FormField>
        <FormField label="Categoria"><Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} /></FormField>
        <FormField label="Subcategoria"><Input value={form.subcategoria} onChange={(e) => set("subcategoria", e.target.value)} /></FormField>
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
    </form>
  );
}
