import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Search, RefreshCw, AlertCircle } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listEventos, type EventoSheetRow } from "@/server/sheets.functions";

/**
 * Combobox read-only com eventos lidos diretamente da planilha do Google Sheets.
 * Permite digitar para filtrar (busca em ID, nome, local, produtor).
 * Texto selecionável (Ctrl+C funciona).
 * Sem botão "+" — a planilha é a fonte da verdade.
 */
export function EventoSheetCombobox({
  value,
  onChange,
  placeholder = "Selecione um evento da planilha…",
  searchPlaceholder = "Buscar por ID, nome, local…",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["eventos-sheets"],
    queryFn: async () => await listEventos(),
    staleTime: 5 * 60 * 1000,
  });

  const rows: EventoSheetRow[] = query.data?.rows ?? [];
  const error = query.data?.error;

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    return rows.filter((r) => {
      const h = normalize([r.id, r.nome, r.local, r.produtor, r.uf].filter(Boolean).join(" "));
      return terms.every((t) => h.includes(t));
    });
  }, [rows, search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

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
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[340px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
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
            <button
              type="button"
              title="Atualizar planilha"
              onClick={(e) => { e.preventDefault(); query.refetch(); }}
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            {value && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-muted-foreground outline-none hover:bg-accent"
                onPointerDown={(e) => { e.preventDefault(); pick(null); }}
              >
                — Limpar seleção —
              </button>
            )}

            {query.isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando planilha…</div>
            ) : error ? (
              <div className="space-y-2 px-2 py-4 text-sm">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Não foi possível carregar eventos da planilha.</span>
                </div>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</div>
            ) : (
              filtered.map((r) => {
                const periodo = formatPeriodo(r.dataInicio, r.dataFim);
                const sub = [r.local, r.uf, periodo, r.produtor].filter(Boolean).join(" · ");
                return (
                  <div key={r.id} className="group flex items-start rounded-sm hover:bg-accent">
                    <button
                      type="button"
                      className="flex-1 px-2 py-2 text-left text-sm outline-none select-text"
                      onPointerDown={(e) => { e.preventDefault(); pick(r.id); }}
                    >
                      <div className="truncate font-medium">{r.id}</div>
                      {sub && (
                        <div className="truncate text-xs text-muted-foreground">{sub}</div>
                      )}
                    </button>
                  </div>
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
