import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn, normalize } from "@/lib/utils";

const sb = supabase as any;

type Opt = { id: string; nome: string };

/**
 * Select com lista vinda de uma tabela (id, nome). Busca digitável,
 * adicionar e remover opções. Implementado como dropdown inline (sem
 * Popover/Portal) para funcionar dentro de Dialogs do Radix.
 */
export function SelectCreatable({
  table,
  value,
  onChange,
  placeholder = "Selecione…",
}: {
  table: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery<Opt[]>({
    queryKey: [`opts-${table}`],
    queryFn: async () => {
      const { data } = await sb.from(table).select("id,nome").order("nome");
      return (data ?? []) as Opt[];
    },
  });

  const add = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await sb
        .from(table)
        .insert({ nome })
        .select("id,nome")
        .single();
      if (error) throw error;
      return data as Opt;
    },
    onSuccess: (d) => {
      qc.setQueryData<Opt[]>([`opts-${table}`], (prev) => {
        const next = [...(prev ?? []), d];
        next.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return next;
      });
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
    const term = normalize(search);
    if (!term) return data;
    return data.filter((o) => normalize(o.nome).includes(term));
  }, [data, search]);

  const exactExists = useMemo(() => {
    const term = normalize(search).trim();
    if (!term) return true;
    return data.some((o) => normalize(o.nome) === term);
  }, [data, search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setSearch("");
  }, [open]);

  function selectNome(nome: string) {
    onChange(nome || null);
    setSearch("");
    setOpen(false);
  }

  function handleAdd() {
    const nome = search.trim();
    if (!nome || add.isPending) return;
    add.mutate(nome);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between font-normal h-9",
          !value && "text-muted-foreground",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex w-full min-w-[260px] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const term = search.trim();
                  if (!term) return;
                  const match = data.find((o) => normalize(o.nome) === normalize(term));
                  if (match) selectNome(match.nome);
                  else handleAdd();
                }
              }}
              placeholder="Buscar ou digitar para adicionar…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                selectNome("");
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground"
            >
              — Nenhum —
            </button>
            {filtered.map((o) => {
              const selected = value === o.nome;
              return (
                <div key={o.id} className="group flex items-center hover:bg-accent">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      selectNome(o.nome);
                    }}
                    className="flex-1 text-left px-3 py-1.5 text-sm flex items-center gap-2"
                  >
                    <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.nome}</span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(`Remover "${o.nome}"?`)) del.mutate(o.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 px-2 text-destructive"
                    aria-label="Remover"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && exactExists && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado.</div>
            )}
          </div>

          {search.trim() && !exactExists && (
            <div className="border-t bg-popover p-2">
              <Button
                type="button"
                size="sm"
                className="w-full justify-start"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleAdd();
                }}
                disabled={add.isPending}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar “{search.trim()}”
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
