import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TIPO_COMPRA_OPTIONS } from "@/lib/compras";
import { useTiposDespesa } from "@/hooks/useTiposDespesa";
import { compraParaDemanda, demandaParaCompra } from "@/lib/compras-conversao";

export type ConverterDestino = "demanda" | "compra";

export function ConverterCardDialog({
  open,
  onOpenChange,
  destino,
  cardId,
  codigoOrigem,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Para onde o card será convertido. */
  destino: ConverterDestino;
  cardId: string;
  codigoOrigem: string;
  onConverted: (novo: { destino: ConverterDestino; id: string; numero: number | null }) => void;
}) {
  const tiposDespesa = useTiposDespesa();
  const [tipo, setTipo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTipo("");
  }, [open, destino]);

  const exigeItens = destino === "demanda" ? tiposDespesa.exigeItens(tipo) : true;

  async function confirmar() {
    if (!tipo) {
      toast.error(destino === "demanda" ? "Escolha o tipo de despesa." : "Escolha o tipo da compra.");
      return;
    }
    setBusy(true);
    try {
      const novo =
        destino === "demanda"
          ? await compraParaDemanda(cardId, tipo, exigeItens)
          : await demandaParaCompra(cardId, tipo);
      toast.success(
        destino === "demanda"
          ? `Convertido em despesa DESPESA-${novo.numero ?? ""}.`
          : `Convertido em compra COMPRA-${novo.numero ?? ""}.`,
      );
      onConverted({ destino, id: novo.id, numero: novo.numero });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível converter o card.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {destino === "demanda" ? "Converter em Despesa" : "Converter em Compra"}
          </DialogTitle>
          <DialogDescription>
            {codigoOrigem} mantém todos os dados preenchidos (itens, anexos, pagamentos e comentários)
            e permanece na mesma coluna. O card recebe um novo código e registra a origem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {destino === "demanda" ? "Tipo de despesa" : "Tipo da compra"}
          </label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {(destino === "demanda"
                ? tiposDespesa.options
                : TIPO_COMPRA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
              ).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destino === "demanda" && tipo && (
            <p className="text-xs text-muted-foreground">
              {exigeItens
                ? "Este tipo usa grade de itens — os itens atuais são mantidos."
                : "Este tipo usa descritivo — os itens atuais viram um resumo em texto no descritivo."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={busy || !tipo}>
            {busy ? "Convertendo…" : "Converter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
