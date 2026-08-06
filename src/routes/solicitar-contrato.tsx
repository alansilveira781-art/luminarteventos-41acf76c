import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPRESAS } from "@/lib/empresas";
import { CheckCircle2, Loader2, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";


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

type TipoPessoa = "pf" | "pj";

type Endereco = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const enderecoVazio: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

type Parcela = { vencimento: string; valor: string };

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
  resp_legal2_nome: "",
  resp_legal2_documento: "",
  resp_legal2_email: "",
  resp_legal2_telefone: "",
  valor: "",
  data_fechamento: "",
  montagem_inicio: "",
  montagem_fim: "",
  desmontagem_inicio: "",
  desmontagem_fim: "",
  montagem_hora_inicio: "",
  montagem_hora_fim: "",
  desmontagem_hora_inicio: "",
  desmontagem_hora_fim: "",
  observacoes: "",
};

type Testemunha = { nome: string; documento: string; email: string };
const testemunhaVazia: Testemunha = { nome: "", documento: "", email: "" };

type Campo = keyof typeof vazio;

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const digitos = (v: string) => v.replace(/\D/g, "");
const telOk = (v: string) => digitos(v).length >= 10;
const parseMoeda = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmtMoeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Erro({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[11px] text-destructive">{msg}</p>;
}

function EnderecoFields({
  valor,
  onChange,
  erros,
  prefixo,
}: {
  valor: Endereco;
  onChange: (e: Endereco) => void;
  erros: Record<string, string>;
  prefixo: string;
}) {
  const [buscando, setBuscando] = useState(false);

  async function buscarCep(cep: string) {
    const d = digitos(cep);
    if (d.length !== 8) return;
    setBuscando(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (data?.erro) return;
      onChange({
        ...valor,
        cep,
        logradouro: data.logradouro || valor.logradouro,
        bairro: data.bairro || valor.bairro,
        cidade: data.localidade || valor.cidade,
        uf: data.uf || valor.uf,
      });
    } catch {
      /* preenchimento manual */
    } finally {
      setBuscando(false);
    }
  }

  const set = (k: keyof Endereco, v: string) => onChange({ ...valor, [k]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>CEP *</Label>
        <div className="relative">
          <Input
            inputMode="numeric"
            value={valor.cep}
            onChange={(e) => set("cep", e.target.value)}
            onBlur={(e) => buscarCep(e.target.value)}
            placeholder="00000-000"
          />
          {buscando && (
            <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <Erro msg={erros[`${prefixo}_cep`]} />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label>Logradouro *</Label>
        <Input value={valor.logradouro} onChange={(e) => set("logradouro", e.target.value)} placeholder="Rua / Avenida" />
        <Erro msg={erros[`${prefixo}_logradouro`]} />
      </div>
      <div className="space-y-1.5">
        <Label>Número *</Label>
        <Input value={valor.numero} onChange={(e) => set("numero", e.target.value)} />
        <Erro msg={erros[`${prefixo}_numero`]} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Complemento</Label>
        <Input value={valor.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Sala, bloco…" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Bairro *</Label>
        <Input value={valor.bairro} onChange={(e) => set("bairro", e.target.value)} />
        <Erro msg={erros[`${prefixo}_bairro`]} />
      </div>
      <div className="space-y-1.5">
        <Label>Cidade *</Label>
        <Input value={valor.cidade} onChange={(e) => set("cidade", e.target.value)} />
        <Erro msg={erros[`${prefixo}_cidade`]} />
      </div>
      <div className="space-y-1.5">
        <Label>UF *</Label>
        <Input maxLength={2} value={valor.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
        <Erro msg={erros[`${prefixo}_uf`]} />
      </div>
    </div>
  );
}

function SolicitarContratoPublico() {
  const { user } = useAuth();
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa | null>(null);
  const [form, setForm] = useState({ ...vazio });

  const [endCliente, setEndCliente] = useState<Endereco>({ ...enderecoVazio });
  const [endResp, setEndResp] = useState<Endereco>({ ...enderecoVazio });
  const [resp2Ativo, setResp2Ativo] = useState(false);
  const [endResp2, setEndResp2] = useState<Endereco>({ ...enderecoVazio });
  const [testemunhas, setTestemunhas] = useState<Testemunha[]>([]);
  const [pagForma, setPagForma] = useState<"pix" | "boleto">("pix");
  const [pagModo, setPagModo] = useState<"igual" | "diferente">("igual");
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<Parcela[]>([{ vencimento: "", valor: "" }]);
  const [proposta, setProposta] = useState<File | null>(null);
  const [docEmpresa, setDocEmpresa] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ tipo: string; numero: number | null } | null>(null);

  const isPJ = tipoPessoa === "pj";
  const valorTotal = parseMoeda(form.valor);

  useEffect(() => {
    setParcelas((prev) => {
      const next: Parcela[] = [];
      for (let i = 0; i < qtdParcelas; i++) next.push(prev[i] ?? { vencimento: "", valor: "" });
      return next;
    });
  }, [qtdParcelas]);

  const valoresCalculados = useMemo(() => {
    if (pagModo === "igual" || qtdParcelas === 1) {
      const cent = Math.round(valorTotal * 100);
      const base = Math.floor(cent / qtdParcelas);
      return Array.from({ length: qtdParcelas }, (_, i) =>
        (i === qtdParcelas - 1 ? base + (cent - base * qtdParcelas) : base) / 100,
      );
    }
    return parcelas.map((p) => parseMoeda(p.valor));
  }, [pagModo, qtdParcelas, valorTotal, parcelas]);

  const somaParcelas = valoresCalculados.reduce((a, b) => a + b, 0);

  const set = (k: Campo, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  function validar() {
    const e: Record<string, string> = {};
    const req = (k: string, v: string) => {
      if (!String(v ?? "").trim()) e[k] = "Campo obrigatório";
    };

    req("titulo", form.titulo);
    req("cliente_nome", form.cliente_nome);
    req("cliente_documento", form.cliente_documento);
    req("cliente_email", form.cliente_email);
    req("cliente_telefone", form.cliente_telefone);

    if (!e.cliente_email && !emailOk(form.cliente_email)) e.cliente_email = "E-mail inválido";
    if (!e.cliente_telefone && !telOk(form.cliente_telefone)) e.cliente_telefone = "Telefone inválido";
    if (!e.cliente_documento) {
      const d = digitos(form.cliente_documento);
      if (isPJ && d.length !== 14) e.cliente_documento = "Informe um CNPJ válido (14 dígitos)";
      if (!isPJ && d.length !== 11) e.cliente_documento = "Informe um CPF válido (11 dígitos)";
    }

    const validarEndereco = (end: Endereco, prefixo: string) => {
      req(`${prefixo}_cep`, end.cep);
      req(`${prefixo}_logradouro`, end.logradouro);
      req(`${prefixo}_numero`, end.numero);
      req(`${prefixo}_bairro`, end.bairro);
      req(`${prefixo}_cidade`, end.cidade);
      req(`${prefixo}_uf`, end.uf);
      if (!e[`${prefixo}_cep`] && digitos(end.cep).length !== 8) e[`${prefixo}_cep`] = "CEP inválido";
    };
    validarEndereco(endCliente, "cliente");

    if (isPJ) {
      req("resp_legal_nome", form.resp_legal_nome);
      req("resp_legal_documento", form.resp_legal_documento);
      req("resp_legal_email", form.resp_legal_email);
      req("resp_legal_telefone", form.resp_legal_telefone);
      if (!e.resp_legal_email && !emailOk(form.resp_legal_email)) e.resp_legal_email = "E-mail inválido";
      if (!e.resp_legal_telefone && !telOk(form.resp_legal_telefone)) e.resp_legal_telefone = "Telefone inválido";
      if (!e.resp_legal_documento && digitos(form.resp_legal_documento).length !== 11)
        e.resp_legal_documento = "Informe um CPF válido (11 dígitos)";
      validarEndereco(endResp, "resp_legal");

      if (resp2Ativo) {
        req("resp_legal2_nome", form.resp_legal2_nome);
        req("resp_legal2_documento", form.resp_legal2_documento);
        if (!e.resp_legal2_documento && digitos(form.resp_legal2_documento).length !== 11)
          e.resp_legal2_documento = "Informe um CPF válido (11 dígitos)";
        if (form.resp_legal2_email && !emailOk(form.resp_legal2_email))
          e.resp_legal2_email = "E-mail inválido";
        validarEndereco(endResp2, "resp_legal2");
      }
    }

    testemunhas.forEach((t, i) => {
      if (!t.nome.trim() && !t.documento.trim()) return;
      if (!t.nome.trim()) e[`testemunha_${i}_nome`] = "Informe o nome";
      if (digitos(t.documento).length !== 11) e[`testemunha_${i}_documento`] = "CPF inválido";
      if (t.email && !emailOk(t.email)) e[`testemunha_${i}_email`] = "E-mail inválido";
    });

    if (valorTotal <= 0) e.valor = "Informe o valor do contrato";
    parcelas.forEach((p, i) => {
      if (!p.vencimento) e[`parcela_${i}_venc`] = "Informe a data";
      if (pagModo === "diferente" && qtdParcelas > 1 && parseMoeda(p.valor) <= 0)
        e[`parcela_${i}_valor`] = "Informe o valor";
    });
    if (pagModo === "diferente" && qtdParcelas > 1 && valorTotal > 0 && Math.abs(somaParcelas - valorTotal) > 0.01) {
      e.parcelas_soma = `A soma das parcelas (${fmtMoeda(somaParcelas)}) deve ser igual ao valor total (${fmtMoeda(valorTotal)})`;
    }

    if (!proposta) e.proposta = "Anexo obrigatório";
    if (!docEmpresa) e.doc_empresa = "Anexo obrigatório";
    return e;
  }

  async function enviar() {
    const e = validar();
    setErros(e);
    if (Object.values(e).some(Boolean)) {
      toast.error("Revise os campos destacados");
      return;
    }

    const payload = {
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      empresa: form.empresa || "",
      cliente_tipo: tipoPessoa,
      cliente_nome: form.cliente_nome.trim(),
      cliente_documento: form.cliente_documento.trim(),
      cliente_email: form.cliente_email.trim(),
      cliente_telefone: form.cliente_telefone.trim(),
      cliente_endereco: endCliente,
      resp_legal_nome: isPJ ? form.resp_legal_nome.trim() : "",
      resp_legal_documento: isPJ ? form.resp_legal_documento.trim() : "",
      resp_legal_email: isPJ ? form.resp_legal_email.trim() : "",
      resp_legal_telefone: isPJ ? form.resp_legal_telefone.trim() : "",
      resp_legal_endereco: isPJ ? endResp : null,
      resp_legal2_nome: isPJ && resp2Ativo ? form.resp_legal2_nome.trim() : "",
      resp_legal2_documento: isPJ && resp2Ativo ? form.resp_legal2_documento.trim() : "",
      resp_legal2_email: isPJ && resp2Ativo ? form.resp_legal2_email.trim() : "",
      resp_legal2_telefone: isPJ && resp2Ativo ? form.resp_legal2_telefone.trim() : "",
      resp_legal2_endereco: isPJ && resp2Ativo ? endResp2 : null,
      testemunhas: testemunhas
        .filter((t) => t.nome.trim())
        .map((t) => ({ nome: t.nome.trim(), documento: t.documento.trim(), email: t.email.trim() })),
      valor: valorTotal,
      pagamento_forma: pagForma,
      pagamento_modo: qtdParcelas > 1 ? pagModo : "igual",
      pagamento_parcelas: parcelas.map((p, i) => ({
        n: i + 1,
        vencimento: p.vencimento,
        valor: Number(valoresCalculados[i]?.toFixed(2) ?? 0),
      })),
      data_fechamento: form.data_fechamento || "",
      observacoes: form.observacoes.trim(),
      solicitante_email: user?.email ?? "",

    };

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (proposta) fd.append("proposta", proposta);
    if (docEmpresa) fd.append(isPJ ? "cartao_cnpj" : "documento_foto", docEmpresa);

    setEnviando(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/public/solicitar-contrato", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });


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
      setEndCliente({ ...enderecoVazio });
      setEndResp({ ...enderecoVazio });
      setEndResp2({ ...enderecoVazio });
      setResp2Ativo(false);
      setTestemunhas([]);
      setParcelas([{ vencimento: "", valor: "" }]);
      setQtdParcelas(1);
      setProposta(null);
      setDocEmpresa(null);
      setErros({});
      setTipoPessoa(null);
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

  if (!tipoPessoa) {
    return (
      <main className="min-h-dvh bg-muted/30 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <header className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Solicitar contrato</h1>
            <p className="text-sm text-muted-foreground">
              Para começar, informe se a contratação é com Pessoa Física ou Pessoa Jurídica.
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className="p-6 space-y-2 cursor-pointer hover:border-primary transition-colors"
              onClick={() => setTipoPessoa("pf")}
            >
              <User className="h-6 w-6 text-primary" />
              <div className="text-base font-medium">Pessoa Física</div>
              <p className="text-xs text-muted-foreground">Nome, CPF, endereço completo, e-mail e telefone.</p>
            </Card>
            <Card
              className="p-6 space-y-2 cursor-pointer hover:border-primary transition-colors"
              onClick={() => setTipoPessoa("pj")}
            >
              <Building2 className="h-6 w-6 text-primary" />
              <div className="text-base font-medium">Pessoa Jurídica</div>
              <p className="text-xs text-muted-foreground">
                Razão social, CNPJ, endereço completo e dados do responsável legal.
              </p>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Solicitar contrato</h1>
          <p className="text-sm text-muted-foreground">
            {isPJ ? "Pessoa Jurídica" : "Pessoa Física"} ·{" "}
            <button className="underline underline-offset-2" onClick={() => setTipoPessoa(null)}>
              trocar
            </button>
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
              <Label>Valor total (R$) *</Label>
              <Input inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
              <Erro msg={erros.valor} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de fechamento</Label>
              <Input type="date" value={form.data_fechamento} onChange={(e) => set("data_fechamento", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">{isPJ ? "Dados da Empresa" : "Dados Pessoais"}</div>
            <p className="text-xs text-muted-foreground">
              {isPJ ? "Empresa contratante/contratada do contrato." : "Pessoa contratante/contratada do contrato."} Todos os campos são obrigatórios.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{isPJ ? "Razão social *" : "Nome *"}</Label>
              <Input
                autoComplete={isPJ ? "organization" : "name"}
                value={form.cliente_nome}
                onChange={(e) => set("cliente_nome", e.target.value)}
                placeholder={isPJ ? "Razão social" : "Nome completo"}
              />
              <Erro msg={erros.cliente_nome} />
            </div>
            <div className="space-y-1.5">
              <Label>{isPJ ? "CNPJ *" : "CPF *"}</Label>
              <Input inputMode="numeric" value={form.cliente_documento} onChange={(e) => set("cliente_documento", e.target.value)} />
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
          <div className="pt-1">
            <div className="text-xs font-medium text-muted-foreground mb-2">Endereço completo</div>
            <EnderecoFields valor={endCliente} onChange={setEndCliente} erros={erros} prefixo="cliente" />
          </div>
        </Card>

        {isPJ && (
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
                <Label>CPF *</Label>
                <Input inputMode="numeric" value={form.resp_legal_documento} onChange={(e) => set("resp_legal_documento", e.target.value)} />
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
            <div className="pt-1">
              <div className="text-xs font-medium text-muted-foreground mb-2">Endereço completo</div>
              <EnderecoFields valor={endResp} onChange={setEndResp} erros={erros} prefixo="resp_legal" />
            </div>

            {!resp2Ativo ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setResp2Ativo(true)}>
                Adicionar segundo responsável legal
              </Button>
            ) : (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">2º Responsável Legal</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResp2Ativo(false);
                      setEndResp2({ ...enderecoVazio });
                      set("resp_legal2_nome", "");
                      set("resp_legal2_documento", "");
                      set("resp_legal2_email", "");
                      set("resp_legal2_telefone", "");
                    }}
                  >
                    Remover
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input value={form.resp_legal2_nome} onChange={(e) => set("resp_legal2_nome", e.target.value)} placeholder="Nome completo" />
                    <Erro msg={erros.resp_legal2_nome} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF *</Label>
                    <Input inputMode="numeric" value={form.resp_legal2_documento} onChange={(e) => set("resp_legal2_documento", e.target.value)} />
                    <Erro msg={erros.resp_legal2_documento} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.resp_legal2_email} onChange={(e) => set("resp_legal2_email", e.target.value)} />
                    <Erro msg={erros.resp_legal2_email} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={form.resp_legal2_telefone} onChange={(e) => set("resp_legal2_telefone", e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Endereço completo</div>
                  <EnderecoFields valor={endResp2} onChange={setEndResp2} erros={erros} prefixo="resp_legal2" />
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Testemunhas (opcional)</div>
            <p className="text-xs text-muted-foreground">
              Até 2 testemunhas que assinarão o contrato.
            </p>
          </div>
          {testemunhas.map((t, i) => (
            <div key={i} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] items-start">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={t.nome}
                  onChange={(e) =>
                    setTestemunhas((p) => p.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
                  }
                />
                <Erro msg={erros[`testemunha_${i}_nome`]} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF *</Label>
                <Input
                  inputMode="numeric"
                  value={t.documento}
                  onChange={(e) =>
                    setTestemunhas((p) => p.map((x, j) => (j === i ? { ...x, documento: e.target.value } : x)))
                  }
                />
                <Erro msg={erros[`testemunha_${i}_documento`]} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={t.email}
                  onChange={(e) =>
                    setTestemunhas((p) => p.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                  }
                />
                <Erro msg={erros[`testemunha_${i}_email`]} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-6"
                onClick={() => setTestemunhas((p) => p.filter((_, j) => j !== i))}
              >
                Remover
              </Button>
            </div>
          ))}
          {testemunhas.length < 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestemunhas((p) => [...p, { ...testemunhaVazia }])}
            >
              Adicionar testemunha
            </Button>
          )}
        </Card>


        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Forma de pagamento</div>
            <p className="text-xs text-muted-foreground">
              Valor total informado: <span className="font-medium text-foreground">{fmtMoeda(valorTotal)}</span>
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Forma *</Label>
              <Select value={pagForma} onValueChange={(v) => setPagForma(v as "pix" | "boleto")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parcelas *</Label>
              <Input
                type="number"
                min={1}
                max={36}
                value={qtdParcelas}
                onChange={(e) => setQtdParcelas(Math.min(36, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            {qtdParcelas > 1 && (
              <div className="space-y-1.5">
                <Label>Divisão *</Label>
                <Select value={pagModo} onValueChange={(v) => setPagModo(v as "igual" | "diferente")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="igual">Parcelas iguais</SelectItem>
                    <SelectItem value="diferente">Valores diferentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {parcelas.map((p, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[70px_1fr_1fr] items-start">
                <div className="text-xs text-muted-foreground pt-2.5">{i + 1}ª parcela</div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vencimento *</Label>
                  <Input
                    type="date"
                    value={p.vencimento}
                    onChange={(e) =>
                      setParcelas((prev) => prev.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))
                    }
                  />
                  <Erro msg={erros[`parcela_${i}_venc`]} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor (R$)</Label>
                  {pagModo === "diferente" && qtdParcelas > 1 ? (
                    <>
                      <Input
                        inputMode="decimal"
                        value={p.valor}
                        onChange={(e) =>
                          setParcelas((prev) => prev.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))
                        }
                        placeholder="0,00"
                      />
                      <Erro msg={erros[`parcela_${i}_valor`]} />
                    </>
                  ) : (
                    <Input readOnly value={fmtMoeda(valoresCalculados[i] ?? 0)} className="bg-muted/50" />
                  )}
                </div>
              </div>
            ))}
            {erros.parcelas_soma && <Erro msg={erros.parcelas_soma} />}
            {qtdParcelas > 1 && (
              <p className="text-[11px] text-muted-foreground">
                Soma das parcelas: <span className="font-medium">{fmtMoeda(somaParcelas)}</span>
              </p>
            )}
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
              <Label>{isPJ ? "Cartão CNPJ (PDF/imagem) *" : "Documento com foto — RG/CNH (PDF/imagem) *"}</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  setDocEmpresa(e.target.files?.[0] ?? null);
                  setErros((x) => ({ ...x, doc_empresa: "" }));
                }}
              />
              {docEmpresa && (
                <p className="text-[11px] text-muted-foreground">
                  {docEmpresa.name} · {(docEmpresa.size / 1024).toFixed(1)} KB
                </p>
              )}
              <Erro msg={erros.doc_empresa} />
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
