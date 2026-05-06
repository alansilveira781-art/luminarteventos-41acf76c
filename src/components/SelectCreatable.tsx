import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const sb = supabase as any;

/** Select com lista vinda de uma tabela (id, nome). Permite criar e remover entradas. */
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
  const [novo, setNovo] = useState("");
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
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
      setNovo("");
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

  return (
    <div className="flex gap-1">
      <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
        <SelectTrigger className="flex-1"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— Nenhum —</SelectItem>
          {data.map((o) => (
            <div key={o.id} className="flex items-center group">
              <SelectItem value={o.nome} className="flex-1">{o.nome}</SelectItem>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Remover "${o.nome}"?`)) del.mutate(o.id); }}
                className="opacity-0 group-hover:opacity-100 px-2 text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Adicionar">
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-2">
            <label className="text-xs font-medium">Nova opção</label>
            <Input value={novo} onChange={(e) => setNovo(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && novo.trim()) add.mutate(novo.trim()); }} />
            <Button size="sm" className="w-full" disabled={!novo.trim() || add.isPending}
              onClick={() => add.mutate(novo.trim())}>Adicionar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
