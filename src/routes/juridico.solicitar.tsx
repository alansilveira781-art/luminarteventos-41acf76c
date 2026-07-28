import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJuridicoSolicitante } from "@/hooks/useJuridicoSolicitante";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPRESAS } from "@/lib/empresas";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/juridico/solicitar")({ component: SolicitarContrato });

const sb = supabase as any;

const vazio = {
  tipo: "contrato" as "contrato" | "aditivo",
  titulo: "",
  empresa: "" as string,
  cliente_nome: "",
  cliente_documento: "",
  cliente_email: "",
  cliente_telefone: "",
  valor: "",
  data_fechamento: "",
  observacoes: "",
};

function SolicitarContrato() {
  const { user, loading: authLoading } = useAuth();
  const { podeSolicitar, loading } = useJuridicoSolicitante();
  const [form, setForm] = useState({ ...vazio });
  const [enviado, setEnviado] = useState(false);

  const set = (k: keyof typeof vazio, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const enviar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o objeto/título do contrato");
      if (!form.cliente_nome.trim()) throw new Error("Informe o nome do cliente");
      const valor = form.valor ? Number(form.valor.replace(/\./g, "").replace(",", ".")) : null;
      const { error } = await sb.from("juridico_contratos").insert({
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        status: "entrada",
        empresa: form.empresa || null,
        cliente_nome: form.cliente_nome.trim(),
        cliente_documento: form.cliente_documento.trim() || null,
        cliente_email: form.cliente_email.trim() || null,
        cliente_telefone: form.cliente_telefone.trim() || null,
        valor: Number.isFinite(valor as number) ? valor : null,
        data_fechamento: form.data_fechamento || null,
        observacoes: form.observacoes.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEnviado(true);
      setForm({ ...vazio });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar solicitação"),
  });

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/auth" />;
  if (!podeSolicitar) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Você não tem permissão para preencher o formulário de solicitação de contratos.
          Solicite a liberação ao administrador do módulo Jurídico.
        </Card>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="p-6">
        <Card className="p-10 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
          <div className="text-lg font-medium">Solicitação enviada!</div>
          <p className="text-sm text-muted-foreground">
            O contrato entrou na coluna "Entrada" do quadro do Jurídico.
          </p>
          <Button onClick={() => setEnviado(false)}>Nova solicitação</Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Solicitar contrato"
        description="Preencha os dados abaixo. A solicitação entra automaticamente no quadro do Jurídico, na coluna Entrada."
      />

      <Card className="p-5 max-w-3xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contrato">Contrato</SelectItem>
                <SelectItem value="aditivo">Aditivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Select value={form.empresa} onValueChange={(v) => set("empresa", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {EMPRESAS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Objeto / título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Contrato de cenografia — Evento X" />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="Razão social ou nome" />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ / CPF</Label>
            <Input value={form.cliente_documento} onChange={(e) => set("cliente_documento", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail do cliente</Label>
            <Input type="email" value={form.cliente_email} onChange={(e) => set("cliente_email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone do cliente</Label>
            <Input value={form.cliente_telefone} onChange={(e) => set("cliente_telefone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-1.5">
            <Label>Data de fechamento</Label>
            <Input type="date" value={form.data_fechamento} onChange={(e) => set("data_fechamento", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={4} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Condições, prazos, anexos que serão enviados, etc." />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
            {enviar.isPending ? "Enviando…" : "Enviar solicitação"}
          </Button>
        </div>
      </Card>
    </>
  );
}
