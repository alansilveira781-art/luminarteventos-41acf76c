import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown, X } from "lucide-react";

export type ItemOption = { id: string; nome: string; codigo: string | null };

export function itemLabel(i: ItemOption) {
  return `${i.codigo ? `${i.codigo} — ` : ""}${i.nome}`;
}

type Props = {
  itens: ItemOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  allLabel?: string;
};

export function ItensMultiSelect({ itens, value, onChange, allLabel = "Todos os itens" }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return itens;
    return itens.filter((i) => `${i.nome} ${i.codigo ?? ""}`.toLowerCase().includes(b));
  }, [itens, busca]);

  const selecionados = useMemo(() => itens.filter((i) => value.includes(i.id)), [itens, value]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const label =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (selecionados[0] ? itemLabel(selecionados[0]) : "1 item selecionado")
        : `${value.length} itens selecionados`;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar por nome ou código…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 border-b"
          >
            {value.length === 0 ? <Check className="h-4 w-4" /> : <span className="w-4" />}
            {allLabel}
          </button>
          <ScrollArea className="h-64">
            {filtrados.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum item encontrado.</p>
            ) : (
              filtrados.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggle(i.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50"
                >
                  <Checkbox checked={value.includes(i.id)} className="pointer-events-none" />
                  <span className="truncate">{itemLabel(i)}</span>
                </button>
              ))
            )}
          </ScrollArea>
          {value.length > 0 && (
            <div className="p-2 border-t">
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
                Limpar seleção
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selecionados.slice(0, 6).map((i) => (
            <Badge key={i.id} variant="secondary" className="gap-1">
              <span className="truncate max-w-[160px]">{itemLabel(i)}</span>
              <button type="button" onClick={() => toggle(i.id)} aria-label={`Remover ${i.nome}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selecionados.length > 6 && <Badge variant="outline">+{selecionados.length - 6}</Badge>}
        </div>
      )}
    </>
  );
}
