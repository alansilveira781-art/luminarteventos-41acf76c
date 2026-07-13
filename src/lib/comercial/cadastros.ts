import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type Vendedor = { id: string; nome: string; percentual_comissao: number };
export type Cerimonial = { id: string; nome: string; percentual_bv: number };
export type Decorador = { id: string; nome: string };
export type Classificacao = { id: string; nome: string };

export function useClassificacoes() {
  return useQuery({
    queryKey: ["comercial-classificacoes"],
    queryFn: async (): Promise<Classificacao[]> => {
      const { data, error } = await sb
        .from("comercial_classificacoes")
        .select("id,nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Classificacao[];
    },
    staleTime: 60_000,
  });
}


export function useVendedores() {
  return useQuery({
    queryKey: ["comercial-vendedores"],
    queryFn: async (): Promise<Vendedor[]> => {
      const { data, error } = await sb
        .from("comercial_vendedores")
        .select("id,nome,percentual_comissao")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Vendedor[];
    },
    staleTime: 60_000,
  });
}

export function useCerimoniais() {
  return useQuery({
    queryKey: ["comercial-cerimoniais"],
    queryFn: async (): Promise<Cerimonial[]> => {
      const { data, error } = await sb
        .from("comercial_cerimoniais")
        .select("id,nome,percentual_bv")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cerimonial[];
    },
    staleTime: 60_000,
  });
}

export function useDecoradores() {
  return useQuery({
    queryKey: ["comercial-decoradores"],
    queryFn: async (): Promise<Decorador[]> => {
      const { data, error } = await sb
        .from("comercial_decoradores")
        .select("id,nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Decorador[];
    },
    staleTime: 60_000,
  });
}

export function useCadastroMutations(
  table:
    | "comercial_vendedores"
    | "comercial_cerimoniais"
    | "comercial_decoradores"
    | "comercial_classificacoes",
  queryKey: string,
) {

  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] });
  const upsert = useMutation({
    mutationFn: async (row: Record<string, any>) => {
      if (row.id) {
        const { id, ...rest } = row;
        const { error } = await sb.from(table).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from(table).insert(row);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { upsert, remove };
}
