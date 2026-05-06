import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, History, Pencil, Upload, Trash2 } from "lucide-react";
import { ItemForm } from "@/components/forms/ItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportDialog } from "@/components/ImportDialog";
import { ITEM_TEMPLATE } from "@/lib/import-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque/")({
  component: EstoquePage,
});

function EstoquePage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      // remove dependent movements first to avoid FK/constraint surprises
      await supabase.from("movimentacao_itens").delete().eq("item_id", id);
      await supabase.from("movimentacoes").delete().eq("item_id", id);
      const { error } = await supabase.from("itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      toast.success("Item excluído");
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
          <>
            <Button type="button" size="lg" variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4 mr-1" /> Nova importação
            </Button>
            <Button type="button" size="lg" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo item
            </Button>
          </>
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
                <th className="px-4 py-3 font-medium text-left">Código</th>
                <th className="px-4 py-3 font-medium text-left">Item</th>
                <th className="px-4 py-3 font-medium text-left">Categoria</th>
                <th className="px-4 py-3 font-medium text-left">Localização</th>
                <th className="px-4 py-3 font-medium text-right">Qtd</th>
                <th className="px-4 py-3 font-medium text-left">UN</th>
                <th className="px-4 py-3 font-medium text-right">Mín</th>
                <th className="px-4 py-3 font-medium text-left">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum item encontrado.</td></tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{i.codigo}</td>
                    <td className="px-4 py-3 font-medium">{i.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.localizacao ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(i.quantidade_atual)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.unidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(i.quantidade_minima)}</td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/estoque/$itemId" params={{ itemId: i.id }}>
                            <History className="h-4 w-4" />
                          </Link>
                        </Button>
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Excluir o item "${i.nome}"? Esta ação não pode ser desfeita.`)) {
                                  delMut.mutate(i.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
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
            allowEditCodigo={isAdmin}
            onSubmit={(payload) => mut.mutate(editing ? { ...payload, id: editing.id } : payload)}
            submitting={mut.isPending}
          />
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        title="Importar itens"
        description="Envie uma planilha (.xlsx, .xls ou .csv) com os itens a serem cadastrados. Itens com código já existente serão ignorados."
        templateFilename="modelo_itens.xlsx"
        templateHeaders={ITEM_TEMPLATE.headers}
        templateExample={ITEM_TEMPLATE.example}
        onImport={async (rows) => {
          const errors: string[] = [];
          let inserted = 0, skipped = 0;
          const { data: existentes } = await supabase.from("itens").select("codigo");
          const setCodigos = new Set((existentes ?? []).map((i: any) => String(i.codigo).toLowerCase()));
          for (const [idx, r] of rows.entries()) {
            const codigo = String(r.codigo ?? "").trim();
            const nome = String(r.nome ?? "").trim();
            if (!codigo || !nome) { skipped++; errors.push(`Linha ${idx + 2}: código e nome obrigatórios`); continue; }
            if (setCodigos.has(codigo.toLowerCase())) { skipped++; continue; }
            const payload = {
              codigo, nome,
              codigo_proprio: r.codigo_proprio || null,
              categoria: r.categoria || null,
              subcategoria: r.subcategoria || null,
              unidade: String(r.unidade || "Unidade"),
              valor_unitario: r.valor_unitario ? Number(r.valor_unitario) : null,
              quantidade_atual: Number(r.quantidade_atual || 0),
              quantidade_minima: Number(r.quantidade_minima || 0),
              localizacao: r.localizacao || null,
              descricao: r.descricao || null,
              observacoes: r.observacoes || null,
              foto_url: r.foto_url || null,
            };
            const { error } = await supabase.from("itens").insert(payload);
            if (error) { skipped++; errors.push(`Linha ${idx + 2}: ${error.message}`); }
            else { inserted++; setCodigos.add(codigo.toLowerCase()); }
          }
          qc.invalidateQueries({ queryKey: ["itens"] });
          return { inserted, skipped, errors };
        }}
      />
    </>
  );
}
