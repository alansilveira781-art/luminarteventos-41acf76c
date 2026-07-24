import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TipoContratacao = "diarista" | "clt" | "pj";

export function EdicaoLoteDialog({
  open,
  onOpenChange,
  ids,
  departamentos,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ids: string[];
  departamentos: string[];
  onSaved: () => void;
}) {
  const [chgVinculo, setChgVinculo] = useState(false);
  const [chgDep, setChgDep] = useState(false);
  const [chgFuncao, setChgFuncao] = useState(false);
  const [vinculo, setVinculo] = useState<TipoContratacao>("clt");
  const [dep, setDep] = useState<string>("");
  const [depMode, setDepMode] = useState<"select" | "novo">("select");
  const [funcao, setFuncao] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setChgVinculo(false);
      setChgDep(false);
      setChgFuncao(false);
      setVinculo("clt");
      setDep(departamentos[0] ?? "");
      setDepMode("select");
      setFuncao("");
    }
  }, [open, departamentos]);

  async function save() {
    const payload: {
      tipo_contratacao?: TipoContratacao;
      departamento?: string | null;
      funcao?: string | null;
    } = {};
    if (chgVinculo) payload.tipo_contratacao = vinculo;
    if (chgDep) payload.departamento = dep.trim() || null;
    if (chgFuncao) payload.funcao = funcao.trim() || null;
    if (Object.keys(payload).length === 0) {
      toast.error("Ative pelo menos um campo para alterar.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("rh_colaboradores").update(payload).in("id", ids);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} colaborador(es) atualizado(s).`);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {ids.length} colaborador(es) em lote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Ative o switch dos campos que deseja sobrescrever. Campos desativados não serão alterados.
          </p>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Alterar vínculo</Label>
              <Switch checked={chgVinculo} onCheckedChange={setChgVinculo} />
            </div>
            {chgVinculo && (
              <Select value={vinculo} onValueChange={(v) => setVinculo(v as TipoContratacao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diarista">Diarista</SelectItem>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="pj">PJ</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Alterar departamento</Label>
              <Switch checked={chgDep} onCheckedChange={setChgDep} />
            </div>
            {chgDep && (
              <div className="space-y-2">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDepMode("select")}
                    className={`px-2 py-1 rounded ${depMode === "select" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDepMode("novo"); setDep(""); }}
                    className={`px-2 py-1 rounded ${depMode === "novo" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    Novo
                  </button>
                </div>
                {depMode === "select" ? (
                  <Select value={dep} onValueChange={setDep}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {departamentos.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={dep} onChange={(e) => setDep(e.target.value)} placeholder="Novo departamento" />
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Alterar função</Label>
              <Switch checked={chgFuncao} onCheckedChange={setChgFuncao} />
            </div>
            {chgFuncao && (
              <Input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Ex: Assistente" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Aplicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
