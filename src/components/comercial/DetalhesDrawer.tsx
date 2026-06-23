import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, GitBranch, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CARD_STATUSES, type ComercialCard, PROPOSTA_STATUS_LABEL, propostaTotal, type Proposta } from "@/lib/comercial/types";
import { useComercial, criarNovaVersaoProposta, getPropostasDoCard, getRootPropostaId, deleteProposta } from "@/lib/comercial/store";
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
  open, onOpenChange, card, onEditProposta, onEditarLimitado,
}: { open: boolean; onOpenChange: (v: boolean) => void; card: ComercialCard | null; onEditProposta?: (p: Proposta) => void; onEditarLimitado?: (p: Proposta) => void }) {
  // Subscribe to store so versions/cards atualizam em tempo real
  useComercial();
  if (!card) return null;
  const status = CARD_STATUSES.find((s) => s.key === card.status);
  const propostasDoCard = getPropostasDoCard(card.id);

  // Agrupa propostas por raiz (numero) -> lista de versões
  const grupos = new Map<string, Proposta[]>();
  propostasDoCard.forEach((p) => {
    const root = getRootPropostaId(p);
    if (!grupos.has(root)) grupos.set(root, []);
    grupos.get(root)!.push(p);
  });
  grupos.forEach((arr) =>
    arr.sort((a, b) => (b.version ?? 1) - (a.version ?? 1)),
  );

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
            {card.dataEnvio && (
              <Field label="Data de envio" value={fmt(card.dataEnvio)} />
            )}
          </Section>

          <Section title="Atendimento">
            <Field label="Consultor(a)" value={card.responsavel || "—"} />
            {card.observacoes && <Field label="Observações" value={card.observacoes} />}
            {card.motivoPerda && (
              <Field label="Motivo da perda" value={card.motivoPerda} />
            )}
          </Section>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Propostas vinculadas
              </div>
              <span className="text-[10px] text-muted-foreground">
                {propostasDoCard.length}
              </span>
            </div>

            {propostasDoCard.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma proposta criada para este card ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {Array.from(grupos.entries()).map(([rootId, versoes]) => {
                  const atual = versoes[0]; // versão mais recente
                  return (
                    <div key={rootId} className="rounded border border-border bg-muted/20 p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="font-semibold text-sm">
                          Proposta #{String(atual.numero).padStart(4, "0")}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {versoes.length} versão{versoes.length === 1 ? "" : "ões"}
                        </Badge>
                      </div>

                      <ul className="space-y-1 text-xs">
                        {versoes.map((v) => (
                          <li
                            key={v.id}
                            className="flex items-center justify-between gap-2 py-1 border-t border-border first:border-t-0"
                          >
                            <span className="flex items-center gap-2">
                              <span className="font-medium">v{v.version ?? 1}</span>
                              <span className="text-muted-foreground">
                                {PROPOSTA_STATUS_LABEL[v.status]}
                              </span>
                              {v.id === card.propostaId && (
                                <Badge variant="secondary" className="text-[9px] py-0">
                                  atual
                                </Badge>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground">
                                {brl(propostaTotal(v))}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                title="Editar"
                                onClick={() => onEditarLimitado?.(v)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                title="Imprimir PDF"
                                onClick={() => gerarPropostaPDF(v)}
                              >
                                <Printer className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                title="Excluir versão"
                                onClick={() => {
                                  if (!confirm(`Excluir a versão v${v.version ?? 1} da proposta #${String(v.numero).padStart(4, "0")}?`)) return;
                                  deleteProposta(v.id);
                                  toast.success("Versão excluída");
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full mt-2"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const nova = await criarNovaVersaoProposta(atual.id);
                          if (nova) {
                            toast.success(`Nova versão criada (v${nova.version})`);
                            onEditProposta?.(nova);
                          } else toast.error("Não foi possível criar nova versão");
                        }}
                      >
                        <GitBranch className="h-3.5 w-3.5 mr-1" /> Criar nova versão
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
