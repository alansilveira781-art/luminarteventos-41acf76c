import { useState } from "react";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SolicitanteForm({ initial, onSubmit, submitting }: any) {
  const [f, setF] = useState({
    nome: initial?.nome ?? "", apelido: initial?.apelido ?? "",
    setor: initial?.setor ?? "", cargo: initial?.cargo ?? "",
    telefone: initial?.telefone ?? "", email: initial?.email ?? "",
    status: initial?.status ?? "ativo", observacoes: initial?.observacoes ?? "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-4">
      <FormSection>
        <FormField label="Nome*" wide><Input required value={f.nome} onChange={(e) => set("nome", e.target.value)} /></FormField>
        <FormField label="Apelido"><Input value={f.apelido} onChange={(e) => set("apelido", e.target.value)} /></FormField>
        <FormField label="Setor"><Input value={f.setor} onChange={(e) => set("setor", e.target.value)} /></FormField>
        <FormField label="Cargo"><Input value={f.cargo} onChange={(e) => set("cargo", e.target.value)} /></FormField>
        <FormField label="Telefone"><Input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} /></FormField>
        <FormField label="E-mail"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></FormField>
        <FormField label="Status">
          <Select value={f.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : "Salvar solicitante"}</Button></FormActions>
      </FormSection>
    </form>
  );
}
