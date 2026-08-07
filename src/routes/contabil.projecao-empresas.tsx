import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/MoneyInput";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addMeses, brl, competenciaAtual, rotuloCompetencia,
  REGIME_LABEL_FISCAL, type EmpresaFiscal, type Regime,
} from "@/lib/fiscal/engine";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/projecao-empresas")({
  head: () => ({
    meta: [
      { title: "Empresas fiscais — Projeção Tributária" },
      {
        name: "description",
        content:
          "Cadastro fiscal das empresas do grupo e lançamento do faturamento mensal usado na projeção tributária.",
      },
      { property: "og:title", content: "Empresas fiscais — Projeção Tributária" },
      {
        property: "og:description",
        content:
          "Cadastro fiscal das empresas do grupo e lançamento do faturamento mensal usado na projeção tributária.",
      },
    ],
  }),
  component: ProjecaoEmpresas,
});

type Form = {
  id?: string;
  nome: string;
  cnpj: string;
  regime: Regime;
  anexo: string;
  inicio_atividade: string;
  iss_aliquota: number;
  rat: number;
  presuncao_irpj: number;
  presuncao_csll: number;
  adicional_irpj_ativo: boolean;
  cnaes: string;
  atividades: string;
  ativo: boolean;
};

const vazio: Form = {
  nome: "",
  cnpj: "",
  regime: "presumido",
  anexo: "",
  inicio_atividade: "",
  iss_aliquota: 0,
  rat: 2,
  presuncao_irpj: 32,
  presuncao_csll: 32,
  adicional_irpj_ativo: false,
  cnaes: "",
  atividades: "",
  ativo: true,
};

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <Input
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="pr-7"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
    </div>
  );
}

function ProjecaoEmpresas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(vazio);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["fiscal-empresas"],
    queryFn: async () => {
      const { data, error } = await sb.from("fiscal_empresas").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as EmpresaFiscal[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const row = {
        nome: f.nome.trim(),
        cnpj: f.cnpj.trim() || null,
        regime: f.regime,
        anexo: f.regime === "simples" ? Number(f.anexo) || null : null,
        inicio_atividade: f.inicio_atividade || null,
        iss_aliquota: Number(f.iss_aliquota) || 0,
        rat: Number(f.rat) || 0,
        presuncao_irpj: Number(f.presuncao_irpj) || 0,
        presuncao_csll: Number(f.presuncao_csll) || 0,
        adicional_irpj_ativo: f.adicional_irpj_ativo,
        cnaes: f.cnaes.split(",").map((s) => s.trim()).filter(Boolean),
        atividades: f.atividades.split(",").map((s) => s.trim()).filter(Boolean),
        ativo: f.ativo,
      };
      if (f.id) {
        const { error } = await sb.from("fiscal_empresas").update(row).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("fiscal_empresas").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Empresa salva");
      qc.invalidateQueries({ queryKey: ["fiscal-empresas"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("fiscal_empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa removida");
      qc.invalidateQueries({ queryKey: ["fiscal-empresas"] });
      qc.invalidateQueries({ queryKey: ["fiscal-faturamento"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/contabil/projecao">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para a projeção
          </Link>
        </Button>
        <PageHeader
          title="Empresas fiscais"
          description="Parâmetros usados na Projeção Tributária: regime, anexo do Simples, ISS municipal, RAT, presunções e as atividades que cada empresa pode faturar."
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Cadastro</h2>
          <Button size="sm" onClick={() => { setForm(vazio); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova empresa
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : empresas.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 px-3">Regime</th>
                  <th className="py-2 px-3 text-right">ISS</th>
                  <th className="py-2 px-3 text-right">RAT</th>
                  <th className="py-2 px-3 text-right">Presunções</th>
                  <th className="py-2 px-3">Atividades</th>
                  <th className="py-2 px-3 text-center">Ativa</th>
                  <th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/40 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{e.nome}</div>
                      {e.cnpj && <div className="text-xs text-muted-foreground">{e.cnpj}</div>}
                      {e.inicio_atividade && (
                        <div className="text-[11px] text-muted-foreground">
                          Início: {new Date(`${e.inicio_atividade}T12:00:00`).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="secondary">
                        {REGIME_LABEL_FISCAL[e.regime]}
                        {e.regime === "simples" && e.anexo ? ` · Anexo ${e.anexo}` : ""}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{e.iss_aliquota}%</td>
                    <td className="py-2 px-3 text-right tabular-nums">{e.rat}%</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs">
                      IRPJ {e.presuncao_irpj}% · CSLL {e.presuncao_csll}%
                      {e.adicional_irpj_ativo && (
                        <div className="text-[11px] text-muted-foreground">Adicional ativo</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground max-w-[220px]">
                      {(e.atividades ?? []).join(", ") || "—"}
                    </td>
                    <td className="py-2 px-3 text-center">{e.ativo ? "Sim" : "Não"}</td>
                    <td className="py-2 pl-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => {
                            setForm({
                              id: e.id,
                              nome: e.nome,
                              cnpj: e.cnpj ?? "",
                              regime: e.regime,
                              anexo: e.anexo ? String(e.anexo) : "",
                              inicio_atividade: e.inicio_atividade ?? "",
                              iss_aliquota: Number(e.iss_aliquota) || 0,
                              rat: Number(e.rat) || 0,
                              presuncao_irpj: Number(e.presuncao_irpj) || 0,
                              presuncao_csll: Number(e.presuncao_csll) || 0,
                              adicional_irpj_ativo: e.adicional_irpj_ativo,
                              cnaes: (e.cnaes ?? []).join(", "),
                              atividades: (e.atividades ?? []).join(", "),
                              ativo: e.ativo,
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover "${e.nome}" e todo o faturamento lançado?`)) {
                              remover.mutate(e.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FaturamentoCard empresas={empresas} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Regime</Label>
                <Select
                  value={form.regime}
                  onValueChange={(v) => setForm({ ...form, regime: v as Regime })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples Nacional</SelectItem>
                    <SelectItem value="presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Anexo {form.regime === "simples" && <span className="text-destructive">*</span>}</Label>
                <Select
                  value={form.anexo || "__none"}
                  onValueChange={(v) => setForm({ ...form, anexo: v === "__none" ? "" : v })}
                  disabled={form.regime !== "simples"}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>Anexo {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Início de atividade</Label>
                <Input
                  type="date"
                  value={form.inicio_atividade}
                  onChange={(e) => setForm({ ...form, inicio_atividade: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>ISS municipal</Label>
                <PercentInput value={form.iss_aliquota} onChange={(v) => setForm({ ...form, iss_aliquota: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>RAT</Label>
                <PercentInput value={form.rat} onChange={(v) => setForm({ ...form, rat: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Presunção IRPJ</Label>
                <PercentInput value={form.presuncao_irpj} onChange={(v) => setForm({ ...form, presuncao_irpj: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Presunção CSLL</Label>
                <PercentInput value={form.presuncao_csll} onChange={(v) => setForm({ ...form, presuncao_csll: v })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Atividades (separadas por vírgula)</Label>
              <Input
                value={form.atividades}
                onChange={(e) => setForm({ ...form, atividades: e.target.value })}
                placeholder="Apoio administrativo, Cenografia, Montagem de stand"
              />
              <p className="text-[11px] text-muted-foreground">
                A projeção bloqueia a empresa quando a atividade da nota não estiver nesta lista.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>CNAEs (separados por vírgula)</Label>
              <Input value={form.cnaes} onChange={(e) => setForm({ ...form, cnaes: e.target.value })} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Adicional de IRPJ já ativo</div>
                <div className="text-xs text-muted-foreground">
                  Marque quando a empresa já ultrapassa o limite mensal de R$ 20.000 de lucro presumido.
                </div>
              </div>
              <Switch
                checked={form.adicional_irpj_ativo}
                onCheckedChange={(v) => setForm({ ...form, adicional_irpj_ativo: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="text-sm font-medium">Empresa ativa</div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.nome.trim()) return toast.error("Informe o nome");
                if (form.regime === "simples" && !form.anexo)
                  return toast.error("Empresas no Simples precisam de um anexo");
                salvar.mutate(form);
              }}
              disabled={salvar.isPending}
            >
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function FaturamentoCard({ empresas }: { empresas: EmpresaFiscal[] }) {
  const qc = useQueryClient();
  const [empresaId, setEmpresaId] = useState<string>("");
  const selecionada = empresaId || empresas[0]?.id || "";

  const competencias = useMemo(() => {
    const atual = competenciaAtual();
    return Array.from({ length: 18 }, (_, i) => addMeses(atual, -i));
  }, []);

  const { data: linhas = [], isLoading } = useQuery({
    enabled: !!selecionada,
    queryKey: ["fiscal-faturamento-empresa", selecionada],
    queryFn: async () => {
      const { data, error } = await sb
        .from("fiscal_faturamento")
        .select("id,competencia,receita_bruta,folha_bruta")
        .eq("empresa_id", selecionada)
        .order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const mapa = useMemo(() => {
    const m: Record<string, { receita: number; folha: number }> = {};
    for (const l of linhas) {
      m[l.competencia] = {
        receita: Number(l.receita_bruta) || 0,
        folha: Number(l.folha_bruta) || 0,
      };
    }
    return m;
  }, [linhas]);

  const [edicao, setEdicao] = useState<Record<string, { receita: number; folha: number }>>({});

  const valorDe = (c: string) => edicao[c] ?? mapa[c] ?? { receita: 0, folha: 0 };

  const salvar = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(edicao).map(([competencia, v]) => ({
        empresa_id: selecionada,
        competencia,
        receita_bruta: v.receita,
        folha_bruta: v.folha,
      }));
      if (!rows.length) return;
      const { error } = await sb
        .from("fiscal_faturamento")
        .upsert(rows, { onConflict: "empresa_id,competencia" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faturamento salvo");
      setEdicao({});
      qc.invalidateQueries({ queryKey: ["fiscal-faturamento-empresa", selecionada] });
      qc.invalidateQueries({ queryKey: ["fiscal-faturamento"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const total12 = competencias
    .slice(0, 12)
    .reduce((a, c) => a + valorDe(c).receita, 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-sm font-semibold">Faturamento mensal</h2>
        <div className="flex items-center gap-2">
          <Select value={selecionada} onValueChange={(v) => { setEmpresaId(v); setEdicao({}); }}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || Object.keys(edicao).length === 0}
          >
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Receita bruta e folha (salários + pró-labore, sem encargos) por competência. Últimos 12 meses
        lançados: <strong className="tabular-nums">{brl(total12)}</strong>.
      </p>

      {isLoading ? (
        <div className="p-6 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-2 pr-3">Competência</th>
                <th className="py-2 px-3">Receita bruta</th>
                <th className="py-2 pl-3">Folha bruta</th>
              </tr>
            </thead>
            <tbody>
              {competencias.map((c) => {
                const v = valorDe(c);
                return (
                  <tr key={c} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 tabular-nums">{rotuloCompetencia(c)}</td>
                    <td className="py-1.5 px-3">
                      <MoneyInput
                        value={v.receita}
                        onChange={(n) => setEdicao((p) => ({ ...p, [c]: { ...v, receita: n } }))}
                      />
                    </td>
                    <td className="py-1.5 pl-3">
                      <MoneyInput
                        value={v.folha}
                        onChange={(n) => setEdicao((p) => ({ ...p, [c]: { ...v, folha: n } }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
