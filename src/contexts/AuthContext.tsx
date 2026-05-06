import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "user";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  roles: Role[];
  modulos: { slug: string; nome: string; rota: string | null }[];
  hasModule: (slug: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modulos, setModulos] = useState<{ slug: string; nome: string; rota: string | null }[]>([]);

  async function loadAccess(userId: string | null) {
    if (!userId) {
      setRoles([]);
      setModulos([]);
      return;
    }
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_modulos")
        .select("modulos(slug,nome,rota,ativo)")
        .eq("user_id", userId),
    ]);
    const rolesList = (r ?? []).map((x: any) => x.role as Role);
    setRoles(rolesList);

    if (rolesList.includes("admin")) {
      const { data: all } = await supabase.from("modulos").select("slug,nome,rota,ativo").eq("ativo", true);
      setModulos((all ?? []).map((x: any) => ({ slug: x.slug, nome: x.nome, rota: x.rota })));
    } else {
      setModulos(
        (m ?? [])
          .map((x: any) => x.modulos)
          .filter((x: any) => x && x.ativo)
          .map((x: any) => ({ slug: x.slug, nome: x.nome, rota: x.rota })),
      );
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadAccess(s?.user.id ?? null), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAccess(data.session?.user.id ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    loading,
    isAdmin: roles.includes("admin"),
    roles,
    modulos,
    hasModule: (slug) => roles.includes("admin") || modulos.some((m) => m.slug === slug),
    refresh: () => loadAccess(session?.user.id ?? null),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
