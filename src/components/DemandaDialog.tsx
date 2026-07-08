import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FormField, FormSection } from "@/components/FormSection";
import { SelectCreatable } from "@/components/SelectCreatable";
import { DbComboboxCreatable } from "@/components/DbComboboxCreatable";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { MentionInput, renderCommentText } from "@/components/MentionInput";
import { Trash2, Upload, Download, FileIcon, ChevronRight, CheckCircle2, XCircle, Plus, PackageCheck, AlertTriangle } from "lucide-react";
import { AnexoViewer, baixarAnexo } from "@/components/AnexoViewer";
import { MoneyInput } from "@/components/MoneyInput";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { EMPRESAS } from "@/lib/empresas";
import { fetchAllRows } from "@/lib/fetch-all";
import { toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { toast } from "sonner";
import { ensureValidSession, describeSupabaseError } from "@/lib/supabase-guard";
import { DEMANDA_STATUSES, TIPO_DEMANDA_OPTIONS, TIPOS_QUE_VAO_PARA_ESTOQUE, proximoStatusDemanda, type DemandaStatus } from "@/lib/demandas";
import { useAuth } from "@/contexts/AuthContext";
import { CopiarLinkButton } from "@/components/CopiarLinkButton";

const sb = supabase as any;

export type DemandaItem = {
  id?: string;
  item_id?: string | null;
  descricao?: string | null;
  unidade?: string | null;
  quantidade: number;
  valor_unitario?: number | null;
};

function novoDemandaItem(): DemandaItem {
  return { item_id: null, descricao: "", unidade: "", quantidade: 1, valor_unitario: 0 };
}

export type Demanda = {
  id?: string;
  status: DemandaStatus;
  titulo?: string | null;
  tipo_demanda?: string | null;
  descritivo?: string | null;
  evento_projeto?: string | null;
  evento_projeto_id?: string | null;
  solicitante?: string | null;
  solicitante_id?: string | null;
  fornecedor?: string | null;
  fornecedor_id?: string | null;
  documento?: string | null;
  comprador?: string | null;
  data_solicitacao?: string | null;
  data_compra?: string | null;
  parcelamento?: string | null;
  condicao_pagamento?: string | null;
  valor_total?: number | null;
  observacoes?: string | null;
  motivo_negacao?: string | null;
  categoria_external_id?: string | null;
};

export type DemandaAdvanceOpts = { approve?: boolean; deny?: boolean };

export function DemandaDialog({
  open,
  onOpenChange,
  demandaId,
  defaultStatus = "solicitacao",
  onAdvance,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demandaId?: string | null;
  defaultStatus?: DemandaStatus;
  onAdvance?: (demanda: Demanda & { id: string }, opts?: DemandaAdvanceOpts) => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Demanda>({ status: defaultStatus });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["compras-fornecedores-min"],
    queryFn: async () => {
      const { data } = await sb.from("compras_fornecedores").select("id,nome,documento").eq("status", "ativo").order("nome");
      return (data ?? []) as { id: string; nome: string; documento: string | null }[];
    },
  });

  const { data: solicitantes = [] } = useQuery({
    queryKey: ["compras-solicitantes-min"],
    queryFn: async () => {
      const { data } = await sb.from("compras_solicitantes").select("id,nome").eq("status", "ativo").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: planoContas = [] } = useQuery({
    queryKey: ["plano-contas-prefix"],
    queryFn: async () => {
      const { data } = await sb.from("ca_plano_contas").select("external_id,nome").order("nome");
      return ((data ?? []) as { external_id: string; nome: string }[]).filter((p) => /^[A-Z]{2,3}\s*-/.test(p.nome ?? ""));
    },
  });

  useEffect(() => {
    if (!open) return;
    setPendingFiles([]);
    if (!demandaId) {
      setForm({ status: defaultStatus, data_solicitacao: new Date().toISOString().slice(0, 10) });
      return;
    }
    (async () => {
      const { data: c } = await sb.from("demandas").select("*").eq("id", demandaId).maybeSingle();
      if (c) setForm(c as any);
    })();
  }, [open, demandaId, defaultStatus]);

  const save = useMutation({
    mutationFn: async () => {
      await ensureValidSession();
      const payload: any = { ...form };
      let id = demandaId;
      if (id) {
        const { data: upd, error } = await sb.from("demandas").update(payload).eq("id", id).select("id");
        if (error) throw error;
        if (!upd || upd.length === 0) throw new Error("Demanda não foi atualizada (sem permissão ou registro removido).");
      } else {
        const { data, error } = await sb.from("demandas").insert(payload).select("id").single();
        if (error) throw error;
        if (!data?.id) throw new Error("Demanda não foi confirmada pelo banco.");
        id = data.id;
      }
      // Upload de anexos pendentes (anexados antes de salvar)
      if (id && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${id}/${Date.now()}_${safeName}`;
          const { error: upErr } = await sb.storage.from("demanda-anexos").upload(path, file, {
            contentType: file.type || undefined,
          });
          if (upErr) throw upErr;
          const { error: insErr } = await sb.from("demanda_anexos").insert({
            demanda_id: id,
            nome: file.name,
            path,
            mime_type: file.type || null,
            tamanho: file.size,
            uploaded_by: user?.id ?? null,
          });
          if (insErr) throw insErr;
        }
      }
      return id;
    },
    onSuccess: async () => {
      toast.success("Demanda salva");
      setPendingFiles([]);
      await qc.refetchQueries({ queryKey: ["demandas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(describeSupabaseError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {(form as any).numero != null && (
          <div className="-mt-2 -mx-6 px-6 pb-2 pr-12 text-xs font-mono text-muted-foreground border-b border-border">
            DEMANDA-{(form as any).numero}
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{demandaId ? "Editar demanda" : "Nova demanda"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="descritivo">Descritivo</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-4">
            <FormSection>
              <FormField label="Título / Descrição">
                <Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Manutenção preventiva da frota" />
              </FormField>
              <FormField label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as DemandaStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEMANDA_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Tipo de Despesa">
                <Select value={form.tipo_demanda ?? ""} onValueChange={(v) => setForm({ ...form, tipo_demanda: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {TIPO_DEMANDA_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Categoria (DRE)">
                <Select
                  value={form.categoria_external_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, categoria_external_id: v || null })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria do plano de contas…" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {planoContas.map((p) => (
                      <SelectItem key={p.external_id} value={p.external_id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Solicitante">
                <SelectCreatable
                  table="compras_solicitantes"
                  value={form.solicitante}
                  onChange={(v) => {
                    const s = solicitantes.find((x) => x.nome === v);
                    setForm({ ...form, solicitante: v, solicitante_id: s?.id ?? null });
                  }}
                />
              </FormField>
              <FormField label="Comprador">
                <SelectCreatable table="compradores" value={form.comprador}
                  onChange={(v) => setForm({ ...form, comprador: v })} />
              </FormField>
              <FormField label="Fornecedor">
                <SelectCreatable
                  table="compras_fornecedores"
                  value={form.fornecedor}
                  onChange={(v) => {
                    const f = fornecedores.find((x) => x.nome === v);
                    setForm({
                      ...form,
                      fornecedor: v,
                      fornecedor_id: f?.id ?? null,
                      documento: f?.documento ?? form.documento,
                    });
                  }}
                />
              </FormField>
              <FormField label="CNPJ / CPF">
                <Input value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
              </FormField>
              <FormField label="Data da solicitação">
                <Input type="date" value={form.data_solicitacao ?? ""} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} />
              </FormField>
              <FormField label="Data da compra/serviço">
                <Input type="date" value={form.data_compra ?? ""} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} />
              </FormField>
              <FormField label="Parcelamento">
                <SelectCreatable table="parcelamentos" value={form.parcelamento}
                  onChange={(v) => setForm({ ...form, parcelamento: v })} />
              </FormField>
              <FormField label="Condição de pagamento">
                <SelectCreatable table="condicoes_pagamento" value={form.condicao_pagamento}
                  onChange={(v) => setForm({ ...form, condicao_pagamento: v })} />
              </FormField>
              <FormField label="Valor total (R$)">
                <MoneyInput
                  value={form.valor_total ?? 0}
                  onChange={(n) => setForm({ ...form, valor_total: n || null })}
                />
              </FormField>
              <FormField label="Observações" wide>
                <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </FormField>
              {form.status === "negada" && (
                <FormField label="Motivo da negação" wide>
                  <Textarea rows={2} value={form.motivo_negacao ?? ""} onChange={(e) => setForm({ ...form, motivo_negacao: e.target.value })} />
                </FormField>
              )}
            </FormSection>

            <div className="mt-2 border-t border-border pt-4">
              <Tabs defaultValue="comentarios">
                <TabsList>
                  <TabsTrigger value="comentarios">Comentários</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent value="comentarios" className="pt-4">
                  {demandaId ? (
                    <Comentarios demandaId={demandaId} userId={user?.id} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Salve a demanda para habilitar os comentários.</p>
                  )}
                </TabsContent>
                <TabsContent value="historico" className="pt-4">
                  {demandaId ? (
                    <Historico demandaId={demandaId} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">O histórico será criado automaticamente após salvar a demanda.</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="descritivo" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Evento / Projeto</label>
              <EventoSheetCombobox
                value={form.evento_projeto}
                onChange={(v) => {
                  setForm({ ...form, evento_projeto: v, evento_projeto_id: null });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descritivo da solicitação</label>
              <Textarea
                rows={12}
                value={form.descritivo ?? ""}
                onChange={(e) => setForm({ ...form, descritivo: e.target.value })}
                placeholder="Descreva em detalhes a solicitação (o que precisa, quantidades, observações, prazos, etc.)"
              />
            </div>
          </TabsContent>

          <TabsContent value="anexos" className="space-y-2 pt-4">
            {demandaId ? (
              <Anexos demandaId={demandaId} userId={user?.id} />
            ) : (
              <PendingAnexos files={pendingFiles} onChange={setPendingFiles} />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <div>
            {demandaId && (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Tem certeza que deseja excluir esta demanda? Esta ação não pode ser desfeita.")) return;
                  try {
                    await sb.from("demanda_comentarios").delete().eq("demanda_id", demandaId);
                    await sb.from("demanda_historico").delete().eq("demanda_id", demandaId);
                    await sb.from("demanda_anexos").delete().eq("demanda_id", demandaId);
                    const { error } = await sb.from("demandas").delete().eq("id", demandaId);
                    if (error) throw error;
                    toast.success("Demanda excluída");
                    qc.invalidateQueries({ queryKey: ["demandas"] });
                    onOpenChange(false);
                  } catch (e: any) {
                    toast.error(e.message ?? "Erro ao excluir");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            {demandaId && (
              <span className="ml-2 inline-block align-middle">
                <CopiarLinkButton path={`/financeiro?id=${demandaId}`} />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              if (!demandaId || !onAdvance) return null;
              if (form.status === "pendente_aprovacao") {
                return (
                  <>
                    <Button
                      onClick={() => onAdvance({ ...form, id: demandaId }, { approve: true })}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar demanda
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => onAdvance({ ...form, id: demandaId }, { deny: true })}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reprovar demanda
                    </Button>
                  </>
                );
              }
              const nextKey = proximoStatusDemanda(form.status, form.tipo_demanda ?? null);
              const nextLabel = nextKey
                ? DEMANDA_STATUSES.find((s) => s.key === nextKey)?.label ?? null
                : null;
              if (!nextLabel || !nextKey) return null;
              return (
                <Button
                  variant="secondary"
                  onClick={() => onAdvance({ ...form, id: demandaId })}
                >
                  Avançar para "{nextLabel}" <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              );
            })()}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Comentarios({ demandaId, userId }: { demandaId: string; userId?: string }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<string[]>([]);

  const { data: comentarios = [] } = useQuery({
    queryKey: ["demanda-coments", demandaId],
    queryFn: async () => {
      const { data } = await sb.from("demanda_comentarios").select("*").eq("demanda_id", demandaId).order("created_at");
      return (data ?? []) as any[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("id,display_name,email");
      return (data ?? []).map((u: any) => ({ id: u.id, nome: u.display_name || u.email || "Usuário" }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!texto.trim()) return;
      const meName = (users.find((u: any) => u.id === userId) as any)?.nome ?? null;
      const { error } = await sb.from("demanda_comentarios").insert({
        demanda_id: demandaId, user_id: userId, user_nome: meName, texto: texto.trim(), mencoes,
      });
      if (error) throw error;
      setTexto(""); setMencoes([]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demanda-coments", demandaId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
        {comentarios.map((c) => (
          <div key={c.id} className="rounded-md border border-border p-2.5 bg-muted/30">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-medium">{c.user_nome ?? "—"}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{renderCommentText(c.texto)}</div>
          </div>
        ))}
      </div>
      <MentionInput value={texto} onChange={(v, m) => { setTexto(v); setMencoes(m); }} users={users as any} onSubmit={() => post.mutate()} />
      <div className="flex justify-end">
        <Button size="sm" disabled={!texto.trim() || post.isPending} onClick={() => post.mutate()}>Comentar</Button>
      </div>
    </div>
  );
}

function Historico({ demandaId }: { demandaId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["demanda-hist", demandaId],
    queryFn: async () => {
      const { data } = await sb.from("demanda_historico").select("*").eq("demanda_id", demandaId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const labels: Record<string, string> = DEMANDA_STATUSES.reduce((a, s) => ({ ...a, [s.key]: s.label }), {});
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {data.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico.</p>}
      {data.map((h) => (
        <div key={h.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
          <div className="font-medium">
            {h.user_nome ?? "Sistema"}{" "}
            {h.acao === "criou" && <span>criou a demanda como <b>{labels[h.status_novo] ?? h.status_novo}</b></span>}
            {h.acao === "mudou_status" && <span>mudou status de <b>{labels[h.status_anterior] ?? h.status_anterior}</b> para <b>{labels[h.status_novo] ?? h.status_novo}</b></span>}
          </div>
          <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
        </div>
      ))}
    </div>
  );
}

function Anexos({ demandaId, userId }: { demandaId: string; userId?: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);


  const { data: anexos = [] } = useQuery({
    queryKey: ["demanda-anexos", demandaId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demanda_anexos")
        .select("*")
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${demandaId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await sb.storage.from("demanda-anexos").upload(path, file, {
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await sb.from("demanda_anexos").insert({
          demanda_id: demandaId,
          nome: file.name,
          path,
          mime_type: file.type || null,
          tamanho: file.size,
          uploaded_by: userId ?? null,
        });
        if (insErr) throw insErr;
      }
      toast.success("Anexos enviados");
      qc.invalidateQueries({ queryKey: ["demanda-anexos", demandaId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(a: any) {
    await baixarAnexo("demanda-anexos", a.path, a.nome);
  }


  async function handleDelete(a: any) {
    if (!confirm(`Remover anexo "${a.nome}"?`)) return;
    try {
      await sb.storage.from("demanda-anexos").remove([a.path]);
      const { error } = await sb.from("demanda_anexos").delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["demanda-anexos", demandaId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    }
  }

  function fmtSize(n?: number | null) {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {uploading ? "Enviando…" : "Clique para anexar arquivos (PDF, Excel, imagens, etc.)"}
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum anexo.</p>
      ) : (
        <div className="space-y-1.5">
          {anexos.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                type="button"
                className="flex-1 min-w-0 text-left hover:underline"
                onClick={() => setPreview(a)}
              >
                <div className="truncate font-medium">{a.nome}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtSize(a.tamanho)} · {new Date(a.created_at).toLocaleString("pt-BR")}
                </div>
              </button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(a)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(a)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <AnexoViewer
        bucket="demanda-anexos"
        anexo={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
    </div>
  );
}

function PendingAnexos({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  function fmtSize(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground italic">
        Os arquivos serão enviados quando você salvar a demanda.
      </p>
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Clique para anexar arquivos (PDF, Excel, imagens, etc.)
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            if (list.length) onChange([...files, ...list]);
            e.target.value = "";
          }}
        />
      </label>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum anexo selecionado.</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtSize(f.size)}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(files.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

