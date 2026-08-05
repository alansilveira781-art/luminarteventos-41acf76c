import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_EVENTO } from "@/lib/comercial/types";
import {
  useProdutores, useProdutorMutations, useAlcadas, useAlcadaMutation,
} from "@/lib/comercial/bonificacao";

type CrudRow = {
  id: string;
  cells: React.ReactNode[];
  onEdit: () => void;
  onDelete: () => void;
};

function CrudTable({
  columns, rows, isLoading, empty,
}: { columns: string[]; rows: CrudRow[]; isLoading?: boolean; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left">
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Carregando...
            </td></tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">{empty}</td></tr>
          )}
          {!isLoading && rows.map((r) => (
            <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30">
              {r.cells.map((c, i) => <td key={i} className="px-3 py-2 align-middle">{c}</td>)}
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Button variant="ghost" size="icon" onClick={r.onEdit} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={r.onDelete} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProdutoresCard() {
  const { data = [], isLoading } = useProdutores();
  const { upsert, remove } = useProdutorMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; nome: string; ativo: boolean } | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Produtores</h2>
        <Button size="sm" onClick={() => { setEditing({ nome: "", ativo: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo produtor
        </Button>
      </div>
      <CrudTable
        isLoading={isLoading}
        empty="Nenhum produtor cadastrado."
        columns={["Nome", "Ativo", ""]}
        rows={data.map((v) => ({
          id: v.id,
          cells: [v.nome, v.ativo ? "Sim" : "Não"],
          onEdit: () => { setEditing({ id: v.id, nome: v.nome, ativo: v.ativo }); setOpen(true); },
          onDelete: () => {
            if (confirm(`Excluir produtor "${v.nome}"?`))
              remove.mutate(v.id, { onSuccess: () => toast.success("Produtor excluído") });
          },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar produtor" : "Novo produtor"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const nome = editing.nome.trim();
                if (!nome) return toast.error("Informe o nome");
                upsert.mutate(
                  { id: editing.id, nome, ativo: editing.ativo },
                  { onSuccess: () => { toast.success("Salvo"); setOpen(false); } },
                );
              }}
            >
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={upsert.isPending}>Salvar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AlcadasCard({ isAdmin }: { isAdmin: boolean }) {
  const { data = [], isLoading } = useAlcadas();
  const updateMut = useAlcadaMutation();
  const categorias = TIPOS_EVENTO;

  const [edits, setEdits] = useState<Record<string, { valor_ate: string; multiplicador: string }>>({});

  const fmtBR = (n: number | null) =>
    n == null ? "" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Alçadas de Complexidade</h2>
        {!isAdmin && (
          <span className="text-xs text-muted-foreground">Edição restrita ao administrador master</span>
        )}
      </div>
      {isLoading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {categorias.map((cat) => {
          const linhas = data.filter((a) => a.categoria === cat).sort((a, b) => a.nivel - b.nivel);
          if (linhas.length === 0) return null;
          return (
            <div key={cat} className="border rounded-md overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                {cat}
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1 text-left w-16">Nível</th>
                    <th className="px-3 py-1 text-left">Valor até (R$)</th>
                    <th className="px-3 py-1 text-left w-28">Multiplicador</th>
                    {isAdmin && <th className="px-3 py-1 w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const e = edits[l.id];
                    const valStr = e?.valor_ate ?? fmtBR(l.valor_ate);
                    const multStr = e?.multiplicador ?? String(l.multiplicador);
                    return (
                      <tr key={l.id} className="border-t border-border/50">
                        <td className="px-3 py-1">{l.nivel}</td>
                        <td className="px-3 py-1">
                          {isAdmin ? (
                            <Input
                              className="h-8"
                              placeholder={l.nivel === 6 ? "acima" : ""}
                              value={valStr}
                              onChange={(ev) =>
                                setEdits((p) => ({ ...p, [l.id]: { valor_ate: ev.target.value, multiplicador: multStr } }))
                              }
                            />
                          ) : (
                            l.valor_ate == null ? "acima" : `R$ ${fmtBR(l.valor_ate)}`
                          )}
                        </td>
                        <td className="px-3 py-1">
                          {isAdmin ? (
                            <Input
                              className="h-8"
                              value={multStr}
                              onChange={(ev) =>
                                setEdits((p) => ({ ...p, [l.id]: { valor_ate: valStr, multiplicador: ev.target.value } }))
                              }
                            />
                          ) : (
                            l.multiplicador
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-1 text-right">
                            {e && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateMut.isPending}
                                onClick={() => {
                                  const parseBR = (s: string) => {
                                    const t = (s || "").replace(/\./g, "").replace(",", ".").trim();
                                    if (t === "") return null;
                                    const n = Number(t);
                                    return Number.isFinite(n) ? n : null;
                                  };
                                  const v = parseBR(e.valor_ate);
                                  const m = Number(e.multiplicador);
                                  if (!Number.isFinite(m) || m < 0) return toast.error("Multiplicador inválido");
                                  updateMut.mutate(
                                    { id: l.id, valor_ate: v, multiplicador: m },
                                    {
                                      onSuccess: () => {
                                        toast.success("Salvo");
                                        setEdits((p) => {
                                          const c = { ...p };
                                          delete c[l.id];
                                          return c;
                                        });
                                      },
                                      onError: (err: any) => toast.error(err?.message || "Falha ao salvar"),
                                    },
                                  );
                                }}
                              >
                                Salvar
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
