import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/operacao/setores")({ component: SetoresPage });

const sb = supabase as any;

type Setor = {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  ativo: boolean;
  fixo: boolean;
  responsavel_id: string | null;
  dias_medios: number | null;
};
type Etapa = { id: string; setor_id: string; nome: string; descricao: string | null; ordem: number; ativo: boolean };
type Profile = { id: string; display_name: string | null; email: string | null };

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
    queryFn: async () => (await sb.from("profiles").select("id,display_name,email").order("display_name")).data ?? [],
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
        description="Configure roteiros de produção por setor. Preparação e Executivo são setores fixos e vêm sempre primeiro."
        actions={<Button onClick={addSetor}><Plus className="h-4 w-4 mr-1" /> Novo setor</Button>}
      />
      <div className="space-y-4">
        {setores.map((s) => {
          const etapas = etapasAll.filter((e) => e.setor_id === s.id);
          return (
            <div key={s.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {s.fixo && (
                    <span
                      title="Setor fixo do início do processo"
                      className="flex items-center gap-1 text-[10px] uppercase rounded-full border px-2 py-0.5 text-muted-foreground"
                    >
                      <Lock className="h-3 w-3" /> fixo
                    </span>
                  )}
                  <Input className="w-64" value={s.nome} disabled={s.fixo} onChange={async (e) => {
                    await sb.from("op_setores").update({ nome: e.target.value }).eq("id", s.id);
                    inv();
                  }} />
                  <Label className="text-xs whitespace-nowrap">Tempo médio (dias):</Label>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8"
                    defaultValue={s.dias_medios ?? 0}
                    onBlur={async (e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      await sb.from("op_setores").update({ dias_medios: v }).eq("id", s.id);
                      inv();
                    }}
                  />

                  <Label className="text-xs">Responsável:</Label>
                  <Select value={s.responsavel_id ?? "__none__"} onValueChange={async (v) => {
                    await sb.from("op_setores").update({ responsavel_id: v === "__none__" ? null : v }).eq("id", s.id);
                    inv();
                  }}>
                    <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— nenhum —</SelectItem>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.email ?? p.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addEtapa(s.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
                  </Button>
                  {!s.fixo && (
                    <Button size="sm" variant={s.ativo ? "outline" : "default"} onClick={async () => {
                      await sb.from("op_setores").update({ ativo: !s.ativo }).eq("id", s.id);
                      inv();
                    }}>{s.ativo ? "Desativar" : "Ativar"}</Button>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                {etapas.map((e, i) => (
                  <EtapaRow
                    key={e.id}
                    etapa={e}
                    index={i}
                    primeira={i === 0}
                    ultima={i === etapas.length - 1}
                    onUp={() => swap(e, etapas[i - 1])}
                    onDown={() => swap(e, etapas[i + 1])}
                    onChanged={inv}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EtapaRow({
  etapa,
  index,
  primeira,
  ultima,
  onUp,
  onDown,
  onChanged,
}: {
  etapa: Etapa;
  index: number;
  primeira: boolean;
  ultima: boolean;
  onUp: () => void;
  onDown: () => void;
  onChanged: () => void;
}) {
  const [nome, setNome] = useState(etapa.nome);
  const [descricao, setDescricao] = useState(etapa.descricao ?? "");

  useEffect(() => {
    setNome(etapa.nome);
    setDescricao(etapa.descricao ?? "");
  }, [etapa.id, etapa.nome, etapa.descricao]);

  async function salvar(patch: Record<string, any>) {
    const { error } = await sb.from("op_setor_etapas").update(patch).eq("id", etapa.id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  return (
    <div className="rounded border p-2 space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground w-8">#{index + 1}</span>
        <Input
          className="flex-1 h-8"
          value={nome}
          onChange={(ev) => setNome(ev.target.value)}
          onBlur={() => nome !== etapa.nome && salvar({ nome })}
        />
        <Button size="icon" variant="ghost" disabled={primeira} onClick={onUp}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" disabled={ultima} onClick={onDown}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={async () => {
          if (!confirm("Excluir etapa?")) return;
          const { error } = await sb.from("op_setor_etapas").delete().eq("id", etapa.id);
          if (error) return toast.error(error.message);
          onChanged();
        }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="pl-10">
        <Textarea
          rows={2}
          className="text-sm"
          placeholder="Descrição: o que deve ser feito nesta etapa"
          value={descricao}
          onChange={(ev) => setDescricao(ev.target.value)}
          onBlur={() => (descricao || null) !== (etapa.descricao ?? null) && salvar({ descricao: descricao || null })}
        />
      </div>
    </div>
  );
}
