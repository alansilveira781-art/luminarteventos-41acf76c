import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Acesso ao módulo de Diaristas.
 *
 * - isFinAdmin: admin geral ou admin do módulo financeiro/financeiro_op.
 *   Vê tudo (todos os apontamentos, valores em R$ e a aba Fechamento).
 * - podeLancar: usuário liberado na tela de Configurações de Diaristas.
 *   Vê e edita apenas os próprios apontamentos, sem valores em R$.
 */
export function useDiaristaAcesso() {
  const { user, isAdmin, modulos, loading } = useAuth();

  const isFinAdmin =
    isAdmin ||
    modulos.some((m) => (m.slug === "financeiro_op" || m.slug === "financeiro") && m.is_admin);

  const temModuloFinanceiro =
    isAdmin || modulos.some((m) => m.slug === "financeiro_op" || m.slug === "financeiro");

  const { data: lancador, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["diarista-lancador", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("diarista_lancadores")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });

  const podeLancar = !!lancador;

  return {
    loading: loading || isLoading,
    isFinAdmin,
    podeLancar,
    /** Pode abrir a tela de diaristas */
    podeAcessar: temModuloFinanceiro || podeLancar,
    /** Só lançador puro (sem módulo financeiro) tem visão restrita */
    somenteProprios: !temModuloFinanceiro && podeLancar,
    verValores: temModuloFinanceiro,
  };
}
