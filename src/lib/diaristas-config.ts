import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiaristaConfig = {
  valor_almoco: number;
  valor_janta: number;
};

export const DIARISTA_CONFIG_KEY = ["diarista_config"];

export function useDiaristaConfig() {
  return useQuery({
    queryKey: DIARISTA_CONFIG_KEY,
    queryFn: async (): Promise<DiaristaConfig> => {
      const { data, error } = await (supabase as any)
        .from("diarista_config")
        .select("valor_almoco, valor_janta")
        .maybeSingle();
      if (error) throw error;
      return {
        valor_almoco: Number(data?.valor_almoco) || 0,
        valor_janta: Number(data?.valor_janta) || 0,
      };
    },
  });
}

export const DIARISTA_DEPARTAMENTOS_KEY = ["diarista_departamentos"];

export type DiaristaDepartamento = { id: string; nome: string; ordem: number };

/** Lista de departamentos cadastrada em Diaristas > Configurações. */
export function useDiaristaDepartamentos() {
  return useQuery({
    queryKey: DIARISTA_DEPARTAMENTOS_KEY,
    queryFn: async (): Promise<DiaristaDepartamento[]> => {
      const { data, error } = await (supabase as any)
        .from("diarista_departamentos")
        .select("id,nome,ordem")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DiaristaDepartamento[];
    },
  });
}
