import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Eye, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EntityOption = {
  id: string;
  nome: string;
  apelido?: string | null;
  [k: string]: any;
};

export function EntitySearchSelect({
  options,
  value,
  onChange,
  onEdit,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
}: {
  options: EntityOption[];
  value: string;
  onChange: (id: string) => void;
  onEdit?: (option: EntityOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter((o) => {
      const haystack = [o.nome, o.apelido ?? ""].join(" ").toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex gap-1 items-center">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((c) => !c)}
      >
        <span className="truncate text-left">
          {selected ? (
            <>
              {selected.nome}
              {selected.apelido && (
                <span className="text-xs text-muted-foreground ml-2">({selected.apelido})</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {selected && onEdit && (
        <Button type="button" variant="ghost" size="icon" title="Editar" onClick={() => onEdit(selected)}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[300px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</div>
            ) : filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onPointerDown={(e) => { e.preventDefault(); onChange(o.id); setSearch(""); setOpen(false); }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === o.id ? "opacity-100" : "opacity-0")} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{o.nome}</span>
                  {o.apelido && (
                    <span className="text-[11px] text-muted-foreground">apelido: {o.apelido}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
