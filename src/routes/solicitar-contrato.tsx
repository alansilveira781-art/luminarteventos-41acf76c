import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPRESAS } from "@/lib/empresas";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/solicitar-contrato")({
  head: () => ({
    meta: [
      { title: "Solicitar contrato — Grupo Luminart" },
      {
        name: "description",
        content: "Envie uma solicitação de contrato ou aditivo ao setor Jurídico do Grupo Luminart.",
      },
      { property: "og:title", content: "Solicitar contrato — Grupo Luminart" },
      {
        property: "og:description",
        content: "Formulário de solicitação de contratos e aditivos do Grupo Luminart.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: SolicitarContratoPublico,
});

const vazio = {
  tipo: "contrato" as "contrato" | "aditivo",
  titulo: "",
  empresa: "" as string,
  cliente_nome: "",
  cliente_documento: "",
  cliente_email: "",
  cliente_telefone: "",
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

function SolicitarContratoPublico() {
  const [form, setForm] = useState({ ...vazio });
  const [proposta, setProposta] = useState<File | null>(null);
  const [cartao, setCartao] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ tipo: string; numero: number | null } | null>(null);

  const set = (k: Campo, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  async function enviar() {
    const e = validar(form, proposta, cartao);
    setErros(e as Record<string, string>);
    if (Object.values(e).some(Boolean)) {
      toast.error("Revise os campos destacados");
      return;
    }

    const valorNum = form.valor ? Number(form.valor.replace(/\./g, "").replace(",", ".")) : null;
    const payload = {
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      empresa: form.empresa || "",
      cliente_nome: form.cliente_nome.trim(),
      cliente_documento: form.cliente_documento.trim(),
      cliente_email: form.cliente_email.trim(),
      cliente_telefone: form.cliente_telefone.trim(),
      resp_legal_nome: form.resp_legal_nome.trim(),
      resp_legal_documento: form.resp_legal_documento.trim(),
      resp_legal_email: form.resp_legal_email.trim(),
      resp_legal_telefone: form.resp_legal_telefone.trim(),
      valor: Number.isFinite(valorNum as number) ? valorNum : null,
      data_fechamento: form.data_fechamento || "",
      observacoes: form.observacoes.trim(),
    };

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (proposta) fd.append("proposta", proposta);
    if (cartao) fd.append("cartao_cnpj", cartao);

    setEnviando(true);
    try {
      const res = await fetch("/api/public/solicitar-contrato", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.error ?? "Não foi possível enviar a solicitação");
        return;
      }
      if (data.anexos_falhados > 0) {
        toast.warning("Solicitação enviada, mas houve falha ao anexar algum arquivo.");
      }
      setEnviado({ tipo: data.tipo, numero: data.numero ?? null });
      setForm({ ...vazio });
      setProposta(null);
      setCartao(null);
      setErros({});
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="min-h-dvh bg-muted/30 flex items-center justify-center p-6">
        <Card className="p-10 text-center space-y-4 max-w-md">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
          <h1 className="text-lg font-medium">Solicitação enviada!</h1>
          <p className="text-sm text-muted-foreground">
            Protocolo:{" "}
            <span className="font-mono font-medium text-foreground">
              {(enviado.tipo === "aditivo" ? "ADITIVO-" : "CONTRATO-") + (enviado.numero ?? "—")}
            </span>
            <br />
            O setor Jurídico já recebeu os dados e os anexos.
          </p>
          <Button onClick={() => setEnviado(null)}>Nova solicitação</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Solicitar contrato</h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo. A solicitação vai direto para o setor Jurídico do Grupo Luminart.
          </p>
        </header>

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
              <Input autoComplete="organization" value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="Razão social" />
              <Erro msg={erros.cliente_nome} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / CPF *</Label>
              <Input value={form.cliente_documento} onChange={(e) => set("cliente_documento", e.target.value)} />
              <Erro msg={erros.cliente_documento} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" autoComplete="email" value={form.cliente_email} onChange={(e) => set("cliente_email", e.target.value)} />
              <Erro msg={erros.cliente_email} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input autoComplete="tel" value={form.cliente_telefone} onChange={(e) => set("cliente_telefone", e.target.value)} />
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
            <p className="text-xs text-muted-foreground">Máximo de 10 MB por arquivo.</p>
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
            <Button onClick={enviar} disabled={enviando}>
              {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {enviando ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
