import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackageCheck, Plus, FileIcon, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { generateNextSku } from "@/lib/sku";
import { MoneyInput } from "@/components/MoneyInput";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EMPRESAS } from "@/lib/empresas";
import { toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { AnexoViewer, baixarAnexo } from "@/components/AnexoViewer";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";

const sb = supabase as any;

export const Route = createFileRoute("/estoque/a-receber")({
  component: AReceberPage,
});

type CompraRow = {
  id: string;
  numero: number | null;
  titulo: string | null;
  solicitante: string | null;
  fornecedor: string | null;
  comprador: string | null;
  data_compra: string | null;
  valor_total: number | null;
};

type CompraItemRow = {
  id: string;
  compra_id: string;
  item_id: string | null;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  valor_unitario: number | null;
  recebido: boolean;
  quantidade_recebida: number;
  evento_projeto: string | null;
};


function AReceberPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: compras = [] } = useQuery({
    queryKey: ["compras-receber"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select("id,numero,titulo,solicitante,fornecedor,fornecedor_id,comprador,data_compra,valor_total,tipo_compra,documento")
        .eq("status", "a_receber")
        .eq("tipo_compra", "mercadoria")
        .order("data_compra", { ascending: true });

      if (error) throw error;
      return data as CompraRow[];
    },
  });

  return (
    <>
      <PageHeader
        title="Compras a receber"
        description="Valide o recebimento dos itens e dê entrada no estoque"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {compras.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhuma compra aguardando recebimento.
          </Card>
        )}
        {compras.map((c) => (
          <Card key={c.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{c.titulo || c.fornecedor || "Compra"}</div>
              <div className="text-[11px] font-mono text-muted-foreground shrink-0">
                {c.numero != null ? `COMPRA-${c.numero}` : "—"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {c.solicitante && <div>Solicitante: {c.solicitante}</div>}
              {c.fornecedor && <div>Fornecedor: {c.fornecedor}</div>}
              {c.comprador && <div>Comprador: {c.comprador}</div>}
              {c.data_compra && <div>Compra: {new Date(c.data_compra).toLocaleDateString("pt-BR")}</div>}
              {c.valor_total != null && (
                <div className="font-medium text-foreground">
                  {Number(c.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
            </div>
            <Button size="sm" className="w-full" onClick={() => setOpenId(c.id)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Validar recebimento
            </Button>
          </Card>

        ))}
      </div>

      {openId && (
        <ReceberDialog compraId={openId} onClose={() => { setOpenId(null); qc.invalidateQueries({ queryKey: ["compras-receber"] }); }} />
      )}
    </>
  );
}

type LinhaExtra = {
  quantidade?: number;
  valor_unitario?: number;
  desconto: number;
  frete: number;
  ipi: number;
  outros_custos: number;
};

function ReceberDialog({ compraId, onClose }: { compraId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: compra } = useQuery({
    queryKey: ["compra-receber-info", compraId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select("id,numero,solicitante,fornecedor,fornecedor_id,documento,comprador,status,empresa,observacoes")
        .eq("id", compraId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Compra não encontrada");
      return data as { id: string; numero: number | null; solicitante: string | null; fornecedor: string | null; fornecedor_id: string | null; documento: string | null; comprador: string | null; status: string; empresa: string | null; observacoes: string | null };
    },
  });

  const { data: itens = [], refetch } = useQuery({
    queryKey: ["compra-itens", compraId],
    queryFn: async () => {
      const { data, error } = await sb.from("compra_itens").select("*").eq("compra_id", compraId);

      if (error) throw error;
      return data as CompraItemRow[];
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["compra-anexos", compraId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compra_anexos")
        .select("*")
        .eq("compra_id", compraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: estoqueItens = [] } = useQuery({
    queryKey: ["itens-select"],
    queryFn: async () =>
      await fetchAllRows<any>("itens", "id,nome,codigo,codigo_proprio,unidade,valor_unitario", {
        orderBy: { column: "nome", ascending: true },
        pageSize: 1000,
      }),
    staleTime: 0,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () =>
      (await sb.from("fornecedores").select("*").eq("status", "ativo").order("nome")).data ?? [],
  });

  const [linhaExtras, setLinhaExtras] = useState<Record<string, LinhaExtra>>({});
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [fornecedorId, setFornecedorId] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataMovimento, setDataMovimento] = useState(() => toBRTInputDateTime());
  const [prefilled, setPrefilled] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<any | null>(null);

  if (compra && !prefilled) {
    setPrefilled(true);
    if (compra.fornecedor_id) setFornecedorId(compra.fornecedor_id);
    if (compra.documento) setNotaFiscal(compra.documento);
    if (compra.empresa) setEmpresa(compra.empresa);
    if (compra.observacoes) setObservacoes(compra.observacoes);
  }

  const getExtra = (it: CompraItemRow): LinhaExtra => {
    const e = linhaExtras[it.id];
    return {
      quantidade: e?.quantidade ?? Number(it.quantidade),
      valor_unitario: e?.valor_unitario ?? (it.valor_unitario != null ? Number(it.valor_unitario) : 0),
      desconto: e?.desconto ?? 0,
      frete: e?.frete ?? 0,
      ipi: e?.ipi ?? 0,
      outros_custos: e?.outros_custos ?? 0,
    };
  };

  const setExtra = (id: string, patch: Partial<LinhaExtra>) => {
    setLinhaExtras((m) => ({ ...m, [id]: { ...getExtra({ id } as any), ...m[id], ...patch } }));
  };

  const statusBlocked = compra && compra.status !== "a_receber";

  const linhasInvalidas = useMemo(() => {
    return itens.some((it) => !it.item_id && !itemMap[it.id]);
  }, [itens, itemMap]);

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!fornecedorId) throw new Error("Selecione o fornecedor");
      if (!empresa) throw new Error("Selecione a empresa");
      if (!dataMovimento) throw new Error("Informe a data do recebimento");

      const fornecedorNome = fornecedores.find((f: any) => f.id === fornecedorId)?.nome ?? "";

      // Revalida status atual da compra antes de qualquer escrita
      const { data: statusRow, error: statusErr } = await sb
        .from("compras")
        .select("status")
        .eq("id", compraId)
        .maybeSingle();
      if (statusErr) throw statusErr;
      if (!statusRow) throw new Error("Compra não encontrada");
      if (statusRow.status !== "a_receber") {
        throw new Error(
          `Esta compra não está mais em 'Compras a Receber' (status atual: ${statusRow.status}) e não pode receber entrada. Atualize a tela.`,
        );
      }

      const dataIso = fromBRTInputDateTime(dataMovimento);

      for (const it of itens) {
        const extra = getExtra(it);
        const qtd = extra.quantidade ?? Number(it.quantidade);
        if (!qtd || qtd <= 0) continue;
        const itemId = it.item_id || itemMap[it.id] || null;
        if (!itemId) {
          throw new Error(`Item "${it.descricao}" não está associado a um item do estoque`);
        }

        const vu = Number(extra.valor_unitario || 0);
        const desc = Number(extra.desconto || 0);
        const fre = Number(extra.frete || 0);
        const ip = Number(extra.ipi || 0);
        const out = Number(extra.outros_custos || 0);
        const valorTotal = qtd * vu - desc + fre + ip + out;

        const { error } = await sb.from("movimentacoes").insert({
          tipo: "entrada",
          entrada_tipo: "compra",
          item_id: itemId,
          quantidade: qtd,
          valor_unitario: vu || null,
          valor_total: Number(valorTotal.toFixed(4)),
          desconto: Number(desc.toFixed(4)),
          frete: Number(fre.toFixed(4)),
          ipi: Number(ip.toFixed(4)),
          outros_custos: Number(out.toFixed(4)),
          empresa,
          data_movimento: dataIso,
          fornecedor_id: fornecedorId || null,
          nota_fiscal: notaFiscal || null,
          responsavel_recebimento: compra?.comprador ?? null,
          responsavel_lancamento: compra?.comprador ?? null,
          observacoes:
            (observacoes ? observacoes + " — " : "") +
            `Recebimento da compra ${compra?.numero != null ? `COMPRA-${compra.numero}` : compraId}${fornecedorNome ? ` - Fornecedor: ${fornecedorNome}` : ""}` +
            (it.evento_projeto ? ` — EVENTO/PROJETO: ${it.evento_projeto}` : ""),

        }).select("id");
        if (error) throw error;

        await sb.from("compra_itens").update({
          recebido: true,
          quantidade_recebida: qtd,
          recebido_em: new Date().toISOString(),
          item_id: itemId,
        }).eq("id", it.id);
      }
      const { error } = await sb.from("compras")
        .update({ status: "finalizado", fornecedor: fornecedorNome || null, fornecedor_id: fornecedorId || null, documento: notaFiscal || null })
        .eq("id", compraId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado e compra finalizada");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
      qc.invalidateQueries({ queryKey: ["entradas"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  function fmtSize(n?: number | null) {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Validar recebimento
            {compra?.numero != null && (
              <span className="ml-2 text-xs font-mono text-muted-foreground">COMPRA-{compra.numero}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {(compra?.numero != null || compra?.solicitante) && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            {compra?.numero != null && <span className="font-mono">COMPRA-{compra.numero}</span>}
            {compra?.solicitante && <span>Solicitante: <span className="text-foreground font-medium">{compra.solicitante}</span></span>}
          </div>
        )}



        {statusBlocked && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <div>
              Esta compra não está mais em <strong>Compras a Receber</strong> (status atual: <strong>{compra?.status}</strong>).
              O recebimento está bloqueado. Atualize a página ou volte o card para "Compras a Receber" para continuar.
            </div>
          </div>
        )}

        {/* Dados gerais da entrada */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-border p-3 bg-muted/20">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data do recebimento*</label>
            <Input type="datetime-local" value={dataMovimento} onChange={(e) => setDataMovimento(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresa*</label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de entrada</label>
            <Input value="Compra" readOnly className="bg-muted/40" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fornecedor*</label>
            <EntitySearchSelect
              options={fornecedores as any}
              value={fornecedorId}
              onChange={(v) => setFornecedorId(v)}
              placeholder="Selecione…"
              searchPlaceholder="Buscar fornecedor…"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nota Fiscal</label>
            <Input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} placeholder="Nº NF" />
          </div>
          <div className="sm:col-span-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        {/* Itens */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Itens recebidos</h3>
          {itens.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item cadastrado nesta compra.</p>
          )}
          {itens.map((it) => {
            const extra = getExtra(it);
            const totalLinha = (extra.quantidade ?? 0) * (extra.valor_unitario ?? 0)
              - extra.desconto + extra.frete + extra.ipi + extra.outros_custos;
            return (
              <div key={it.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="font-medium text-sm">{it.descricao}</div>
                <div className="text-xs text-muted-foreground">
                  Pedido: {Number(it.quantidade)} {it.unidade ?? ""}
                </div>
                {it.evento_projeto && (
                  <div className="text-xs"><span className="text-muted-foreground">EVENTO/PROJETO:</span> <span className="font-medium">{it.evento_projeto}</span></div>
                )}


                <div className="flex flex-wrap gap-2">
                  <div className="w-[90px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qtd recebida</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={String(extra.quantidade ?? 0)}
                      onChange={(e) => setExtra(it.id, { quantidade: Number(e.target.value) })}
                    />
                  </div>
                  <div className="w-[120px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cust. unit.</label>
                    <MoneyInput value={Number(extra.valor_unitario || 0)} onChange={(n) => setExtra(it.id, { valor_unitario: n })} hidePrefix decimals={4} />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Desconto</label>
                    <MoneyInput value={extra.desconto} onChange={(n) => setExtra(it.id, { desconto: n })} hidePrefix />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Frete</label>
                    <MoneyInput value={extra.frete} onChange={(n) => setExtra(it.id, { frete: n })} hidePrefix />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">IPI</label>
                    <MoneyInput value={extra.ipi} onChange={(n) => setExtra(it.id, { ipi: n })} hidePrefix />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Outros</label>
                    <MoneyInput value={extra.outros_custos} onChange={(n) => setExtra(it.id, { outros_custos: n })} hidePrefix />
                  </div>
                  <div className="w-[120px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Total linha</label>
                    <div className="h-9 flex items-center px-2 rounded-md border border-input bg-muted/30 text-sm tabular-nums">
                      R$ {totalLinha.toFixed(2)}
                    </div>
                  </div>
                </div>

                {!it.item_id && !itemMap[it.id] && (
                  <div className="rounded border border-dashed border-warning/60 bg-warning/5 p-2 space-y-2">
                    <div className="text-xs text-warning">Item não associado ao estoque — escolha uma opção:</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Selecionar item existente</label>
                        <ItemSearchSelect
                          itens={estoqueItens as any}
                          value=""
                          onChange={(id) => {
                            setItemMap((m) => ({ ...m, [it.id]: id }));
                            toast.success("Item associado");
                          }}
                          placeholder="Buscar item no estoque…"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ou cadastrar novo</label>
                        <CadastrarItemInline
                          descricao={it.descricao}
                          unidade={it.unidade ?? "un"}
                          onCreated={(id) => {
                            setItemMap((m) => ({ ...m, [it.id]: id }));
                            toast.success("Item cadastrado no estoque");
                            refetch();
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {(it.item_id || itemMap[it.id]) && !it.item_id && (
                  <div className="text-xs text-success">✓ Item associado</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Anexos */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Anexos da compra</h3>
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
                    onClick={() => setPreviewAnexo(a)}
                  >
                    <div className="truncate font-medium">{a.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtSize(a.tamanho)} · {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                  </button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => baixarAnexo("compra-anexos", a.path, a.nome)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => finalizar.mutate()}
            disabled={finalizar.isPending || !!statusBlocked || linhasInvalidas}
          >
            {finalizar.isPending ? "Processando…" : "Finalizar recebimento"}
          </Button>
        </DialogFooter>

        <AnexoViewer
          bucket="compra-anexos"
          anexo={previewAnexo}
          open={!!previewAnexo}
          onOpenChange={(o) => !o && setPreviewAnexo(null)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CadastrarItemInline({
  descricao, unidade, onCreated,
}: { descricao: string; unidade: string; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [codigoProprio, setCodigoProprio] = useState("");
  const [nome, setNome] = useState(descricao);
  const [un, setUn] = useState(unidade);

  async function handleOpen() {
    setOpen(true);
    if (!codigo) {
      try {
        const sku = await generateNextSku();
        setCodigo(sku);
      } catch {}
    }
  }

  async function create() {
    if (!codigo || !nome) {
      toast.error("Preencha código e nome");
      return;
    }
    const { data, error } = await supabase
      .from("itens")
      .insert({ codigo, codigo_proprio: codigoProprio || null, nome, unidade: un, quantidade_atual: 0 })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    onCreated(data.id);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={handleOpen}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar novo item
      </Button>
    );
  }
  return (
    <div className="grid gap-2 grid-cols-2 rounded border border-dashed border-border p-2">
      <Input placeholder="Código (auto)" value={codigo} readOnly className="bg-muted/40" />
      <Input placeholder="Código próprio" value={codigoProprio} onChange={(e) => setCodigoProprio(e.target.value)} />
      <Input placeholder="Nome*" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input placeholder="Unidade" value={un} onChange={(e) => setUn(e.target.value)} />
      <div className="col-span-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="sm" onClick={create}>Cadastrar</Button>
      </div>
    </div>
  );
}
