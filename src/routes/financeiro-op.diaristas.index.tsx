import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Settings, Plus, Pencil, Trash2, Loader2, Download, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { MoneyInput } from "@/components/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calcularApontamento, formatHoras, type Local } from "@/lib/diaristas-calc";

export const Route = createFileRoute("/financeiro-op/diaristas/")({
  component: DiaristasIndex,
});

type Diarista = {
  id: string;
  nome: string;
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  chave_pix: string | null;
  ativo: boolean;
};

type Apontamento = {
  id: string;
  diarista_id: string;
  empresa: string | null;
  atividade: string | null;
  projeto: string | null;
  comodos: string | null;
  data: string;
  hora_inicial: string;
  hora_final: string;
  intervalo_minutos: number;
  local: string;
  obs: string | null;
  extra_manual: number;
};

type ApontamentoForm = {
  id?: string;
  diarista_id: string;
  projeto: string;
  data: string;
  hora_inicial: string;
  hora_final: string;
  intervalo_minutos: number;
  local: Local;
  obs: string;
  extra_manual: number;
};

const emptyApontamento = (): ApontamentoForm => ({
  diarista_id: "",
  projeto: "",
  data: format(new Date(), "yyyy-MM-dd"),
  hora_inicial: "08:00",
  hora_final: "17:00",
  intervalo_minutos: 60,
  local: "Fortaleza",
  obs: "",
  extra_manual: 0,
});

function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function DiaristasIndex() {
  const { isAdmin, modulos } = useAuth();
  const isFinAdmin = isAdmin || modulos.some((m) => m.slug === "financeiro_op" && m.is_admin);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Diaristas"
          description="Apontamento de dias trabalhados e fechamento por período."
        />
        {isFinAdmin && (
          <Button asChild variant="outline">
            <Link to="/financeiro-op/diaristas/configuracoes">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="apontamento">
        <TabsList>
          <TabsTrigger value="apontamento">Apontamento</TabsTrigger>
          <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
        </TabsList>
        <TabsContent value="apontamento" className="mt-4">
          <ApontamentoTab />
        </TabsContent>
        <TabsContent value="fechamento" className="mt-4">
          <FechamentoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Data hooks
// ─────────────────────────────────────────────────────────────

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

function useApontamentos() {
  return useQuery({
    queryKey: ["diarista_apontamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diarista_apontamentos")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Apontamento[];
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Apontamento
// ─────────────────────────────────────────────────────────────

function ApontamentoTab() {
  const qc = useQueryClient();
  const { data: diaristas = [] } = useDiaristas();
  const { data: apontamentos = [], isLoading } = useApontamentos();

  const diaristasAtivos = useMemo(() => diaristas.filter((d) => d.ativo), [diaristas]);
  const diaristasMap = useMemo(
    () => new Map(diaristas.map((d) => [d.id, d])),
    [diaristas],
  );

  // filtros
  const [fDiarista, setFDiarista] = useState<string>("todos");
  const [fLocal, setFLocal] = useState<string>("todos");
  const [fProjeto, setFProjeto] = useState<string>("");
  const [fDe, setFDe] = useState<string>("");
  const [fAte, setFAte] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApontamentoForm>(emptyApontamento());

  const upsert = useMutation({
    mutationFn: async (payload: ApontamentoForm) => {
      if (!payload.diarista_id) throw new Error("Selecione o diarista");
      const row = {
        diarista_id: payload.diarista_id,
        projeto: payload.projeto.trim() || null,
        data: payload.data,
        hora_inicial: payload.hora_inicial,
        hora_final: payload.hora_final,
        intervalo_minutos: Number(payload.intervalo_minutos) || 0,
        local: payload.local,
        obs: payload.obs.trim() || null,
        extra_manual: Number(payload.extra_manual) || 0,
      };
      if (payload.id) {
        const { error } = await (supabase as any)
          .from("diarista_apontamentos").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("diarista_apontamentos").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Apontamento salvo");
      qc.invalidateQueries({ queryKey: ["diarista_apontamentos"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("diarista_apontamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Apontamento removido");
      qc.invalidateQueries({ queryKey: ["diarista_apontamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    return apontamentos.filter((a) => {
      if (fDiarista !== "todos" && a.diarista_id !== fDiarista) return false;
      if (fLocal !== "todos" && a.local !== fLocal) return false;
      if (fProjeto && !(a.projeto ?? "").toLowerCase().includes(fProjeto.toLowerCase())) return false;
      if (fDe && a.data < fDe) return false;
      if (fAte && a.data > fAte) return false;
      return true;
    });
  }, [apontamentos, fDiarista, fLocal, fProjeto, fDe, fAte]);

  // preview em tempo real no formulário
  const previewDiarista = diaristasMap.get(editing.diarista_id);
  const preview = previewDiarista
    ? calcularApontamento(editing, previewDiarista)
    : null;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Diarista</Label>
            <Select value={fDiarista} onValueChange={setFDiarista}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {diaristas.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Local</Label>
            <Select value={fLocal} onValueChange={setFLocal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Fortaleza">Fortaleza</SelectItem>
                <SelectItem value="Fora">Fora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Projeto</Label>
            <Input value={fProjeto} onChange={(e) => setFProjeto(e.target.value)} placeholder="Filtrar" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">De</Label>
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</Label>
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} />
          </div>
          <div>
            <Button
              className="w-full"
              onClick={() => { setEditing(emptyApontamento()); setOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo apontamento
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="p-4">
        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum apontamento no filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 px-3">Diarista</th>
                  <th className="py-2 px-3">Projeto</th>
                  <th className="py-2 px-3">Local</th>
                  <th className="py-2 px-3">Horário</th>
                  <th className="py-2 px-3 text-right">Interv.</th>
                  <th className="py-2 px-3 text-right">Horas</th>
                  <th className="py-2 px-3 text-right">R$/h</th>
                  <th className="py-2 px-3 text-right">Diária</th>
                  <th className="py-2 px-3 text-right">Extra</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const d = diaristasMap.get(a.diarista_id);
                  const calc = d ? calcularApontamento(a, d) : null;
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="py-2 pr-3 tabular-nums">{fmtDate(a.data)}</td>
                      <td className="py-2 px-3 font-medium">{d?.nome ?? "—"}</td>
                      <td className="py-2 px-3">{a.projeto ?? "—"}</td>
                      <td className="py-2 px-3">{a.local}</td>
                      <td className="py-2 px-3 tabular-nums">
                        {a.hora_inicial.slice(0, 5)}–{a.hora_final.slice(0, 5)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{a.intervalo_minutos}min</td>
                      <td className="py-2 px-3 text-right tabular-nums">{calc?.horasLabel ?? "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {calc ? fmtBRL(calc.valorHora) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{calc ? fmtBRL(calc.diaria) : "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {calc ? fmtBRL(calc.extra) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">
                        {calc ? fmtBRL(calc.total) : "—"}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => {
                              setEditing({
                                id: a.id,
                                diarista_id: a.diarista_id,
                                empresa: a.empresa ?? "",
                                atividade: a.atividade ?? "",
                                projeto: a.projeto ?? "",
                                comodos: a.comodos ?? "",
                                data: a.data,
                                hora_inicial: a.hora_inicial.slice(0, 5),
                                hora_final: a.hora_final.slice(0, 5),
                                intervalo_minutos: a.intervalo_minutos,
                                local: (a.local as Local) ?? "Fortaleza",
                                obs: a.obs ?? "",
                                extra_manual: Number(a.extra_manual) || 0,
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("Excluir este apontamento?")) remove.mutate(a.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td colSpan={10} className="py-2 pr-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {fmtBRL(filtered.reduce((acc, a) => {
                      const d = diaristasMap.get(a.diarista_id);
                      return acc + (d ? calcularApontamento(a, d).total : 0);
                    }, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Dialog Novo/Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar apontamento" : "Novo apontamento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Diarista</Label>
                <Select
                  value={editing.diarista_id}
                  onValueChange={(v) => setEditing({ ...editing, diarista_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {diaristasAtivos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Local</Label>
                <Select
                  value={editing.local}
                  onValueChange={(v) => setEditing({ ...editing, local: v as Local })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fortaleza">Fortaleza</SelectItem>
                    <SelectItem value="Fora">Fora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Projeto</Label>
                <Input value={editing.projeto}
                  onChange={(e) => setEditing({ ...editing, projeto: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Atividade</Label>
                <Input value={editing.atividade}
                  onChange={(e) => setEditing({ ...editing, atividade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cômodos</Label>
                <Input value={editing.comodos}
                  onChange={(e) => setEditing({ ...editing, comodos: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input value={editing.empresa}
                  onChange={(e) => setEditing({ ...editing, empresa: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={editing.data}
                  onChange={(e) => setEditing({ ...editing, data: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Intervalo (min)</Label>
                <Input type="number" min={0} value={editing.intervalo_minutos}
                  onChange={(e) => setEditing({ ...editing, intervalo_minutos: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário inicial</Label>
                <Input type="time" value={editing.hora_inicial}
                  onChange={(e) => setEditing({ ...editing, hora_inicial: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário final</Label>
                <Input type="time" value={editing.hora_final}
                  onChange={(e) => setEditing({ ...editing, hora_final: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Extra (R$)</Label>
                <MoneyInput value={editing.extra_manual}
                  onChange={(v) => setEditing({ ...editing, extra_manual: v })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={editing.obs}
                  onChange={(e) => setEditing({ ...editing, obs: e.target.value })} />
              </div>
            </div>

            {/* Preview de cálculo */}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Cálculo automático
              </div>
              {preview ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Horas trabalhadas</div>
                    <div className="font-semibold tabular-nums">{preview.horasLabel}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Valor/hora</div>
                    <div className="tabular-nums">{fmtBRL(preview.valorHora)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Valor da diária</div>
                    <div className="tabular-nums">{fmtBRL(preview.diaria)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Extra</div>
                    <div className="tabular-nums">{fmtBRL(preview.extra)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-semibold tabular-nums">{fmtBRL(preview.total)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Selecione um diarista para ver o cálculo.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => upsert.mutate(editing)}
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
// Fechamento / Relatório
// ─────────────────────────────────────────────────────────────

function FechamentoTab() {
  const { data: diaristas = [] } = useDiaristas();
  const { data: apontamentos = [], isLoading } = useApontamentos();

  const diaristasMap = useMemo(
    () => new Map(diaristas.map((d) => [d.id, d])),
    [diaristas],
  );

  const hoje = new Date();
  const [de, setDe] = useState<string>(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [ate, setAte] = useState<string>(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [fLocal, setFLocal] = useState<string>("todos");
  const [fDiarista, setFDiarista] = useState<string>("todos");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  const toggleExp = (id: string) => {
    setExpandido((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const linhas = useMemo(() => {
    const filtrados = apontamentos.filter((a) => {
      if (de && a.data < de) return false;
      if (ate && a.data > ate) return false;
      if (fLocal !== "todos" && a.local !== fLocal) return false;
      if (fDiarista !== "todos" && a.diarista_id !== fDiarista) return false;
      return true;
    });

    const grupos = new Map<string, {
      diarista: Diarista | undefined;
      dias: number;
      minutos: number;
      total: number;
      itens: Array<{ ap: Apontamento; calc: ReturnType<typeof calcularApontamento> | null }>;
    }>();

    for (const a of filtrados) {
      const d = diaristasMap.get(a.diarista_id);
      const calc = d ? calcularApontamento(a, d) : null;
      const g = grupos.get(a.diarista_id) ?? {
        diarista: d, dias: 0, minutos: 0, total: 0, itens: [],
      };
      g.dias += 1;
      g.minutos += calc?.minutosTrabalhados ?? 0;
      g.total += calc?.total ?? 0;
      g.itens.push({ ap: a, calc });
      grupos.set(a.diarista_id, g);
    }
    return [...grupos.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => (a.diarista?.nome ?? "").localeCompare(b.diarista?.nome ?? "", "pt-BR"));
  }, [apontamentos, de, ate, fLocal, fDiarista, diaristasMap]);

  const totalGeral = linhas.reduce((acc, l) => acc + l.total, 0);
  const totalDias = linhas.reduce((acc, l) => acc + l.dias, 0);
  const totalMinutos = linhas.reduce((acc, l) => acc + l.minutos, 0);

  const exportar = (formato: "xlsx" | "csv") => {
    const header = ["Diarista", "Chave Pix", "Qtde de dias", "Total de horas", "Total a pagar"];
    const body = linhas.map((l) => [
      l.diarista?.nome ?? "—",
      l.diarista?.chave_pix ?? "",
      l.dias,
      formatHoras(l.minutos),
      Number(l.total.toFixed(2)),
    ]);
    const foot = ["TOTAL", "", totalDias, formatHoras(totalMinutos), Number(totalGeral.toFixed(2))];

    if (formato === "csv") {
      const rows = [header, ...body, foot];
      const csv = rows.map((r) =>
        r.map((v) => {
          const s = String(v ?? "");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(";")
      ).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fechamento-diaristas-${de}_a_${ate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Fechamento — Diaristas"],
      ["Período", `${fmtDate(de)} a ${fmtDate(ate)}`],
      [],
      header,
      ...body,
      [],
      foot,
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Resumo");

    // Detalhe
    const detHeader = ["Diarista", "Data", "Projeto", "Local", "Horas", "Diária", "Extra", "Total"];
    const detBody: any[][] = [];
    for (const l of linhas) {
      for (const it of l.itens) {
        detBody.push([
          l.diarista?.nome ?? "—",
          fmtDate(it.ap.data),
          it.ap.projeto ?? "",
          it.ap.local,
          it.calc?.horasLabel ?? "",
          Number((it.calc?.diaria ?? 0).toFixed(2)),
          Number((it.calc?.extra ?? 0).toFixed(2)),
          Number((it.calc?.total ?? 0).toFixed(2)),
        ]);
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet([detHeader, ...detBody]);
    ws2["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Detalhe");

    XLSX.writeFile(wb, `fechamento-diaristas-${de}_a_${ate}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-end">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Local</Label>
            <Select value={fLocal} onValueChange={setFLocal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Fortaleza">Fortaleza</SelectItem>
                <SelectItem value="Fora">Fora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Diarista</Label>
            <Select value={fDiarista} onValueChange={setFDiarista}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {diaristas.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full" variant="outline" disabled={linhas.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportar("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("csv")}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Tabela consolidada */}
      <Card className="p-4">
        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : linhas.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum apontamento no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3 w-8" />
                  <th className="py-2 px-3">Diarista</th>
                  <th className="py-2 px-3">Chave Pix</th>
                  <th className="py-2 px-3 text-right">Dias</th>
                  <th className="py-2 px-3 text-right">Total de horas</th>
                  <th className="py-2 pl-3 text-right">Total a pagar</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const aberto = expandido.has(l.id);
                  return (
                    <Fragment key={l.id}>
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                        onClick={() => toggleExp(l.id)}>
                        <td className="py-2 pr-3">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="py-2 px-3 font-medium">{l.diarista?.nome ?? "—"}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{l.diarista?.chave_pix ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{l.dias}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatHoras(l.minutos)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums font-semibold">{fmtBRL(l.total)}</td>
                      </tr>
                      {aberto && (
                        <tr key={l.id + "-det"} className="bg-muted/30">
                          <td />
                          <td colSpan={5} className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left border-b border-border/60 text-muted-foreground">
                                    <th className="py-1 pr-2">Data</th>
                                    <th className="py-1 px-2">Projeto</th>
                                    <th className="py-1 px-2">Local</th>
                                    <th className="py-1 px-2 text-right">Horas</th>
                                    <th className="py-1 px-2 text-right">Diária</th>
                                    <th className="py-1 px-2 text-right">Extra</th>
                                    <th className="py-1 pl-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {l.itens.map((it) => (
                                    <tr key={it.ap.id} className="border-b border-border/40">
                                      <td className="py-1 pr-2 tabular-nums">{fmtDate(it.ap.data)}</td>
                                      <td className="py-1 px-2">{it.ap.projeto ?? "—"}</td>
                                      <td className="py-1 px-2">{it.ap.local}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{it.calc?.horasLabel ?? "—"}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{fmtBRL(it.calc?.diaria ?? 0)}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{fmtBRL(it.calc?.extra ?? 0)}</td>
                                      <td className="py-1 pl-2 text-right tabular-nums font-medium">{fmtBRL(it.calc?.total ?? 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td />
                  <td className="py-2 px-3">TOTAL GERAL</td>
                  <td />
                  <td className="py-2 px-3 text-right tabular-nums">{totalDias}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatHoras(totalMinutos)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{fmtBRL(totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
