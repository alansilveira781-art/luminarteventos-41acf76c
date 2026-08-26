import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/eventos/configuracoes")({
  component: EventosConfiguracoes,
});

const sb = supabase as any;

type Produtor = { id: string; nome: string };

function EventosConfiguracoes() {
  const { isAdmin, hasModule, loading } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produtor | null>(null);
  const [nome, setNome] = useState("");

  const { data: produtores = [] } = useQuery({
    queryKey: ["produtores"],
    queryFn: async () => {
      const { data, error } = await sb.from("produtores").select("id,nome").order("nome");
      if (error) throw error;
      return (data ?? []) as Produtor[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const nomeTrim = nome.trim();
      if (!nomeTrim) throw new Error("Informe o nome do produtor");
      if (editing) {
        const { error } = await sb
          .from("produtores")
          .update({ nome: nomeTrim })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("produtores").insert({ nome: nomeTrim });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produtor salvo");
      qc.invalidateQueries({ queryKey: ["produtores"] });
      setOpen(false);
      setEditing(null);
      setNome("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("produtores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produtor excluído");
      qc.invalidateQueries({ queryKey: ["produtores"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  if (loading) return null;
  if (!isAdmin && !hasModule("eventos")) return <Navigate to="/" />;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Configurações de Eventos"
        description="Cadastro de produtores"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setNome("");
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Novo produtor
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtores.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.nome}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(p);
                      setNome(p.nome);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Excluir produtor "${p.nome}"?`)) excluir.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {produtores.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum produtor cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {open && (
        <Dialog open onOpenChange={(v) => !v && setOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produtor" : "Novo produtor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do produtor"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
