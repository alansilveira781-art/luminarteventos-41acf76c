import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

export const Route = createFileRoute("/estoque/a-receber")({
  component: AReceberPage,
});

type CompraRow = {
  id: string;
  titulo: string | null;
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
};

function AReceberPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: compras = [] } = useQuery({
    queryKey: ["compras-receber"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select("id,titulo,fornecedor,comprador,data_compra,valor_total,tipo_compra")
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
            <div className="font-medium">{c.titulo || c.fornecedor || "Compra"}</div>
            <div className="text-xs text-muted-foreground space-y-0.5">
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

function ReceberDialog({ compraId, onClose }: { compraId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: itens = [], refetch } = useQuery({
    queryKey: ["compra-itens", compraId],
    queryFn: async () => {
      const { data, error } = await sb.from("compra_itens").select("*").eq("compra_id", compraId);
      if (error) throw error;
      return data as CompraItemRow[];
    },
  });

  const [recebimentos, setRecebimentos] = useState<Record<string, number>>({});
  const [itemMap, setItemMap] = useState<Record<string, string>>({});

  const finalizar = useMutation({
    mutationFn: async () => {
      for (const it of itens) {
        const qtd = recebimentos[it.id] ?? Number(it.quantidade);
        if (!qtd || qtd <= 0) continue;
        const itemId = it.item_id || itemMap[it.id] || null;
        if (itemId) {
          const { error } = await sb.from("movimentacoes").insert({
            tipo: "entrada",
            entrada_tipo: "compra",
            item_id: itemId,
            quantidade: qtd,
            valor_unitario: it.valor_unitario,
            observacoes: `Recebimento da compra ${compraId}`,
          });
          if (error) throw error;
        }
        await sb.from("compra_itens").update({
          recebido: true,
          quantidade_recebida: qtd,
          recebido_em: new Date().toISOString(),
          item_id: itemId,
        }).eq("id", it.id);
      }
      const { error } = await sb.from("compras").update({ status: "finalizado" }).eq("id", compraId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado e compra finalizada");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validar recebimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {itens.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item cadastrado nesta compra.</p>
          )}
          {itens.map((it) => (
            <div key={it.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{it.descricao}</div>
                  <div className="text-xs text-muted-foreground">
                    Qtd pedida: {Number(it.quantidade)} {it.unidade ?? ""}
                    {!it.item_id && (
                      <span className="ml-2 inline-flex items-center text-warning">
                        • Item não cadastrado no estoque
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-32">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recebido</label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={Number(it.quantidade)}
                    onChange={(e) => setRecebimentos((r) => ({ ...r, [it.id]: Number(e.target.value) }))}
                  />
                </div>
              </div>
              {!it.item_id && (
                <CadastrarItemInline
                  descricao={it.descricao}
                  unidade={it.unidade ?? "un"}
                  onCreated={(id) => {
                    setItemMap((m) => ({ ...m, [it.id]: id }));
                    toast.success("Item cadastrado no estoque");
                    refetch();
                  }}
                />
              )}
            </div>
          ))}
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

function CadastrarItemInline({
  descricao, unidade, onCreated,
}: { descricao: string; unidade: string; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [codigoProprio, setCodigoProprio] = useState("");
  const [nome, setNome] = useState(descricao);
  const [un, setUn] = useState(unidade);

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
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar no estoque
      </Button>
    );
  }
  return (
    <div className="mt-2 grid gap-2 grid-cols-2 rounded border border-dashed border-border p-2">
      <Input placeholder="Código*" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
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
