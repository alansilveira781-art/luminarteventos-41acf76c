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
import { PackageCheck, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/MoneyInput";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EMPRESAS } from "@/lib/empresas";
import { toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { TIPO_DEMANDA_OPTIONS, TIPOS_QUE_VAO_PARA_ESTOQUE } from "@/lib/demandas";

const sb = supabase as any;

export const Route = createFileRoute("/financeiro/a-receber")({
  component: DespesasAReceberPage,
});

type DemandaRow = {
  id: string;
  numero: number | null;
  titulo: string | null;
  solicitante: string | null;
  fornecedor: string | null;
  fornecedor_id: string | null;
  comprador: string | null;
  data_compra: string | null;
  valor_total: number | null;
  tipo_demanda: string | null;
  documento: string | null;
  observacoes: string | null;
  status: string;
};

const TIPO_LABEL: Record<string, string> = TIPO_DEMANDA_OPTIONS.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {},
);

function DespesasAReceberPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: demandas = [] } = useQuery({
    queryKey: ["demandas-a-receber"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select("id,numero,titulo,solicitante,fornecedor,fornecedor_id,comprador,data_compra,valor_total,tipo_demanda,documento,observacoes,status")
        .eq("status", "a_receber")
        .in("tipo_demanda", TIPOS_QUE_VAO_PARA_ESTOQUE)
        .order("data_compra", { ascending: true });
      if (error) throw error;
      return data as DemandaRow[];
    },
  });

  return (
    <>
      <PageHeader
        title="Despesas a receber"
        description="Valide o recebimento das despesas de fardamento, material de limpeza e material de escritório, dando entrada no estoque."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {demandas.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhuma despesa aguardando recebimento.
          </Card>
        )}
        {demandas.map((d) => (
          <Card key={d.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{d.titulo || d.fornecedor || "Despesa"}</div>
              <div className="text-[11px] font-mono text-muted-foreground shrink-0">
                {d.numero != null ? `DEMANDA-${d.numero}` : "—"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {d.tipo_demanda && <div>Tipo: {TIPO_LABEL[d.tipo_demanda] ?? d.tipo_demanda}</div>}
              {d.solicitante && <div>Solicitante: {d.solicitante}</div>}
              {d.fornecedor && <div>Fornecedor: {d.fornecedor}</div>}
              {d.comprador && <div>Comprador: {d.comprador}</div>}
              {d.data_compra && <div>Compra: {new Date(d.data_compra).toLocaleDateString("pt-BR")}</div>}
              {d.valor_total != null && (
                <div className="font-medium text-foreground">
                  {Number(d.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
            </div>
            <Button size="sm" className="w-full" onClick={() => setOpenId(d.id)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Validar recebimento
            </Button>
          </Card>
        ))}
      </div>

      {openId && (
        <ReceberDemandaDialog
          demandaId={openId}
          onClose={() => {
            setOpenId(null);
            qc.invalidateQueries({ queryKey: ["demandas-a-receber"] });
            qc.invalidateQueries({ queryKey: ["demandas"] });
          }}
        />
      )}
    </>
  );
}

type Linha = {
  key: string;
  item_id: string;
  quantidade: number;
  valor_unitario: number;
};

function novaLinha(): Linha {
  return {
    key: `l-${Math.random().toString(36).slice(2, 9)}`,
    item_id: "",
    quantidade: 0,
    valor_unitario: 0,
  };
}

function ReceberDemandaDialog({ demandaId, onClose }: { demandaId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: demanda } = useQuery({
    queryKey: ["demanda-a-receber", demandaId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select("id,numero,titulo,solicitante,fornecedor,fornecedor_id,documento,comprador,status,observacoes,tipo_demanda,valor_total")
        .eq("id", demandaId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Demanda não encontrada");
      return data as DemandaRow;
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

  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [fornecedorId, setFornecedorId] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataMovimento, setDataMovimento] = useState(() => toBRTInputDateTime());
  const [prefilled, setPrefilled] = useState(false);

  if (demanda && !prefilled) {
    setPrefilled(true);
    if (demanda.fornecedor_id) setFornecedorId(demanda.fornecedor_id);
    if (demanda.documento) setNotaFiscal(demanda.documento);
    if (demanda.observacoes) setObservacoes(demanda.observacoes);
  }

  const statusBlocked = demanda && demanda.status !== "a_receber";

  const totalRecebimento = useMemo(() => {
    return linhas.reduce((soma, l) => {
      const q = Number(l.quantidade || 0);
      const vu = Number(l.valor_unitario || 0);
      if (!q || q <= 0) return soma;
      return soma + q * vu;
    }, 0);
  }, [linhas]);

  const linhasValidas = linhas.filter((l) => l.item_id && l.quantidade > 0);

  function setLinha(key: string, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removerLinha(key: string) {
    setLinhas((ls) => (ls.length <= 1 ? ls : ls.filter((l) => l.key !== key)));
  }
  function adicionarLinha() {
    setLinhas((ls) => [...ls, novaLinha()]);
  }

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!fornecedorId) throw new Error("Selecione o fornecedor");
      if (!empresa) throw new Error("Selecione a empresa");
      if (!dataMovimento) throw new Error("Informe a data do recebimento");
      if (linhasValidas.length === 0)
        throw new Error("Adicione ao menos um item (com item, quantidade e valor).");

      const fornecedorNome = fornecedores.find((f: any) => f.id === fornecedorId)?.nome ?? "";

      const { data: statusRow, error: statusErr } = await sb
        .from("demandas")
        .select("status")
        .eq("id", demandaId)
        .maybeSingle();
      if (statusErr) throw statusErr;
      if (!statusRow) throw new Error("Demanda não encontrada");
      if (statusRow.status !== "a_receber") {
        throw new Error(
          `Esta despesa não está mais em 'A Receber' (status atual: ${statusRow.status}). Atualize a tela.`,
        );
      }

      const dataIso = fromBRTInputDateTime(dataMovimento);

      const { data: numData, error: numErr } = await sb.rpc("next_requisicao_numero");
      if (numErr) throw numErr;
      const requisicaoNumero = numData as number;

      const origem = demanda?.numero != null ? `DEMANDA-${demanda.numero}` : demandaId;

      for (const l of linhasValidas) {
        const qtd = Number(l.quantidade);
        const vu = Number(l.valor_unitario || 0);
        const valorTotal = qtd * vu;

        const { error } = await sb.from("movimentacoes").insert({
          tipo: "entrada",
          entrada_tipo: "compra",
          item_id: l.item_id,
          quantidade: qtd,
          valor_unitario: vu || null,
          valor_total: Number(valorTotal.toFixed(4)),
          desconto: 0,
          frete: 0,
          ipi: 0,
          outros_custos: 0,
          requisicao_numero: requisicaoNumero,
          empresa,
          data_movimento: dataIso,
          fornecedor_id: fornecedorId || null,
          nota_fiscal: notaFiscal || null,
          responsavel_recebimento: demanda?.comprador ?? null,
          responsavel_lancamento: demanda?.comprador ?? null,
          observacoes:
            (observacoes ? observacoes + " — " : "") +
            `Recebimento da despesa ${origem}${fornecedorNome ? ` - Fornecedor: ${fornecedorNome}` : ""}`,
        });
        if (error) throw error;
      }

      const { error: updErr } = await sb
        .from("demandas")
        .update({
          status: "finalizado",
          fornecedor: fornecedorNome || demanda?.fornecedor || null,
          fornecedor_id: fornecedorId || null,
          documento: notaFiscal || null,
        })
        .eq("id", demandaId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado e despesa finalizada");
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demandas-a-receber"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
      qc.invalidateQueries({ queryKey: ["entradas"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Validar recebimento
            {demanda?.numero != null && (
              <span className="ml-2 text-xs font-mono text-muted-foreground">DEMANDA-{demanda.numero}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {(demanda?.numero != null || demanda?.solicitante || demanda?.tipo_demanda) && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            {demanda?.numero != null && <span className="font-mono">DEMANDA-{demanda.numero}</span>}
            {demanda?.tipo_demanda && (
              <span>Tipo: <span className="text-foreground font-medium">{TIPO_LABEL[demanda.tipo_demanda] ?? demanda.tipo_demanda}</span></span>
            )}
            {demanda?.solicitante && (
              <span>Solicitante: <span className="text-foreground font-medium">{demanda.solicitante}</span></span>
            )}
          </div>
        )}

        {statusBlocked && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <div>
              Esta despesa não está mais em <strong>A Receber</strong> (status atual: <strong>{demanda?.status}</strong>).
              O recebimento está bloqueado. Atualize a página ou volte o card para "A Receber".
            </div>
          </div>
        )}

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
            <Input value="Compra (despesa)" readOnly className="bg-muted/40" />
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
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nota fiscal</label>
            <Input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Itens que vão dar entrada no estoque</h3>
            <Button size="sm" variant="outline" onClick={adicionarLinha}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
            </Button>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-2 font-medium">Item de estoque*</th>
                  <th className="p-2 font-medium w-24">Qtd*</th>
                  <th className="p-2 font-medium w-32">Valor unit.</th>
                  <th className="p-2 font-medium w-32 text-right">Total</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const total = Number(l.quantidade || 0) * Number(l.valor_unitario || 0);
                  return (
                    <tr key={l.key} className="border-t border-border align-top">
                      <td className="p-2">
                        <ItemSearchSelect
                          itens={estoqueItens as any}
                          value={l.item_id}
                          onChange={(v) => setLinha(l.key, { item_id: v })}
                          placeholder="Buscar item…"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.quantidade || ""}
                          onChange={(e) => setLinha(l.key, { quantidade: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2">
                        <MoneyInput
                          value={l.valor_unitario}
                          onChange={(v) => setLinha(l.key, { valor_unitario: v })}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="p-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={linhas.length <= 1}
                          onClick={() => removerLinha(l.key)}
                          aria-label="Remover linha"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/20">
                <tr>
                  <td colSpan={3} className="p-2 text-right font-medium">Total do recebimento</td>
                  <td className="p-2 text-right font-semibold tabular-nums">
                    {totalRecebimento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => finalizar.mutate()}
            disabled={finalizar.isPending || statusBlocked || linhasValidas.length === 0}
          >
            {finalizar.isPending ? "Registrando…" : "Registrar entrada e finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
