import { useState, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { generateNextSku } from "@/lib/sku";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { SelectCreatable } from "@/components/SelectCreatable";
import { Upload, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

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
    codigo_proprio: initial?.codigo_proprio ?? "",
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

  useEffect(() => {
    if (!initial && !form.codigo) {
      generateNextSku().then((sku) => setForm((f) => (f.codigo ? f : { ...f, codigo: sku }))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
        <FormField label="Código (gerado automaticamente)"><Input readOnly value={form.codigo} className="bg-muted/40" /></FormField>
        <FormField label="Código próprio (fornecedor)">
          <Input
            value={form.codigo_proprio}
            onChange={(e) => set("codigo_proprio", e.target.value)}
            placeholder="Ex.: 4825/1010"
          />
        </FormField>
        <FormField label="Nome*"><Input required value={form.nome} onChange={(e) => set("nome", e.target.value)} /></FormField>
        <FormField label="Categoria">
          <SelectCreatable table="categorias" value={form.categoria || null} onChange={(v) => set("categoria", v ?? "")} />
        </FormField>
        <FormField label="Valor unitário (R$)"><Input type="number" min="0" step="0.01" value={form.valor_unitario} onChange={(e) => set("valor_unitario", e.target.value)} placeholder="0.00" /></FormField>
        <FormField label="Unidade de medida">
          <SelectCreatable table="unidades" value={form.unidade || null} onChange={(v) => set("unidade", v ?? "")} />
        </FormField>
        <FormField label="Localização física"><Input value={form.localizacao} onChange={(e) => set("localizacao", e.target.value)} /></FormField>
        <FormField label={initial ? "Quantidade atual (ajuste)" : "Quantidade inicial"}><Input type="number" min={0} step="0.01" value={form.quantidade_atual} onChange={(e) => set("quantidade_atual", e.target.value)} /></FormField>
        <FormField label="Quantidade mínima"><Input type="number" min={0} step="0.01" value={form.quantidade_minima} onChange={(e) => set("quantidade_minima", e.target.value)} /></FormField>
        <FormField label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{itemStatuses.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Foto do item" wide>
          <FotoUpload value={form.foto_url} onChange={(url) => set("foto_url", url)} />
        </FormField>
        <FormField label="Descrição" wide><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></FormField>
        <FormField label="Observações" wide><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : "Salvar item"}</Button></FormActions>
      </FormSection>
    </form>
  );
}

function FotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("item-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
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
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="Prévia" className="h-20 w-20 rounded-md object-cover border border-border" />
        ) : (
          <div className="h-20 w-20 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground">
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
              Remover
            </Button>
          )}
        </div>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole uma URL https://…"
        className="text-xs"
      />
    </div>
  );
}
