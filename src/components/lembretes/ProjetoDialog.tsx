import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CORES_PROJETO, type LembreteProjeto } from "@/lib/lembretes";

export function ProjetoDialog({
  open,
  onOpenChange,
  projeto,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projeto: LembreteProjeto | null;
  onSubmit: (values: { nome: string; cor: string; ativo: boolean }) => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_PROJETO[0]);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNome(projeto?.nome ?? "");
    setCor(projeto?.cor ?? CORES_PROJETO[0]);
    setAtivo(projeto?.ativo ?? true);
  }, [open, projeto]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{projeto ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nome.trim()) return;
            onSubmit({ nome: nome.trim(), cor, ativo });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="proj-nome">Nome</Label>
            <Input id="proj-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES_PROJETO.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setCor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    cor === c ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                aria-label="Cor personalizada"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="proj-ativo" className="cursor-pointer">
              Projeto ativo
            </Label>
            <Switch id="proj-ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
