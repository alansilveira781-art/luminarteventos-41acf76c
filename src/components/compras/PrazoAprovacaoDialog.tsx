import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrazoDot } from "@/components/PrazoDot";
import { hojeBRT, prazoLabel } from "@/lib/prazo";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo?: string | null;
  prazoAnterior?: string | null;
  onConfirm: (prazo: string) => void | Promise<void>;
};

export function PrazoAprovacaoDialog({ open, onOpenChange, titulo, prazoAnterior, onConfirm }: Props) {
  const [prazo, setPrazo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPrazo("");
      setSaving(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo prazo da compra aprovada</DialogTitle>
          <DialogDescription>
            {titulo ? `${titulo} — ` : ""}o prazo da fase de aprovação encerra aqui. Informe o prazo
            que vale até o card chegar em Finalizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {prazoAnterior && (
            <p className="text-xs text-muted-foreground">
              Prazo anterior: {prazoLabel(prazoAnterior)}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Prazo até finalizar</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                min={hojeBRT()}
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
              <PrazoDot prazo={prazo || null} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!prazo || saving}
            onClick={async () => {
              if (!prazo) return;
              setSaving(true);
              try {
                await onConfirm(prazo);
              } finally {
                setSaving(false);
              }
            }}
          >
            Aprovar com este prazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
