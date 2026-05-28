import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { normalize } from "@/lib/utils";

export const Route = createFileRoute("/financeiro/eventos")({
  component: EventosPage,
});

const sb = supabase as any;

type Evento = {
  id: string;
  nome: string;
  codigo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  local: string | null;
  uf: string | null;
  produtor: string | null;
  montagem_inicio: string | null;
  montagem_fim: string | null;
  desmontagem_inicio: string | null;
  desmontagem_fim: string | null;
  observacoes: string | null;
};

const empty: Partial<Evento> = {};

function EventosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Evento> | null>(null);
  const [search, setSearch] = useState("");

  const { data: eventos = [] } = useQuery({
    queryKey: ["eventos_projetos_full"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("eventos_projetos")
        .select("*")
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("eventos_projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos_projetos_full"] });
      qc.invalidateQueries({ queryKey: ["opts-eventos_projetos"] });
      toast.success("Evento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return eventos;
    return eventos.filter((e) => {
      const h = normalize(
        [e.nome, e.codigo, e.local, e.uf, e.produtor].filter(Boolean).join(" ")
      );
      return terms.every((t) => h.includes(t));
    });
  }, [eventos, search]);

  return (
    <>
      <PageHeader
        title="Eventos / Projetos"
        description="Cadastro de eventos e projetos usados em todos os módulos"
        actions={
          <Button onClick={() => setEditing(empty)}>
            <Plus className="h-4 w-4 mr-1" /> Novo evento
          </Button>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, local, produtor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 px-2">Nome</th>
                <th className="text-left py-2 px-2">Período</th>
                <th className="text-left py-2 px-2">Local</th>
                <th className="text-left py-2 px-2">UF</th>
                <th className="text-left py-2 px-2">Produtor</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum evento.
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-2 select-text">
                    <div className="font-medium">{e.nome}</div>
                    {e.codigo && (
                      <div className="text-xs text-muted-foreground">{e.codigo}</div>
                    )}
                  </td>
                  <td className="py-2 px-2 select-text">{formatPeriodo(e.data_inicio, e.data_fim)}</td>
                  <td className="py-2 px-2 select-text">{e.local ?? "—"}</td>
                  <td className="py-2 px-2 select-text">{e.uf ?? "—"}</td>
                  <td className="py-2 px-2 select-text">{e.produtor ?? "—"}</td>
                  <td className="py-2 px-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover "${e.nome}"?`)) remove.mutate(e.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <EventoDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["eventos_projetos_full"] });
            qc.invalidateQueries({ queryKey: ["opts-eventos_projetos"] });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function formatPeriodo(ini?: string | null, fim?: string | null) {
  const f = (d?: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : null;
  const a = f(ini);
  const b = f(fim);
  if (a && b && a !== b) return `${a} → ${b}`;
  return a ?? b ?? "—";
}

function EventoDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<Evento>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Evento>>(initial);
  const set = <K extends keyof Evento>(k: K, v: Evento[K] | null) =>
    setForm((f) => ({ ...f, [k]: v as any }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome?.trim()) throw new Error("Nome é obrigatório");
      const payload: any = {
        nome: form.nome.trim(),
        codigo: form.codigo || null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        local: form.local || null,
        uf: form.uf || null,
        produtor: form.produtor || null,
        montagem_inicio: form.montagem_inicio || null,
        montagem_fim: form.montagem_fim || null,
        desmontagem_inicio: form.desmontagem_inicio || null,
        desmontagem_fim: form.desmontagem_fim || null,
        observacoes: form.observacoes || null,
      };
      if (form.id) {
        const { error } = await sb.from("eventos_projetos").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("eventos_projetos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Evento salvo");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar evento / projeto" : "Novo evento / projeto"}</DialogTitle>
        </DialogHeader>

        <><h3 className="text-sm font-semibold mt-4 mb-2">Identificação</h3><FormSection>
          <FormField label="Nome do evento" >
            <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
          </FormField>
          <FormField label="Código">
            <Input
              value={form.codigo ?? ""}
              onChange={(e) => set("codigo", e.target.value)}
              placeholder="ex: 46115"
            />
          </FormField>
        </FormSection></>

        <><h3 className="text-sm font-semibold mt-4 mb-2">Período</h3><FormSection>
          <FormField label="Início">
            <Input
              type="date"
              value={form.data_inicio ?? ""}
              onChange={(e) => set("data_inicio", e.target.value)}
            />
          </FormField>
          <FormField label="Final">
            <Input
              type="date"
              value={form.data_fim ?? ""}
              onChange={(e) => set("data_fim", e.target.value)}
            />
          </FormField>
        </FormSection></>

        <><h3 className="text-sm font-semibold mt-4 mb-2">Local</h3><FormSection>
          <FormField label="Local">
            <Input value={form.local ?? ""} onChange={(e) => set("local", e.target.value)} />
          </FormField>
          <FormField label="UF / Cidade">
            <Input
              value={form.uf ?? ""}
              onChange={(e) => set("uf", e.target.value)}
              placeholder="ex: Fortaleza/CE"
            />
          </FormField>
          <FormField label="Produtor">
            <Input value={form.produtor ?? ""} onChange={(e) => set("produtor", e.target.value)} />
          </FormField>
        </FormSection></>

        <><h3 className="text-sm font-semibold mt-4 mb-2">Montagem</h3><FormSection>
          <FormField label="Início montagem">
            <Input
              type="date"
              value={form.montagem_inicio ?? ""}
              onChange={(e) => set("montagem_inicio", e.target.value)}
            />
          </FormField>
          <FormField label="Final montagem">
            <Input
              type="date"
              value={form.montagem_fim ?? ""}
              onChange={(e) => set("montagem_fim", e.target.value)}
            />
          </FormField>
        </FormSection></>

        <><h3 className="text-sm font-semibold mt-4 mb-2">Desmontagem</h3><FormSection>
          <FormField label="Início desmontagem">
            <Input
              type="date"
              value={form.desmontagem_inicio ?? ""}
              onChange={(e) => set("desmontagem_inicio", e.target.value)}
            />
          </FormField>
          <FormField label="Final desmontagem">
            <Input
              type="date"
              value={form.desmontagem_fim ?? ""}
              onChange={(e) => set("desmontagem_fim", e.target.value)}
            />
          </FormField>
        </FormSection></>

        <><h3 className="text-sm font-semibold mt-4 mb-2">Observações</h3><FormSection>
          <FormField label="Observações" wide>
            <Textarea
              rows={4}
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </FormField>
        </FormSection></>

        <FormActions>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </FormActions>
      </DialogContent>
    </Dialog>
  );
}
