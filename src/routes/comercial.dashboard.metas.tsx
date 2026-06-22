import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/comercial/dashboard/metas")({
  component: MetasPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const CLASSIFICACOES = ["Cenografia", "Social", "Stand", "Corporativo"] as const;

type MetaRow = { ano: number; mes: number; classificacao: string; valor_meta: number };

const cellKey = (mes: number, c: string) => `${mes}-${c}`;
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function MetasPage() {
  const { isAdmin, modulos } = useAuth();
  const isComercialAdmin = isAdmin || modulos.some((m) => m.slug === "comercial" && m.is_admin);

  const anoAtual = new Date().getFullYear();
  const anos = useMemo(() => {
    const out: number[] = [];
    for (let a = anoAtual - 5; a <= anoAtual + 2; a++) out.push(a);
    return out;
  }, [anoAtual]);

  const [ano, setAno] = useState<number>(anoAtual);
  const qc = useQueryClient();

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["comercial-metas", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comercial_metas")
        .select("ano,mes,classificacao,valor_meta")
        .eq("ano", ano);
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  const [valores, setValores] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (let mes = 1; mes <= 12; mes++) {
      for (const c of CLASSIFICACOES) {
        next[cellKey(mes, c)] = 0;
      }
    }
    for (const r of metas) {
      next[cellKey(r.mes, r.classificacao)] = Number(r.valor_meta) || 0;
    }
    setValores(next);
  }, [metas]);

  const [saving, setSaving] = useState(false);
  async function salvar() {
    setSaving(true);
    try {
      const rows: MetaRow[] = [];
      for (let mes = 1; mes <= 12; mes++) {
        for (const c of CLASSIFICACOES) {
          rows.push({ ano, mes, classificacao: c, valor_meta: valores[cellKey(mes, c)] || 0 });
        }
      }
      const { error } = await supabase
        .from("comercial_metas")
        .upsert(rows, { onConflict: "ano,mes,classificacao" });
      if (error) throw error;
      toast.success("Metas salvas");
      qc.invalidateQueries({ queryKey: ["comercial-metas", ano] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const totalPorMes = (mes: number) =>
    CLASSIFICACOES.reduce((s, c) => s + (valores[cellKey(mes, c)] || 0), 0);
  const totalPorClass = (c: string) => {
    let s = 0;
    for (let mes = 1; mes <= 12; mes++) s += valores[cellKey(mes, c)] || 0;
    return s;
  };
  const totalGeral = CLASSIFICACOES.reduce((s, c) => s + totalPorClass(c), 0);

  if (!isComercialAdmin) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Acesso restrito — somente administradores do comercial podem visualizar e editar metas.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Button onClick={salvar} disabled={saving || isLoading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar metas
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando metas...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Mês</th>
                {CLASSIFICACOES.map((c) => (
                  <th key={c} className="text-right px-3 py-2 font-medium">{c}</th>
                ))}
                <th className="text-right px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((nome, idx) => {
                const mes = idx + 1;
                return (
                  <tr key={mes} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{nome}</td>
                    {CLASSIFICACOES.map((c) => (
                      <td key={c} className="px-2 py-1">
                        <MoneyInput
                          hidePrefix
                          value={valores[cellKey(mes, c)] ?? 0}
                          onChange={(v) =>
                            setValores((prev) => ({ ...prev, [cellKey(mes, c)]: v }))
                          }
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmt(totalPorMes(mes))}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2">Total</td>
                {CLASSIFICACOES.map((c) => (
                  <td key={c} className="px-3 py-2 text-right tabular-nums">{fmt(totalPorClass(c))}</td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalGeral)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
