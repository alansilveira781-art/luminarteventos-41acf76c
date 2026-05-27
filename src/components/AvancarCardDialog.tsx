import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const sb = supabase as any;

type Profile = { id: string; display_name: string | null; email: string | null };

export function AvancarCardDialog({
  open, onOpenChange, statusLabel, defaultResponsavelId, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  statusLabel: string;
  defaultResponsavelId?: string | null;
  onConfirm: (data: { responsavelId: string; responsavelNome: string; observacao: string }) => void;
}) {
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [observacao, setObservacao] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("id, display_name, email").order("display_name");
      return (data ?? []) as Profile[];
    },
  });

  useEffect(() => {
    if (open) {
      setResponsavelId(defaultResponsavelId || "");
      setObservacao("");
    }
  }, [open, defaultResponsavelId]);

  const handleConfirm = () => {
    const p = profiles.find((x) => x.id === responsavelId);
    if (!p) return;
    const nome = p.display_name || p.email || "Usuário";
    onConfirm({ responsavelId, responsavelNome: nome, observacao });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avançar para "{statusLabel}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || p.email || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Essa pessoa receberá uma notificação sobre este card.
            </p>
          </div>
          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Algo que o responsável precisa saber..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!responsavelId}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
