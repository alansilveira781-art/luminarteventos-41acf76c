import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Send } from "lucide-react";
import { toast } from "sonner";
import { useComercial, updatePropostaStatus, updateCard } from "@/lib/comercial/store";
import { PROPOSTA_STATUS_LABEL, type Proposta, type PropostaStatus } from "@/lib/comercial/types";
import { gerarPropostaPDF } from "@/lib/comercial/pdf";

export const Route = createFileRoute("/comercial/propostas")({
  component: Propostas,
});

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};
function total(p: Proposta) {
  return p.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0) +
    (p.custos.frete || 0) + (p.custos.montagem || 0) + (p.custos.desmontagem || 0) +
    (p.custos.outros || []).reduce((s, c) => s + c.valor, 0);
}

const STATUS_OPTS: PropostaStatus[] = ["enviado", "em_negociacao", "fechado", "perdido"];

function Propostas() {
  const { propostas, cards } = useComercial();
  const aprovadas = useMemo(
    () => propostas.filter((p) => STATUS_OPTS.includes(p.status)),
    [propostas],
  );

  function changeStatus(p: Proposta, status: PropostaStatus) {
    updatePropostaStatus(p.id, status);
    if (p.cardId) {
      const card = cards.find((c) => c.id === p.cardId);
      if (card) {
        if (status === "fechado") updateCard(card.id, { status: "fechamento" });
        else if (status === "perdido") updateCard(card.id, { status: "perda", motivoPerda: card.motivoPerda || "Marcada via proposta" });
        else if (status === "em_negociacao") updateCard(card.id, { status: "negociacao" });
        else if (status === "enviado") updateCard(card.id, { status: "orcamento_enviado" });
      }
    }
    toast.success("Status atualizado");
  }

  return (
    <>
      <PageHeader title="Propostas" description="Propostas aprovadas e prontas para envio" />

      {aprovadas.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma proposta aprovada ainda.
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Evento</th>
              <th className="text-left p-3 w-32">Data</th>
              <th className="text-right p-3 w-32">Total</th>
              <th className="text-left p-3 w-44">Status</th>
              <th className="text-right p-3 w-44">Ações</th>
            </tr>
          </thead>
          <tbody>
            {aprovadas.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3 font-mono text-xs text-muted-foreground">#{p.numero}</td>
                <td className="p-3">{p.cliente.nome}</td>
                <td className="p-3">{p.evento.tipo || "—"}</td>
                <td className="p-3">{fmt(p.evento.data)}</td>
                <td className="p-3 text-right font-medium">{brl(total(p))}</td>
                <td className="p-3">
                  <Select value={p.status} onValueChange={(v) => changeStatus(p, v as PropostaStatus)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTS.map((s) => (
                        <SelectItem key={s} value={s}>{PROPOSTA_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => gerarPropostaPDF(p)}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    <Button size="sm" onClick={() => toast.success("Proposta enviada com sucesso!")}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
