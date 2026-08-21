import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TIPO_DEMANDA_OPTIONS,
  TIPOS_COM_ITENS,
  TIPOS_QUE_VAO_PARA_ESTOQUE,
  TIPOS_QUE_VAO_PARA_PATRIMONIO,
  TIPO_DEMANDA_LEGACY_LABELS,
} from "@/lib/demandas";

const sb = supabase as any;

export type DestinoRecebimento = "nenhum" | "estoque" | "patrimonio";

export type TipoDespesa = {
  id: string;
  slug: string;
  label: string;
  exige_itens: boolean;
  destino_recebimento: DestinoRecebimento;
  ativo: boolean;
  ordem: number;
};

/** Fallback usado enquanto a tabela não carrega (mantém o app funcional). */
const FALLBACK: TipoDespesa[] = TIPO_DEMANDA_OPTIONS.map((o, i) => ({
  id: o.value,
  slug: o.value,
  label: o.label,
  exige_itens: TIPOS_COM_ITENS.includes(o.value),
  destino_recebimento: TIPOS_QUE_VAO_PARA_ESTOQUE.includes(o.value)
    ? "estoque"
    : TIPOS_QUE_VAO_PARA_PATRIMONIO.includes(o.value)
      ? "patrimonio"
      : "nenhum",
  ativo: true,
  ordem: (i + 1) * 10,
}));

export function slugifyTipo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function useTiposDespesa() {
  const qc = useQueryClient();
  const { isAdmin, modulos, session } = useAuth();

  const podeCriar =
    isAdmin ||
    modulos.some(
      (m) => (m.slug === "financeiro_op" || m.slug === "financeiro") && m.is_admin,
    );

  const autenticado = !!session;

  const { data, isLoading } = useQuery({
    queryKey: ["demanda-tipos", autenticado],
    queryFn: async () => {
      if (!autenticado) {
        // Usuários não autenticados (formulário público) leem via rota pública,
        // pois a tabela não é exposta ao papel anônimo.
        const res = await fetch("/api/public/tipos-despesa");
        if (!res.ok) throw new Error("Falha ao carregar tipos");
        const json = await res.json();
        return (json.tipos ?? []) as TipoDespesa[];
      }
      const { data, error } = await sb
        .from("demanda_tipos")
        .select("id,slug,label,exige_itens,destino_recebimento,ativo,ordem")
        .order("ordem")
        .order("label");
      if (error) throw error;
      return (data ?? []) as TipoDespesa[];
    },
    staleTime: 5 * 60_000,
  });


  const tipos = data && data.length ? data : FALLBACK;

  return useMemo(() => {
    const ativos = tipos.filter((t) => t.ativo);
    const options = ativos.map((t) => ({ value: t.slug, label: t.label }));
    const byValue = new Map(tipos.map((t) => [t.slug, t]));
    const comItens = tipos.filter((t) => t.exige_itens).map((t) => t.slug);
    const paraEstoque = tipos
      .filter((t) => t.destino_recebimento === "estoque")
      .map((t) => t.slug);
    const paraPatrimonio = tipos
      .filter((t) => t.destino_recebimento === "patrimonio")
      .map((t) => t.slug);

    return {
      loading: isLoading,
      tipos,
      options,
      comItens,
      paraEstoque,
      paraPatrimonio,
      paraRecebimento: [...paraEstoque, ...paraPatrimonio],
      exigeItens: (slug?: string | null) => comItens.includes(slug ?? ""),
      vaiParaRecebimento: (slug?: string | null) =>
        paraEstoque.includes(slug ?? "") || paraPatrimonio.includes(slug ?? ""),
      labelOf: (slug?: string | null) =>
        byValue.get(slug ?? "")?.label ??
        TIPO_DEMANDA_LEGACY_LABELS[slug ?? ""] ??
        (slug || "Sem tipo"),
      podeCriar,
      refetch: () => qc.invalidateQueries({ queryKey: ["demanda-tipos"] }),
    };
  }, [tipos, isLoading, podeCriar, qc]);
}
