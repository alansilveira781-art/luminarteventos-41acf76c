import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { MoneyInput } from "@/components/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertTriangle, Download, Loader2, Pencil, Plus, ShieldAlert, Trash2,
} from "lucide-react";
import { listVendasDb } from "@/lib/comercial/vendas-db.functions";
import type { VendaRow } from "@/lib/comercial/vendas.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  PeriodoFilter, filterByPeriodo, periodoFromPreset,
  type Periodo, type PeriodoPreset,
} from "@/components/PeriodoFilter";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import {
  BulkEditDialog, normalizeBulkPatch, type BulkField,
} from "@/components/BulkEditDialog";
import { useSort, SortableTh } from "@/components/SortableTh";
import { useVendedores, useCerimoniais, useDecoradores, useClassificacoes } from "@/lib/comercial/cadastros";
import { CadastroCombobox } from "@/components/comercial/CadastroCombobox";



export const Route = createFileRoute("/comercial/vendas")({
  component: VendasPage,
});

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EMPRESAS = ["Planejados", "Eventos"];

// Registros legados usam '1900-01-01' como placeholder para data_evento.
const LEGACY_EVENTO = "1900-01-01";
function isLegacyEvento(iso: string | null | undefined): boolean {
  return !!iso && iso.slice(0, 10) === LEGACY_EVENTO;
}
function formatDateOrLegacy(iso: string | null | undefined): string {
  if (!iso || isLegacyEvento(iso)) return "—";
  return formatDate(iso);
}


const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function mesNomeFrom(iso: string | null): string | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  return m ? (MESES_PT[m - 1] ?? null) : null;
}
function anoFrom(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
function trimestreFrom(iso: string | null): 1 | 2 | 3 | 4 | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  if (!m) return null;
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 9) return 3;
  return 4;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const PAGE_SIZE = 50;

function unique<T>(arr: (T | null | undefined)[]): T[] {
  const s = new Set<T>();
  for (const v of arr) if (v !== null && v !== undefined && v !== ("" as unknown)) s.add(v as T);
  return [...s];
}

type FormState = {
  data_registro: string;
  data_evento: string;
  tipo: string;
  nome_evento: string;
  local: string;
  cidade: string;
  estado: string;
  classificacao: string;
  consultor: string;
  cerimonial: string;
  decorador: string;
  empresa: string;
  valor_proposta: number;
  desconto: number;
};

function emptyForm(): FormState {
  return {
    data_registro: todayIso(),
    data_evento: "",

    tipo: "Venda",
    nome_evento: "",
    local: "",
    cidade: "",
    estado: "",
    classificacao: "",
    consultor: "",
    cerimonial: "",
    decorador: "",
    empresa: "",
    valor_proposta: 0,
    desconto: 0,
  };
}

function formFromRow(r: VendaRow): FormState {
  const de = r.dataEvento ?? "";
  return {
    data_registro: r.dataRegistro ?? todayIso(),
    data_evento: isLegacyEvento(de) ? "" : de,
    tipo: r.tipo ?? "",
    nome_evento: r.nomeEvento ?? "",
    local: r.local ?? "",
    cidade: r.cidade ?? "",
    estado: r.estado ?? "",
    classificacao: r.classificacao ?? "",
    consultor: r.consultor ?? "",
    cerimonial: r.cerimonial ?? "",
    decorador: r.decorador ?? "",
    empresa: r.empresa ?? "",
    valor_proposta: r.valorProposta || 0,
    desconto: r.desconto || 0,
  };
}

function buildDbPayload(
  f: FormState,
  derived: { valor_final: number; valor_bv: number; valor_comissao: number },
) {
  const data = f.data_registro || null;
  const dataEvento = f.data_evento || null;
  const baseEvento = dataEvento ?? data;
  return {
    data_registro: data,
    data_evento: dataEvento,
    tipo: f.tipo || null,
    nome_evento: f.nome_evento || null,
    local: f.local || null,
    cidade: f.cidade || null,
    estado: f.estado || null,
    classificacao: f.classificacao || null,
    consultor: f.consultor || null,
    cerimonial: f.cerimonial || null,
    decorador: f.decorador || null,
    empresa: f.empresa || null,
    valor_proposta: f.valor_proposta || 0,
    desconto: f.desconto || 0,
    valor_final: derived.valor_final,
    valor_bv: derived.valor_bv,
    valor_comissao: derived.valor_comissao,
    ano: anoFrom(data),
    mes: mesNomeFrom(data),
    mes_evento: mesNomeFrom(baseEvento),
    ano_evento: anoFrom(baseEvento),
    trimestre_evento: trimestreFrom(baseEvento),
  };
}


function VendasPage() {
  const { isAdmin, isModuleAdmin, loading: authLoading } = useAuth();
  const canView = isAdmin || isModuleAdmin("comercial");

  const qc = useQueryClient();

  const [empresa, setEmpresa] = useState<string>("Todos");
  const [consultor, setConsultor] = useState<string>("Todos");
  const [classificacao, setClassificacao] = useState<string>("Todos");
  const [busca, setBusca] = useState<string>("");
  const [page, setPage] = useState(1);

  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("mes");
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoFromPreset("mes"));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendaRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: vendedores = [] } = useVendedores();
  const { data: cerimoniais = [] } = useCerimoniais();
  const { data: decoradores = [] } = useDecoradores();
  const { data: classificacoes = [] } = useClassificacoes();


  const derived = useMemo(() => {
    const valor_final = Math.max(0, (form.valor_proposta || 0) - (form.desconto || 0));
    const vend = vendedores.find((v) => v.nome === form.consultor);
    const ceri = cerimoniais.find((c) => c.nome === form.cerimonial);
    const valor_comissao = vend ? valor_final * (Number(vend.percentual_comissao) || 0) / 100 : 0;
    const valor_bv = ceri ? valor_final * (Number(ceri.percentual_bv) || 0) / 100 : 0;
    return {
      valor_final: Number(valor_final.toFixed(2)),
      valor_bv: Number(valor_bv.toFixed(2)),
      valor_comissao: Number(valor_comissao.toFixed(2)),
    };
  }, [form.valor_proposta, form.desconto, form.consultor, form.cerimonial, vendedores, cerimoniais]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comercial-vendas-db"],
    queryFn: () => listVendasDb(),
    staleTime: 5 * 60 * 1000,
    enabled: canView,
  });

  const rows = data?.rows ?? [];

  const opts = useMemo(() => ({
    empresas: unique(rows.map((r) => r.empresa)).sort(),
    consultores: unique(rows.map((r) => r.consultor)).sort(),
    classificacoes: unique(rows.map((r) => r.classificacao)).sort(),
  }), [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (empresa !== "Todos" && (r.empresa ?? "") !== empresa) return false;
      if (consultor !== "Todos" && (r.consultor ?? "") !== consultor) return false;
      if (classificacao !== "Todos" && (r.classificacao ?? "") !== classificacao) return false;
      if (q) {
        const blob = `${r.nomeEvento ?? ""} ${r.local ?? ""} ${r.cidade ?? ""} ${r.estado ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    list = filterByPeriodo(list, periodo, (r) => r.dataRegistro);
    return list;
  }, [rows, empresa, consultor, classificacao, busca, periodo]);

  const { sort, toggleSort, applySort } = useSort();

  const sorted = useMemo(() => {
    if (sort) {
      return applySort(filtered as any, (r: any, key: string) => {
        switch (key) {
          case "data_registro": return r.dataRegistro ?? "";
          case "data_evento": return isLegacyEvento(r.dataEvento) ? "" : (r.dataEvento ?? "");

          case "tipo": return r.tipo ?? "";
          case "nome_evento": return r.nomeEvento ?? "";
          case "local": return r.local ?? "";
          case "cidade": return r.cidade ?? "";
          case "estado": return r.estado ?? "";
          case "classificacao": return r.classificacao ?? "";
          case "consultor": return r.consultor ?? "";
          case "cerimonial": return r.cerimonial ?? "";
          case "decorador": return r.decorador ?? "";
          case "empresa": return r.empresa ?? "";
          case "valor_proposta": return r.valorProposta || 0;
          case "desconto": return r.desconto || 0;
          case "valor_final": return r.valorFinal || 0;
          case "valor_bv": return r.valorBV || 0;
          default: return r[key];
        }
      }) as VendaRow[];
    }
    return [...filtered].sort((a, b) => (b.dataRegistro ?? "").localeCompare(a.dataRegistro ?? ""));
  }, [filtered, sort, applySort]);


  const totalProposta = useMemo(() => sorted.reduce((s, r) => s + (r.valorProposta || 0), 0), [sorted]);
  const totalDesc = useMemo(() => sorted.reduce((s, r) => s + (r.desconto || 0), 0), [sorted]);
  const totalValor = useMemo(() => sorted.reduce((s, r) => s + (r.valorFinal || 0), 0), [sorted]);
  const totalBV = useMemo(() => sorted.reduce((s, r) => s + (r.valorBV || 0), 0), [sorted]);

  useEffect(() => { setPage(1); }, [empresa, consultor, classificacao, busca, periodo]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const pageRowsWithId = pageRows.filter((r): r is VendaRow & { id: string } => !!r.id);

  const sel = useBulkSelection(pageRowsWithId);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }
  function openEdit(r: VendaRow) {
    if (!r.id) return;
    setEditing(r);
    setForm(formFromRow(r));
    setFormOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = buildDbPayload(form, derived);
      if (editing?.id) {
        const { error } = await supabase
          .from("comercial_vendas")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comercial_vendas")
          .insert({ ...payload, source: "manual" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Venda atualizada" : "Venda cadastrada");
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] });
      setFormOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("comercial_vendas").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda(s) excluída(s)");
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] });
      sel.clear();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const bulkMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const ids = Array.from(sel.selected);
      if (!ids.length) return;
      const norm = normalizeBulkPatch(patch);
      const { error } = await supabase
        .from("comercial_vendas")
        .update(norm as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendas atualizadas");
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] });
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  function handleBulkDelete() {
    const ids = Array.from(sel.selected);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} venda(s)? Esta ação não pode ser desfeita.`)) return;
    delMut.mutate(ids);
  }

  function handleDeleteOne(r: VendaRow) {
    if (!r.id) return;
    if (!confirm("Excluir esta venda? Esta ação não pode ser desfeita.")) return;
    delMut.mutate([r.id]);
  }

  function exportCsv() {
    const headers = [
      "Data do Evento", "Data de Registro", "Tipo", "Nome do Evento", "Local", "Cidade", "Estado",
      "Classificação", "Consultor", "Cerimonial", "Decorador", "Empresa",
      "Valor da Proposta", "Desconto", "Valor Final", "Valor BV",
    ];
    const esc = (v: string | number | null) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(";")];
    for (const r of sorted) {
      lines.push([
        isLegacyEvento(r.dataEvento) ? "" : (r.dataEvento ?? ""),
        r.dataRegistro ?? "", r.tipo ?? "", r.nomeEvento ?? "",
        r.local ?? "", r.cidade ?? "", r.estado ?? "",
        r.classificacao ?? "", r.consultor ?? "", r.cerimonial ?? "", r.decorador ?? "", r.empresa ?? "",
        r.valorProposta, r.desconto, r.valorFinal, r.valorBV,
      ].map(esc).join(";"));
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFiltros() {
    setEmpresa("Todos"); setConsultor("Todos"); setClassificacao("Todos");
    setBusca(""); setPage(1);
    setPeriodoPreset("mes"); setPeriodo(periodoFromPreset("mes"));
  }

  const BULK_FIELDS: BulkField[] = [
    { key: "tipo", label: "Tipo", type: "text" },
    {
      key: "classificacao", label: "Classificação", type: "select", allowClear: true,
      options: classificacoes.map((c) => ({ value: c.nome, label: c.nome })),
    },
    { key: "consultor", label: "Consultor", type: "text" },
    { key: "cerimonial", label: "Cerimonial", type: "text" },
    { key: "decorador", label: "Decorador", type: "text" },
    {
      key: "empresa", label: "Empresa", type: "select", allowClear: true,
      options: EMPRESAS.map((v) => ({ value: v, label: v })),
    },
    { key: "valor_proposta", label: "Valor da Proposta", type: "money" },
    { key: "desconto", label: "Desconto", type: "money" },
    { key: "valor_final", label: "Valor Final", type: "money" },
    { key: "valor_bv", label: "Valor BV", type: "money" },
  ];

  if (authLoading) {
    return (
      <div className="p-6">
        <Card className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="p-6 flex items-start gap-3 text-sm border-amber-500/40 bg-amber-500/5">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-medium text-amber-700 dark:text-amber-400">Acesso restrito</div>
            <div className="text-muted-foreground mt-1">
              Apenas administradores podem visualizar os registros de vendas.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Vendas"
        description="Cadastro e gestão de vendas"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sorted.length}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Nova venda
            </Button>
          </div>
        }
      />

      <Card className="p-4 space-y-3">
        {/* Período — linha própria, largura livre para as setas e o calendário */}
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">Período</Label>
          <PeriodoFilter
            preset={periodoPreset}
            periodo={periodo}
            onChange={(p, per) => { setPeriodoPreset(p); setPeriodo(per); }}
          />
        </div>

        {/* Demais filtros — linha embaixo */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <FiltroSelect label="Empresa" value={empresa} onChange={setEmpresa} options={opts.empresas} />
          <FiltroSelect label="Consultor" value={consultor} onChange={setConsultor} options={opts.consultores} />
          <FiltroSelect label="Classificação" value={classificacao} onChange={setClassificacao} options={opts.classificacoes} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">Buscar</Label>
          <Input
            placeholder="Evento, local, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{sorted.length.toLocaleString("pt-BR")} registros</span>
          <button className="underline hover:text-foreground" onClick={resetFiltros}>Limpar filtros</button>
        </div>
      </Card>

      <BulkActionsBar
        count={sel.count}
        onEdit={() => setBulkOpen(true)}
        onClear={sel.clear}
        label="venda(s) selecionada(s)"
        extraActions={
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={delMut.isPending}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionadas
          </Button>
        }
      />

      {isLoading && (
        <Card className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando vendas...
        </Card>
      )}

      {!isLoading && (error || data?.error) && (
        <Card className="p-6 flex items-start gap-3 text-sm border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <div className="font-medium text-destructive">Não foi possível carregar os dados</div>
            <div className="text-muted-foreground mt-1">{(error as Error)?.message ?? data?.error}</div>
          </div>
        </Card>
      )}

      {!isLoading && !data?.error && data && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 w-8">
                    <Checkbox checked={sel.allSelected} onCheckedChange={() => sel.toggleAll()} />
                  </th>
                  <SortableTh sort={sort} onToggle={toggleSort} k="data_evento" label="Data do Evento" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="data_registro" label="Data de Registro" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />

                  <SortableTh sort={sort} onToggle={toggleSort} k="tipo" label="Tipo" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="nome_evento" label="Nome do Evento" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="local" label="Local" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="cidade" label="Cidade" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="estado" label="Estado" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="classificacao" label="Classificação" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="consultor" label="Consultor" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="cerimonial" label="Cerimonial" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="decorador" label="Decorador" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="empresa" label="Empresa" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="valor_proposta" label="Valor da Proposta" align="right" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="desconto" label="Desconto" align="right" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="valor_final" label="Valor Final" align="right" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
                  <SortableTh sort={sort} onToggle={toggleSort} k="valor_bv" label="Valor BV" align="right" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" />

                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={18} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => {
                  const id = r.id;
                  const checked = id ? sel.selected.has(id) : false;
                  return (
                    <tr key={id ?? `${r.dataRegistro}-${r.nomeEvento}`} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        {id && (
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => sel.toggle(id)}
                          />
                        )}
                      </td>
                      <Td>{formatDateOrLegacy(r.dataEvento)}</Td>
                      <Td>{formatDate(r.dataRegistro)}</Td>

                      <Td>{r.tipo ?? "—"}</Td>
                      <Td className="font-medium">{r.nomeEvento ?? "—"}</Td>
                      <Td>{r.local ?? "—"}</Td>
                      <Td>{r.cidade ?? "—"}</Td>
                      <Td>{r.estado ?? "—"}</Td>
                      <Td>{r.classificacao ?? "—"}</Td>
                      <Td>{r.consultor ?? "—"}</Td>
                      <Td>{r.cerimonial ?? "—"}</Td>
                      <Td>{r.decorador ?? "—"}</Td>
                      <Td>{r.empresa ?? "—"}</Td>
                      <Td className="text-right">{brl(r.valorProposta || 0)}</Td>
                      <Td className="text-right">{brl(r.desconto || 0)}</Td>
                      <Td className="text-right font-semibold">{brl(r.valorFinal || 0)}</Td>
                      <Td className="text-right">{brl(r.valorBV || 0)}</Td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {id && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteOne(r)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 border-t-2 border-border">
                <tr>
                  <Td colSpan={13} className="font-semibold">Totais ({sorted.length.toLocaleString("pt-BR")} registros)</Td>
                  <Td className="text-right font-semibold">{brl(totalProposta)}</Td>
                  <Td className="text-right font-semibold">{brl(totalDesc)}</Td>
                  <Td className="text-right font-semibold">{brl(totalValor)}</Td>
                  <Td className="text-right font-semibold">{brl(totalBV)}</Td>
                  <Td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-sm">
            <div className="text-muted-foreground">
              Página {curPage} de {totalPages} · {PAGE_SIZE} por página
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={curPage === 1}>«</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={curPage === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={curPage === totalPages}>Próxima</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={curPage === totalPages}>»</Button>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar venda" : "Nova venda"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
          >
            <Field label="Data do Evento">
              <Input type="date" value={form.data_evento}
                onChange={(e) => setForm({ ...form, data_evento: e.target.value })} required />
            </Field>
            <Field label="Data de Registro">
              <Input type="date" value={form.data_registro}
                onChange={(e) => setForm({ ...form, data_registro: e.target.value })} required />
            </Field>
            <Field label="Tipo">
              <Select
                value={form.tipo || "Venda"}
                onValueChange={(v) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Extra">Extra</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Empresa">
              <SelectFree value={form.empresa} options={EMPRESAS}
                onChange={(v) => setForm({ ...form, empresa: v })} />
            </Field>
            <Field label="Nome do Evento" className="sm:col-span-2 lg:col-span-3">
              <Input value={form.nome_evento}
                onChange={(e) => setForm({ ...form, nome_evento: e.target.value })} required />
            </Field>
            <Field label="Local">
              <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </Field>
            <Field label="Cidade">
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </Field>
            <Field label="Estado">
              <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
            </Field>
            <Field label="Classificação">
              <CadastroCombobox
                table="comercial_classificacoes"
                queryKey="comercial-classificacoes"
                value={form.classificacao}
                onChange={(v) => setForm({ ...form, classificacao: v })}
              />
            </Field>
            <Field label="Consultor(a)">
              <CadastroCombobox
                table="comercial_vendedores"
                queryKey="comercial-vendedores"
                value={form.consultor}
                onChange={(v) => setForm({ ...form, consultor: v })}
                extraFields={[{ key: "percentual_comissao", label: "% Comissão", type: "number", default: 0 }]}
              />
            </Field>
            <Field label="Cerimonial">
              <CadastroCombobox
                table="comercial_cerimoniais"
                queryKey="comercial-cerimoniais"
                value={form.cerimonial}
                onChange={(v) => setForm({ ...form, cerimonial: v })}
                extraFields={[{ key: "percentual_bv", label: "% BV", type: "number", default: 0 }]}
              />
            </Field>
            <Field label="Decorador(a)/Agência">
              <CadastroCombobox
                table="comercial_decoradores"
                queryKey="comercial-decoradores"
                value={form.decorador}
                onChange={(v) => setForm({ ...form, decorador: v })}
              />
            </Field>
            <Field label="Valor da Proposta">
              <MoneyInput value={form.valor_proposta}
                onChange={(n) => setForm({ ...form, valor_proposta: n })} />
            </Field>
            <Field label="Desconto">
              <MoneyInput value={form.desconto}
                onChange={(n) => setForm({ ...form, desconto: n })} />
            </Field>
            <Field label="Valor Final (calculado)">
              <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/40 font-medium tabular-nums">
                {brl(derived.valor_final)}
              </div>
            </Field>
            <Field label="Valor BV (calculado)">
              <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/40 tabular-nums">
                {brl(derived.valor_bv)}
              </div>
            </Field>
            <Field label="Valor Comissão (calculado)">
              <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/40 tabular-nums">
                {brl(derived.valor_comissao)}
              </div>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Valor Final = Proposta − Desconto. BV e Comissão usam os percentuais cadastrados no
                consultor/cerimonial.
              </span>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar venda"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={sel.count}
        fields={BULK_FIELDS}
        submitting={bulkMut.isPending}
        onSubmit={(patch) => bulkMut.mutate(patch)}
        title="Editar vendas em massa"
      />
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px] uppercase">{label}</Label>
      {children}
    </div>
  );
}

function SelectFree({
  value, options, onChange,
}: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(value !== "" && !options.includes(value));
  useEffect(() => {
    if (value !== "" && !options.includes(value)) setCustom(true);
  }, [value, options]);
  if (custom) {
    return (
      <div className="flex gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => { setCustom(false); onChange(""); }}>↺</Button>
      </div>
    );
  }
  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => {
        if (v === "__other__") { setCustom(true); onChange(""); return; }
        if (v === "__none__") { onChange(""); return; }
        onChange(v);
      }}
    >
      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="__other__">Outro...</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FiltroSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Todos">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function Td({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
