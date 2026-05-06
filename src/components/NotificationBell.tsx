import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const sb = supabase as any;

type Notif = {
  id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["notificacoes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await sb
        .from("notificacoes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notificacoes", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      await sb.from("notificacoes").update({ lida: true }).eq("user_id", user!.id).eq("lida", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] }),
  });

  const unread = data.filter((n) => !n.lida).length;
  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Notificações</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} className="h-6 text-[11px]">
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Sem notificações</div>
          )}
          {data.map((n) => {
            const body = (
              <div className={`px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/50 ${!n.lida ? "bg-accent/30" : ""}`}>
                <div className="text-sm font-medium">{n.titulo}</div>
                {n.mensagem && <div className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link as any} onClick={() => setOpen(false)}>{body}</Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
