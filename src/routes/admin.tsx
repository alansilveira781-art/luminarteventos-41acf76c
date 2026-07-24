import { createFileRoute, Link, Outlet, useRouterState, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection } from "@/components/FormSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, Users as UsersIcon, Boxes, Database, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" />;

  const tabs = [
    { to: "/admin", label: "Visão geral", icon: Shield, exact: true },
    { to: "/admin/usuarios", label: "Usuários", icon: UsersIcon },
    { to: "/admin/modulos", label: "Módulos", icon: Boxes },
    { to: "/admin/empresas", label: "Empresas", icon: Building2 },
    { to: "/admin/dados", label: "Base de dados", icon: Database },
  ];

  return (
    <div className="-mx-4 -my-6 sm:-mx-8 sm:-my-8 px-4 sm:px-8 py-6 sm:py-8 min-h-[calc(100vh-3.5rem)] bg-muted">
      <PageHeader title="Administração" description="Gerencie usuários, módulos e dados do sistema" />
      <nav className="flex flex-wrap gap-1 mb-4 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
                active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
