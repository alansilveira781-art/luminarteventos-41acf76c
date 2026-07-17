import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/MoneyInput";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/financeiro-op/diaristas/configuracoes")({
  component: DiaristasConfiguracoes,
});

type Diarista = {
  id: string;
  nome: string;
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  chave_pix: string | null;
  ativo: boolean;
};

type DiaristaForm = {
  id?: string;
  nome: string;
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  chave_pix: string;
  ativo: boolean;
};

const emptyForm: DiaristaForm = {
  nome: "",
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
  const { isAdmin, modulos } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro_op" && m.is_admin);
  if (!isFinAdmin) return <Navigate to="/financeiro-op/diaristas" />;

  const qc = useQueryClient();
  const { data = [], isLoading } = useDiaristas();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiaristaForm>(emptyForm);

  const upsert = useMutation({
    mutationFn: async (payload: DiaristaForm) => {
      const row = {
        nome: payload.nome.trim(),
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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Configurações — Diaristas"
        description="Cadastre diaristas com valor/hora por localidade e chave Pix. Estes dados serão usados no apontamento e fechamento."
      />

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
                  <th className="py-2 pr-3">Nome</th>
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
                    <td className="py-2 pr-3 font-medium">{d.nome}</td>
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
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={editing.nome}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                placeholder="Nome do diarista"
                autoFocus
              />
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
