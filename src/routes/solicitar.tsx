import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPO_COMPRA_OPTIONS } from "@/lib/compras";
import { TIPO_DEMANDA_OPTIONS } from "@/lib/demandas";
import { ShoppingCart, Wallet, ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/solicitar")({
  head: () => ({
    meta: [
      { title: "Nova solicitação — Grupo Luminart" },
      { name: "description", content: "Envie uma solicitação de compra ou demanda ao Grupo Luminart." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: SolicitarPage,
});

type Tipo = "compra" | "demanda";

type ItemRow = {
  descricao: string;
  quantidade: string;
  unidade: string;
  valor_unitario: string;
};

type FormState = {
  tipo: Tipo | null;
  titulo: string;
  subtipo: string;
  fornecedor: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_telefone: string;
  descricao: string;
  valor_total: string;
  itens: ItemRow[];
  pago: boolean | null;
  parcelamento: string;
  condicao_pagamento: string;
  data_compra: string;
  is_reembolso: boolean;
  reembolsar_para: string;
};

const emptyItem = (): ItemRow => ({ descricao: "", quantidade: "1", unidade: "un", valor_unitario: "" });

const initial: FormState = {
  tipo: null,
  titulo: "",
  subtipo: "",
  fornecedor: "",
  solicitante_nome: "",
  solicitante_email: "",
  solicitante_telefone: "",
  descricao: "",
  valor_total: "",
  itens: [emptyItem()],
  pago: null,
  parcelamento: "",
  condicao_pagamento: "",
  data_compra: "",
  is_reembolso: false,
  reembolsar_para: "",
};

const TIPOS_DEMANDA_PAGAVEIS = ["alimentacao", "estacionamento", "manutencao_galpao"];

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;
const ACCEPT_TYPES = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function SolicitarPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ numero: number | null; tipo: Tipo } | null>(null);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [opcoes, setOpcoes] = useState<{ parcelamentos: string[]; condicoes_pagamento: string[] }>({
    parcelamentos: [],
    condicoes_pagamento: [],
  });

  useEffect(() => {
    fetch("/api/public/opcoes-pagamento")
      .then((r) => r.json())
      .then((d) => setOpcoes({
        parcelamentos: d.parcelamentos ?? [],
        condicoes_pagamento: d.condicoes_pagamento ?? [],
      }))
      .catch(() => {});
  }, []);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const updateItem = (idx: number, patch: Partial<ItemRow>) =>
    setForm((f) => ({
      ...f,
      itens: f.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));

  const addItem = () => setForm((f) => ({ ...f, itens: [...f.itens, emptyItem()] }));
  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, itens: f.itens.length > 1 ? f.itens.filter((_, i) => i !== idx) : f.itens }));

  function canAdvance(): boolean {
    if (step === 0) return !!form.tipo;
    if (step === 1) {
      if (form.titulo.trim().length === 0) return false;
      if (form.tipo === "demanda" && form.is_reembolso && form.reembolsar_para.trim().length === 0) return false;
      return true;
    }
    if (step === 2) {
      if (form.solicitante_nome.trim().length === 0) return false;
      if (form.tipo === "compra") {
        return form.itens.some(
          (it) => it.descricao.trim().length > 0 && Number(it.quantidade) > 0,
        );
      }
      return form.descricao.trim().length > 0;
    }
    return true;
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    let rejectedSize = 0;
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) {
        rejectedSize++;
        continue;
      }
      accepted.push(f);
    }
    if (rejectedSize > 0) {
      toast.error(`${rejectedSize} arquivo(s) acima de 10 MB foram ignorados.`);
    }
    setAnexos((prev) => {
      const merged = [...prev, ...accepted];
      if (merged.length > MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} arquivos. Os excedentes foram removidos.`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }
  function removeAnexo(idx: number) {
    setAnexos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!form.tipo) return;
    setSending(true);
    try {
      const itensValidos =
        form.tipo === "compra"
          ? form.itens
              .filter((it) => it.descricao.trim().length > 0 && Number(it.quantidade) > 0)
              .map((it) => ({
                descricao: it.descricao.trim(),
                quantidade: Number(it.quantidade),
                unidade: it.unidade.trim(),
                valor_unitario: it.valor_unitario ? Number(it.valor_unitario) : null,
              }))
          : undefined;

      const payload = {
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        subtipo: form.subtipo || null,
        fornecedor: form.fornecedor || "",
        solicitante_nome: form.solicitante_nome.trim(),
        solicitante_email: form.solicitante_email.trim(),
        solicitante_telefone: form.solicitante_telefone.trim(),
        descricao: form.descricao.trim(),
        valor_total: form.valor_total ? Number(form.valor_total) : null,
        itens: itensValidos,
        pago: form.tipo === "demanda" && !form.is_reembolso ? form.pago : null,
        parcelamento: form.is_reembolso ? "" : (form.parcelamento || ""),
        condicao_pagamento: form.is_reembolso ? "" : (form.condicao_pagamento || ""),
        data_compra: form.is_reembolso ? "" : (form.data_compra || ""),
        is_reembolso: form.tipo === "demanda" ? form.is_reembolso : false,
        reembolsar_para: form.is_reembolso ? form.reembolsar_para.trim() : "",
      };

      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      for (const file of anexos) {
        fd.append("anexos", file, file.name);
      }

      const res = await fetch("/api/public/solicitar", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || "Erro ao enviar");
      }
      if (json.anexos_falhados && json.anexos_falhados > 0) {
        toast.warning(`${json.anexos_falhados} anexo(s) não puderam ser enviados.`);
      }
      setDone({ numero: json.numero ?? null, tipo: form.tipo });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar solicitação");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const codePrefix = done.tipo === "compra" ? "COMPRA" : "DEMANDA";
    return (
      <Shell>
        <div className="text-center space-y-4 py-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-semibold">Solicitação enviada!</h1>
          <p className="text-muted-foreground text-sm">
            Recebemos sua solicitação e ela já está na fila para análise.
          </p>
          {done.numero != null && (
            <p className="text-xs font-mono text-muted-foreground">
              Protocolo: {codePrefix}-{done.numero}
            </p>
          )}
          <div className="pt-4 flex flex-col gap-2">
            <Button
              onClick={() => {
                setForm(initial);
                setStep(0);
                setDone(null);
              }}
            >
              Enviar outra solicitação
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  const isCompra = form.tipo === "compra";

  return (
    <Shell>
      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <Step title="O que você quer solicitar?" subtitle="Escolha o tipo da solicitação.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TipoCard
              active={form.tipo === "compra"}
              onClick={() => update({ tipo: "compra" })}
              icon={<ShoppingCart className="h-7 w-7" />}
              title="Compra"
              desc="Aquisição de mercadoria, serviço ou imobilizado."
            />
            <TipoCard
              active={form.tipo === "demanda"}
              onClick={() => update({ tipo: "demanda" })}
              icon={<Wallet className="h-7 w-7" />}
              title="Demanda"
              desc="Estacionamento, alimentação, manutenção, etc."
            />
          </div>
        </Step>
      )}

      {step === 1 && (
        <Step title="Sobre a solicitação" subtitle="Conte rapidamente do que se trata.">
          <div className="space-y-4">
            <Field label="Título / Resumo *">
              <Input
                value={form.titulo}
                maxLength={200}
                onChange={(e) => update({ titulo: e.target.value })}
                placeholder={isCompra ? "Ex.: Compra de papel A4" : "Ex.: Manutenção da frota"}
              />
            </Field>
            <Field label={isCompra ? "Tipo de compra" : "Tipo de demanda"}>
              <Select value={form.subtipo} onValueChange={(v) => update({ subtipo: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(isCompra ? TIPO_COMPRA_OPTIONS : TIPO_DEMANDA_OPTIONS).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fornecedor (se já souber)">
              <Input
                value={form.fornecedor}
                maxLength={160}
                onChange={(e) => update({ fornecedor: e.target.value })}
                placeholder="Opcional"
              />
            </Field>
            <Field label="Valor estimado total (R$)">
              <MoneyInput
                value={Number(String(form.valor_total).replace(",", ".")) || 0}
                onChange={(n) => update({ valor_total: n ? String(n) : "" })}
                placeholder="Opcional"
              />
            </Field>

            {!isCompra && (
              <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border accent-primary"
                    checked={form.is_reembolso}
                    onChange={(e) => update({
                      is_reembolso: e.target.checked,
                      pago: e.target.checked ? null : form.pago,
                      parcelamento: e.target.checked ? "" : form.parcelamento,
                      condicao_pagamento: e.target.checked ? "" : form.condicao_pagamento,
                      data_compra: e.target.checked ? "" : form.data_compra,
                    })}
                  />
                  <span className="text-sm">
                    <span className="font-medium">É um reembolso?</span>
                    <span className="block text-xs text-muted-foreground">
                      Marque se esta demanda é um reembolso a alguém da equipe.
                    </span>
                  </span>
                </label>

                {form.is_reembolso ? (
                  <Field label="Nome de quem será reembolsado *">
                    <Input
                      value={form.reembolsar_para}
                      maxLength={160}
                      onChange={(e) => update({ reembolsar_para: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Foi pago?">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => update({ pago: true })}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            form.pago === true
                              ? "border-primary ring-2 ring-primary/30 bg-primary/5 text-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => update({ pago: false, parcelamento: "", condicao_pagamento: "", data_compra: "" })}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            form.pago === false
                              ? "border-primary ring-2 ring-primary/30 bg-primary/5 text-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          Não
                        </button>
                      </div>
                    </Field>

                    {form.pago === true && (
                      <div className="space-y-3">
                        <Field label="Parcelamento">
                          <Select
                            value={form.parcelamento || undefined}
                            onValueChange={(v) => update({ parcelamento: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione…" />
                            </SelectTrigger>
                            <SelectContent>
                              {opcoes.parcelamentos.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Condição de pagamento">
                          <Select
                            value={form.condicao_pagamento || undefined}
                            onValueChange={(v) => update({ condicao_pagamento: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione…" />
                            </SelectTrigger>
                            <SelectContent>
                              {opcoes.condicoes_pagamento.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Data da compra">
                          <Input
                            type="date"
                            value={form.data_compra}
                            onChange={(e) => update({ data_compra: e.target.value })}
                          />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step
          title="Detalhes da solicitação"
          subtitle={isCompra ? "Liste os itens e quem está solicitando." : "Descreva a demanda e quem está solicitando."}
        >
          <div className="space-y-5">
            <Field label="Seu nome *">
              <Input
                value={form.solicitante_nome}
                maxLength={120}
                onChange={(e) => update({ solicitante_nome: e.target.value })}
                placeholder="Nome completo"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.solicitante_email}
                  maxLength={160}
                  onChange={(e) => update({ solicitante_email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.solicitante_telefone}
                  maxLength={40}
                  onChange={(e) => update({ solicitante_telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </Field>
            </div>

            {isCompra ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Itens da compra *
                  </Label>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.itens.map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border p-3 space-y-2 bg-muted/20"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            value={it.descricao}
                            maxLength={300}
                            onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                            placeholder="Descrição do item"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={it.quantidade}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^\d,.-]/g, "");
                                updateItem(idx, { quantidade: v });
                              }}
                              placeholder="Qtd"
                            />
                            <Input
                              value={it.unidade}
                              maxLength={20}
                              onChange={(e) => updateItem(idx, { unidade: e.target.value })}
                              placeholder="Un."
                            />
                            <MoneyInput
                              hidePrefix
                              value={Number(String(it.valor_unitario).replace(",", ".")) || 0}
                              onChange={(n) => updateItem(idx, { valor_unitario: String(n) })}
                              placeholder="Vlr unit."
                            />
                          </div>
                        </div>
                        {form.itens.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(idx)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Field label="Observações (opcional)">
                  <Textarea
                    rows={3}
                    value={form.descricao}
                    maxLength={4000}
                    onChange={(e) => update({ descricao: e.target.value })}
                    placeholder="Algum detalhe adicional sobre a compra…"
                  />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Descreva sua demanda *">
                  <Textarea
                    rows={6}
                    value={form.descricao}
                    maxLength={4000}
                    onChange={(e) => update({ descricao: e.target.value })}
                    placeholder="Detalhe a demanda, prazos, locais, observações…"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {form.descricao.length}/4000
                  </p>
                </Field>
              </>

            )}
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step title="Confira antes de enviar" subtitle="Revise os dados da solicitação.">
          <div className="rounded-lg border border-border divide-y divide-border text-sm">
            <Row k="Tipo" v={isCompra ? "Compra" : "Demanda"} />
            <Row k="Título" v={form.titulo} />
            {form.subtipo && <Row k="Categoria" v={labelOf(form.tipo!, form.subtipo)} />}
            {form.fornecedor && <Row k="Fornecedor" v={form.fornecedor} />}
            {form.valor_total && (
              <Row
                k="Valor estimado"
                v={Number(form.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              />
            )}
            <Row k="Solicitante" v={form.solicitante_nome} />
            {form.solicitante_email && <Row k="E-mail" v={form.solicitante_email} />}
            {form.solicitante_telefone && <Row k="Telefone" v={form.solicitante_telefone} />}

            {isCompra ? (
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-2">Itens</div>
                <ul className="space-y-1">
                  {form.itens
                    .filter((it) => it.descricao.trim() && Number(it.quantidade) > 0)
                    .map((it, idx) => (
                      <li key={idx} className="flex justify-between gap-3 text-sm">
                        <span className="break-words">{it.descricao}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {it.quantidade} {it.unidade}
                          {it.valor_unitario ? ` · R$ ${Number(it.valor_unitario).toFixed(2)}` : ""}
                        </span>
                      </li>
                    ))}
                </ul>
                {form.descricao && (
                  <>
                    <div className="text-xs text-muted-foreground mt-3 mb-1">Observações</div>
                    <div className="whitespace-pre-wrap break-words">{form.descricao}</div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Descrição</div>
                <div className="whitespace-pre-wrap break-words">{form.descricao}</div>
              </div>
            )}
          </div>
        </Step>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || sending}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
            Avançar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Enviar solicitação
          </Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-semibold">Grupo Luminart</div>
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
            Sou da equipe
          </Link>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TipoCard({
  active, onClick, icon, title, desc,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${
        active
          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/40"
      }`}
    >
      <div className={`mb-2 ${active ? "text-primary" : "text-muted-foreground"}`}>{icon}</div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-sm font-medium text-right break-words">{v}</span>
    </div>
  );
}

function labelOf(tipo: Tipo, value: string): string {
  const list = tipo === "compra" ? TIPO_COMPRA_OPTIONS : TIPO_DEMANDA_OPTIONS;
  return (list as readonly { value: string; label: string }[]).find((o) => o.value === value)?.label ?? value;
}
