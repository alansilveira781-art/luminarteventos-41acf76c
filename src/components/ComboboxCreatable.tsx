import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search, Plus } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Combobox de texto livre com busca tolerante a acentos.
 * - value/onChange trabalham com a string final (não id).
 * - Sugere opções existentes; permite "Usar X" para criar valor novo.
 */
export function ComboboxCreatable({
  options,
  value,
  onChange,
  placeholder = "Digite ou selecione…",
  searchPlaceholder = "Buscar ou digitar novo…",
  allowCreate = true,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCreate?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter((o) => {
      const h = normalize(o);
      return terms.every((t) => h.includes(t));
    });
  }, [options, search]);

  const showCreate = allowCreate && search.trim() && !options.some((o) => normalize(o) === normalize(search));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((c) => !c)}
      >
        <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) pick(filtered[0]);
                  else if (showCreate) pick(search.trim());
                }
              }}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filtered.length === 0 && !showCreate ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</div>
            ) : (
              <>
                {filtered.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    onPointerDown={(e) => { e.preventDefault(); pick(o); }}
                  >
                    <span className="truncate">{o}</span>
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground border-t border-border/50 mt-1"
                    onPointerDown={(e) => { e.preventDefault(); pick(search.trim()); }}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">Usar “{search.trim()}”</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
