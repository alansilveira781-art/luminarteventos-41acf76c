import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DRE_STRUCTURE, type DreLine, type DreGroupId } from "@/lib/conta-azul/dre";

type Row = {
  ordem: number;
  codigo: string;
  label: string;
  tipo: "sum" | "calc";
  sinal: number;
  prefixos: string[] | null;
  formula: string[] | null;
  ativo: boolean;
};

const sb = supabase as any;

export function useDreEstrutura() {
  return useQuery({
    queryKey: ["ca-dre-estrutura"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DreLine[]> => {
      const { data, error } = await sb
        .from("ca_dre_estrutura")
        .select("ordem,codigo,label,tipo,sinal,prefixos,formula,ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error || !data || !data.length) return DRE_STRUCTURE;
      return (data as Row[]).map((r) => ({
        id: r.codigo as DreGroupId,
        label: r.label,
        kind: r.tipo,
        sign: (r.sinal === -1 ? -1 : 1) as 1 | -1,
        prefixes: r.prefixos ?? [],
        formula: (r.formula ?? []) as DreGroupId[],
      }));
    },
  });
}
