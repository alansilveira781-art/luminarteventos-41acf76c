import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (dataEnvio: string) => void;
  defaultDate?: string;
};

export function EnvioDialog({ open, onOpenChange, onConfirm, defaultDate }: Props) {
  const [data, setData] = useState("");
  useEffect(() => {
    if (open) setData(defaultDate || new Date().toISOString().slice(0, 10));
  }, [open, defaultDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mover para Orçamento Enviado</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Data de envio *</Label>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Informe a data em que a proposta foi enviada ao cliente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!data}
            onClick={() => { onConfirm(data); onOpenChange(false); }}
          >
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
