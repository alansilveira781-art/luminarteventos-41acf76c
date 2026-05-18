import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { useComercial, createCard } from "@/lib/comercial/store";
import { CARD_STATUSES, PROPOSTA_STATUS_LABEL, type Cliente } from "@/lib/comercial/types";
import { toast } from "sonner";

export const Route = createFileRoute("/comercial/clientes")({
  component: Clientes,
});

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};

function Clientes() {
  const { clientes, cards, propostas } = useComercial();
  const [selected, setSelected] = useState<Cliente | null>(null);

  const linkedCards = useMemo(
    () => (selected ? cards.filter((c) => c.clienteId === selected.id || c.clienteNome === selected.nome) : []),
    [selected, cards],
  );
  const linkedPropostas = useMemo(
    () => (selected ? propostas.filter((p) => p.clienteId === selected.id) : []),
    [selected, propostas],
  );

  function statusFunil(cliente: Cliente) {
    const cs = cards.filter((c) => c.clienteId === cliente.id || c.clienteNome === cliente.nome);
    if (cs.some((c) => c.status === "fechamento")) return "Cliente fechado";
    if (cs.some((c) => c.status === "negociacao" || c.status === "orcamento_enviado")) return "Em negociação";
    if (cs.length > 0) return "Lead";
    return "Sem atividade";
  }

  function novoLead(cliente: Cliente) {
    createCard({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      eventoNome: "",
      eventoDataInicio: "",
      eventoDataFim: "",
      valorEstimado: 0,
      responsavel: "",
      observacoes: "",
      status: "lead",
    });
    toast.success("Novo lead criado para " + cliente.nome);
  }

  function timeline(cliente: Cliente) {
    const events: { when: string; what: string }[] = [];
    events.push({ when: cliente.createdAt, what: "Cliente cadastrado" });
    cards.filter((c) => c.clienteId === cliente.id || c.clienteNome === cliente.nome).forEach((c) => {
      events.push({ when: c.createdAt, what: `Lead criado: ${c.eventoNome || "Evento"}` });
      if (c.status === "fechamento") events.push({ when: c.createdAt, what: "Negócio fechado" });
      if (c.status === "perda") events.push({ when: c.createdAt, what: `Perda: ${c.motivoPerda || ""}` });
    });
    propostas.filter((p) => p.clienteId === cliente.id).forEach((p) => {
      events.push({ when: p.createdAt, what: `Proposta #${p.numero} criada` });
      if (p.approvedAt) events.push({ when: p.approvedAt, what: `Proposta #${p.numero} aprovada` });
    });
    return events.sort((a, b) => b.when.localeCompare(a.when));
  }

  return (
    <>
      <PageHeader title="Clientes" description="CRM simplificado" />

      {clientes.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente cadastrado. Crie um lead no Quadro de Vendas para começar.
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3 w-40">Status</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3 font-medium">{c.nome}</td>
                <td className="p-3">{c.telefone || "—"}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3"><Badge variant="secondary">{statusFunil(c)}</Badge></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setSelected(c)}>Ver detalhes</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.nome}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Contato</div>
                  <div>{selected.telefone || "—"}</div>
                  <div>{selected.email || "—"}</div>
                  <Button size="sm" className="mt-2" onClick={() => novoLead(selected)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo lead
                  </Button>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Timeline</div>
                  <div className="space-y-2">
                    {timeline(selected).map((e, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-24 shrink-0">{fmt(e.when.slice(0, 10))}</span>
                        <span>{e.what}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Eventos / Cards ({linkedCards.length})
                  </div>
                  {linkedCards.length === 0 && <div className="text-xs text-muted-foreground">Nenhum</div>}
                  <div className="space-y-1.5">
                    {linkedCards.map((c) => {
                      const st = CARD_STATUSES.find((s) => s.key === c.status);
                      return (
                        <div key={c.id} className="flex justify-between text-xs">
                          <span>{c.eventoNome || "Evento"} {c.eventoDataInicio && `• ${fmt(c.eventoDataInicio)}`}</span>
                          {st && <Badge variant="secondary" className="gap-1"><span className={`h-1.5 w-1.5 rounded-full ${st.color}`} />{st.label}</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Propostas ({linkedPropostas.length})
                  </div>
                  {linkedPropostas.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma</div>}
                  <div className="space-y-1.5">
                    {linkedPropostas.map((p) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span>#{p.numero} • {fmt(p.evento.dataInicio)}</span>
                        <Badge variant="secondary">{PROPOSTA_STATUS_LABEL[p.status]}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
