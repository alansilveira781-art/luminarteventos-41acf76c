import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDiaristaAcesso } from "@/lib/diaristas-acesso";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/MoneyInput";
import { supabase } from "@/integrations/supabase/client";
import { useDiaristaConfig, DIARISTA_CONFIG_KEY } from "@/lib/diaristas-config";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/financeiro-op/diaristas/configuracoes")({
  component: DiaristasConfiguracoes,
});

type Diarista = {
  id: string;
  nome: string;
  apelido: string | null;
  departamento: string | null;
  colaborador_id: string | null;
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  chave_pix: string | null;
  ativo: boolean;
};

type DiaristaForm = {
  id?: string;
  nome: string;
  apelido: string;
  departamento: string;
  colaborador_id: string | null;
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  chave_pix: string;
  ativo: boolean;
};

const SEM_DEPTO = "__sem";
const SEM_COLAB = "__nenhum";

type Colaborador = {
  id: string;
  nome: string;
  apelido: string | null;
  departamento: string | null;
};

const emptyForm: DiaristaForm = {
  nome: "",
  apelido: "",
  departamento: "",
  colaborador_id: null,
  valor_hora_fortaleza: 0,
  valor_hora_fora: 0,
  chave_pix: "",
  ativo: true,
};

function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function useColaboradores() {
  return useQuery({
    queryKey: ["rh-colaboradores-diaristas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rh_colaboradores")
        .select("id,nome,apelido,departamento")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });
}


function useDiaristas() {
  return useQuery({
    queryKey: ["diaristas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diaristas")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Diarista[];
    },
  });
}

function DiaristasConfiguracoes() {
  const { isFinAdmin, podeLancar, loading: loadingAcesso } = useDiaristaAcesso();

  const qc = useQueryClient();
  const { data = [], isLoading } = useDiaristas();
  const { data: colaboradores = [] } = useColaboradores();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiaristaForm>(emptyForm);

  const upsert = useMutation({
    mutationFn: async (payload: DiaristaForm) => {
      const row = {
        nome: payload.nome.trim(),
        apelido: payload.apelido.trim() || null,
        departamento: payload.departamento.trim() || null,
        colaborador_id: payload.colaborador_id || null,
        valor_hora_fortaleza: Number(payload.valor_hora_fortaleza) || 0,
        valor_hora_fora: Number(payload.valor_hora_fora) || 0,
        chave_pix: payload.chave_pix.trim() || null,
        ativo: payload.ativo,
      };
      if (payload.id) {
        const { error } = await (supabase as any)
          .from("diaristas")
          .update(row)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("diaristas").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Diarista salvo");
      qc.invalidateQueries({ queryKey: ["diaristas"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("diaristas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diarista removido");
      qc.invalidateQueries({ queryKey: ["diaristas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from("diaristas")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diaristas"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const rows = useMemo(() => data, [data]);

  if (loadingAcesso) return null;
  if (!isFinAdmin && !podeLancar) return <Navigate to="/financeiro-op/diaristas" />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/financeiro-op/diaristas">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
        </Button>
        <PageHeader
          title={isFinAdmin ? "Configurações — Diaristas" : "Cadastro de diaristas"}
          description={
            isFinAdmin
              ? "Cadastre diaristas com valor/hora por localidade e chave Pix. Estes dados serão usados no apontamento e fechamento."
              : "Cadastre os diaristas que você vai usar nos lançamentos. Os valores por hora são definidos pelo financeiro."
          }
        />
      </div>

      {isFinAdmin && <LancadoresCard />}

      {isFinAdmin && <RefeicoesCard />}


      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Diaristas cadastrados</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditing(emptyForm);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo diarista
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum diarista cadastrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">Apelido</th>
                  <th className="py-2 px-3">Nome</th>
                  <th className="py-2 px-3">Departamento</th>
                  <th className="py-2 px-3 text-right">R$/h Fortaleza</th>

                  <th className="py-2 px-3 text-right">Diária Fortaleza (8h)</th>
                  <th className="py-2 px-3 text-right">R$/h Fora</th>
                  <th className="py-2 px-3 text-right">Diária Fora (8h)</th>
                  <th className="py-2 px-3">Chave Pix</th>
                  <th className="py-2 px-3 text-center">Ativo</th>
                  <th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="py-2 pr-3 font-medium">{d.apelido || "—"}</td>
                    <td className="py-2 px-3">{d.nome}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{d.departamento || "—"}</td>


                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmtBRL(Number(d.valor_hora_fortaleza))}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {fmtBRL(Number(d.valor_hora_fortaleza) * 8)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmtBRL(Number(d.valor_hora_fora))}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {fmtBRL(Number(d.valor_hora_fora) * 8)}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {d.chave_pix || "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Switch
                        checked={d.ativo}
                        onCheckedChange={(v) =>
                          toggleAtivo.mutate({ id: d.id, ativo: v })
                        }
                      />
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing({
                              id: d.id,
                              nome: d.nome,
                              apelido: d.apelido ?? "",
                              departamento: d.departamento ?? "",
                              colaborador_id: d.colaborador_id ?? null,
                              valor_hora_fortaleza: Number(d.valor_hora_fortaleza) || 0,
                              valor_hora_fora: Number(d.valor_hora_fora) || 0,
                              chave_pix: d.chave_pix ?? "",
                              ativo: d.ativo,
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover diarista "${d.nome}"?`)) {
                              remove.mutate(d.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar diarista" : "Novo diarista"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Apelido</Label>
                <Input
                  value={editing.apelido}
                  onChange={(e) => setEditing({ ...editing, apelido: e.target.value })}
                  placeholder="Como é chamado (opcional)"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome do diarista</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Colaborador (RH)</Label>
                <Select
                  value={editing.colaborador_id ?? SEM_COLAB}
                  onValueChange={(v) => {
                    if (v === SEM_COLAB) {
                      setEditing({ ...editing, colaborador_id: null });
                      return;
                    }
                    const c = colaboradores.find((x) => x.id === v);
                    setEditing({
                      ...editing,
                      colaborador_id: v,
                      nome: c?.nome ?? editing.nome,
                      apelido: editing.apelido || (c?.apelido ?? ""),
                      departamento: c?.departamento ?? editing.departamento,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_COLAB}>Nenhum (opcional)</SelectItem>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">
                  Ao escolher, o nome é preenchido pelo cadastro do RH.
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select
                  value={editing.departamento || SEM_DEPTO}
                  onValueChange={(v) =>
                    setEditing({ ...editing, departamento: v === SEM_DEPTO ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_DEPTO}>Sem departamento</SelectItem>
                    {DEPARTAMENTOS.map((dep) => (
                      <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor/Hora Fortaleza</Label>
                <MoneyInput
                  value={editing.valor_hora_fortaleza}
                  onChange={(v) => setEditing({ ...editing, valor_hora_fortaleza: v })}
                />
                <div className="text-[11px] text-muted-foreground">
                  Diária (8h): {fmtBRL(editing.valor_hora_fortaleza * 8)}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Valor/Hora Fora</Label>
                <MoneyInput
                  value={editing.valor_hora_fora}
                  onChange={(v) => setEditing({ ...editing, valor_hora_fora: v })}
                />
                <div className="text-[11px] text-muted-foreground">
                  Diária (8h): {fmtBRL(editing.valor_hora_fora * 8)}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Chave Pix</Label>
              <Input
                value={editing.chave_pix}
                onChange={(e) => setEditing({ ...editing, chave_pix: e.target.value })}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <div className="text-xs text-muted-foreground">
                  Diaristas inativos ficam ocultos no apontamento.
                </div>
              </div>
              <Switch
                checked={editing.ativo}
                onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editing.nome.trim()) {
                  toast.error("Informe o nome");
                  return;
                }
                upsert.mutate(editing);
              }}
              disabled={upsert.isPending}
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Liberação de acesso ao lançamento de diárias
// ─────────────────────────────────────────────────────────────

type PerfilRow = { id: string; email: string | null; display_name: string | null };

function RefeicoesCard() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useDiaristaConfig();
  const [almoco, setAlmoco] = useState<number | null>(null);
  const [janta, setJanta] = useState<number | null>(null);

  const vAlmoco = almoco ?? config?.valor_almoco ?? 0;
  const vJanta = janta ?? config?.valor_janta ?? 0;

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("diarista_config")
        .upsert(
          { id: true, valor_almoco: vAlmoco, valor_janta: vJanta },
          { onConflict: "id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valores de refeição salvos");
      qc.invalidateQueries({ queryKey: DIARISTA_CONFIG_KEY });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold mb-1">Valores de refeição</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Valores gerais somados ao total do dia quando o almoço ou a janta forem marcados no apontamento.
      </p>
      {isLoading ? (
        <div className="p-4 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <div className="space-y-1">
            <Label>Valor do almoço</Label>
            <MoneyInput value={vAlmoco} onChange={(v) => setAlmoco(v)} />
          </div>
          <div className="space-y-1">
            <Label>Valor da janta</Label>
            <MoneyInput value={vJanta} onChange={(v) => setJanta(v)} />
          </div>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar valores
          </Button>
        </div>
      )}
    </Card>
  );
}

function LancadoresCard() {

  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const { data: perfis = [] } = useQuery({
    queryKey: ["diarista-lancadores-perfis"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id,email,display_name")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PerfilRow[];
    },
  });

  const { data: liberados = [], isLoading } = useQuery({
    queryKey: ["diarista-lancadores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diarista_lancadores")
        .select("user_id");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.user_id as string);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, liberar }: { userId: string; liberar: boolean }) => {
      if (liberar) {
        const { error } = await (supabase as any)
          .from("diarista_lancadores")
          .insert({ user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("diarista_lancadores")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diarista-lancadores"] });
      qc.invalidateQueries({ queryKey: ["diarista-lancador"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao alterar acesso"),
  });

  const set = new Set(liberados);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? perfis.filter(
          (p) =>
            (p.display_name ?? "").toLowerCase().includes(q) ||
            (p.email ?? "").toLowerCase().includes(q),
        )
      : perfis;
    // Liberados primeiro
    return [...lista].sort(
      (a, b) => Number(set.has(b.id)) - Number(set.has(a.id)),
    );
  }, [perfis, busca, liberados]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-sm font-semibold">Quem pode lançar diárias</h2>
        <Input
          className="max-w-xs"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar usuário"
        />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Os usuários liberados veem a aba Diaristas, cadastram novos diaristas e lançam,
        editam e excluem apenas os próprios lançamentos — sem acesso a valores nem ao fechamento.
      </p>

      {isLoading ? (
        <div className="p-6 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
          {filtrados.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {p.display_name || p.email || p.id}
                </div>
                {p.display_name && p.email && (
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                )}
              </div>
              <Switch
                checked={set.has(p.id)}
                onCheckedChange={(v) => toggle.mutate({ userId: p.id, liberar: v })}
              />
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
