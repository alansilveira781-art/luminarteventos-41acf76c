import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, History, Pencil } from "lucide-react";
import { ItemForm } from "@/components/forms/ItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque/")({
  component: EstoquePage,
});

function EstoquePage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("itens").select("*").order("nome").limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("itens").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("itens").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Item salvo");
      setEditing(null);
      setCreating(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!itens) return [];
    const s = q.toLowerCase().trim();
    if (!s) return itens;
    return itens.filter(
      (i) =>
        i.nome.toLowerCase().includes(s) ||
        i.codigo.toLowerCase().includes(s) ||
        (i.categoria ?? "").toLowerCase().includes(s) ||
        (i.localizacao ?? "").toLowerCase().includes(s) ||
        i.status.includes(s),
    );
  }, [itens, q]);

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Cadastro e consulta de itens"
        actions={
          <Button type="button" size="lg" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo item
          </Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, categoria, localização, status…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Localização</th>
                <th className="px-4 py-3 font-medium text-right">Qtd</th>
                <th className="px-4 py-3 font-medium text-right">Mín</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum item encontrado.</td></tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{i.codigo}</td>
                    <td className="px-4 py-3 font-medium">{i.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.localizacao ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(i.quantidade_atual)} {i.unidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(i.quantidade_minima)}</td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/estoque/$itemId" params={{ itemId: i.id }}>
                            <History className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle>
          </DialogHeader>
          <ItemForm
            initial={editing}
            onSubmit={(payload) => mut.mutate(editing ? { ...payload, id: editing.id } : payload)}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
