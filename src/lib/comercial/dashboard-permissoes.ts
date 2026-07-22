import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type DashboardPermissoes = {
  ver_painel: boolean;
  ver_relatorio: boolean;
  ver_vendedores: boolean;
  ver_indicadores: boolean;
};

export const PERMS_ALL: DashboardPermissoes = {
  ver_painel: true,
  ver_relatorio: true,
  ver_vendedores: true,
  ver_indicadores: true,
};

export const PERMS_VENDEDOR_ONLY: DashboardPermissoes = {
  ver_painel: false,
  ver_relatorio: false,
  ver_vendedores: true,
  ver_indicadores: false,
};

export const PERMS_NONE: DashboardPermissoes = {
  ver_painel: false,
  ver_relatorio: false,
  ver_vendedores: false,
  ver_indicadores: false,
};

export function useDashboardPermissoes(): {
  perms: DashboardPermissoes;
  loading: boolean;
  temAcessoAlgumaAba: boolean;
  isAdminComercial: boolean;
} {
  const { user, isAdmin, modulos, loading: authLoading } = useAuth();
  const isAdminComercial =
    isAdmin || modulos.some((m) => m.slug === "comercial" && m.is_admin);
  const temModuloComercial =
    isAdmin || modulos.some((m) => m.slug === "comercial");

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["comercial-dashboard-permissoes", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("comercial_dashboard_permissoes")
        .select("ver_painel, ver_relatorio, ver_vendedores, ver_indicadores")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? null) as DashboardPermissoes | null;
    },
    staleTime: 60_000,
  });

  let perms: DashboardPermissoes;
  if (data) {
    perms = data;
  } else if (isAdminComercial) {
    perms = PERMS_ALL;
  } else if (temModuloComercial) {
    perms = PERMS_VENDEDOR_ONLY;
  } else {
    perms = PERMS_NONE;
  }

  const temAcessoAlgumaAba =
    perms.ver_painel || perms.ver_relatorio || perms.ver_vendedores || perms.ver_indicadores;

  return {
    perms,
    loading: authLoading || isLoading,
    temAcessoAlgumaAba,
    isAdminComercial,
  };
}

export function normalizarNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
