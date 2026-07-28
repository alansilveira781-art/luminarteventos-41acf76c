import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Indica se o usuário logado pode preencher o formulário de solicitação de
 * contratos (administradores, admins do módulo Jurídico ou usuários liberados
 * em Jurídico › Configurações).
 */
export function useJuridicoSolicitante() {
  const { user, isAdmin, modulos } = useAuth();
  const isJuridicoAdmin = isAdmin || modulos.some((m) => m.slug === "juridico" && m.is_admin);

  const { data, isLoading } = useQuery({
    enabled: !!user && !isJuridicoAdmin,
    queryKey: ["juridico-solicitante", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("juridico_solicitantes")
        .select("ativo")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { ativo: boolean } | null;
    },
    staleTime: 60_000,
  });

  return {
    podeSolicitar: isJuridicoAdmin || !!data?.ativo,
    isJuridicoAdmin,
    loading: !isJuridicoAdmin && isLoading,
  };
}
