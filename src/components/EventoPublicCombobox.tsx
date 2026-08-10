import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EventoPublicoRow = {
  id: string;
  nome: string;
  local: string;
  uf: string;
  produtor: string;
  dataInicio: string;
  dataFim: string;
  origem: "calendario" | "planilha";
};

let cache: EventoPublicoRow[] | null = null;

/** Combobox de eventos para o formulário público (sem cliente Supabase no browser). */
export function EventoPublicCombobox({
  value,
  onChange,
  placeholder = "Selecione um evento…",
  searchPlaceholder = "Buscar por código, nome, local…",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EventoPublicoRow[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch("/api/public/eventos")
      .then((r) => r.json())
      .then((d) => {
        cache = (d?.eventos ?? []) as EventoPublicoRow[];
        if (alive) setRows(cache!);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    return rows.filter((r) => {
      const h = normalize([r.id, r.nome, r.local, r.produtor, r.uf].filter(Boolean).join(" "));
      return terms.every((t) => h.includes(t));
    });
  }, [rows, search]);

  const pick = (v: string | null) => {
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
                  if (filtered.length === 1) pick(filtered[0].id);
                }
              }}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto p-1">
            {value && (
              <button
                type="button"
                className="flex w-full items-center rounded-sm px-2 py-2 text-left text-xs text-muted-foreground outline-none hover:bg-accent"
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(null);
                }}
              >
                — Limpar seleção —
              </button>
            )}
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando eventos…</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</div>
            ) : (
              filtered.map((r) => {
                const periodo = formatPeriodo(r.dataInicio, r.dataFim);
                const sub = [r.local, r.uf, periodo, r.produtor].filter(Boolean).join(" · ");
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pick(r.id);
                    }}
                  >
                    <div className="truncate font-medium">{r.id}</div>
                    {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
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

function formatPeriodo(ini?: string, fim?: string) {
  const a = (ini ?? "").trim();
  const b = (fim ?? "").trim();
  if (a && b && a !== b) return `${a} → ${b}`;
  return a || b || "";
}
