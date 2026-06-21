import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogoDescricao, TipoMedida } from "./types";

const sb = supabase as any;
const QK = ["comercial_catalogo"];

type DbRow = {
  id: string;
  nome: string;
  tipo_medida: string;
  valor_unitario: number;
  unidade: string | null;
  created_at: string;
};

function rowToCatalogo(r: DbRow): CatalogoDescricao {
  return {
    id: r.id,
    nome: r.nome,
    tipoMedida: (r.tipo_medida as TipoMedida) ?? "unidade",
    valorUnitario: Number(r.valor_unitario) || 0,
    unidade: r.unidade ?? "un",
    createdAt: r.created_at,
  };
}

export function useCatalogo() {
  const { data = [], isLoading } = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<CatalogoDescricao[]> => {
      const { data, error } = await sb
        .from("comercial_catalogo")
        .select("id,nome,tipo_medida,valor_unitario,unidade,created_at")
        .order("nome");
      if (error) throw error;
      return (data ?? []).map(rowToCatalogo);
    },
  });
  return { catalogo: data, isLoading };
}

export function useCatalogoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const create = useMutation({
    mutationFn: async (input: Omit<CatalogoDescricao, "id" | "createdAt">) => {
      const { data, error } = await sb
        .from("comercial_catalogo")
        .insert({
          nome: input.nome,
          tipo_medida: input.tipoMedida,
          valor_unitario: input.valorUnitario,
          unidade: input.unidade ?? "un",
        })
        .select("id,nome,tipo_medida,valor_unitario,unidade,created_at")
        .single();
      if (error) throw error;
      return rowToCatalogo(data);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CatalogoDescricao> }) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.nome !== undefined) dbPatch.nome = patch.nome;
      if (patch.tipoMedida !== undefined) dbPatch.tipo_medida = patch.tipoMedida;
      if (patch.valorUnitario !== undefined) dbPatch.valor_unitario = patch.valorUnitario;
      if (patch.unidade !== undefined) dbPatch.unidade = patch.unidade;
      const { error } = await sb.from("comercial_catalogo").update(dbPatch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
