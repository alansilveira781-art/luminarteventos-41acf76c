import { useState } from "react";
import { FormActions, FormField, FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FornecedorForm({ initial, onSubmit, submitting }: any) {
  const [f, setF] = useState({
    nome: initial?.nome ?? "", nome_fantasia: initial?.nome_fantasia ?? "",
    documento: initial?.documento ?? "",
    contato_nome: initial?.contato_nome ?? "", telefone: initial?.telefone ?? "",
    email: initial?.email ?? "", endereco: initial?.endereco ?? "",
    tipo_fornecimento: initial?.tipo_fornecimento ?? "",
    status: initial?.status ?? "ativo", observacoes: initial?.observacoes ?? "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-4">
      <FormSection>
        <FormField label="Nome*" wide><Input required value={f.nome} onChange={(e) => set("nome", e.target.value)} /></FormField>
        <FormField label="CNPJ/CPF"><Input value={f.documento} onChange={(e) => set("documento", e.target.value)} /></FormField>
        <FormField label="Tipo de fornecimento"><Input value={f.tipo_fornecimento} onChange={(e) => set("tipo_fornecimento", e.target.value)} /></FormField>
        <FormField label="Contato"><Input value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} /></FormField>
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
        <FormField label="Endereço" wide><Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} /></FormField>
        <FormField label="Observações" wide><Textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></FormField>
        <FormActions><Button type="submit" size="lg" disabled={submitting}>{submitting ? "Salvando…" : "Salvar fornecedor"}</Button></FormActions>
      </FormSection>
    </form>
  );
}
