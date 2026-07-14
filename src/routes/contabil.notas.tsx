import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { subMonths } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Pencil, Trash2, Search, Save } from "lucide-react";
import { MoneyInput } from "@/components/MoneyInput";
import { toast } from "sonner";
import { format } from "date-fns";
import { EMPRESAS, EMPRESA_REGIME, REGIME_LABEL, IMPOSTOS_POR_REGIME, type Empresa } from "@/lib/empresas";
import { calcularImpostosPresumido, type Aliquota } from "@/lib/contabil/calculo";
import { SortableTh, useSort } from "@/components/SortableTh";
import { PeriodoFilter, periodoDoMes, filterByPeriodo, type Periodo, type PeriodoPreset } from "@/components/PeriodoFilter";
import { usePersistedState } from "@/hooks/usePersistedState";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { EntitySearchSelect } from "@/components/EntitySearchSelect";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/notas")({
  component: NotasFiscaisPage,
});

type Nota = {
  id: string;
  empresa: string;
  numero: string | null;
  tipo_servico: string | null;
  tomador_nome: string;
  tomador_documento: string | null;
  tomador_email: string | null;
  nome_evento: string | null;
  valor_bruto: number;
  valor_liquido: number | null;
  impostos: Record<string, number> | null;
  status: string;
  data_emissao: string | null;
  observacoes: string | null;
};

const STATUS = ["rascunho", "emitida", "cancelada"] as const;
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  cancelada: "Cancelada",
};

const MES_ANTERIOR = periodoDoMes(subMonths(new Date(), 1));

function NotasFiscaisPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Nota | null>(null);
  const [q, setQ] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("__all");
  const [filtroStatus, setFiltroStatus] = useState<string>("__all");
  const [periodoPreset, setPeriodoPreset] = usePersistedState<PeriodoPreset>("contabil-notas-preset", "mes");
  const [periodo, setPeriodo] = useState<Periodo>(MES_ANTERIOR);
  const { sort, toggleSort, applySort } = useSort();

  const { data: notas } = useQuery({
    queryKey: ["contabil-notas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_notas_fiscais")
        .select("*")
        .order("data_emissao", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Nota[];
    },
  });

  const { data: aliquotas } = useQuery({
    queryKey: ["contabil-aliquotas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_configuracao_aliquotas")
        .select("empresa, imposto, aliquota, base_calculo, aliquota_adicional, observacoes")
        .eq("ativo", true);
      if (error) throw error;
      return data as Array<{
        empresa: string;
        imposto: string;
        aliquota: number;
        base_calculo: number | null;
        aliquota_adicional: number | null;
        observacoes: string | null;
      }>;
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let rows = (notas ?? []).filter((n) => {
      if (filtroEmpresa !== "__all" && n.empresa !== filtroEmpresa) return false;
      if (filtroStatus !== "__all" && n.status !== filtroStatus) return false;
      if (!s) return true;
      return [n.numero, n.tomador_nome, n.tomador_documento, n.tipo_servico, n.nome_evento]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s));
    });
    rows = filterByPeriodo(rows, periodo, (n) => n.data_emissao);
    return applySort(rows as any, (n: any, k) => {
      if (k === "tomador") return n.tomador_nome;
      return n[k];
    });
  }, [notas, q, filtroEmpresa, filtroStatus, periodo, sort, applySort]);

  const upsertMut = useMutation({
    mutationFn: async (p: Partial<Nota> & { id?: string }) => {
      if (p.id) {
        const { error } = await sb.from("contabil_notas_fiscais").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("contabil_notas_fiscais").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-notas"] });
      qc.invalidateQueries({ queryKey: ["contabil-notas-dash"] });
      toast.success("Nota salva");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contabil_notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-notas"] });
      qc.invalidateQueries({ queryKey: ["contabil-notas-dash"] });
      toast.success("Nota excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader
        title="Notas Fiscais"
        description="Emissão de notas fiscais conforme tributação de cada empresa"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova nota
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, tomador, serviço, evento…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas empresas</SelectItem>
            {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos status</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <PeriodoFilter
          preset={periodoPreset}
          periodo={periodo}
          onChange={(p, per) => { setPeriodoPreset(p); setPeriodo(per); }}
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs uppercase text-muted-foreground">
                <SortableTh sort={sort} onToggle={toggleSort} k="data_emissao" label="Data" />
                <SortableTh sort={sort} onToggle={toggleSort} k="numero" label="Número" />
                <SortableTh sort={sort} onToggle={toggleSort} k="empresa" label="Empresa" />
                <SortableTh sort={sort} onToggle={toggleSort} k="tomador" label="Tomador" />
                <SortableTh sort={sort} onToggle={toggleSort} k="nome_evento" label="Evento" />
                <SortableTh sort={sort} onToggle={toggleSort} k="tipo_servico" label="Serviço" />
                <SortableTh sort={sort} onToggle={toggleSort} k="valor_bruto" label="Bruto" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="valor_liquido" label="Líquido" align="right" />
                <SortableTh sort={sort} onToggle={toggleSort} k="status" label="Status" />
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma nota encontrada.</td></tr>
              ) : filtered.map((n) => (
                <tr key={n.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">{n.data_emissao ? format(new Date(n.data_emissao), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{n.numero ?? "—"}</td>
                  <td className="px-4 py-3">{n.empresa}</td>
                  <td className="px-4 py-3">
                    <div>{n.tomador_nome}</div>
                    {n.tomador_documento && <div className="text-xs text-muted-foreground">{n.tomador_documento}</div>}
                  </td>
                  <td className="px-4 py-3">{n.nome_evento ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{n.tipo_servico ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtBRL(Number(n.valor_bruto || 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{n.valor_liquido != null ? fmtBRL(Number(n.valor_liquido)) : "—"}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[n.status] ?? n.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(n); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir nota?")) delMut.mutate(n.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar nota fiscal" : "Nova nota fiscal"}</DialogTitle>
          </DialogHeader>
          <NotaForm
            initial={editing}
            aliquotas={aliquotas ?? []}
            onSubmit={(p) => upsertMut.mutate({ ...p, id: editing?.id })}
            submitting={upsertMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotaForm({
  initial,
  aliquotas,
  onSubmit,
  submitting,
}: {
  initial: Nota | null;
  aliquotas: Array<{
    empresa: string;
    imposto: string;
    aliquota: number;
    base_calculo: number | null;
    aliquota_adicional: number | null;
    observacoes: string | null;
  }>;
  onSubmit: (p: any) => void;
  submitting: boolean;
}) {
  const [empresa, setEmpresa] = useState<string>(initial?.empresa ?? EMPRESAS[0]);
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [tipoServico, setTipoServico] = useState(initial?.tipo_servico ?? "");
  const [tomadorNome, setTomadorNome] = useState(initial?.tomador_nome ?? "");
  const [tomadorDoc, setTomadorDoc] = useState(initial?.tomador_documento ?? "");
  const [tomadorEmail, setTomadorEmail] = useState(initial?.tomador_email ?? "");
  const [nomeEvento, setNomeEvento] = useState(initial?.nome_evento ?? "");
  const [valorBruto, setValorBruto] = useState<string>(initial ? String(initial.valor_bruto) : "");
  const [dataEmissao, setDataEmissao] = useState(initial?.data_emissao ?? format(new Date(), "yyyy-MM-dd"));
  const [status, setStatus] = useState(initial?.status ?? "rascunho");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");

  const regime = EMPRESA_REGIME[empresa as Empresa];
  const aliquotasEmpresa: Aliquota[] = useMemo(() => {
    const cfg = aliquotas.filter((a) => a.empresa === empresa);
    if (cfg.length) {
      return cfg.map((a) => ({
        imposto: a.imposto,
        aliquota: Number(a.aliquota),
        base_calculo: a.base_calculo,
        aliquota_adicional: a.aliquota_adicional,
        observacoes: a.observacoes,
      }));
    }
    return IMPOSTOS_POR_REGIME[regime].map((i) => ({ imposto: i, aliquota: 0 }));
  }, [aliquotas, empresa, regime]);

  const valorBrutoNum = Number(valorBruto) || 0;
  const apuracao = useMemo(
    () => calcularImpostosPresumido(valorBrutoNum, aliquotasEmpresa),
    [valorBrutoNum, aliquotasEmpresa]
  );
  const impostosCalc: Record<string, number> = useMemo(
    () => Object.fromEntries(apuracao.itens.map((i) => [i.imposto, i.valor])),
    [apuracao]
  );
  const totalImpostos = +apuracao.itens.reduce((s, i) => s + i.valor, 0).toFixed(2);
  const valorLiquido = +(valorBrutoNum - totalImpostos).toFixed(2);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!tomadorNome) return toast.error("Informe o tomador");
        if (!valorBrutoNum) return toast.error("Informe o valor bruto");
        onSubmit({
          empresa,
          numero: numero || null,
          tipo_servico: tipoServico || null,
          tomador_nome: tomadorNome,
          tomador_documento: tomadorDoc || null,
          tomador_email: tomadorEmail || null,
          nome_evento: nomeEvento || null,
          valor_bruto: valorBrutoNum,
          valor_liquido: valorLiquido,
          impostos: impostosCalc,
          status,
          data_emissao: dataEmissao || null,
          observacoes: observacoes || null,
        });
      }}
      className="space-y-4"
    >
      <FormSection>
        <FormField label="Empresa*">
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e} — {REGIME_LABEL[EMPRESA_REGIME[e]]}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Número">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </FormField>
        <FormField label="Data de emissão">
          <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
        </FormField>
        <FormField label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Evento" wide>
          <Input value={nomeEvento} onChange={(e) => setNomeEvento(e.target.value)} placeholder="Nome do evento vinculado" />
        </FormField>
        <FormField label="Tipo de serviço" wide>
          <Input value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} placeholder="Ex.: Locação cenografia, Desenvolvimento de software…" />
        </FormField>
        <FormField label="Tomador*">
          <Input value={tomadorNome} onChange={(e) => setTomadorNome(e.target.value)} required />
        </FormField>
        <FormField label="CNPJ/CPF do tomador">
          <Input value={tomadorDoc} onChange={(e) => setTomadorDoc(e.target.value)} />
        </FormField>
        <FormField label="E-mail do tomador" wide>
          <Input type="email" value={tomadorEmail} onChange={(e) => setTomadorEmail(e.target.value)} />
        </FormField>
        <FormField label="Valor bruto (R$)*">
          <MoneyInput value={Number(valorBruto || 0)} onChange={(n) => setValorBruto(n ? String(n) : "")} />
        </FormField>
      </FormSection>

      <Card className="p-3 space-y-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Cálculo de impostos — {REGIME_LABEL[regime]}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {apuracao.itens.map((item) => {
            const cfg = aliquotasEmpresa.find((a) => a.imposto === item.imposto);
            const baseCalc = Number(cfg?.base_calculo ?? 0);
            const rotulo =
              baseCalc > 0
                ? `${item.imposto} (${item.aliquota}% s/ base ${baseCalc}%)`
                : `${item.imposto} (${item.aliquota}%)`;
            return (
              <div key={item.imposto} className="flex justify-between border border-border rounded-md px-2 py-1">
                <span className="text-muted-foreground">{rotulo}</span>
                <span className="tabular-nums">
                  {item.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span>Total impostos</span>
          <span className="tabular-nums">{totalImpostos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>Valor líquido</span>
          <span className="tabular-nums">{valorLiquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          O adicional de IRPJ (10% sobre o lucro presumido que exceder R$ 20.000/mês) é apurado na apuração mensal.
        </p>
        {!aliquotas.some((a) => a.empresa === empresa) && (
          <p className="text-xs text-muted-foreground">
            As alíquotas exibidas são padrão. Configure alíquotas reais na aba <strong>Configuração</strong>.
          </p>
        )}
      </Card>

      <FormField label="Observações" wide>
        <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </FormField>

      <FormActions>
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar"}</Button>
      </FormActions>
    </form>
  );
}
