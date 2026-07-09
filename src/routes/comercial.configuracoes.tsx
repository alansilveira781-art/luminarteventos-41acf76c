import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { CARD_STATUSES } from "@/lib/comercial/types";
import { StatusDefaultsTable } from "@/components/StatusDefaultsTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useVendedores, useCerimoniais, useDecoradores, useCadastroMutations,
} from "@/lib/comercial/cadastros";
import {
  useProdutores, useProdutorMutations, useAlcadas, useAlcadaMutation,
} from "@/lib/comercial/bonificacao";
import { TIPOS_EVENTO } from "@/lib/comercial/types";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/comercial/configuracoes")({
  component: ComercialConfiguracoes,
});

function ComercialConfiguracoes() {
  const { isAdmin, modulos } = useAuth();
  const isComercialAdmin = isAdmin || modulos.some((m) => m.slug === "comercial" && m.is_admin);
  if (!isComercialAdmin) return <Navigate to="/comercial" />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Configurações"
        description="Responsáveis padrão por status e cadastros usados nas vendas (vendedores, cerimoniais e decoradores)."
      />
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Responsáveis padrão por status</h2>
        <StatusDefaultsTable
          tableName="comercial_status_defaults"
          moduleSlug="comercial"
          statuses={CARD_STATUSES as unknown as { key: string; label: string; color: string }[]}
        />
      </Card>

      <VendedoresCard />
      <CerimoniaisCard />
      <DecoradoresCard />
      <ProdutoresCard />
      <AlcadasCard isAdmin={isAdmin} />
    </div>
  );
}

/* ---------- Vendedores ---------- */
function VendedoresCard() {
  const { data = [], isLoading } = useVendedores();
  const { upsert, remove } = useCadastroMutations("comercial_vendedores", "comercial-vendedores");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; nome: string; percentual_comissao: number } | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Vendedores (Consultor(a))</h2>
        <Button size="sm" onClick={() => { setEditing({ nome: "", percentual_comissao: 0 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo vendedor
        </Button>
      </div>
      <CrudTable
        isLoading={isLoading}
        empty="Nenhum vendedor cadastrado."
        columns={["Nome", "% Comissão", ""]}
        rows={data.map((v) => ({
          id: v.id,
          cells: [
            v.nome,
            `${Number(v.percentual_comissao).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
          ],
          onEdit: () => { setEditing({ id: v.id, nome: v.nome, percentual_comissao: Number(v.percentual_comissao) || 0 }); setOpen(true); },
          onDelete: () => {
            if (confirm(`Excluir vendedor "${v.nome}"?`))
              remove.mutate(v.id, { onSuccess: () => toast.success("Vendedor excluído") });
          },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const nome = editing.nome.trim();
                const pct = Number(editing.percentual_comissao);
                if (!nome) return toast.error("Informe o nome");
                if (!Number.isFinite(pct) || pct < 0) return toast.error("Percentual inválido");
                upsert.mutate(
                  { id: editing.id, nome, percentual_comissao: pct },
                  { onSuccess: () => { toast.success("Salvo"); setOpen(false); } },
                );
              }}
            >
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Percentual de comissão (%)</Label>
                <Input
                  type="number" step="0.01" min={0}
                  value={editing.percentual_comissao}
                  onChange={(e) => setEditing({ ...editing, percentual_comissao: Number(e.target.value) })}
                />
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

/* ---------- Cerimoniais ---------- */
function CerimoniaisCard() {
  const { data = [], isLoading } = useCerimoniais();
  const { upsert, remove } = useCadastroMutations("comercial_cerimoniais", "comercial-cerimoniais");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; nome: string; percentual_bv: number } | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Cerimoniais</h2>
        <Button size="sm" onClick={() => { setEditing({ nome: "", percentual_bv: 0 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo cerimonial
        </Button>
      </div>
      <CrudTable
        isLoading={isLoading}
        empty="Nenhum cerimonial cadastrado."
        columns={["Nome", "% BV", ""]}
        rows={data.map((v) => ({
          id: v.id,
          cells: [
            v.nome,
            `${Number(v.percentual_bv).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
          ],
          onEdit: () => { setEditing({ id: v.id, nome: v.nome, percentual_bv: Number(v.percentual_bv) || 0 }); setOpen(true); },
          onDelete: () => {
            if (confirm(`Excluir cerimonial "${v.nome}"?`))
              remove.mutate(v.id, { onSuccess: () => toast.success("Cerimonial excluído") });
          },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar cerimonial" : "Novo cerimonial"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const nome = editing.nome.trim();
                const pct = Number(editing.percentual_bv);
                if (!nome) return toast.error("Informe o nome");
                if (!Number.isFinite(pct) || pct < 0) return toast.error("Percentual inválido");
                upsert.mutate(
                  { id: editing.id, nome, percentual_bv: pct },
                  { onSuccess: () => { toast.success("Salvo"); setOpen(false); } },
                );
              }}
            >
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Percentual de BV (%)</Label>
                <Input
                  type="number" step="0.01" min={0}
                  value={editing.percentual_bv}
                  onChange={(e) => setEditing({ ...editing, percentual_bv: Number(e.target.value) })}
                />
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

/* ---------- Decoradores ---------- */
function DecoradoresCard() {
  const { data = [], isLoading } = useDecoradores();
  const { upsert, remove } = useCadastroMutations("comercial_decoradores", "comercial-decoradores");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; nome: string } | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Decoradores / Agências</h2>
        <Button size="sm" onClick={() => { setEditing({ nome: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo decorador
        </Button>
      </div>
      <CrudTable
        isLoading={isLoading}
        empty="Nenhum decorador cadastrado."
        columns={["Nome", ""]}
        rows={data.map((v) => ({
          id: v.id,
          cells: [v.nome],
          onEdit: () => { setEditing({ id: v.id, nome: v.nome }); setOpen(true); },
          onDelete: () => {
            if (confirm(`Excluir decorador "${v.nome}"?`))
              remove.mutate(v.id, { onSuccess: () => toast.success("Decorador excluído") });
          },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar decorador" : "Novo decorador"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const nome = editing.nome.trim();
                if (!nome) return toast.error("Informe o nome");
                upsert.mutate(
                  { id: editing.id, nome },
                  { onSuccess: () => { toast.success("Salvo"); setOpen(false); } },
                );
              }}
            >
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
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

/* ---------- Tabela genérica ---------- */
type CrudRow = { id: string; cells: (string | number)[]; onEdit: () => void; onDelete: () => void };
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

/* ---------- Produtores ---------- */
function ProdutoresCard() {
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

/* ---------- Alçadas de Complexidade ---------- */
function AlcadasCard({ isAdmin }: { isAdmin: boolean }) {
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
