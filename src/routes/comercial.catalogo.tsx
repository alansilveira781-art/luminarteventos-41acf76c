import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/comercial/NumberInput";
import { MoneyInput } from "@/components/MoneyInput";
import { useCatalogo, useCatalogoMutations } from "@/lib/comercial/useCatalogo";
import {
  TIPO_MEDIDA_LABEL,
  type CatalogoDescricao,
  type TipoMedida,
} from "@/lib/comercial/types";

export const Route = createFileRoute("/comercial/catalogo")({
  component: CatalogoPage,
});

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPOS: TipoMedida[] = ["unidade", "dimensional", "area", "linear"];

function CatalogoPage() {
  const { catalogo } = useComercial();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CatalogoDescricao | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      catalogo.filter((c) =>
        !q.trim() ? true : c.nome.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [catalogo, q],
  );

  return (
    <>
      <PageHeader
        title="Catálogo de descrições"
        description="Cadastre as descrições reutilizáveis usadas nas propostas, com tipo de medida e valor unitário padrão."
        actions={
          <Button onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova descrição
          </Button>
        }
      />

      <div className="mb-3 max-w-sm">
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 w-56">Tipo de medida</th>
              <th className="text-right p-3 w-40">Valor unitário</th>
              <th className="text-right p-3 w-32">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma descrição cadastrada</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3 font-medium">{c.nome}</td>
                <td className="p-3"><Badge variant="secondary">{TIPO_MEDIDA_LABEL[c.tipoMedida]}</Badge></td>
                <td className="p-3 text-right">
                  {brl(c.valorUnitario)}
                  {c.tipoMedida === "area" ? "/m²" : c.tipoMedida === "linear" ? "/m" : ""}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (confirm(`Excluir "${c.nome}"?`)) {
                        deleteCatalogoDescricao(c.id);
                        toast.success("Descrição excluída");
                      }
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CatalogoDialog open={open} onOpenChange={setOpen} edit={edit} />
    </>
  );
}

function CatalogoDialog({
  open, onOpenChange, edit,
}: { open: boolean; onOpenChange: (v: boolean) => void; edit: CatalogoDescricao | null }) {
  const [nome, setNome] = useState("");
  const [tipoMedida, setTipoMedida] = useState<TipoMedida>("unidade");
  const [valor, setValor] = useState(0);
  const [unidade, setUnidade] = useState("un");

  useEffect(() => {
    if (!open) return;
    setNome(edit?.nome ?? "");
    setTipoMedida(edit?.tipoMedida ?? "unidade");
    setValor(edit?.valorUnitario ?? 0);
    setUnidade(edit?.unidade ?? "un");
  }, [open, edit]);

  function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    if (edit) {
      updateCatalogoDescricao(edit.id, { nome: nome.trim(), tipoMedida, valorUnitario: valor, unidade });
      toast.success("Descrição atualizada");
    } else {
      createCatalogoDescricao({ nome: nome.trim(), tipoMedida, valorUnitario: valor, unidade });
      toast.success("Descrição cadastrada");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Editar descrição" : "Nova descrição"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Painel LED 4x2, Mesa redonda…" />
          </div>
          <div>
            <Label>Tipo de medida *</Label>
            <Select value={tipoMedida} onValueChange={(v) => setTipoMedida(v as TipoMedida)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_MEDIDA_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipoMedida === "unidade" && (
            <div>
              <Label>Unidade (rótulo)</Label>
              <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, pç, kg…" />
            </div>
          )}
          <div>
            <Label>
              Valor unitário (R${tipoMedida === "area" ? "/m²" : tipoMedida === "linear" ? "/m" : ""}) *
            </Label>
            <MoneyInput value={valor} onChange={setValor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
