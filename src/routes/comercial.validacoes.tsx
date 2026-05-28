import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useComercial, aprovarProposta, reprovarProposta } from "@/lib/comercial/store";
import { PROPOSTA_STATUS_LABEL, type Proposta, propostaTotal, ambienteSubtotal, descricaoSubtotal, descricaoMedidaLabel } from "@/lib/comercial/types";
import { PropostaWizard } from "@/components/comercial/PropostaWizard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/comercial/validacoes")({
  component: Validacoes,
});

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};

function totalProposta(p: Proposta) {
  return propostaTotal(p);
}

function Validacoes() {
  const { isAdmin, modulos } = useAuth();
  const isComercialAdmin = isAdmin || modulos.some((m) => m.slug === "comercial" && m.is_admin);
  if (!isComercialAdmin) return <Navigate to="/comercial" />;

  const { propostas } = useComercial();
  const [editProposta, setEditProposta] = useState<Proposta | null>(null);

  const pendentes = useMemo(
    () => propostas.filter((p) => p.status === "aguardando_aprovacao" || p.status === "em_revisao"),
    [propostas],
  );

  return (
    <>
      <PageHeader
        title="Validações"
        description="Aprovação interna de propostas antes do envio ao cliente"
      />

      {pendentes.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma proposta aguardando validação.
        </div>
      )}

      <div className="space-y-3">
        {pendentes.map((p) => (
          <Collapsible key={p.id} className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  #{p.numero} — {p.cliente.nome}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.evento.tipo || "Evento"} • {fmt(p.evento.dataInicio)}{p.evento.dataFim && p.evento.dataFim !== p.evento.dataInicio ? ` – ${fmt(p.evento.dataFim)}` : ""} • {p.evento.local || "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{brl(totalProposta(p))}</div>
                <Badge variant={p.status === "em_revisao" ? "destructive" : "secondary"} className="mt-1">
                  {PROPOSTA_STATUS_LABEL[p.status]}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border p-3 space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Cliente</div>
                  <div>{p.cliente.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.cliente.telefone} • {p.cliente.email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Responsável</div>
                  <div>{p.responsavel || "—"}</div>
                </div>
              </div>

              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2">Ambiente / Item / Descrição</th>
                      <th className="text-right p-2 w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(p.ambientes || []).map((amb) => (
                      <>
                        <tr key={amb.id} className="border-t border-border bg-muted/20">
                          <td className="p-2 font-semibold">{amb.nome || "Ambiente"}</td>
                          <td className="p-2 text-right font-semibold">{brl(ambienteSubtotal(amb))}</td>
                        </tr>
                        {amb.itens.map((it) => (
                          <>
                            <tr key={it.id} className="border-t border-border">
                              <td className="p-2 pl-6 font-medium">{it.nome || "Item"}</td>
                              <td className="p-2"></td>
                            </tr>
                            {it.descricoes.map((d) => (
                              <tr key={d.id} className="border-t border-border">
                                <td className="p-2 pl-10 text-muted-foreground">
                                  {d.descricao || "—"} <span className="text-[10px]">({descricaoMedidaLabel(d)} × {brl(d.valorUnitario)})</span>
                                </td>
                                <td className="p-2 text-right">{brl(descricaoSubtotal(d))}</td>
                              </tr>
                            ))}
                          </>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold">Total: {brl(totalProposta(p))}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditProposta(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { reprovarProposta(p.id); toast.success("Proposta enviada para revisão"); }}>
                    <X className="h-3.5 w-3.5 mr-1" /> Reprovar
                  </Button>
                  <Button size="sm" onClick={() => { aprovarProposta(p.id); toast.success("Proposta aprovada"); }}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      <PropostaWizard
        open={!!editProposta}
        onOpenChange={(v) => { if (!v) setEditProposta(null); }}
        proposta={editProposta}
      />
    </>
  );
}
