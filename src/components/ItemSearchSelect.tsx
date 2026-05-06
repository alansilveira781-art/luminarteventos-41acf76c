import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ItemOption = {
  id: string;
  nome: string;
  codigo: string;
  codigo_proprio?: string | null;
  unidade?: string;
  quantidade_atual?: number | string;
};

export function ItemSearchSelect({
  itens,
  value,
  onChange,
  placeholder = "Selecione um item…",
  showStock = false,
}: {
  itens: ItemOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  showStock?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = itens.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                <span className="font-mono text-xs text-muted-foreground mr-2">{selected.codigo}</span>
                {selected.nome}
                {showStock && selected.quantidade_atual != null && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({selected.quantidade_atual} {selected.unidade})
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command
          filter={(val, search) => {
            const s = search.toLowerCase().trim();
            if (!s) return 1;
            return val.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Buscar por código, código próprio ou nome…"
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none border-0"
            />
          </div>
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {itens.map((it) => {
                const haystack = [it.codigo, it.codigo_proprio ?? "", it.nome].join(" | ");
                return (
                  <CommandItem
                    key={it.id}
                    value={`${haystack}__${it.id}`}
                    onSelect={() => {
                      onChange(it.id);
                      setOpen(false);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(it.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === it.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{it.codigo}</span>
                        {it.nome}
                      </span>
                      {(it.codigo_proprio || (showStock && it.quantidade_atual != null)) && (
                        <span className="text-[11px] text-muted-foreground">
                          {it.codigo_proprio && <>cód. próprio: <span className="font-mono">{it.codigo_proprio}</span></>}
                          {it.codigo_proprio && showStock && it.quantidade_atual != null && " · "}
                          {showStock && it.quantidade_atual != null && (
                            <>disponível: {it.quantidade_atual} {it.unidade}</>
                          )}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
