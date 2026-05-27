import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSection, FormActions } from "@/components/FormSection";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EMPRESAS, EMPRESA_REGIME, REGIME_LABEL, IMPOSTOS_POR_REGIME, type Empresa } from "@/lib/empresas";

const sb = supabase as any;

export const Route = createFileRoute("/contabil/configuracao")({
  component: ConfiguracaoPage,
});

type Aliquota = {
  id: string;
  empresa: string;
  regime: string;
  imposto: string;
  base_calculo: number;
  aliquota: number;
  aliquota_adicional: number;
  ativo: boolean;
  observacoes: string | null;
};

function ConfiguracaoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Aliquota | null>(null);

  const { data: aliquotas } = useQuery({
    queryKey: ["contabil-aliquotas-full"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contabil_configuracao_aliquotas")
        .select("*")
        .order("empresa")
        .order("imposto");
      if (error) throw error;
      return (data ?? []) as Aliquota[];
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (p: Partial<Aliquota> & { id?: string }) => {
      if (p.id) {
        const { error } = await sb.from("contabil_configuracao_aliquotas").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("contabil_configuracao_aliquotas").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-aliquotas"] });
      qc.invalidateQueries({ queryKey: ["contabil-aliquotas-full"] });
      toast.success("Alíquota salva");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contabil_configuracao_aliquotas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-aliquotas"] });
      qc.invalidateQueries({ queryKey: ["contabil-aliquotas-full"] });
      toast.success("Removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: async (empresa: Empresa) => {
      const regime = EMPRESA_REGIME[empresa];
      const defaults: Record<string, { base_calculo: number; aliquota: number; aliquota_adicional?: number; observacoes?: string }> = {
        ISS: { base_calculo: 0, aliquota: 0 },
        PIS: { base_calculo: 0, aliquota: 0.65 },
        COFINS: { base_calculo: 0, aliquota: 3 },
        IRPJ: { base_calculo: 32, aliquota: 15, aliquota_adicional: 10, observacoes: "limite=20000" },
        CSLL: { base_calculo: 32, aliquota: 9 },
        DAS: { base_calculo: 0, aliquota: 0 },
      };
      const existentes = new Set((aliquotas ?? []).filter((a) => a.empresa === empresa).map((a) => a.imposto));
      const toInsert = IMPOSTOS_POR_REGIME[regime]
        .filter((i) => !existentes.has(i))
        .map((imposto) => ({
          empresa,
          regime,
          imposto,
          base_calculo: defaults[imposto]?.base_calculo ?? 0,
          aliquota: defaults[imposto]?.aliquota ?? 0,
          aliquota_adicional: defaults[imposto]?.aliquota_adicional ?? 0,
          observacoes: defaults[imposto]?.observacoes ?? null,
          ativo: true,
        }));
      if (!toInsert.length) return;
      const { error } = await sb.from("contabil_configuracao_aliquotas").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contabil-aliquotas-full"] });
      toast.success("Impostos padrão criados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Configuração tributária"
        description="Base de cálculo, alíquota e adicional (quando aplicável) de cada imposto por empresa"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova alíquota
          </Button>
        }
      />

      {EMPRESAS.map((empresa) => {
        const regime = EMPRESA_REGIME[empresa];
        const linhas = (aliquotas ?? []).filter((a) => a.empresa === empresa);
        return (
          <Card key={empresa} className="mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{empresa}</div>
                <div className="text-xs text-muted-foreground">{REGIME_LABEL[regime]}</div>
              </div>
              {linhas.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => seedMut.mutate(empresa)}>
                  Criar impostos padrão
                </Button>
              )}
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2">Imposto</th>
                  <th className="px-4 py-2 text-right">Base de cálculo (%)</th>
                  <th className="px-4 py-2 text-right">Alíquota (%)</th>
                  <th className="px-4 py-2 text-right">Alíquota adicional (%)</th>
                  <th className="px-4 py-2">Observações</th>
                  <th className="px-4 py-2">Ativo</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">Nenhuma alíquota cadastrada.</td></tr>
                ) : linhas.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{a.imposto}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(a.base_calculo).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(a.aliquota).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(a.aliquota_adicional).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{a.observacoes ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{a.ativo ? "Sim" : "Não"}</td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) delMut.mutate(a.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar alíquota" : "Nova alíquota"}</DialogTitle>
          </DialogHeader>
          <AliquotaForm
            initial={editing}
            onSubmit={(p) => upsertMut.mutate({ ...p, id: editing?.id })}
            submitting={upsertMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AliquotaForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial: Aliquota | null;
  onSubmit: (p: any) => void;
  submitting: boolean;
}) {
  const [empresa, setEmpresa] = useState<string>(initial?.empresa ?? EMPRESAS[0]);
  const [imposto, setImposto] = useState(initial?.imposto ?? "");
  const [baseCalculo, setBaseCalculo] = useState<string>(initial ? String(initial.base_calculo) : "0");
  const [aliquota, setAliquota] = useState<string>(initial ? String(initial.aliquota) : "0");
  const [aliquotaAdicional, setAliquotaAdicional] = useState<string>(initial ? String(initial.aliquota_adicional ?? 0) : "0");
  const [ativo, setAtivo] = useState<string>(initial ? (initial.ativo ? "1" : "0") : "1");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const regime = EMPRESA_REGIME[empresa as Empresa];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!imposto.trim()) return toast.error("Informe o imposto");
        onSubmit({
          empresa,
          regime,
          imposto: imposto.trim().toUpperCase(),
          base_calculo: Number(baseCalculo) || 0,
          aliquota: Number(aliquota) || 0,
          aliquota_adicional: Number(aliquotaAdicional) || 0,
          ativo: ativo === "1",
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
        <FormField label="Imposto*">
          <Input value={imposto} onChange={(e) => setImposto(e.target.value)} placeholder="Ex.: PIS, COFINS, IRPJ, CSLL, DAS…" required />
        </FormField>
        <FormField label="Base de cálculo (%)*">
          <Input type="number" step="0.01" value={baseCalculo} onChange={(e) => setBaseCalculo(e.target.value)} required />
        </FormField>
        <FormField label="Alíquota (%)*">
          <Input type="number" step="0.01" value={aliquota} onChange={(e) => setAliquota(e.target.value)} required />
        </FormField>
        <FormField label="Alíquota adicional (%) — só IRPJ">
          <Input type="number" step="0.01" value={aliquotaAdicional} onChange={(e) => setAliquotaAdicional(e.target.value)} />
        </FormField>
        <FormField label="Ativo">
          <Select value={ativo} onValueChange={setAtivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Sim</SelectItem>
              <SelectItem value="0">Não</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Observações (use limite=20000 para o adicional do IRPJ)" wide>
          <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </FormField>
      </FormSection>
      <FormActions>
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar"}</Button>
      </FormActions>
    </form>
  );
}
