import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search, Check } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Select com busca digitável tolerante a acentos, para listas estáticas
 * de opções (value/label). Não permite criação inline.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter((o) => {
      const h = normalize(o.label);
      return terms.every((t) => h.includes(t));
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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setSearch("");
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between font-normal h-9", !current && "text-muted-foreground")}
        onClick={() => setOpen((c) => !c)}
      >
        <span className="truncate text-left">{current?.label ?? placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) {
                    onChange(filtered[0].value);
                    setOpen(false);
                  }
                }
              }}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</div>
            ) : (
              filtered.map((o) => {
                const selected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
