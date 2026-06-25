import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import * as Icons from "lucide-react";
import { Shield, Users as UsersIcon, Boxes, Database, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Hub,
});

function Hub() {
  const { isAdmin, modulos } = useAuth();

  const { data: stats } = useQuery({
    enabled: isAdmin,
    queryKey: ["hub-admin-stats"],
    queryFn: async () => {
      const [u, m, a] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("modulos").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
      ]);
      return { users: u.count ?? 0, modules: m.count ?? 0, admins: a.count ?? 0 };
    },
  });

  return (
    <>
      <PageHeader
        title="Bem-vindo"
        description="Selecione um módulo para começar"
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {isAdmin && (
          <Link to="/admin" className="group">
            <Card className="p-3 h-full border-primary/30 bg-gradient-to-br from-primary/10 to-transparent hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="h-8 w-8 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                  <Shield className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div className="text-sm font-semibold">Administração</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Usuários, módulos e dados
              </div>
            </Card>
          </Link>
        )}

        {modulos.map((m) => {
          const Icon = (Icons as any)[iconFor(m.slug)] ?? Boxes;
          const to = m.slug === "estoque" ? "/dashboard" : (m.rota || "/");
          return (
            <Link key={m.slug} to={to} className="group">
              <Card className="p-3 h-full hover:border-primary/60 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="h-8 w-8 rounded-md bg-muted text-foreground flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <div className="text-sm font-semibold">{m.nome}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Acessar {m.nome.toLowerCase()}
                </div>
              </Card>
            </Link>
          );
        })}

        {!isAdmin && modulos.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Você ainda não tem acesso a nenhum módulo. Solicite a um administrador.
          </Card>
        )}
      </div>
    </>
  );
}

function iconFor(slug: string) {
  const map: Record<string, string> = { estoque: "Package", compras: "ShoppingCart", financeiro: "Wallet", financeiro_op: "DollarSign" };
  return map[slug] ?? "Boxes";
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | undefined }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2 py-2">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
      <div className="text-sm font-semibold mt-1">{value ?? "—"}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
