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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/PageHeader";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { MoneyInput } from "@/components/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertTriangle, Download, Loader2, Pencil, Plus, RefreshCw, ShieldAlert, Trash2,
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
import { calcularDerivados, matchCadastro } from "@/lib/comercial/comissao";
import {
  buildVendaDbPayload, emptyVendaForm, todayIso, type VendaFormState,
} from "@/lib/comercial/venda-form";
import { VendaFormFields } from "@/components/comercial/VendaFormFields";




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

const PAGE_SIZE = 50;

function unique<T>(arr: (T | null | undefined)[]): T[] {
  const s = new Set<T>();
  for (const v of arr) if (v !== null && v !== undefined && v !== ("" as unknown)) s.add(v as T);
  return [...s];
}

type FormState = VendaFormState;

const emptyForm = emptyVendaForm;
const buildDbPayload = buildVendaDbPayload;

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
    valor_proposta: r.valorProposta ?? 0,
    desconto: r.desconto ?? 0,
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
  const [detalhe, setDetalhe] = useState<VendaRow | null>(null);

  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedores();
  const { data: cerimoniais = [], isLoading: loadingCerimoniais } = useCerimoniais();
  const cadastrosCarregando = loadingVendedores || loadingCerimoniais;

  const { data: decoradores = [] } = useDecoradores();
  const { data: classificacoes = [] } = useClassificacoes();


  const derived = useMemo(
    () =>
      calcularDerivados(
        {
          valor_proposta: form.valor_proposta,
          desconto: form.desconto,
          consultor: form.consultor,
          cerimonial: form.cerimonial,
        },
        vendedores as any,
        cerimoniais as any,
      ),
    [form.valor_proposta, form.desconto, form.consultor, form.cerimonial, vendedores, cerimoniais],
  );

  const consultorSemCadastro = useMemo(
    () => !!form.consultor.trim() && !matchCadastro(form.consultor, vendedores as any),
    [form.consultor, vendedores],
  );

  const consultorGatilho = useMemo(
    () => (matchCadastro(form.consultor, vendedores as any) as any)?.tipo_comissao === "gatilho",
    [form.consultor, vendedores],
  );




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

  const classificacaoOptions = useMemo(() => {
    const set = new Set(["Planejados", ...opts.classificacoes]);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [opts.classificacoes]);

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

  async function recalcularIds(ids: string[]) {
    if (!ids.length) return 0;
    const { data: atuais, error } = await supabase
      .from("comercial_vendas")
      .select("id,valor_proposta,desconto,consultor,cerimonial,valor_final,valor_bv,valor_comissao")
      .in("id", ids);
    if (error) throw error;
    let n = 0;
    for (const r of (atuais ?? []) as any[]) {
      const d = calcularDerivados(
        {
          valor_proposta: Number(r.valor_proposta) || 0,
          desconto: Number(r.desconto) || 0,
          consultor: r.consultor,
          cerimonial: r.cerimonial,
        },
        vendedores as any,
        cerimoniais as any,
      );
      if (
        Number(r.valor_final) === d.valor_final &&
        Number(r.valor_bv) === d.valor_bv &&
        Number(r.valor_comissao) === d.valor_comissao
      ) continue;
      const { error: upErr } = await supabase.from("comercial_vendas").update(d as any).eq("id", r.id);
      if (upErr) throw upErr;
      n++;
    }
    return n;
  }

  const RECALC_KEYS = ["consultor", "cerimonial", "valor_proposta", "desconto"];

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
      const tocaDerivados = Object.keys(norm).some((k) => RECALC_KEYS.includes(k));
      const manual = Object.keys(norm).some((k) =>
        ["valor_final", "valor_bv"].includes(k),
      );
      if (tocaDerivados && !manual) await recalcularIds(ids);
    },
    onSuccess: () => {
      toast.success("Vendas atualizadas");
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] });
      setBulkOpen(false);
      sel.clear();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const recalcMut = useMutation({
    mutationFn: async () => {
      const ids = (sel.selected.size
        ? Array.from(sel.selected)
        : sorted.map((r) => r.id).filter(Boolean)) as string[];
      return recalcularIds(ids);
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} venda(s) recalculada(s)` : "Nenhum ajuste necessário");
      qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao recalcular"),
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

  function filtrosDescricao(): string[] {
    const f: string[] = [];
    const d = (x: Date | null) => (x ? x.toLocaleDateString("pt-BR") : "—");
    if (periodo.from || periodo.to) f.push(`Período: ${d(periodo.from)} a ${d(periodo.to)}`);
    if (empresa !== "Todos") f.push(`Empresa: ${empresa}`);
    if (consultor !== "Todos") f.push(`Consultor: ${consultor}`);
    if (classificacao !== "Todos") f.push(`Classificação: ${classificacao}`);
    if (busca.trim()) f.push(`Busca: ${busca.trim()}`);
    return f;
  }

  function exportCsv() {
    const headers = [
      "Data do Evento", "Data de Registro", "Tipo", "Nome do Evento", "Local", "Cidade", "Estado",
      "Classificação", "Consultor", "Cerimonial", "Decorador", "Empresa",
      "Valor da Proposta", "Desconto", "Valor Final", "Valor BV", "Valor Comissão",
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
        r.valorProposta, r.desconto, r.valorFinal, r.valorBV, r.valorComissao ?? 0,
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

  async function exportPdf() {
    try {
      const { gerarRelatorioVendasPdf } = await import("@/lib/comercial/vendas-relatorio");
      await gerarRelatorioVendasPdf({
        filtros: filtrosDescricao(),
        linhas: sorted.map((r) => ({
          dataEvento: r.dataEvento ?? null,
          dataRegistro: r.dataRegistro ?? null,
          nomeEvento: r.nomeEvento ?? null,
          local: r.local ?? null,
          cidade: r.cidade ?? null,
          estado: r.estado ?? null,
          empresa: r.empresa ?? null,
          classificacao: r.classificacao ?? null,
          consultor: r.consultor ?? null,
          cerimonial: r.cerimonial ?? null,
          decorador: r.decorador ?? null,
          valorProposta: Number(r.valorProposta || 0),
          desconto: Number(r.desconto || 0),
          valorFinal: Number(r.valorFinal || 0),
          valorBV: Number(r.valorBV || 0),
          valorComissao: Number(r.valorComissao || 0),
        })),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar o relatório");
    }
  }


  function resetFiltros() {
    setEmpresa("Todos"); setConsultor("Todos"); setClassificacao("Todos");
    setBusca(""); setPage(1);
    setPeriodoPreset("mes"); setPeriodo(periodoFromPreset("mes"));
  }

  const BULK_FIELDS: BulkField[] = [
    {
      key: "tipo", label: "Tipo", type: "select",
      options: [{ value: "Venda", label: "Venda" }, { value: "Extra", label: "Extra" }],
    },
    {
      key: "classificacao", label: "Classificação", type: "cadastro",
      table: "comercial_classificacoes", queryKey: "comercial-classificacoes",
    },
    {
      key: "consultor", label: "Consultor(a)", type: "cadastro",
      table: "comercial_vendedores", queryKey: "comercial-vendedores",
      extraFields: [{ key: "percentual_comissao", label: "% Comissão", type: "number", default: 0 }],
    },
    {
      key: "cerimonial", label: "Cerimonial", type: "cadastro",
      table: "comercial_cerimoniais", queryKey: "comercial-cerimoniais",
      extraFields: [{ key: "percentual_bv", label: "% BV", type: "number", default: 0 }],
    },
    {
      key: "decorador", label: "Decorador(a)/Agência", type: "cadastro",
      table: "comercial_decoradores", queryKey: "comercial-decoradores",
    },
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!sorted.length}>
                  <Download className="h-4 w-4 mr-2" /> Exportar relatório
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => { void exportPdf(); }}>PDF</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportCsv()}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const qtd = sel.selected.size || sorted.length;
                if (!qtd) return;
                if (!confirm(`Recalcular comissão e BV de ${qtd} venda(s) usando os percentuais cadastrados?`)) return;
                recalcMut.mutate();
              }}
              disabled={recalcMut.isPending || !sorted.length}
            >
              {recalcMut.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Recalcular comissões/BV
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
          <FiltroSelect label="Classificação" value={classificacao} onChange={setClassificacao} options={classificacaoOptions} />
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
                    <tr
                      key={id ?? `${r.dataRegistro}-${r.nomeEvento}`}
                      className="border-t border-border/50 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetalhe(r)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
            <VendaFormFields form={form} setForm={setForm} derived={derived} />

            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMut.isPending || cadastrosCarregando}>
                {saveMut.isPending ? "Salvando..." : cadastrosCarregando ? "Carregando..." : editing ? "Salvar alterações" : "Cadastrar venda"}
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

      <Sheet open={!!detalhe} onOpenChange={(v) => { if (!v) setDetalhe(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {detalhe && (
            <>
              <SheetHeader>
                <SheetTitle>{detalhe.nomeEvento || "Venda"}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <DetalheSecao titulo="Evento">
                  <DetalheItem label="Data do evento" value={formatDateOrLegacy(detalhe.dataEvento)} />
                  <DetalheItem label="Data de registro" value={formatDate(detalhe.dataRegistro)} />
                  <DetalheItem label="Tipo" value={detalhe.tipo ?? "—"} />
                  <DetalheItem label="Local" value={detalhe.local ?? "—"} />
                  <DetalheItem label="Cidade" value={detalhe.cidade ?? "—"} />
                  <DetalheItem label="Estado" value={detalhe.estado ?? "—"} />
                  <DetalheItem label="Salão" value={detalhe.salao ?? "—"} />
                  <DetalheItem label="Tipo de evento" value={detalhe.tipoEvento ?? "—"} />
                  <DetalheItem label="Classificação" value={detalhe.classificacao ?? "—"} />
                  <DetalheItem label="Quantidade" value={String(detalhe.quantidade ?? 0)} />
                </DetalheSecao>

                <DetalheSecao titulo="Atendimento">
                  <DetalheItem label="Consultor" value={detalhe.consultor ?? "—"} />
                  <DetalheItem label="Gestor" value={detalhe.gestor ?? "—"} />
                  <DetalheItem label="Cerimonial" value={detalhe.cerimonial ?? "—"} />
                  <DetalheItem label="Decorador" value={detalhe.decorador ?? "—"} />
                  <DetalheItem label="Empresa" value={detalhe.empresa ?? "—"} />
                </DetalheSecao>

                <DetalheSecao titulo="Valores">
                  <DetalheItem label="Valor da proposta" value={brl(detalhe.valorProposta || 0)} />
                  <DetalheItem label="Desconto" value={brl(detalhe.desconto || 0)} />
                  <DetalheItem label="Percentual" value={`${Number(detalhe.percentual || 0).toLocaleString("pt-BR")}%`} />
                  <DetalheItem label="Valor final" value={brl(detalhe.valorFinal || 0)} />
                  <DetalheItem label="Valor BV" value={brl(detalhe.valorBV || 0)} />
                  <DetalheItem label="Comissão" value={brl(detalhe.valorComissao || 0)} />
                  <DetalheItem label="Comissão do gestor" value={brl(detalhe.comissaoGestor || 0)} />
                  <DetalheItem label="Tipo de comissão" value={detalhe.tipoComissao ?? "—"} />
                </DetalheSecao>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => { const r = detalhe; setDetalhe(null); openEdit(r); }}
                  >
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => { const r = detalhe; setDetalhe(null); handleDeleteOne(r); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetalheSecao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{titulo}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetalheItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
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
