import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { CARD_STATUSES, type ComercialCard, PROPOSTA_STATUS_LABEL, propostaTotal } from "@/lib/comercial/types";
import { useComercial, criarNovaVersaoProposta, getVersoesProposta, getRootPropostaId } from "@/lib/comercial/store";
import { gerarPropostaPDF } from "@/lib/comercial/pdf";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};
const fmtPeriodo = (ini: string, fim: string) => {
  if (!ini && !fim) return "—";
  if (!fim || ini === fim) return fmt(ini);
  return `${fmt(ini)} – ${fmt(fim)}`;
};

export function DetalhesDrawer({
  open, onOpenChange, card,
}: { open: boolean; onOpenChange: (v: boolean) => void; card: ComercialCard | null }) {
  const { propostas } = useComercial();
  if (!card) return null;
  const status = CARD_STATUSES.find((s) => s.key === card.status);
  const proposta = propostas.find((p) => p.id === card.propostaId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{card.clienteNome}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-2">
            {status && (
              <Badge variant="secondary" className="gap-1.5">
                <span className={`h-2 w-2 rounded-full ${status.color}`} />
                {status.label}
              </Badge>
            )}
          </div>

          <Section title="Evento">
            <Field label="Nome" value={card.eventoNome || "—"} />
            <Field label="Período" value={fmtPeriodo(card.eventoDataInicio, card.eventoDataFim)} />
            <Field label="Valor estimado" value={brl(card.valorEstimado)} />
          </Section>

          <Section title="Atendimento">
            <Field label="Consultor(a)" value={card.responsavel || "—"} />
            {card.observacoes && <Field label="Observações" value={card.observacoes} />}
            {card.motivoPerda && (
              <Field label="Motivo da perda" value={card.motivoPerda} />
            )}
          </Section>

          {proposta && (() => {
            const rootId = getRootPropostaId(proposta);
            const versoes = getVersoesProposta(rootId);
            const podeNovaVersao = ["enviado", "em_negociacao", "em_revisao"].includes(proposta.status);
            return (
              <Section title="Proposta vinculada">
                <Field label="Número" value={`#${proposta.numero} · v${proposta.version ?? 1}`} />
                <Field label="Status" value={PROPOSTA_STATUS_LABEL[proposta.status]} />
                <Field label="Total" value={brl(propostaTotal(proposta))} />

                {versoes.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">Histórico de versões</div>
                    <ul className="space-y-1 text-xs">
                      {versoes.map((v) => (
                        <li key={v.id} className="flex justify-between gap-2">
                          <span className={v.id === proposta.id ? "font-semibold" : ""}>
                            v{v.version ?? 1} {v.id === proposta.id ? "(atual)" : ""}
                          </span>
                          <span className="text-muted-foreground">
                            {PROPOSTA_STATUS_LABEL[v.status]} · {brl(propostaTotal(v))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button className="w-full mt-3" size="sm" onClick={() => gerarPropostaPDF(proposta)}>
                  <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir proposta (PDF)
                </Button>
                {podeNovaVersao && (
                  <Button
                    className="w-full mt-2"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nova = criarNovaVersaoProposta(proposta.id);
                      if (nova) toast.success(`Nova versão criada (v${nova.version})`);
                    }}
                  >
                    <GitBranch className="h-3.5 w-3.5 mr-1" /> Criar nova versão
                  </Button>
                )}
              </Section>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
