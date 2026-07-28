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
  // Dados da Empresa
  cliente_nome: "",
  cliente_documento: "",
  cliente_email: "",
  cliente_telefone: "",
  // Responsável Legal
  resp_legal_nome: "",
  resp_legal_documento: "",
  resp_legal_email: "",
  resp_legal_telefone: "",
  valor: "",
  data_fechamento: "",
  observacoes: "",
};

type Campo = keyof typeof vazio;

const OBRIGATORIOS: Campo[] = [
  "titulo",
  "cliente_nome",
  "cliente_documento",
  "cliente_email",
  "cliente_telefone",
  "resp_legal_nome",
  "resp_legal_documento",
  "resp_legal_email",
  "resp_legal_telefone",
];

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const docOk = (v: string) => v.replace(/\D/g, "").length >= 11;
const telOk = (v: string) => v.replace(/\D/g, "").length >= 10;

function validar(form: typeof vazio, proposta: File | null, cartao: File | null) {
  const erros: Partial<Record<Campo | "proposta" | "cartao_cnpj", string>> = {};
  for (const c of OBRIGATORIOS) {
    if (!String(form[c] ?? "").trim()) erros[c] = "Campo obrigatório";
  }
  if (!erros.cliente_email && !emailOk(form.cliente_email)) erros.cliente_email = "E-mail inválido";
  if (!erros.resp_legal_email && !emailOk(form.resp_legal_email)) erros.resp_legal_email = "E-mail inválido";
  if (!erros.cliente_documento && !docOk(form.cliente_documento)) erros.cliente_documento = "Informe um CNPJ/CPF válido";
  if (!erros.resp_legal_documento && !docOk(form.resp_legal_documento)) erros.resp_legal_documento = "Informe um CPF/CNPJ válido";
  if (!erros.cliente_telefone && !telOk(form.cliente_telefone)) erros.cliente_telefone = "Telefone inválido";
  if (!erros.resp_legal_telefone && !telOk(form.resp_legal_telefone)) erros.resp_legal_telefone = "Telefone inválido";
  if (!proposta) erros.proposta = "Anexo obrigatório";
  if (!cartao) erros.cartao_cnpj = "Anexo obrigatório";
  return erros;
}

function Erro({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[11px] text-destructive">{msg}</p>;
}

function SolicitarContrato() {
  const { user, loading: authLoading } = useAuth();
  const { podeSolicitar, loading } = useJuridicoSolicitante();
  const [form, setForm] = useState({ ...vazio });
  const [proposta, setProposta] = useState<File | null>(null);
  const [cartao, setCartao] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);

  const set = (k: Campo, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  async function anexar(contratoId: string, file: File, tipo: string) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${contratoId}/${Date.now()}_${safe}`;
    const { error: upErr } = await sb.storage
      .from("juridico-anexos")
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { error } = await sb.from("juridico_anexos").insert({
      contrato_id: contratoId,
      nome: file.name,
      path,
      mime_type: file.type || null,
      tamanho: file.size,
      tipo,
      uploaded_by: user?.id ?? null,
    });
    if (error) throw error;
  }

  const enviar = useMutation({
    mutationFn: async () => {
      const e = validar(form, proposta, cartao);
      setErros(e as Record<string, string>);
      if (Object.values(e).some(Boolean)) throw new Error("Revise os campos destacados");

      const valor = form.valor ? Number(form.valor.replace(/\./g, "").replace(",", ".")) : null;
      const { data: criado, error } = await sb
        .from("juridico_contratos")
        .insert({
          titulo: form.titulo.trim(),
          tipo: form.tipo,
          status: "entrada",
          empresa: form.empresa || null,
          cliente_nome: form.cliente_nome.trim(),
          cliente_documento: form.cliente_documento.trim(),
          cliente_email: form.cliente_email.trim(),
          cliente_telefone: form.cliente_telefone.trim(),
          resp_legal_nome: form.resp_legal_nome.trim(),
          resp_legal_documento: form.resp_legal_documento.trim(),
          resp_legal_email: form.resp_legal_email.trim(),
          resp_legal_telefone: form.resp_legal_telefone.trim(),
          valor: Number.isFinite(valor as number) ? valor : null,
          data_fechamento: form.data_fechamento || null,
          observacoes: form.observacoes.trim() || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      try {
        if (proposta) await anexar(criado.id, proposta, "proposta");
        if (cartao) await anexar(criado.id, cartao, "cartao_cnpj");
      } catch (err: any) {
        toast.error(`Solicitação criada, mas falhou ao anexar arquivos: ${err?.message ?? err}`);
      }
    },
    onSuccess: () => {
      setEnviado(true);
      setForm({ ...vazio });
      setProposta(null);
      setCartao(null);
      setErros({});
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
            O contrato entrou na coluna "Entrada" do quadro do Jurídico, já com os anexos.
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

      <div className="max-w-3xl space-y-4">
        <Card className="p-5 space-y-4">
          <div className="text-sm font-semibold">Solicitação</div>
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
              <Label>Empresa do grupo</Label>
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
              <Erro msg={erros.titulo} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Data de fechamento</Label>
              <Input type="date" value={form.data_fechamento} onChange={(e) => set("data_fechamento", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Dados da Empresa</div>
            <p className="text-xs text-muted-foreground">Empresa contratante/contratada do contrato. Todos os campos são obrigatórios.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="Razão social" />
              <Erro msg={erros.cliente_nome} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / CPF *</Label>
              <Input value={form.cliente_documento} onChange={(e) => set("cliente_documento", e.target.value)} />
              <Erro msg={erros.cliente_documento} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={form.cliente_email} onChange={(e) => set("cliente_email", e.target.value)} />
              <Erro msg={erros.cliente_email} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.cliente_telefone} onChange={(e) => set("cliente_telefone", e.target.value)} />
              <Erro msg={erros.cliente_telefone} />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Responsável Legal</div>
            <p className="text-xs text-muted-foreground">Pessoa que assina pela empresa. Todos os campos são obrigatórios.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.resp_legal_nome} onChange={(e) => set("resp_legal_nome", e.target.value)} placeholder="Nome completo" />
              <Erro msg={erros.resp_legal_nome} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / CPF *</Label>
              <Input value={form.resp_legal_documento} onChange={(e) => set("resp_legal_documento", e.target.value)} />
              <Erro msg={erros.resp_legal_documento} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={form.resp_legal_email} onChange={(e) => set("resp_legal_email", e.target.value)} />
              <Erro msg={erros.resp_legal_email} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.resp_legal_telefone} onChange={(e) => set("resp_legal_telefone", e.target.value)} />
              <Erro msg={erros.resp_legal_telefone} />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Anexos obrigatórios</div>
            <p className="text-xs text-muted-foreground">Os arquivos ficam anexados ao card do contrato no quadro do Jurídico.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proposta (PDF/Word) *</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  setProposta(e.target.files?.[0] ?? null);
                  setErros((x) => ({ ...x, proposta: "" }));
                }}
              />
              {proposta && (
                <p className="text-[11px] text-muted-foreground">
                  {proposta.name} · {(proposta.size / 1024).toFixed(1)} KB
                </p>
              )}
              <Erro msg={erros.proposta} />
            </div>
            <div className="space-y-1.5">
              <Label>Cartão CNPJ (PDF/imagem) *</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  setCartao(e.target.files?.[0] ?? null);
                  setErros((x) => ({ ...x, cartao_cnpj: "" }));
                }}
              />
              {cartao && (
                <p className="text-[11px] text-muted-foreground">
                  {cartao.name} · {(cartao.size / 1024).toFixed(1)} KB
                </p>
              )}
              <Erro msg={erros.cartao_cnpj} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={4} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Condições, prazos, informações complementares…" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
              {enviar.isPending ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
