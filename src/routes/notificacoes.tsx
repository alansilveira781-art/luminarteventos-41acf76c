import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Bell, Check, RotateCcw, Trash2 } from "lucide-react";

const sb = supabase as any;

type Notif = {
  id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  concluida: boolean;
  concluida_em: string | null;
  created_at: string;
};

export const Route = createFileRoute("/notificacoes")({
  component: NotificacoesPage,
  head: () => ({ meta: [{ title: "Notificações" }] }),
});

function NotificacoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"todas" | "nao_lidas" | "pendentes" | "concluidas">("todas");

  const { data = [] } = useQuery({
    queryKey: ["notificacoes-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await sb
        .from("notificacoes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data ?? []) as Notif[];
    },
  });

  const filtered = useMemo(() => {
    switch (filtro) {
      case "nao_lidas": return data.filter((n) => !n.lida);
      case "pendentes": return data.filter((n) => !n.concluida);
      case "concluidas": return data.filter((n) => n.concluida);
      default: return data;
    }
  }, [data, filtro]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notificacoes-all", user?.id] });
    qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] });
  };

  const toggleConcluida = useMutation({
    mutationFn: async (n: Notif) => {
      await sb.from("notificacoes").update({
        concluida: !n.concluida,
        concluida_em: !n.concluida ? new Date().toISOString() : null,
        lida: true,
      }).eq("id", n.id);
    },
    onSuccess: invalidate,
  });

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      await sb.from("notificacoes").update({ lida: true }).eq("id", id);
    },
    onSuccess: invalidate,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      await sb.from("notificacoes").delete().eq("id", id);
    },
    onSuccess: invalidate,
  });

  if (!user) return <div className="p-6 text-sm text-muted-foreground">Faça login para ver suas notificações.</div>;

  const counts = {
    todas: data.length,
    nao_lidas: data.filter((n) => !n.lida).length,
    pendentes: data.filter((n) => !n.concluida).length,
    concluidas: data.filter((n) => n.concluida).length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5" />
        <h1 className="text-2xl font-semibold">Notificações</h1>
      </div>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
          <TabsTrigger value="nao_lidas">Não lidas ({counts.nao_lidas})</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes ({counts.pendentes})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({counts.concluidas})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="divide-y divide-border">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</div>
        )}
        {filtered.map((n) => (
          <div key={n.id} className={`p-3 flex items-start gap-3 ${!n.lida ? "bg-accent/20" : ""}`}>
            <Checkbox
              checked={n.concluida}
              onCheckedChange={() => toggleConcluida.mutate(n)}
              className="mt-1"
              title={n.concluida ? "Reabrir" : "Marcar como concluída"}
            />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${n.concluida ? "line-through text-muted-foreground" : ""}`}>
                {n.titulo}
              </div>
              {n.mensagem && (
                <div className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</div>
              )}
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString("pt-BR")}
                {n.concluida && n.concluida_em && (
                  <> · concluída em {new Date(n.concluida_em).toLocaleString("pt-BR")}</>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {n.link && (
                <Link to={n.link as any} onClick={() => marcarLida.mutate(n.id)}>
                  <Button size="sm" variant="outline">Abrir</Button>
                </Link>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleConcluida.mutate(n)}
                title={n.concluida ? "Reabrir" : "Concluir"}
              >
                {n.concluida ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => excluir.mutate(n.id)}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
