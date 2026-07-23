import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/operacao/setores")({ component: SetoresPage });

const sb = supabase as any;

type Setor = { id: string; nome: string; slug: string; ordem: number; ativo: boolean; responsavel_id: string | null };
type Etapa = { id: string; setor_id: string; nome: string; ordem: number; ativo: boolean };
type Profile = { id: string; nome: string | null; email: string | null };

function SetoresPage() {
  const qc = useQueryClient();
  const { isAdmin, isModuleAdmin } = useAuth();
  if (!isAdmin && !isModuleAdmin("operacao")) return <Navigate to="/operacao" />;

  const { data: setores = [] } = useQuery<Setor[]>({
    queryKey: ["op_setores_all"],
    queryFn: async () => (await sb.from("op_setores").select("*").order("ordem")).data ?? [],
  });
  const { data: etapasAll = [] } = useQuery<Etapa[]>({
    queryKey: ["op_etapas_all"],
    queryFn: async () => (await sb.from("op_setor_etapas").select("*").order("ordem")).data ?? [],
  });
  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles_min"],
    queryFn: async () => (await sb.from("profiles").select("id,nome,email").order("nome")).data ?? [],
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["op_setores_all"] });
    qc.invalidateQueries({ queryKey: ["op_setores"] });
    qc.invalidateQueries({ queryKey: ["op_etapas_all"] });
  };

  async function addSetor() {
    const nome = prompt("Nome do setor")?.trim();
    if (!nome) return;
    const slug = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
    const ordem = (setores[setores.length - 1]?.ordem ?? 0) + 10;
    const { error } = await sb.from("op_setores").insert({ nome, slug, ordem, ativo: true });
    if (error) toast.error(error.message); else inv();
  }
  async function addEtapa(setor_id: string) {
    const nome = prompt("Nome da etapa")?.trim();
    if (!nome) return;
    const et = etapasAll.filter((e) => e.setor_id === setor_id);
    const ordem = (et[et.length - 1]?.ordem ?? 0) + 10;
    const { error } = await sb.from("op_setor_etapas").insert({ setor_id, nome, ordem, ativo: true });
    if (error) toast.error(error.message); else inv();
  }
  async function swap(a: Etapa, b: Etapa) {
    await sb.from("op_setor_etapas").update({ ordem: b.ordem }).eq("id", a.id);
    await sb.from("op_setor_etapas").update({ ordem: a.ordem }).eq("id", b.id);
    inv();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Setores e etapas"
        description="Configure roteiros de produção por setor"
        actions={<Button onClick={addSetor}><Plus className="h-4 w-4 mr-1" /> Novo setor</Button>}
      />
      <div className="space-y-4">
        {setores.map((s) => {
          const etapas = etapasAll.filter((e) => e.setor_id === s.id);
          return (
            <div key={s.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Input className="w-64" value={s.nome} onChange={async (e) => {
                    await sb.from("op_setores").update({ nome: e.target.value }).eq("id", s.id);
                    inv();
                  }} />
                  <Label className="text-xs">Responsável:</Label>
                  <Select value={s.responsavel_id ?? "__none__"} onValueChange={async (v) => {
                    await sb.from("op_setores").update({ responsavel_id: v === "__none__" ? null : v }).eq("id", s.id);
                    inv();
                  }}>
                    <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— nenhum —</SelectItem>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome ?? p.email ?? p.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addEtapa(s.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
                  </Button>
                  <Button size="sm" variant={s.ativo ? "outline" : "default"} onClick={async () => {
                    await sb.from("op_setores").update({ ativo: !s.ativo }).eq("id", s.id);
                    inv();
                  }}>{s.ativo ? "Desativar" : "Ativar"}</Button>
                </div>
              </div>
              <div className="grid gap-1">
                {etapas.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-muted-foreground w-8">#{i + 1}</span>
                    <Input className="flex-1 h-8" value={e.nome} onChange={async (ev) => {
                      await sb.from("op_setor_etapas").update({ nome: ev.target.value }).eq("id", e.id);
                      inv();
                    }} />
                    <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => swap(e, etapas[i - 1])}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={i === etapas.length - 1} onClick={() => swap(e, etapas[i + 1])}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm("Excluir etapa?")) return;
                      const { error } = await sb.from("op_setor_etapas").delete().eq("id", e.id);
                      if (error) return toast.error(error.message);
                      inv();
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
