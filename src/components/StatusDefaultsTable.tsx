import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;
const NONE = "__none__";

type StatusOption = { key: string; label: string; color: string };
type Profile = { id: string; display_name: string | null; email: string | null };
type Default = { status: string; responsavel_id: string | null; responsavel_nome: string | null };

export function StatusDefaultsTable({
  tableName,
  moduleSlug,
  statuses,
}: {
  tableName: "compras_status_defaults" | "comercial_status_defaults" | "financeiro_status_defaults";
  moduleSlug: string;
  statuses: StatusOption[];
}) {
  const qc = useQueryClient();

  const { data: defaults = [] } = useQuery({
    queryKey: [tableName],
    queryFn: async () => {
      const { data } = await sb.from(tableName).select("status, responsavel_id, responsavel_nome");
      return (data ?? []) as Default[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-module", moduleSlug],
    queryFn: async () => {
      // usuários que têm acesso ao módulo
      const { data: mod } = await sb.from("modulos").select("id").eq("slug", moduleSlug).maybeSingle();
      if (!mod?.id) return [] as Profile[];
      const { data: ums } = await sb.from("user_modulos").select("user_id").eq("modulo_id", mod.id);
      const ids = (ums ?? []).map((u: any) => u.user_id);
      // adiciona admins gerais também
      const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "admin");
      const allIds = Array.from(new Set([...ids, ...(admins ?? []).map((a: any) => a.user_id)]));
      if (!allIds.length) return [] as Profile[];
      const { data: profs } = await sb
        .from("profiles")
        .select("id, display_name, email")
        .in("id", allIds)
        .order("display_name");
      return (profs ?? []) as Profile[];
    },
  });

  const defaultsByStatus = useMemo(() => {
    const m: Record<string, Default> = {};
    defaults.forEach((d) => (m[d.status] = d));
    return m;
  }, [defaults]);

  const saveMut = useMutation({
    mutationFn: async (vars: { status: string; responsavelId: string | null }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (vars.responsavelId === null) {
        const { error } = await sb.from(tableName).delete().eq("status", vars.status);
        if (error) throw error;
        return;
      }
      const p = profiles.find((x) => x.id === vars.responsavelId);
      const nome = p?.display_name || p?.email || null;
      const { error } = await sb.from(tableName).upsert(
        {
          status: vars.status,
          responsavel_id: vars.responsavelId,
          responsavel_nome: nome,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "status" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [tableName] });
      toast.success("Responsável padrão atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left p-3 w-1/2">Status</th>
            <th className="text-left p-3">Responsável padrão</th>
            <th className="p-3 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => {
            const def = defaultsByStatus[s.key];
            return (
              <tr key={s.key} className="border-t border-border">
                <td className="p-3">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.color}`} />
                    {s.label}
                  </span>
                </td>
                <td className="p-3">
                  <Select
                    value={def?.responsavel_id || NONE}
                    onValueChange={(v) =>
                      saveMut.mutate({ status: s.key, responsavelId: v === NONE ? null : v })
                    }
                  >
                    <SelectTrigger className="h-9 max-w-xs">
                      <SelectValue placeholder="Sem padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Sem padrão —</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.display_name || p.email || p.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  {def?.responsavel_id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Remover padrão"
                      onClick={() => saveMut.mutate({ status: s.key, responsavelId: null })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
