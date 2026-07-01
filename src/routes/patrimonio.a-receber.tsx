import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { NumberInput } from "@/components/comercial/NumberInput";

const sb = supabase as any;

export const Route = createFileRoute("/patrimonio/a-receber")({
  component: PatrimonioAReceberPage,
});

const ESTADOS_PAT = ["OTIMO", "BOM", "EM MANUTENCAO", "DANIFICADO"];
const UNIDADES_PAT = ["UNIDADE", "M²", "METRAGEM", "PAR", "PEÇA"];

type DemandaRow = {
  id: string;
  numero: number | null;
  titulo: string | null;
  fornecedor: string | null;
  valor_total: number | null;
  data_compra: string | null;
  observacoes: string | null;
  created_at: string | null;
};

function PatrimonioAReceberPage() {
  const [openDemanda, setOpenDemanda] = useState<DemandaRow | null>(null);
  const qc = useQueryClient();

  const { data: pendentes = [] } = useQuery({
    queryKey: ["patrimonio-a-receber"],
    queryFn: async () => {
      const { data: demandas, error } = await sb
        .from("demandas")
        .select("id,numero,titulo,fornecedor,valor_total,data_compra,observacoes,created_at")
        .eq("tipo_demanda", "imobilizado")
        .eq("status", "finalizado")
        .order("data_compra", { ascending: true });
      if (error) throw error;
      if (!demandas?.length) return [] as DemandaRow[];

      const ids = demandas.map((d: any) => d.id);
      const { data: registros } = await sb
        .from("demanda_patrimonio_registros")
        .select("demanda_id")
        .in("demanda_id", ids);
      const jaRegistrados = new Set((registros ?? []).map((r: any) => r.demanda_id));

      return (demandas as DemandaRow[]).filter((d) => !jaRegistrados.has(d.id));
    },
  });

  return (
    <>
      <PageHeader
        title="A receber"
        description="Imobilizados finalizados no financeiro aguardando validação de recebimento"
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

function ValidarRecebimentoDialog({ demanda, onClose }: { demanda: DemandaRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [f, setF] = useState(() => ({
    nome: demanda.titulo || demanda.fornecedor || "",
    valor: Number(demanda.valor_total || 0),
    data_compra: demanda.data_compra ?? "",
    subcategoria: "",
    especificacao: "",
    dimensoes: "",
    quantidade: 1,
    unidade: "UNIDADE",
    estado: "BOM",
    localizacao: "",
    observacoes: `Originado da Despesa ${demanda.numero != null ? `#${demanda.numero}` : demanda.id.slice(0, 8)}${demanda.observacoes ? `\n${demanda.observacoes}` : ""}`,
  }));
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!f.nome?.trim()) throw new Error("Informe o nome do item");

      const { data: jaReg } = await sb
        .from("demanda_patrimonio_registros")
        .select("id")
        .eq("demanda_id", demanda.id)
        .maybeSingle();
      if (jaReg) throw new Error("Este imobilizado já foi registrado no patrimônio. Atualize a tela.");

      const { data: lastItems } = await sb
        .from("pat_itens")
        .select("id_item")
        .ilike("id_item", "IMO-%")
        .order("id_item", { ascending: false })
        .limit(1);
      const last = lastItems?.[0]?.id_item ?? "IMO-0000";
      const n = parseInt(String(last).split("-")[1] || "0", 10) + 1;
      const id_item = `IMO-${String(n).padStart(4, "0")}`;

      const { data: novoPat, error: patErr } = await sb
        .from("pat_itens")
        .insert({
          nome: f.nome.trim(),
          id_item,
          categoria: "IMOBILIZADO",
          subcategoria: f.subcategoria || null,
          especificacao: f.especificacao || null,
          dimensoes: f.dimensoes || null,
          quantidade: Number(f.quantidade) || 1,
          unidade: f.unidade || "UNIDADE",
          valor: Number(f.valor) || 0,
          estado: f.estado || "BOM",
          data_compra: f.data_compra || null,
          localizacao: f.localizacao || null,
          observacoes: f.observacoes || null,
        })
        .select("id")
        .single();
      if (patErr) throw patErr;

      await sb.from("pat_movimentacoes").insert({
        tipo: "entrada",
        item_id: novoPat.id,
        quantidade: Number(f.quantidade) || 1,
        data_movimento: new Date().toISOString(),
        finalidade: "Aquisição",
        observacoes: `Recebimento de imobilizado — Despesa ${demanda.numero != null ? `#${demanda.numero}` : ""}`,
        created_by: user?.id ?? null,
      });

      const { error: regErr } = await sb
        .from("demanda_patrimonio_registros")
        .insert({
          demanda_id: demanda.id,
          pat_item_id: novoPat.id,
          registrado_por: user?.id ?? null,
        });
      if (regErr) throw regErr;
    },
    onSuccess: () => {
      toast.success("Recebimento validado e imobilizado registrado no patrimônio!");
      qc.invalidateQueries({ queryKey: ["patrimonio-a-receber"] });
      qc.invalidateQueries({ queryKey: ["pat_itens"] });
      qc.invalidateQueries({ queryKey: ["pat_movs", "entrada"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao validar recebimento"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
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

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
          {demanda.fornecedor && <p><span className="text-muted-foreground">Fornecedor:</span> {demanda.fornecedor}</p>}
          {demanda.valor_total != null && (
            <p><span className="text-muted-foreground">Valor:</span> {Number(demanda.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Nome do item *</Label>
            <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Ar-condicionado Split 12.000 BTU" />
          </div>
          <div className="space-y-1.5">
            <Label>Especificação</Label>
            <Input value={f.especificacao} onChange={(e) => set("especificacao", e.target.value)} placeholder="Modelo, marca, cor…" />
          </div>
          <div className="space-y-1.5">
            <Label>Dimensões</Label>
            <Input value={f.dimensoes} onChange={(e) => set("dimensoes", e.target.value)} placeholder="Ex: 90x60cm" />
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade</Label>
            <NumberInput value={f.quantidade} onChange={(nv) => set("quantidade", nv)} />
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={f.unidade} onValueChange={(v) => set("unidade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADES_PAT.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <NumberInput value={f.valor} onChange={(nv) => set("valor", nv)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={f.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS_PAT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data de compra</Label>
            <Input type="date" value={f.data_compra ?? ""} onChange={(e) => set("data_compra", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Subcategoria</Label>
            <Input value={f.subcategoria} onChange={(e) => set("subcategoria", e.target.value)} placeholder="Ex: CLIMATIZAÇÃO" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Localização</Label>
            <Input value={f.localizacao} onChange={(e) => set("localizacao", e.target.value)} placeholder="Ex: Galpão Principal — Sala de Reuniões" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => finalizar.mutate()} disabled={finalizar.isPending}>
            {finalizar.isPending ? "Processando…" : "Finalizar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
