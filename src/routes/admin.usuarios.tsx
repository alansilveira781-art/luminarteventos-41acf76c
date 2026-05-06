import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: ums }] = await Promise.all([
        supabase.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("user_modulos").select("user_id,modulo_id"),
      ]);
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
        modulos: (ums ?? []).filter((u: any) => u.user_id === p.id).map((u: any) => u.modulo_id),
      }));
    },
  });

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Papel</th>
              <th className="px-4 py-3 text-left">Módulos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2.5">{u.display_name ?? "—"}</td>
                <td className="px-4 py-2.5">{u.email}</td>
                <td className="px-4 py-2.5">
                  {u.roles.includes("admin") ? <Badge>Admin</Badge> : <Badge variant="secondary">Usuário</Badge>}
                </td>
                <td className="px-4 py-2.5">{u.roles.includes("admin") ? "Todos" : u.modulos.length}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                    <Settings2 className="h-4 w-4 mr-1" /> Acessos
                  </Button>
                </td>
              </tr>
            ))}
            {!rows?.length && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum usuário</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <EditAccess user={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />}
    </Card>
  );
}

function EditAccess({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(user.roles.includes("admin"));
  const [modIds, setModIds] = useState<string[]>(user.modulos);

  const { data: modulos } = useQuery({
    queryKey: ["modulos-all"],
    queryFn: async () => (await supabase.from("modulos").select("id,nome,slug").eq("ativo", true).order("ordem")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      // role
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      await supabase.from("user_roles").insert({ user_id: user.id, role: isAdmin ? "admin" : "user" });
      // modules
      await supabase.from("user_modulos").delete().eq("user_id", user.id);
      if (!isAdmin && modIds.length) {
        await supabase.from("user_modulos").insert(modIds.map((modulo_id) => ({ user_id: user.id, modulo_id })));
      }
    },
    onSuccess: () => {
      toast.success("Acessos atualizados");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{user.display_name || user.email}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isAdmin} onCheckedChange={(v) => setIsAdmin(!!v)} />
            <span className="text-sm font-medium">Administrador (acessa tudo)</span>
          </label>
          <div className={isAdmin ? "opacity-40 pointer-events-none" : ""}>
            <div className="text-xs uppercase text-muted-foreground mb-2">Módulos liberados</div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(modulos ?? []).map((m: any) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={modIds.includes(m.id)}
                    onCheckedChange={(v) =>
                      setModIds((cur) => (v ? [...cur, m.id] : cur.filter((x) => x !== m.id)))
                    }
                  />
                  <span className="text-sm">{m.nome}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
