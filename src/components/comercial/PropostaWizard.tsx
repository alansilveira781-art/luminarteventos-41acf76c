import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ChevronLeft, ChevronRight, ImagePlus, X, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  TIPOS_EVENTO,
  TIPO_MEDIDA_LABEL,
  type Ambiente,
  type ItemAmbiente,
  type DescricaoItem,
  type CustoExtra,
  type Proposta,
  type CatalogoDescricao,
  ambienteSubtotal,
  itemSubtotal,
  descricaoSubtotal,
} from "@/lib/comercial/types";
import {
  createProposta,
  updateProposta,
  upsertCliente,
  useComercial,
  addConsultor,
} from "@/lib/comercial/store";
import { NumberInput } from "@/components/comercial/NumberInput";
import { MoneyInput } from "@/components/MoneyInput";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cardId?: string | null;
  defaults?: {
    clienteNome?: string;
    clienteTelefone?: string;
    clienteEmail?: string;
    eventoNome?: string;
    eventoDataInicio?: string;
    eventoDataFim?: string;
    responsavel?: string;
  };
  proposta?: Proposta | null;
};

const STEPS = ["Cliente", "Evento", "Ambientes e Itens", "Custos", "Resumo"];
const NEW_CONSULTOR = "__novo__";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function newDescricaoVazia(): DescricaoItem {
  return {
    id: uid(),
    catalogoId: null,
    descricao: "",
    tipoMedida: "unidade",
    unidade: "un",
    quantidade: 1,
    valorUnitario: 0,
  };
}
function descricaoFromCatalogo(c: CatalogoDescricao): DescricaoItem {
  return {
    id: uid(),
    catalogoId: c.id,
    descricao: c.nome,
    tipoMedida: c.tipoMedida,
    unidade: c.unidade || "un",
    quantidade: 1,
    valorUnitario: c.valorUnitario,
    largura: c.tipoMedida === "unidade" ? undefined : 0,
    altura: c.tipoMedida === "dimensional" ? 0 : undefined,
    comprimento: c.tipoMedida !== "unidade" ? 0 : undefined,
  };
}
function newItem(): ItemAmbiente {
  return { id: uid(), nome: "", descricoes: [] };
}
function newAmbiente(nome = ""): Ambiente {
  return { id: uid(), nome, imagens: [], itens: [newItem()] };
}

export function PropostaWizard({ open, onOpenChange, cardId, defaults, proposta }: Props) {
  const { consultores, catalogo } = useComercial();
  const [step, setStep] = useState(0);
  const [cliente, setCliente] = useState({ nome: "", telefone: "", email: "" });
  const [evento, setEvento] = useState<Proposta["evento"]>({
    tipo: "",
    dataInicio: "",
    dataFim: "",
    local: "",
    cidade: "",
    observacoes: "",
  });
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [custos, setCustos] = useState<{ frete: number; montagem: number; desmontagem: number; outros: CustoExtra[] }>({
    frete: 0, montagem: 0, desmontagem: 0, outros: [],
  });
  const [resumo, setResumo] = useState({ margem: 0, validade: "" });
  const [responsavel, setResponsavel] = useState("");
  const [novoConsultorOpen, setNovoConsultorOpen] = useState(false);
  const [novoConsultor, setNovoConsultor] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (proposta) {
      setCliente(proposta.cliente);
      setEvento(proposta.evento);
      setAmbientes(proposta.ambientes?.length ? proposta.ambientes : [newAmbiente("Ambiente principal")]);
      setCustos(proposta.custos);
      setResumo(proposta.resumo);
      setResponsavel(proposta.responsavel);
    } else {
      setCliente({
        nome: defaults?.clienteNome ?? "",
        telefone: defaults?.clienteTelefone ?? "",
        email: defaults?.clienteEmail ?? "",
      });
      setEvento({
        tipo: "",
        dataInicio: defaults?.eventoDataInicio ?? "",
        dataFim: defaults?.eventoDataFim ?? defaults?.eventoDataInicio ?? "",
        local: defaults?.eventoNome ?? "",
        cidade: "",
        observacoes: "",
      });
      setAmbientes([newAmbiente("Ambiente principal")]);
      setCustos({ frete: 0, montagem: 0, desmontagem: 0, outros: [] });
      setResumo({ margem: 0, validade: "" });
      setResponsavel(defaults?.responsavel ?? "");
    }
  }, [open, proposta, defaults]);

  const subtotalAmbientes = useMemo(
    () => ambientes.reduce((s, a) => s + ambienteSubtotal(a), 0),
    [ambientes],
  );
  const totalCustos = useMemo(
    () =>
      (custos.frete || 0) +
      (custos.montagem || 0) +
      (custos.desmontagem || 0) +
      custos.outros.reduce((s, c) => s + (c.valor || 0), 0),
    [custos],
  );
  const totalFinal = subtotalAmbientes + totalCustos;

  function canNext() {
    if (step === 0) return cliente.nome.trim().length > 0;
    if (step === 1) return !!evento.tipo && !!evento.dataInicio;
    if (step === 2) {
      const hasDescricao = ambientes.some((a) =>
        a.itens.some((i) => i.descricoes.length > 0),
      );
      return ambientes.length > 0 && hasDescricao;
    }
    return true;
  }

  async function finish() {
    if (!cliente.nome.trim()) return toast.error("Informe o cliente");
    const totalDescricoes = ambientes.reduce(
      (s, a) => s + a.itens.reduce((si, it) => si + it.descricoes.length, 0),
      0,
    );
    if (totalDescricoes === 0) return toast.error("Adicione ao menos uma descrição em algum item");

    const c = upsertCliente(cliente);
    if (proposta) {
      updateProposta(proposta.id, {
        cliente, evento, ambientes, custos, resumo, responsavel, clienteId: c.id,
        status: "aguardando_aprovacao",
      });
      toast.success("Proposta atualizada e enviada para validação");
    } else {
      await createProposta({
        cardId: cardId ?? null, clienteId: c.id, cliente, evento, ambientes, custos, resumo, responsavel,
      });
      toast.success("Proposta enviada para validação interna");
    }
    onOpenChange(false);
  }

  function onConsultorChange(v: string) {
    if (v === NEW_CONSULTOR) {
      setNovoConsultor("");
      setNovoConsultorOpen(true);
      return;
    }
    setResponsavel(v);
  }
  function confirmarNovoConsultor() {
    const n = novoConsultor.trim();
    if (!n) return;
    addConsultor(n);
    setResponsavel(n);
    setNovoConsultorOpen(false);
  }

  // ----- Ambientes / Itens / Descrições helpers -----
  function patchAmbiente(idx: number, patch: Partial<Ambiente>) {
    setAmbientes(ambientes.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function patchItem(aIdx: number, iIdx: number, patch: Partial<ItemAmbiente>) {
    setAmbientes(ambientes.map((a, i) => {
      if (i !== aIdx) return a;
      return { ...a, itens: a.itens.map((it, j) => (j === iIdx ? { ...it, ...patch } : it)) };
    }));
  }
  function patchDescricao(aIdx: number, iIdx: number, dIdx: number, patch: Partial<DescricaoItem>) {
    setAmbientes(ambientes.map((a, i) => {
      if (i !== aIdx) return a;
      return {
        ...a,
        itens: a.itens.map((it, j) => {
          if (j !== iIdx) return it;
          return { ...it, descricoes: it.descricoes.map((d, k) => (k === dIdx ? { ...d, ...patch } : d)) };
        }),
      };
    }));
  }

  function adicionarDescricaoDoCatalogo(aIdx: number, iIdx: number, catalogoId: string) {
    if (catalogoId === "__vazia__") {
      const novas = [...ambientes[aIdx].itens[iIdx].descricoes, newDescricaoVazia()];
      patchItem(aIdx, iIdx, { descricoes: novas });
      return;
    }
    const c = catalogo.find((x) => x.id === catalogoId);
    if (!c) return;
    const novas = [...ambientes[aIdx].itens[iIdx].descricoes, descricaoFromCatalogo(c)];
    patchItem(aIdx, iIdx, { descricoes: novas });
  }

  async function adicionarImagens(aIdx: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const dataUrls = await Promise.all(arr.map((f) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    })));
    const ambiente = ambientes[aIdx];
    patchAmbiente(aIdx, { imagens: [...ambiente.imagens, ...dataUrls] });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{proposta ? `Editar proposta #${proposta.numero}` : "Criar proposta"}</DialogTitle>
          </DialogHeader>

          <div className="mb-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              {STEPS.map((s, i) => (
                <span key={s} className={i === step ? "text-foreground font-medium" : ""}>
                  {i + 1}. {s}
                </span>
              ))}
            </div>
            <Progress value={((step + 1) / STEPS.length) * 100} />
          </div>

          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={cliente.telefone} onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tipo de evento *</Label>
                <Select value={evento.tipo || undefined} onValueChange={(v) => setEvento({ ...evento, tipo: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden sm:block" />
              <div>
                <Label>Data início *</Label>
                <Input type="date" value={evento.dataInicio} onChange={(e) => setEvento({ ...evento, dataInicio: e.target.value })} />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={evento.dataFim} onChange={(e) => setEvento({ ...evento, dataFim: e.target.value })} />
              </div>
              <div>
                <Label>Local</Label>
                <Input value={evento.local} onChange={(e) => setEvento({ ...evento, local: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={evento.cidade} onChange={(e) => setEvento({ ...evento, cidade: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={evento.observacoes} onChange={(e) => setEvento({ ...evento, observacoes: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Cada <b>ambiente</b> contém vários <b>itens</b>, e cada item tem <b>descrições</b> do catálogo.{" "}
                  <Link to="/comercial/catalogo" className="text-primary underline">Gerenciar catálogo →</Link>
                </p>
                <Button size="sm" variant="outline" onClick={() => setAmbientes([...ambientes, newAmbiente()])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar ambiente
                </Button>
              </div>

              {ambientes.map((amb, aIdx) => (
                <div key={amb.id} className="rounded-lg border border-border bg-muted/20">
                  <div className="p-3 border-b border-border flex gap-2 items-center">
                    <Input
                      className="flex-1"
                      placeholder="Nome do ambiente (ex: Recepção, Palco…)"
                      value={amb.nome}
                      onChange={(e) => patchAmbiente(aIdx, { nome: e.target.value })}
                    />
                    <div className="text-sm font-medium whitespace-nowrap">{brl(ambienteSubtotal(amb))}</div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setAmbientes(ambientes.filter((_, i) => i !== aIdx))}
                      title="Remover ambiente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Imagens do ambiente */}
                  <div className="p-3 border-b border-border">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Imagens do ambiente</div>
                    <div className="flex flex-wrap gap-2 items-start">
                      {amb.imagens.map((src, imgIdx) => (
                        <div key={imgIdx} className="relative group h-20 w-20 rounded overflow-hidden border border-border">
                          <img src={src} alt={`Ambiente ${amb.nome || aIdx + 1} - imagem ${imgIdx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => patchAmbiente(aIdx, { imagens: amb.imagens.filter((_, i) => i !== imgIdx) })}
                            className="absolute top-0.5 right-0.5 bg-background/80 hover:bg-background rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                            title="Remover imagem"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="h-20 w-20 rounded border border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/30">
                        <ImagePlus className="h-4 w-4 mb-1" />
                        Adicionar
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => { adicionarImagens(aIdx, e.target.files); e.target.value = ""; }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="p-3 space-y-3">
                    {amb.itens.map((item, iIdx) => (
                      <div key={item.id} className="rounded border border-border bg-card">
                        <div className="p-2 border-b border-border flex gap-2 items-center">
                          <Input
                            className="flex-1"
                            placeholder="Nome do item (ex: Painel LED, Mobiliário…)"
                            value={item.nome}
                            onChange={(e) => patchItem(aIdx, iIdx, { nome: e.target.value })}
                          />
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{brl(itemSubtotal(item))}</div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => patchAmbiente(aIdx, { itens: amb.itens.filter((_, j) => j !== iIdx) })}
                            title="Remover item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="p-2 space-y-2">
                          {item.descricoes.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              Nenhuma descrição. Adicione uma do catálogo abaixo.
                            </div>
                          )}
                          {item.descricoes.map((d, dIdx) => (
                            <DescricaoRow
                              key={d.id}
                              d={d}
                              onPatch={(patch) => patchDescricao(aIdx, iIdx, dIdx, patch)}
                              onRemove={() =>
                                patchItem(aIdx, iIdx, { descricoes: item.descricoes.filter((_, k) => k !== dIdx) })
                              }
                            />
                          ))}

                          <div className="flex gap-2 pt-1">
                            <Select value="" onValueChange={(v) => adicionarDescricaoDoCatalogo(aIdx, iIdx, v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="+ Adicionar descrição (catálogo)" />
                              </SelectTrigger>
                              <SelectContent>
                                {catalogo.length === 0 && (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    Catálogo vazio
                                  </div>
                                )}
                                {catalogo.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome} <span className="text-muted-foreground">— {TIPO_MEDIDA_LABEL[c.tipoMedida]}</span>
                                  </SelectItem>
                                ))}
                                <SelectItem value="__vazia__">+ Descrição manual (em branco)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => patchAmbiente(aIdx, { itens: [...amb.itens, newItem()] })}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar item
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Frete (R$)</Label><MoneyInput value={custos.frete} onChange={(n) => setCustos({ ...custos, frete: n })} /></div>
                <div><Label>Montagem (R$)</Label><MoneyInput value={custos.montagem} onChange={(n) => setCustos({ ...custos, montagem: n })} /></div>
                <div><Label>Desmontagem (R$)</Label><MoneyInput value={custos.desmontagem} onChange={(n) => setCustos({ ...custos, desmontagem: n })} /></div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Outros custos</div>
                  <Button size="sm" variant="outline" onClick={() => setCustos({ ...custos, outros: [...custos.outros, { descricao: "", valor: 0 }] })}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {custos.outros.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Descrição" value={c.descricao} onChange={(e) => setCustos({ ...custos, outros: custos.outros.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x) })} />
                      <MoneyInput className="w-40" value={c.valor} onChange={(n) => setCustos({ ...custos, outros: custos.outros.map((x, j) => j === i ? { ...x, valor: n } : x) })} />
                      <Button size="icon" variant="ghost" onClick={() => setCustos({ ...custos, outros: custos.outros.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  {custos.outros.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">Nenhum custo adicional</div>}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border divide-y divide-border">
                <Row label="Subtotal dos ambientes" value={brl(subtotalAmbientes)} />
                <Row label="Total dos custos adicionais" value={brl(totalCustos)} />
                <Row label="Total final" value={brl(totalFinal)} bold />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Margem estimada (%)</Label><NumberInput step="0.1" value={resumo.margem} onChange={(n) => setResumo({ ...resumo, margem: n })} /></div>
                <div><Label>Validade da proposta</Label><Input type="date" value={resumo.validade} onChange={(e) => setResumo({ ...resumo, validade: e.target.value })} /></div>
                <div className="sm:col-span-2">
                  <Label>Consultor(a) responsável</Label>
                  <Select value={responsavel || undefined} onValueChange={onConsultorChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {consultores.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value={NEW_CONSULTOR}>+ Adicionar consultor(a)…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finish}>Enviar para validação</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novoConsultorOpen} onOpenChange={setNovoConsultorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo consultor(a)</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input
              value={novoConsultor}
              onChange={(e) => setNovoConsultor(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") confirmarNovoConsultor(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoConsultorOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarNovoConsultor} disabled={!novoConsultor.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DescricaoRow({
  d, onPatch, onRemove,
}: { d: DescricaoItem; onPatch: (p: Partial<DescricaoItem>) => void; onRemove: () => void }) {
  return (
    <div className="rounded border border-border bg-muted/10 p-2">
      <div className="flex items-center gap-2 mb-2">
        <Input
          className="flex-1 h-8 text-sm"
          value={d.descricao}
          onChange={(e) => onPatch({ descricao: e.target.value })}
          placeholder="Descrição"
        />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {TIPO_MEDIDA_LABEL[d.tipoMedida]}
        </span>
        <Button size="icon" variant="ghost" onClick={onRemove} title="Remover descrição">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-6 items-end">
        {d.tipoMedida === "unidade" && (
          <div className="col-span-1">
            <Label className="text-[10px]">Unid.</Label>
            <Input className="h-8 text-sm" value={d.unidade} onChange={(e) => onPatch({ unidade: e.target.value })} />
          </div>
        )}
        {(d.tipoMedida === "dimensional" || d.tipoMedida === "area") && (
          <div>
            <Label className="text-[10px]">Largura (m)</Label>
            <NumberInput className="h-8 text-sm" step="0.01" value={d.largura ?? 0} onChange={(n) => onPatch({ largura: n })} />
          </div>
        )}
        {d.tipoMedida === "dimensional" && (
          <div>
            <Label className="text-[10px]">Altura (m)</Label>
            <NumberInput className="h-8 text-sm" step="0.01" value={d.altura ?? 0} onChange={(n) => onPatch({ altura: n })} />
          </div>
        )}
        {(d.tipoMedida === "dimensional" || d.tipoMedida === "area" || d.tipoMedida === "linear") && (
          <div>
            <Label className="text-[10px]">Comprimento (m)</Label>
            <NumberInput className="h-8 text-sm" step="0.01" value={d.comprimento ?? 0} onChange={(n) => onPatch({ comprimento: n })} />
          </div>
        )}
        <div>
          <Label className="text-[10px]">Qtde</Label>
          <NumberInput className="h-8 text-sm" value={d.quantidade} onChange={(n) => onPatch({ quantidade: n })} />
        </div>
        <div>
          <Label className="text-[10px]">
            Valor un.{d.tipoMedida === "area" ? " (/m²)" : d.tipoMedida === "linear" ? " (/m)" : ""}
          </Label>
          <MoneyInput className="h-8 text-sm" value={d.valorUnitario} onChange={(n) => onPatch({ valorUnitario: n })} />
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">Subtotal</div>
          <div className="text-sm font-medium">{brl(descricaoSubtotal(d))}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between p-3 ${bold ? "text-base font-semibold" : "text-sm"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
