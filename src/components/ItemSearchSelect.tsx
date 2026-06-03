import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  autoOpen = false,
  onAfterSelect,
}: {
  itens: ItemOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  showStock?: boolean;
  autoOpen?: boolean;
  onAfterSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = itens.find((i) => i.id === value);
  const filteredItens = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return itens;

    return itens.filter((it) => {
      const haystack = normalize(
        [it.codigo, it.codigo_proprio ?? "", it.nome, it.unidade ?? ""].join(" "),
      );
      return terms.every((term) => haystack.includes(term));
    });
  }, [itens, search]);

  useEffect(() => {
    if (autoOpen && !value) setOpen(true);
  }, [autoOpen, value]);

  const selectItem = (id: string) => {
    onChange(id);
    setSearch("");
    setOpen(false);
    if (onAfterSelect) setTimeout(() => onAfterSelect(id), 0);
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal h-auto min-h-10 py-2"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-left whitespace-normal break-words">
          {selected ? (
            <>
              <span className="font-mono text-xs text-muted-foreground mr-2">
                {selected.codigo}
              </span>
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
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Buscar por código, código próprio ou nome…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredItens.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum item encontrado.
              </div>
            ) : (
              filteredItens.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    selectItem(it.id);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === it.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm whitespace-normal break-words">
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {it.codigo}
                      </span>
                      {it.nome}
                    </span>
                    {(it.codigo_proprio || (showStock && it.quantidade_atual != null)) && (
                      <span className="text-[11px] text-muted-foreground">
                        {it.codigo_proprio && (
                          <>
                            cód. próprio: <span className="font-mono">{it.codigo_proprio}</span>
                          </>
                        )}
                        {it.codigo_proprio && showStock && it.quantidade_atual != null && " · "}
                        {showStock && it.quantidade_atual != null && (
                          <>
                            disponível: {it.quantidade_atual} {it.unidade}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
