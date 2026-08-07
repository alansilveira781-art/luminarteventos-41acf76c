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
