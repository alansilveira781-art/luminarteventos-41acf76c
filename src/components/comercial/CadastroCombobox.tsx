import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sb = supabase as any;

type Opt = { id: string; nome: string };

type ExtraField = {
  key: string;
  label: string;
  type: "number";
  default?: number;
};

type TableName =
  | "comercial_vendedores"
  | "comercial_cerimoniais"
  | "comercial_decoradores"
  | "comercial_classificacoes";

/**
 * Combobox com busca digitável, criação inline e suporte a campos extras
 * (ex: percentual_comissao para vendedor, percentual_bv para cerimonial).
 * Baseado em SelectCreatable — dropdown INLINE (sem Popover/Portal) para
 * funcionar dentro de Dialogs do Radix.
 */
export function CadastroCombobox({
  table,
  queryKey,
  value,
  onChange,
  placeholder = "Selecione…",
  extraFields = [],
}: {
  table: TableName;
  queryKey: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  extraFields?: ExtraField[];
}) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [extras, setExtras] = useState<Record<string, number>>({});

  const { data = [] } = useQuery({
    queryKey: [queryKey],
    queryFn: async (): Promise<Opt[]> => {
      const { data, error } = await sb.from(table).select("id,nome").order("nome");
      if (error) throw error;
      return (data ?? []) as Opt[];
    },
    staleTime: 60_000,
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
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else {
      setSearch("");
      setCreating(false);
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { data, error } = await sb.from(table).insert(payload).select("id,nome").single();
      if (error) throw error;
      return data as Opt;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      onChange(d.nome);
      toast.success("Adicionado");
      setSearch("");
      setCreating(false);
      setOpen(false);
    },
    onError: (e: any) => {
      if (e?.code === "23505") toast.error("Já existe um cadastro com esse nome.");
      else toast.error(e?.message ?? "Erro ao criar");
    },
  });

  function pick(nome: string) {
    onChange(nome);
    setSearch("");
    setOpen(false);
  }

  function startCreate() {
    const nome = search.trim();
    if (!nome) return;
    if (extraFields.length === 0) {
      createMut.mutate({ nome });
      return;
    }
    setNewNome(nome);
    const init: Record<string, number> = {};
    for (const f of extraFields) init[f.key] = f.default ?? 0;
    setExtras(init);
    setCreating(true);
  }

  function confirmCreate() {
    const nome = newNome.trim();
    if (!nome) return;
    createMut.mutate({ nome, ...extras });
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-stretch gap-1">
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex-1 justify-between font-normal h-9",
            !value && "text-muted-foreground",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onChange("")}
            title="Limpar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex w-full min-w-[280px] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {!creating && (
            <>
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
                      const match = data.find(
                        (o) => normalize(o.nome) === normalize(term),
                      );
                      if (match) pick(match.nome);
                      else startCreate();
                    }
                  }}
                  placeholder="Buscar ou digitar para adicionar…"
                  className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filtered.map((o) => {
                  const selected = value === o.nome;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        pick(o.nome);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "h-3.5 w-3.5",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o.nome}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && exactExists && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum resultado.
                  </div>
                )}
              </div>
              {search.trim() && !exactExists && (
                <div className="shrink-0 border-t bg-popover p-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full justify-start"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startCreate();
                    }}
                    disabled={createMut.isPending}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Criar “{search.trim()}”
                  </Button>
                </div>
              )}
            </>
          )}
          {creating && (
            <div className="p-3 space-y-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase">Nome</Label>
                <Input
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  autoFocus
                />
              </div>
              {extraFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-[11px] uppercase">{f.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={extras[f.key] ?? 0}
                    onChange={(e) =>
                      setExtras((prev) => ({
                        ...prev,
                        [f.key]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={confirmCreate}
                  disabled={createMut.isPending || !newNome.trim()}
                >
                  {createMut.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
