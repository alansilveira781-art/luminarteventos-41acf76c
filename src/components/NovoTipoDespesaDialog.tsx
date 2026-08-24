import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { slugifyTipo, type DestinoRecebimento } from "@/hooks/useTiposDespesa";

const sb = supabase as any;

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do tipo").max(60, "Máximo de 60 caracteres"),
});

export function NovoTipoDespesaDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Recebe o slug do tipo criado para já selecioná-lo no formulário. */
  onCreated?: (slug: string) => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [exigeItens, setExigeItens] = useState(false);
  const [destino, setDestino] = useState<DestinoRecebimento>("nenhum");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNome("");
    setExigeItens(false);
    setDestino("nenhum");
  }

  async function salvar() {
    const parsed = schema.safeParse({ nome });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const slug = slugifyTipo(parsed.data.nome);
    if (!slug) {
      toast.error("Nome inválido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await sb.from("demanda_tipos").insert({
        slug,
        label: parsed.data.nome,
        exige_itens: exigeItens || destino !== "nenhum",
        destino_recebimento: destino,
        created_by: user?.id ?? null,
      });
      if (error) {
        if (String(error.code) === "23505") {
          toast.error("Já existe um tipo de aquisiÃ§Ã£o com esse nome.");
        } else if (String(error.code) === "42501") {
          toast.error("Você não tem permissão para criar tipos de aquisiÃ§Ã£o.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Tipo de aquisiÃ§Ã£o criado!");
      onCreated?.(slug);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo tipo de aquisiÃ§Ã£o</DialogTitle>
          <DialogDescription>
            O novo tipo fica disponível para todos os usuários no quadro de aquisiÃ§Ãµes e no
            formulário de solicitação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do tipo</Label>
            <Input
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Marketing"
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="exige-itens"
              checked={exigeItens || destino !== "nenhum"}
              disabled={destino !== "nenhum"}
              onCheckedChange={(v) => setExigeItens(!!v)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="exige-itens" className="cursor-pointer">
                Exige lista de itens
              </Label>
              <p className="text-xs text-muted-foreground">
                Mostra a grade de itens (quantidade, cotação, desconto, IPI, frete) no lugar
                do descritivo livre.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gera recebimento?</Label>
            <Select
              value={destino}
              onValueChange={(v) => setDestino(v as DestinoRecebimento)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum (vai direto para Finalizado)</SelectItem>
                <SelectItem value="estoque">Estoque (validação em Estoque › A Receber)</SelectItem>
                <SelectItem value="patrimonio">
                  Patrimônio (validação em Patrimônio › A Receber)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving || !nome.trim()}>
            {saving ? "Salvando…" : "Criar tipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
