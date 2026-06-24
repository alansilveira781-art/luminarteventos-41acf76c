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
import { Settings2, UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
async function invokeAdminFn(name: string, body: any) {
  // Garante token fresco antes de chamar edge function (evita 401 por sessão expirada).
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    await supabase.auth.refreshSession();
  } else {
    const expiresAt = (sess.session.expires_at ?? 0) * 1000;
    if (expiresAt - Date.now() < 60_000) {
      await supabase.auth.refreshSession();
    }
  }
  const { data: fresh } = await supabase.auth.getSession();
  if (!fresh.session) {
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${fresh.session.access_token}` },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}


export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

type ModAccess = { modulo_id: string; is_admin: boolean };

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
        supabase.from("user_modulos").select("user_id,modulo_id,is_admin"),
      ]);
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
        modulos: (ums ?? [])
          .filter((u: any) => u.user_id === p.id)
          .map((u: any) => ({ modulo_id: u.modulo_id, is_admin: !!u.is_admin })) as ModAccess[],
      }));
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Novo usuário
        </Button>
      </div>
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
                  <td className="px-4 py-2.5">
                    {u.roles.includes("admin")
                      ? "Todos"
                      : `${u.modulos.length}${u.modulos.some((m: ModAccess) => m.is_admin) ? " · admin" : ""}`}
                  </td>
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
      </Card>
      {editing && <EditAccess user={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />}
      {creating && <CreateUser onClose={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />}
    </div>
  );
}

function ModuleAccessList({
  modulos,
  value,
  onChange,
}: {
  modulos: { id: string; nome: string }[];
  value: ModAccess[];
  onChange: (next: ModAccess[]) => void;
}) {
  const get = (id: string) => value.find((v) => v.modulo_id === id);
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {modulos.map((m) => {
        const cur = get(m.id);
        const checked = !!cur;
        return (
          <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) =>
                  onChange(
                    v
                      ? [...value, { modulo_id: m.id, is_admin: false }]
                      : value.filter((x) => x.modulo_id !== m.id),
                  )
                }
              />
              <span className="text-sm">{m.nome}</span>
            </label>
            <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${checked ? "" : "opacity-30 pointer-events-none"}`}>
              <Checkbox
                checked={!!cur?.is_admin}
                onCheckedChange={(v) =>
                  onChange(value.map((x) => (x.modulo_id === m.id ? { ...x, is_admin: !!v } : x)))
                }
              />
              <span>Admin do módulo</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

function CreateUser({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mods, setMods] = useState<ModAccess[]>([]);

  const { data: modulos } = useQuery({
    queryKey: ["modulos-all"],
    queryFn: async () => (await supabase.from("modulos").select("id,nome,slug").eq("ativo", true).order("ordem")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      await invokeAdminFn("admin-create-user", {
        email,
        password,
        display_name: displayName,
        is_admin: isAdmin,
        modulo_ids: mods.map((m) => m.modulo_id),
        modulo_admin_ids: mods.filter((m) => m.is_admin).map((m) => m.modulo_id),
      });
    },
    onSuccess: () => { toast.success("Usuário criado"); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar usuário"),
  });
    onSuccess: () => { toast.success("Usuário criado"); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar usuário"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Senha</Label><PasswordInput value={password} onChange={setPassword} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isAdmin} onCheckedChange={(v) => setIsAdmin(!!v)} />
            <span className="text-sm font-medium">Administrador (acessa tudo)</span>
          </label>
          <div className={isAdmin ? "opacity-40 pointer-events-none" : ""}>
            <div className="text-xs uppercase text-muted-foreground mb-2">Módulos liberados</div>
            <ModuleAccessList modulos={(modulos ?? []) as any} value={mods} onChange={setMods} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !email || !password}>Criar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAccess({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(user.roles.includes("admin"));
  const [mods, setMods] = useState<ModAccess[]>(user.modulos as ModAccess[]);
  const [displayName, setDisplayName] = useState<string>(user.display_name ?? "");
  const [email, setEmail] = useState<string>(user.email ?? "");
  const [password, setPassword] = useState<string>("");

  const updateAccount = useMutation({
    mutationFn: async () => {
      const payload: any = { user_id: user.id };
      if (displayName !== (user.display_name ?? "")) payload.display_name = displayName;
      if (email && email !== user.email) payload.email = email;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 1) return;
      await invokeAdminFn("admin-update-user", payload);
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const { data: modulos } = useQuery({
    queryKey: ["modulos-all"],
    queryFn: async () => (await supabase.from("modulos").select("id,nome,slug").eq("ativo", true).order("ordem")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      await supabase.from("user_roles").insert({ user_id: user.id, role: isAdmin ? "admin" : "user" });
      await supabase.from("user_modulos").delete().eq("user_id", user.id);
      if (!isAdmin && mods.length) {
        await supabase.from("user_modulos").insert(
          mods.map((m) => ({ user_id: user.id, modulo_id: m.modulo_id, is_admin: m.is_admin })),
        );
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
          <div className="space-y-3 border-b border-border pb-4">
            <div className="text-xs uppercase text-muted-foreground">Conta</div>
            <div><Label>Nome</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Nova senha</Label><PasswordInput value={password} onChange={setPassword} placeholder="Deixe em branco para manter" /></div>
            <Button size="sm" variant="outline" onClick={() => updateAccount.mutate()} disabled={updateAccount.isPending}>
              Atualizar conta
            </Button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isAdmin} onCheckedChange={(v) => setIsAdmin(!!v)} />
            <span className="text-sm font-medium">Administrador (acessa tudo)</span>
          </label>
          <div className={isAdmin ? "opacity-40 pointer-events-none" : ""}>
            <div className="text-xs uppercase text-muted-foreground mb-2">Módulos liberados</div>
            <ModuleAccessList modulos={(modulos ?? []) as any} value={mods} onChange={setMods} />
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
