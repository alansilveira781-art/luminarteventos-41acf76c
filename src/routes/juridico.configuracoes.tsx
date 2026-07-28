import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/juridico/configuracoes")({ component: JuridicoConfiguracoes });

const sb = supabase as any;

type Profile = { id: string; display_name: string | null; email: string | null };
type Solicitante = { user_id: string; ativo: boolean };

function JuridicoConfiguracoes() {
  const { isAdmin, modulos, loading, user } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const isJuridicoAdmin = isAdmin || modulos.some((m) => m.slug === "juridico" && m.is_admin);

  const { data: solicitantes = [] } = useQuery({
    enabled: isJuridicoAdmin,
    queryKey: ["juridico-solicitantes"],
    queryFn: async () => {
      const { data, error } = await sb.from("juridico_solicitantes").select("user_id, ativo");
      if (error) throw error;
      return (data ?? []) as Solicitante[];
    },
  });

  const { data: profiles = [] } = useQuery({
    enabled: isJuridicoAdmin,
    queryKey: ["profiles-todos"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("profiles")
        .select("id, display_name, email")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const nomeDe = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.display_name || p?.email || id;
  };

  const disponiveis = useMemo(
    () => profiles.filter((p) => !solicitantes.some((s) => s.user_id === p.id)),
    [profiles, solicitantes],
  );

  const adicionar = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await sb
        .from("juridico_solicitantes")
        .insert({ user_id: userId, ativo: true, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovo("");
      qc.invalidateQueries({ queryKey: ["juridico-solicitantes"] });
      toast.success("Usuário liberado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao liberar usuário"),
  });

  const alternar = useMutation({
    mutationFn: async (vars: { userId: string; ativo: boolean }) => {
      const { error } = await sb
        .from("juridico_solicitantes")
        .update({ ativo: vars.ativo })
        .eq("user_id", vars.userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["juridico-solicitantes"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const remover = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await sb.from("juridico_solicitantes").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["juridico-solicitantes"] });
      toast.success("Acesso removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  if (loading) return null;
  if (!isJuridicoAdmin) return <Navigate to="/juridico" />;

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Defina quais usuários podem preencher o formulário de solicitação de contratos. O formulário não aparece no menu — compartilhe o link com quem foi liberado."
      />

      <Card className="p-4 mb-4 max-w-3xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Link do formulário de solicitação</div>
          <p className="text-xs text-muted-foreground">/juridico/solicitar — visível apenas para usuários liberados abaixo.</p>
        </div>
        <CopiarLinkButton path="/juridico/solicitar" label="Copiar link" />
      </Card>

      <Card className="p-5 space-y-4 max-w-3xl">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Liberar usuário</label>
            <Select value={novo} onValueChange={setNovo}>
              <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
              <SelectContent>
                {disponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || p.email || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => novo && adicionar.mutate(novo)} disabled={!novo || adicionar.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="w-28">Ativo</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solicitantes.map((s) => (
              <TableRow key={s.user_id}>
                <TableCell>{nomeDe(s.user_id)}</TableCell>
                <TableCell>
                  <Switch
                    checked={s.ativo}
                    onCheckedChange={(v) => alternar.mutate({ userId: s.user_id, ativo: v })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover acesso de ${nomeDe(s.user_id)}?`)) remover.mutate(s.user_id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {solicitantes.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum usuário liberado ainda
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
