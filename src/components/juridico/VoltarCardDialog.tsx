import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VoltarCardDialog({
  open,
  onOpenChange,
  deLabel,
  paraLabel,
  cancelaAssinatura,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deLabel: string;
  paraLabel: string;
  /** true quando o card sai de Assinatura com documento já enviado ao Clicksign */
  cancelaAssinatura: boolean;
  onConfirm: (motivo: string) => Promise<void> | void;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo("");
      setSalvando(false);
    }
  }, [open]);

  const confirmar = async () => {
    setSalvando(true);
    try {
      await onConfirm(motivo);
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voltar card para "{paraLabel}"?</DialogTitle>
          <DialogDescription>
            O card sairá de <b>{deLabel}</b> e voltará para <b>{paraLabel}</b>. A alteração ficará
            registrada no histórico do contrato.
          </DialogDescription>
        </DialogHeader>

        {cancelaAssinatura && (
          <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div>
              <b>Tem certeza?</b> Esta alteração <b>excluirá o contrato enviado para assinatura</b> no
              Clicksign. Os signatários perderão o acesso ao link e o envio terá que ser refeito do zero.
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Motivo (registrado no histórico)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex.: ajuste de valores solicitado pelo cliente"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant={cancelaAssinatura ? "destructive" : "default"}
            onClick={confirmar}
            disabled={salvando}
          >
            {salvando ? "Processando…" : cancelaAssinatura ? "Sim, excluir e voltar" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
