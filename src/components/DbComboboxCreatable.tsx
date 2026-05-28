import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Search, Plus, Trash2 } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

/**
 * Combobox digitável com busca tolerante a acentos, vinculado a uma tabela
 * (id, nome). Permite criar novas opções inline e remover existentes.
 * O texto das opções é selecionável (Ctrl+C funciona).
 */
export function DbComboboxCreatable({
  table,
  value,
  onChange,
  placeholder = "Selecione ou digite…",
  searchPlaceholder = "Buscar ou digitar novo…",
  allowDelete = true,
}: {
  table: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowDelete?: boolean;
}) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: options = [] } = useQuery({
    queryKey: [`opts-${table}`],
    queryFn: async () => {
      const { data } = await sb.from(table).select("id,nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const add = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await sb.from(table).insert({ nome }).select("id,nome").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: [`opts-${table}`] });
      onChange(d.nome);
      setSearch("");
      setOpen(false);
      toast.success("Adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`opts-${table}`] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter((o) => {
      const h = normalize(o.nome);
      return terms.every((t) => h.includes(t));
    });
  }, [options, search]);

  const showCreate =
    search.trim() && !options.some((o) => normalize(o.nome) === normalize(search));

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
                  if (filtered.length === 1) pick(filtered[0].nome);
                  else if (showCreate) add.mutate(search.trim());
                }
              }}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {value && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-muted-foreground outline-none hover:bg-accent"
                onPointerDown={(e) => { e.preventDefault(); pick(""); onChange(null); }}
              >
                — Limpar seleção —
              </button>
            )}
            {filtered.length === 0 && !showCreate ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</div>
            ) : (
              <>
                {filtered.map((o) => (
                  <div key={o.id} className="group flex items-center rounded-sm hover:bg-accent">
                    <button
                      type="button"
                      className="flex-1 px-2 py-2 text-left text-sm outline-none truncate select-text"
                      onPointerDown={(e) => { e.preventDefault(); pick(o.nome); }}
                    >
                      {o.nome}
                    </button>
                    {allowDelete && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 px-2 py-2 text-destructive"
                        title="Remover"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(`Remover "${o.nome}"?`)) del.mutate(o.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    disabled={add.isPending}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent border-t border-border/50 mt-1"
                    onPointerDown={(e) => { e.preventDefault(); add.mutate(search.trim()); }}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">Adicionar “{search.trim()}”</span>
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
