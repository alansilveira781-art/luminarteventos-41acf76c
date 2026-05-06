import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/luminart-logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const nav = useNavigate();

  if (loading) return null;
  if (session) return <Navigate to="/" />;
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Luminart" className="h-16 w-16 object-contain" />
          <h1 className="mt-3 text-xl font-semibold">Luminart</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Painel interno</p>
        </div>
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login"><LoginForm onDone={() => nav({ to: "/" })} /></TabsContent>
          <TabsContent value="signup"><SignupForm /></TabsContent>
        </Tabs>
        <div className="my-4 flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton />
      </Card>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-3 mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        setLoading(false);
        if (error) return toast.error(error.message);
        onDone();
      }}
    >
      <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" required placeholder="Senha" value={pwd} onChange={(e) => setPwd(e.target.value)} />
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</Button>
    </form>
  );
}

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-3 mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signUp({
          email,
          password: pwd,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }}
    >
      <Input required placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" required minLength={6} placeholder="Senha (mín. 6)" value={pwd} onChange={(e) => setPwd(e.target.value)} />
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando…" : "Criar conta"}</Button>
    </form>
  );
}

function GoogleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
        if (error) toast.error(error.message);
      }}
    >
      Entrar com Google
    </Button>
  );
}
