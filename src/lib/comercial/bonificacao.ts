import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type Produtor = { id: string; nome: string; ativo: boolean };
export type AlcadaRow = {
  id: string;
  categoria: string;
  nivel: number;
  valor_ate: number | null;
  multiplicador: number;
};
export type BonificacaoRow = {
  id: string;
  venda_id: string | null;
  nome_evento: string;
  data_evento: string | null;
  categoria: string | null;
  produtor_id: string | null;
  produtor_nome: string | null;
  complexidade: number | null;
  valor_final: number | null;
  ano: number | null;
  mes: string | null;
};

export function useProdutores(onlyAtivos = false) {
  return useQuery({
    queryKey: ["comercial-produtores", onlyAtivos],
    queryFn: async (): Promise<Produtor[]> => {
      let q = sb.from("comercial_produtores").select("id,nome,ativo").order("nome");
      if (onlyAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Produtor[];
    },
    staleTime: 60_000,
  });
}

export function useProdutorMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["comercial-produtores"] });
  const upsert = useMutation({
    mutationFn: async (row: { id?: string; nome: string; ativo: boolean }) => {
      if (row.id) {
        const { id, ...rest } = row;
        const { error } = await sb.from("comercial_produtores").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("comercial_produtores").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_produtores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  return { upsert, remove };
}

export function useAlcadas() {
  return useQuery({
    queryKey: ["comercial-alcadas"],
    queryFn: async (): Promise<AlcadaRow[]> => {
      const { data, error } = await sb
        .from("comercial_alcadas_complexidade")
        .select("id,categoria,nivel,valor_ate,multiplicador")
        .order("categoria")
        .order("nivel");
      if (error) throw error;
      return (data ?? []) as AlcadaRow[];
    },
    staleTime: 60_000,
  });
}

export function useAlcadaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id: string; valor_ate: number | null; multiplicador: number }) => {
      const { id, ...rest } = row;
      const { error } = await sb.from("comercial_alcadas_complexidade").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial-alcadas"] }),
  });
}

const normalize = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Mapeia categoria do evento para a categoria usada nas alçadas (Casamento -> Social). */
export function categoriaParaAlcada(cat: string | null | undefined): string {
  const n = normalize(cat || "");
  if (n === "casamento") return "Social";
  if (n === "cenografia") return "Cenografia";
  if (n === "corporativo") return "Corporativo";
  if (n === "stand") return "Stand";
  if (n === "social") return "Social";
  return cat || "";
}

/** Sugere complexidade (1-6) a partir das alçadas da categoria e valor final. */
export function sugerirComplexidade(
  alcadas: AlcadaRow[],
  categoria: string | null | undefined,
  valorFinal: number,
): number {
  const alvo = normalize(categoriaParaAlcada(categoria));
  const faixas = alcadas
    .filter((a) => normalize(a.categoria) === alvo)
    .sort((a, b) => a.nivel - b.nivel);
  if (!faixas.length) return 1;
  for (const f of faixas) {
    if (f.valor_ate == null) return f.nivel;
    if (valorFinal <= Number(f.valor_ate)) return f.nivel;
  }
  return 6;
}

export function multiplicadorDaCategoria(alcadas: AlcadaRow[], categoria: string | null | undefined): number {
  const alvo = normalize(categoriaParaAlcada(categoria));
  const f = alcadas.find((a) => normalize(a.categoria) === alvo);
  return f?.multiplicador ?? 150;
}

export function useBonificacoes(ano: number | "Todos", mes: string) {
  return useQuery({
    queryKey: ["comercial-bonificacao", ano, mes],
    queryFn: async (): Promise<BonificacaoRow[]> => {
      let q = sb.from("comercial_bonificacao_producao").select("*");
      if (ano !== "Todos") q = q.eq("ano", ano);
      if (mes && mes !== "Todos") q = q.eq("mes", mes.toLowerCase());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BonificacaoRow[];
    },
    staleTime: 30_000,
  });
}

export function useBonificacaoMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["comercial-bonificacao"] });
  const upsert = useMutation({
    mutationFn: async (row: Omit<BonificacaoRow, "id"> & { id?: string }) => {
      const { error } = await sb
        .from("comercial_bonificacao_producao")
        .upsert(row, { onConflict: "venda_id,produtor_id" });
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_bonificacao_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  return { upsert, remove };
}
