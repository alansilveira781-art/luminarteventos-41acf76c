import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackageCheck, Paperclip, FileIcon, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NumberInput } from "@/components/comercial/NumberInput";
import { AnexoViewer, baixarAnexo } from "@/components/AnexoViewer";

const sb = supabase as any;

export const Route = createFileRoute("/patrimonio/a-receber")({
  component: PatrimonioAReceberPage,
});

const ESTADOS_PAT = ["OTIMO", "BOM", "EM MANUTENCAO", "DANIFICADO"];
const UNIDADES_PAT = ["UNIDADE", "M²", "METRAGEM", "PAR", "PEÇA"];

type DemandaItemRow = {
  id: string;
  item_id: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number | null;
  desconto: number | null;
  frete: number | null;
  ipi: number | null;
  outros_custos: number | null;
};

type AnexoRow = {
  id: string;
  nome: string;
  path: string;
  mime_type: string | null;
  tamanho: number | null;
  created_at: string | null;
};

type DemandaRow = {
  id: string;
  numero: number | null;
  titulo: string | null;
  fornecedor: string | null;
  documento: string | null;
  solicitante: string | null;
  comprador: string | null;
  valor_total: number | null;
  data_compra: string | null;
  data_solicitacao: string | null;
  observacoes: string | null;
  numeros_nf: string[] | null;
  numero_nf: string | null;
  categoria_external_id: string | null;
  created_at: string | null;
  itens: DemandaItemRow[];
  anexos: AnexoRow[];
};

function fmtSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function PatrimonioAReceberPage() {
  const [openDemanda, setOpenDemanda] = useState<DemandaRow | null>(null);
  const qc = useQueryClient();

  const { data: pendentes = [] } = useQuery({
    queryKey: ["patrimonio-a-receber"],
    queryFn: async () => {
      const { data: demandas, error } = await sb
        .from("demandas")
        .select(
          "id,numero,titulo,fornecedor,documento,solicitante,comprador,valor_total,data_compra,data_solicitacao,observacoes,numeros_nf,numero_nf,categoria_external_id,created_at",
        )
        .eq("tipo_demanda", "imobilizado")
        .eq("status", "a_receber")
        .order("data_compra", { ascending: true });
      if (error) throw error;
      const rows = (demandas ?? []) as any[];
      if (!rows.length) return [] as DemandaRow[];

      const ids = rows.map((r) => r.id);
      const [{ data: itens }, { data: anexos }] = await Promise.all([
        sb
          .from("demanda_itens")
          .select("id,demanda_id,item_id,descricao,unidade,quantidade,valor_unitario,desconto,frete,ipi,outros_custos")
          .in("demanda_id", ids)
          .eq("recebido", false),
        sb
          .from("demanda_anexos")
          .select("id,demanda_id,nome,path,mime_type,tamanho,created_at")
          .in("demanda_id", ids)
          .order("created_at", { ascending: false }),
      ]);

      const itensByDemanda: Record<string, DemandaItemRow[]> = {};
      for (const it of (itens ?? []) as any[]) {
        (itensByDemanda[it.demanda_id] ||= []).push(it);
      }
      const anexosByDemanda: Record<string, AnexoRow[]> = {};
      for (const a of (anexos ?? []) as any[]) {
        (anexosByDemanda[a.demanda_id] ||= []).push(a);
      }

      return rows.map((r) => ({
        ...r,
        itens: itensByDemanda[r.id] ?? [],
        anexos: anexosByDemanda[r.id] ?? [],
      })) as DemandaRow[];
    },
  });

  return (
    <>
      <PageHeader
        title="A receber"
        description="Imobilizados em Despesa aguardando validação de recebimento"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pendentes.length === 0 && (
          <Card className="p-6 col-span-full text-sm text-muted-foreground text-center">
            Nenhum imobilizado aguardando recebimento.
          </Card>
        )}
        {pendentes.map((d) => (
          <Card key={d.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight">
                {d.titulo || d.fornecedor || "Imobilizado"}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted whitespace-nowrap">
                {d.numero != null ? `DESPESA-${d.numero}` : "—"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {d.fornecedor && <p>Fornecedor: {d.fornecedor}</p>}
              {d.data_compra && (
                <p>Compra: {new Date(d.data_compra + "T00:00").toLocaleDateString("pt-BR")}</p>
              )}
              {d.valor_total != null && (
                <p className="font-medium text-foreground">
                  {Number(d.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <span>{d.itens.length} {d.itens.length === 1 ? "item" : "itens"}</span>
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {d.anexos.length} {d.anexos.length === 1 ? "anexo" : "anexos"}
                </span>
              </div>
            </div>
            <Button size="sm" className="mt-auto" onClick={() => setOpenDemanda(d)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Validar recebimento
            </Button>
          </Card>
        ))}
      </div>

      {openDemanda && (
        <ValidarRecebimentoDialog
          demanda={openDemanda}
          onClose={() => {
            setOpenDemanda(null);
            qc.invalidateQueries({ queryKey: ["patrimonio-a-receber"] });
          }}
        />
      )}
    </>
  );
}

type LinhaPat = {
  demanda_item_id: string | null;
  nome: string;
  cod: number | null;
  quantidade: number;
  unidade: string;
  valor: number;
  especificacao: string;
  dimensoes: string;
  subcategoria: string;
  estado: string;
  localizacao: string;
  data_compra: string | null;
  observacoes: string;
};

function buildInitialLinhas(demanda: DemandaRow): LinhaPat[] {
  const baseObs = `Originado da Despesa ${demanda.numero != null ? `#${demanda.numero}` : demanda.id.slice(0, 8)}`;
  if (demanda.itens.length === 0) {
    return [
      {
        demanda_item_id: null,
        nome: demanda.titulo || demanda.fornecedor || "",
        cod: null,
        quantidade: 1,
        unidade: "UNIDADE",
        valor: Number(demanda.valor_total || 0),
        especificacao: "",
        dimensoes: "",
        subcategoria: "",
        estado: "BOM",
        localizacao: "",
        data_compra: demanda.data_compra ?? null,
        observacoes: baseObs,
      },
    ];
  }
  return demanda.itens.map((it) => {
    const q = Number(it.quantidade || 0);
    const vu = Number(it.valor_unitario || 0);
    const desc = Number(it.desconto || 0);
    const fre = Number(it.frete || 0);
    const ip = Number(it.ipi || 0);
    const out = Number(it.outros_custos || 0);
    const totalLinha = q * vu - desc + fre + ip + out;
    const valorUnitEfetivo = q > 0 ? totalLinha / q : vu;
    return {
      demanda_item_id: it.id,
      nome: it.descricao || demanda.titulo || "",
      cod: null,
      quantidade: q > 0 ? q : 1,
      unidade: it.unidade || "UNIDADE",
      valor: Number(valorUnitEfetivo.toFixed(4)),
      especificacao: "",
      dimensoes: "",
      subcategoria: "",
      estado: "BOM",
      localizacao: "",
      data_compra: demanda.data_compra ?? null,
      observacoes: baseObs,
    };
  });
}

function ValidarRecebimentoDialog({ demanda, onClose }: { demanda: DemandaRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [linhas, setLinhas] = useState<LinhaPat[]>(() => buildInitialLinhas(demanda));
  const [preview, setPreview] = useState<AnexoRow | null>(null);

  const nfs = useMemo(() => {
    if (demanda.numeros_nf && demanda.numeros_nf.length > 0) return demanda.numeros_nf;
    return demanda.numero_nf ? [demanda.numero_nf] : [];
  }, [demanda]);

  const setLinha = (idx: number, patch: Partial<LinhaPat>) =>
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLinha = (idx: number) =>
    setLinhas((prev) => prev.filter((_, i) => i !== idx));

  const finalizar = useMutation({
    mutationFn: async () => {
      if (linhas.length === 0) throw new Error("Adicione ao menos um item para patrimoniar.");
      for (const l of linhas) {
        if (!l.nome?.trim()) throw new Error("Todos os itens precisam de nome.");
      }

      // 1. Revalidar status
      const { data: statusRow, error: statusErr } = await sb
        .from("demandas")
        .select("status")
        .eq("id", demanda.id)
        .maybeSingle();
      if (statusErr) throw statusErr;
      if (!statusRow || statusRow.status !== "a_receber") {
        throw new Error("Esta despesa não está mais em A Receber. Atualize a tela.");
      }

      // 2. Anti-duplicidade
      const { data: jaReg } = await sb
        .from("demanda_patrimonio_registros")
        .select("id")
        .eq("demanda_id", demanda.id)
        .limit(1);
      if (jaReg && jaReg.length > 0) {
        throw new Error("Este imobilizado já foi registrado no patrimônio. Atualize a tela.");
      }

      // 3. Buscar último id_item UMA VEZ
      const { data: lastItems } = await sb
        .from("pat_itens")
        .select("id_item")
        .ilike("id_item", "IMO-%")
        .order("id_item", { ascending: false })
        .limit(1);
      const last = lastItems?.[0]?.id_item ?? "IMO-0000";
      let counter = parseInt(String(last).split("-")[1] || "0", 10);

      const processedItemIds: string[] = [];

      for (const l of linhas) {
        counter += 1;
        const id_item = `IMO-${String(counter).padStart(4, "0")}`;

        const { data: novoPat, error: patErr } = await sb
          .from("pat_itens")
          .insert({
            nome: l.nome.trim(),
            id_item,
            cod: l.cod ?? null,
            categoria: "IMOBILIZADO",
            subcategoria: l.subcategoria || null,
            especificacao: l.especificacao || null,
            dimensoes: l.dimensoes || null,
            quantidade: Number(l.quantidade) || 1,
            unidade: l.unidade || "UNIDADE",
            valor: Number(l.valor) || 0,
            estado: l.estado || "BOM",
            data_compra: l.data_compra || null,
            localizacao: l.localizacao || null,
            observacoes: l.observacoes || null,
          })
          .select("id")
          .single();
        if (patErr) throw patErr;

        const { error: movErr } = await sb.from("pat_movimentacoes").insert({
          tipo: "entrada",
          item_id: novoPat.id,
          quantidade: Number(l.quantidade) || 1,
          data_movimento: new Date().toISOString(),
          finalidade: "Aquisição",
          observacoes: `Recebimento de imobilizado — Despesa ${demanda.numero != null ? `#${demanda.numero}` : demanda.id.slice(0, 8)}`,
          created_by: user?.id ?? null,
        });
        if (movErr) throw movErr;

        const { error: regErr } = await sb.from("demanda_patrimonio_registros").insert({
          demanda_id: demanda.id,
          pat_item_id: novoPat.id,
          registrado_por: user?.id ?? null,
        });
        if (regErr) throw regErr;

        if (l.demanda_item_id) processedItemIds.push(l.demanda_item_id);
      }

      // 4. Marcar itens como recebidos
      if (processedItemIds.length > 0) {
        await sb
          .from("demanda_itens")
          .update({ recebido: true, recebido_em: new Date().toISOString() })
          .in("id", processedItemIds);
      }

      // 5. Finalizar despesa
      const { error: updErr } = await sb
        .from("demandas")
        .update({ status: "finalizado" })
        .eq("id", demanda.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Recebimento validado e imobilizado registrado no patrimônio!");
      qc.invalidateQueries({ queryKey: ["patrimonio-a-receber"] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["pat_itens"] });
      qc.invalidateQueries({ queryKey: ["pat_movs", "entrada"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao validar recebimento"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Validar recebimento
            {demanda.numero != null && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted">
                DESPESA-{demanda.numero}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* BLOCO A — Resumo */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
          {demanda.fornecedor && (
            <p><span className="text-muted-foreground">Fornecedor:</span> {demanda.fornecedor}</p>
          )}
          {demanda.documento && (
            <p><span className="text-muted-foreground">CNPJ/CPF:</span> {demanda.documento}</p>
          )}
          {demanda.solicitante && (
            <p><span className="text-muted-foreground">Solicitante:</span> {demanda.solicitante}</p>
          )}
          {demanda.comprador && (
            <p><span className="text-muted-foreground">Comprador:</span> {demanda.comprador}</p>
          )}
          {demanda.data_compra && (
            <p>
              <span className="text-muted-foreground">Data da compra:</span>{" "}
              {new Date(demanda.data_compra + "T00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
          {demanda.valor_total != null && (
            <p>
              <span className="text-muted-foreground">Valor total:</span>{" "}
              {Number(demanda.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          )}
          {nfs.length > 0 && (
            <p className="sm:col-span-2 flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground">NFs:</span>
              {nfs.map((n, i) => (
                <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">
                  {n}
                </span>
              ))}
            </p>
          )}
        </div>

        {/* BLOCO B — Anexos */}
        {demanda.anexos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Anexos da despesa</Label>
            <div className="space-y-1.5">
              {demanda.anexos.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left hover:underline"
                    onClick={() => setPreview(a)}
                  >
                    <div className="truncate font-medium">{a.nome}</div>
                    {a.tamanho != null && (
                      <div className="text-[11px] text-muted-foreground">{fmtSize(a.tamanho)}</div>
                    )}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => baixarAnexo("demanda-anexos", a.path, a.nome)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BLOCO C — Itens a patrimoniar */}
        <div className="space-y-3">
          <Label className="text-xs">Itens a patrimoniar</Label>
          {linhas.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Nenhum item para patrimoniar.
            </p>
          )}
          {linhas.map((l, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-3 bg-card">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">
                  Item {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLinha(idx)}
                  disabled={linhas.length === 1}
                  title={linhas.length === 1 ? "Ao menos um item" : "Remover"}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Nome do item *</Label>
                  <Input value={l.nome} onChange={(e) => setLinha(idx, { nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Especificação</Label>
                  <Input value={l.especificacao} onChange={(e) => setLinha(idx, { especificacao: e.target.value })} placeholder="Modelo, marca, cor…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Dimensões</Label>
                  <Input value={l.dimensoes} onChange={(e) => setLinha(idx, { dimensoes: e.target.value })} placeholder="Ex: 90x60cm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade</Label>
                  <NumberInput value={l.quantidade} onChange={(nv) => setLinha(idx, { quantidade: nv })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <Select value={l.unidade} onValueChange={(v) => setLinha(idx, { unidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES_PAT.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor unitário (R$)</Label>
                  <NumberInput value={l.valor} onChange={(nv) => setLinha(idx, { valor: nv })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select value={l.estado} onValueChange={(v) => setLinha(idx, { estado: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_PAT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data de compra</Label>
                  <Input
                    type="date"
                    value={l.data_compra ?? ""}
                    onChange={(e) => setLinha(idx, { data_compra: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Subcategoria</Label>
                  <Input value={l.subcategoria} onChange={(e) => setLinha(idx, { subcategoria: e.target.value })} placeholder="Ex: CLIMATIZAÇÃO" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Localização</Label>
                  <Input value={l.localizacao} onChange={(e) => setLinha(idx, { localizacao: e.target.value })} placeholder="Ex: Galpão Principal — Sala de Reuniões" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={l.observacoes} onChange={(e) => setLinha(idx, { observacoes: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => finalizar.mutate()} disabled={finalizar.isPending}>
            {finalizar.isPending ? "Processando…" : "Finalizar recebimento"}
          </Button>
        </DialogFooter>

        <AnexoViewer
          bucket="demanda-anexos"
          anexo={preview}
          open={!!preview}
          onOpenChange={(o) => !o && setPreview(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
