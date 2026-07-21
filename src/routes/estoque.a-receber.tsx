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
import { PackageCheck, Plus, FileIcon, Download, AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { generateNextSku } from "@/lib/sku";
import { MoneyInput } from "@/components/MoneyInput";
import { ItemSearchSelect } from "@/components/ItemSearchSelect";
import { EMPRESAS } from "@/lib/empresas";
import { toBRTInputDateTime, fromBRTInputDateTime } from "@/lib/datetime";
import { AnexoViewer, baixarAnexo } from "@/components/AnexoViewer";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";
import { TIPOS_QUE_VAO_PARA_ESTOQUE, TIPO_DEMANDA_OPTIONS } from "@/lib/demandas";


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


type DemandaRow = {
  id: string;
  numero: number | null;
  titulo: string | null;
  tipo_demanda: string | null;
  solicitante: string | null;
  fornecedor: string | null;
  fornecedor_id: string | null;
  comprador: string | null;
  observacoes: string | null;
  total: number;
};

const TIPO_DEMANDA_LABEL: Record<string, string> = Object.fromEntries(
  TIPO_DEMANDA_OPTIONS.map((o) => [o.value, o.label]),
);


function AReceberPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDemandaId, setOpenDemandaId] = useState<string | null>(null);

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

  const { data: demandas = [] } = useQuery({
    queryKey: ["demandas-receber"],
    queryFn: async () => {
      const { data: dm, error } = await sb
        .from("demandas")
        .select("id,numero,titulo,tipo_demanda,solicitante,fornecedor,fornecedor_id,comprador,observacoes")
        .eq("status", "a_receber")
        .in("tipo_demanda", TIPOS_QUE_VAO_PARA_ESTOQUE);
      if (error) throw error;
      const rows = (dm ?? []) as any[];
      const ids = rows.map((r) => r.id);
      let totals: Record<string, number> = {};
      if (ids.length) {
        const { data: itens } = await sb
          .from("demanda_itens")
          .select("demanda_id,quantidade,valor_unitario,desconto,frete,ipi,outros_custos")
          .in("demanda_id", ids)
          .eq("recebido", false);
        for (const it of (itens ?? []) as any[]) {
          const q = Number(it.quantidade || 0);
          const vu = Number(it.valor_unitario || 0);
          const desc = Number(it.desconto || 0);
          const fre = Number(it.frete || 0);
          const ip = Number(it.ipi || 0);
          const out = Number(it.outros_custos || 0);
          totals[it.demanda_id] = (totals[it.demanda_id] || 0) + (q * vu - desc + fre + ip + out);
        }
      }
      return rows.map((r) => ({ ...r, total: totals[r.id] || 0 })) as DemandaRow[];
    },
  });

  return (
    <>
      <PageHeader
        title="Recebimentos a validar"
        description="Compras e despesas de material aguardando entrada no estoque"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {compras.length === 0 && demandas.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhum recebimento pendente.
          </Card>
        )}
        {compras.map((c) => (
          <Card key={c.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{c.titulo || c.fornecedor || "Compra"}</div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                {c.numero != null ? `COMPRA-${c.numero}` : "COMPRA"}
              </span>
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
        {demandas.map((d) => (
          <Card key={d.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{d.titulo || d.fornecedor || "Despesa"}</div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                {d.numero != null ? `DESPESA-${d.numero}` : "DESPESA"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {d.tipo_demanda && <div>Tipo: {TIPO_DEMANDA_LABEL[d.tipo_demanda] ?? d.tipo_demanda.replace(/_/g, " ")}</div>}
              {d.solicitante && <div>Solicitante: {d.solicitante}</div>}
              {d.fornecedor && <div>Fornecedor: {d.fornecedor}</div>}
              {d.comprador && <div>Comprador: {d.comprador}</div>}
              {d.total > 0 && (
                <div className="font-medium text-foreground">
                  {d.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
            </div>
            <Button size="sm" className="w-full" onClick={() => setOpenDemandaId(d.id)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Validar recebimento
            </Button>
          </Card>
        ))}
      </div>

      {openId && (
        <ReceberDialog
          compraId={openId}
          compraNumero={compras.find((c) => c.id === openId)?.numero ?? null}
          onClose={() => { setOpenId(null); qc.invalidateQueries({ queryKey: ["compras-receber"] }); }}
        />
      )}
      {openDemandaId && (
        <ReceberDemandaDialog
          demandaId={openDemandaId}
          demandaNumero={demandas.find((d) => d.id === openDemandaId)?.numero ?? null}
          onClose={() => {
            setOpenDemandaId(null);
            qc.invalidateQueries({ queryKey: ["demandas-receber"] });
            qc.invalidateQueries({ queryKey: ["demandas"] });
          }}
        />
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

function ReceberDialog({ compraId, compraNumero, onClose }: { compraId: string; compraNumero: number | null; onClose: () => void }) {
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
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");

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

  const totalRecebimento = useMemo(() => {
    return itens.reduce((soma, it) => {
      const extra = getExtra(it);
      const qtd = extra.quantidade ?? Number(it.quantidade) ?? 0;
      const vu = Number(extra.valor_unitario || 0);
      const desc = Number(extra.desconto || 0);
      const fre = Number(extra.frete || 0);
      const ip = Number(extra.ipi || 0);
      const out = Number(extra.outros_custos || 0);
      if (!qtd || qtd <= 0) return soma;
      return soma + (qtd * vu - desc + fre + ip + out);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, linhaExtras]);


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

      // Gera UM número de requisição para agrupar todos os itens deste recebimento
      const { data: numData, error: numErr } = await sb.rpc("next_requisicao_numero");
      if (numErr) throw numErr;
      const requisicaoNumero = numData as number;

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
          requisicao_numero: requisicaoNumero,

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

  const devolver = useMutation({
    mutationFn: async () => {
      if (!motivoDevolucao.trim()) throw new Error("Informe o motivo da devolução");

      const { data: statusRow, error: statusErr } = await sb
        .from("compras")
        .select("status")
        .eq("id", compraId)
        .maybeSingle();
      if (statusErr) throw statusErr;
      if (!statusRow) throw new Error("Compra não encontrada");
      if (statusRow.status !== "a_receber") {
        throw new Error(`Esta compra não está mais em 'A Receber' (status: ${statusRow.status}).`);
      }

      const { error: updateErr } = await sb
        .from("compras")
        .update({ status: "em_andamento" })
        .eq("id", compraId);
      if (updateErr) throw updateErr;

      const { data: { user } } = await supabase.auth.getUser();
      await sb.from("compra_comentarios").insert({
        compra_id: compraId,
        user_id: user?.id ?? null,
        user_nome: user?.user_metadata?.full_name ?? user?.email ?? "Estoque",
        texto: `🔄 Devolvido para Compras Em Andamento\nMotivo: ${motivoDevolucao.trim()}`,
      });
    },
    onSuccess: () => {
      toast.success("Compra devolvida para 'Em Andamento' no Quadro de Compras");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      setDevolverOpen(false);
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao devolver"),
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
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Validar recebimento</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">
              COMPRA-{compraNumero ?? compra?.numero ?? "—"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {compra?.solicitante && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>Solicitante: <span className="text-foreground font-medium">{compra.solicitante}</span></span>
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

                {!it.item_id && (
                  <div className={`rounded border p-2 space-y-2 ${itemMap[it.id] ? "border-success/40 bg-success/5" : "border-dashed border-warning/60 bg-warning/5"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-xs ${itemMap[it.id] ? "text-success" : "text-warning"}`}>
                        {itemMap[it.id] ? "✓ Item associado — você pode trocar se necessário" : "Item não associado ao estoque — escolha uma opção:"}
                      </div>
                      {itemMap[it.id] && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setItemMap((m) => {
                              const next = { ...m };
                              delete next[it.id];
                              return next;
                            });
                            toast.success("Associação desfeita");
                          }}
                        >
                          Desfazer associação
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Selecionar item existente</label>
                        <ItemSearchSelect
                          itens={estoqueItens as any}
                          value={itemMap[it.id] ?? ""}
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

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              className="border-warning/60 text-warning hover:bg-warning/10"
              onClick={() => setDevolverOpen(true)}
              disabled={!!statusBlocked || finalizar.isPending}
            >
              <Undo2 className="h-4 w-4 mr-1" /> Devolver para Compras
            </Button>
            <div className="text-sm">
              <span className="text-muted-foreground">Total do recebimento: </span>
              <span className="font-semibold tabular-nums">
                {totalRecebimento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>


          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => finalizar.mutate()}
              disabled={finalizar.isPending || !!statusBlocked || linhasInvalidas}
            >
              {finalizar.isPending ? "Processando…" : "Finalizar recebimento"}
            </Button>
          </div>
        </DialogFooter>

        {devolverOpen && (
          <Dialog open onOpenChange={(v) => { if (!v) setDevolverOpen(false); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Devolver para Compras Em Andamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  O card voltará para a coluna <strong>Compra Em Andamento</strong> no Quadro de Compras. O motivo ficará registrado nos comentários da compra.
                </p>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                    Motivo / Causa*
                  </label>
                  <Textarea
                    rows={3}
                    value={motivoDevolucao}
                    onChange={(e) => setMotivoDevolucao(e.target.value)}
                    placeholder="Ex: Item com avaria, quantidade divergente, produto errado…"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDevolverOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => devolver.mutate()}
                  disabled={devolver.isPending || !motivoDevolucao.trim()}
                >
                  {devolver.isPending ? "Devolvendo…" : "Confirmar devolução"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

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

type LinhaRecDem = {
  key: string;
  demanda_item_id?: string | null;
  item_id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  frete: number;
  ipi: number;
  outros_custos: number;
};

function novaLinhaRecDem(): LinhaRecDem {
  return {
    key: `l-${Math.random().toString(36).slice(2, 9)}`,
    item_id: "",
    descricao: "",
    unidade: "",
    quantidade: 0,
    valor_unitario: 0,
    desconto: 0,
    frete: 0,
    ipi: 0,
    outros_custos: 0,
  };
}

function ReceberDemandaDialog({ demandaId, demandaNumero, onClose }: { demandaId: string; demandaNumero: number | null; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: demanda } = useQuery({
    queryKey: ["demanda-a-receber-info", demandaId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select("id,numero,titulo,solicitante,fornecedor,fornecedor_id,documento,comprador,status,tipo_demanda")
        .eq("id", demandaId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Despesa não encontrada");
      return data as any;
    },
  });

  const { data: demandaItens = [] } = useQuery({
    queryKey: ["demanda-itens-a-receber-src", demandaId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demanda_itens")
        .select("id,item_id,descricao,unidade,quantidade,valor_unitario,desconto,frete,ipi,outros_custos,recebido")
        .eq("demanda_id", demandaId)
        .eq("recebido", false)
        .order("created_at", { ascending: true });
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

  const [previewAnexo, setPreviewAnexo] = useState<any | null>(null);

  function fmtSizeD(n?: number | null) {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  const [linhas, setLinhas] = useState<LinhaRecDem[]>([novaLinhaRecDem()]);
  const [fornecedorId, setFornecedorId] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [dataMovimento, setDataMovimento] = useState(() => toBRTInputDateTime());
  const [prefilled, setPrefilled] = useState(false);

  if (demanda && !prefilled) {
    setPrefilled(true);
    if (demanda.fornecedor_id) setFornecedorId(demanda.fornecedor_id);
    if (demanda.documento) setNotaFiscal(demanda.documento);
  }

  const [linhasInit, setLinhasInit] = useState(false);
  if (demandaItens.length > 0 && !linhasInit) {
    setLinhasInit(true);
    setLinhas(
      demandaItens.map((it) => ({
        key: `l-${it.id}`,
        demanda_item_id: it.id,
        item_id: it.item_id ?? "",
        descricao: it.descricao ?? "",
        unidade: it.unidade ?? "",
        quantidade: Number(it.quantidade || 0),
        valor_unitario: Number(it.valor_unitario || 0),
        desconto: Number(it.desconto || 0),
        frete: Number(it.frete || 0),
        ipi: Number(it.ipi || 0),
        outros_custos: Number(it.outros_custos || 0),
      })),
    );
  }

  const statusBlocked = demanda && demanda.status !== "a_receber";

  const totalRecebimento = useMemo(() => {
    return linhas.reduce((soma, l) => {
      const q = Number(l.quantidade || 0);
      if (!q || q <= 0) return soma;
      const vu = Number(l.valor_unitario || 0);
      return soma + (q * vu - Number(l.desconto || 0) + Number(l.frete || 0) + Number(l.ipi || 0) + Number(l.outros_custos || 0));
    }, 0);
  }, [linhas]);

  const linhasValidas = linhas.filter((l) => l.item_id && l.quantidade > 0);

  function setLinha(key: string, patch: Partial<LinhaRecDem>) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removerLinha(key: string) {
    setLinhas((ls) => (ls.length <= 1 ? ls : ls.filter((l) => l.key !== key)));
  }
  function adicionarLinha() {
    setLinhas((ls) => [...ls, novaLinhaRecDem()]);
  }

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!fornecedorId) throw new Error("Selecione o fornecedor");
      if (!empresa) throw new Error("Selecione a empresa");
      if (!dataMovimento) throw new Error("Informe a data do recebimento");
      if (linhasValidas.length === 0)
        throw new Error("Selecione ao menos um item de estoque e informe a quantidade.");

      const fornecedorNome = fornecedores.find((f: any) => f.id === fornecedorId)?.nome ?? "";

      const { data: statusRow, error: statusErr } = await sb
        .from("demandas").select("status").eq("id", demandaId).maybeSingle();
      if (statusErr) throw statusErr;
      if (!statusRow) throw new Error("Despesa não encontrada");
      if (statusRow.status !== "a_receber") {
        throw new Error(`Esta despesa não está mais em 'A Receber' (status atual: ${statusRow.status}).`);
      }

      const dataIso = fromBRTInputDateTime(dataMovimento);
      const { data: numData, error: numErr } = await sb.rpc("next_requisicao_numero");
      if (numErr) throw numErr;
      const requisicaoNumero = numData as number;
      const origem = demanda?.numero != null ? `DESPESA-${demanda.numero}` : demandaId;

      for (const l of linhasValidas) {
        const qtd = Number(l.quantidade);
        const vu = Number(l.valor_unitario || 0);
        const desc = Number(l.desconto || 0);
        const fre = Number(l.frete || 0);
        const ip = Number(l.ipi || 0);
        const out = Number(l.outros_custos || 0);
        const valorTotal = qtd * vu - desc + fre + ip + out;

        const { error } = await sb.from("movimentacoes").insert({
          tipo: "entrada",
          entrada_tipo: "compra",
          item_id: l.item_id,
          quantidade: qtd,
          valor_unitario: vu || null,
          valor_total: Number(valorTotal.toFixed(4)),
          desconto: Number(desc.toFixed(4)),
          frete: Number(fre.toFixed(4)),
          ipi: Number(ip.toFixed(4)),
          outros_custos: Number(out.toFixed(4)),
          requisicao_numero: requisicaoNumero,
          empresa,
          data_movimento: dataIso,
          fornecedor_id: fornecedorId || null,
          nota_fiscal: notaFiscal || null,
          responsavel_recebimento: demanda?.comprador ?? null,
          responsavel_lancamento: demanda?.comprador ?? null,
          observacoes: `Recebimento da despesa ${origem}${fornecedorNome ? ` - Fornecedor: ${fornecedorNome}` : ""}`,
        });
        if (error) throw error;

        if (l.demanda_item_id) {
          await sb.from("demanda_itens").update({
            item_id: l.item_id,
            recebido: true,
            quantidade_recebida: qtd,
            recebido_em: new Date().toISOString(),
          }).eq("id", l.demanda_item_id);
        }
      }

      const { error: updErr } = await sb.from("demandas").update({
        status: "finalizado",
        fornecedor: fornecedorNome || demanda?.fornecedor || null,
        fornecedor_id: fornecedorId || null,
        documento: notaFiscal || null,
      }).eq("id", demandaId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado e despesa finalizada");
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demandas-receber"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["item-movs"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Validar recebimento</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">
              DESPESA-{demanda?.numero ?? "—"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {demanda?.solicitante && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>Solicitante: <span className="text-foreground font-medium">{demanda.solicitante}</span></span>
          </div>
        )}

        {statusBlocked && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <div>
              Esta despesa não está mais em <strong>A Receber</strong> (status atual: <strong>{demanda?.status}</strong>).
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
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Itens que vão dar entrada no estoque</h3>
            <Button size="sm" variant="outline" onClick={adicionarLinha}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
            </Button>
          </div>

          {linhas.map((l) => {
            const total = Number(l.quantidade || 0) * Number(l.valor_unitario || 0)
              - Number(l.desconto || 0) + Number(l.frete || 0) + Number(l.ipi || 0) + Number(l.outros_custos || 0);
            return (
              <div key={l.key} className="rounded-md border border-border p-3 space-y-2">
                {l.descricao && (
                  <div className="text-xs text-muted-foreground">{l.descricao}</div>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_120px]">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item de estoque*</label>
                    <ItemSearchSelect
                      itens={estoqueItens as any}
                      value={l.item_id}
                      onChange={(v) => setLinha(l.key, { item_id: v })}
                      placeholder="Buscar item…"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qtd*</label>
                    <Input
                      type="number" min={0} step="0.01"
                      value={l.quantidade || ""}
                      onChange={(e) => setLinha(l.key, { quantidade: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cust. unit.</label>
                    <MoneyInput value={l.valor_unitario} onChange={(v) => setLinha(l.key, { valor_unitario: v })} hidePrefix decimals={4} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Total linha</label>
                    <div className="h-9 flex items-center justify-end px-2 rounded-md border border-input bg-muted/30 text-sm tabular-nums">
                      {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Desconto</label>
                    <MoneyInput value={l.desconto} onChange={(v) => setLinha(l.key, { desconto: v })} hidePrefix />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Frete</label>
                    <MoneyInput value={l.frete} onChange={(v) => setLinha(l.key, { frete: v })} hidePrefix />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">IPI</label>
                    <MoneyInput value={l.ipi} onChange={(v) => setLinha(l.key, { ipi: v })} hidePrefix />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Outros / Imposto</label>
                    <MoneyInput value={l.outros_custos} onChange={(v) => setLinha(l.key, { outros_custos: v })} hidePrefix />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" disabled={linhas.length <= 1} onClick={() => removerLinha(l.key)}>
                    <Undo2 className="h-3.5 w-3.5 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="text-right text-sm">
            <span className="text-muted-foreground">Total do recebimento: </span>
            <span className="font-semibold tabular-nums">
              {totalRecebimento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>

        {anexos.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Anexos da solicitação</div>
            <div className="flex flex-wrap gap-2">
              {anexos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPreviewAnexo(a)}
                  className="text-left rounded-md border border-border bg-muted/30 hover:bg-muted px-3 py-2 text-xs max-w-[240px] truncate"
                  title={a.nome}
                >
                  <div className="font-medium truncate">{a.nome}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtSizeD(a.tamanho)}</div>
                </button>
              ))}
            </div>
            {previewAnexo && (
              <AnexoViewer
                bucket="demanda-anexos"
                anexo={previewAnexo}
                open={!!previewAnexo}
                onOpenChange={(o) => !o && setPreviewAnexo(null)}
              />
            )}
          </div>
        )}


        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => finalizar.mutate()}
            disabled={finalizar.isPending || !!statusBlocked}
          >
            <PackageCheck className="h-4 w-4 mr-1" />
            {finalizar.isPending ? "Registrando…" : "Finalizar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
