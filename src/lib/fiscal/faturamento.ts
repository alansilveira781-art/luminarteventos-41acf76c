// Faturamento mensal usado na Projeção Tributária.
// Até 07/2026 a fonte é o histórico lançado (declaração contábil).
// A partir de 08/2026 a receita do mês vem das notas emitidas na Apuração de Impostos.

import { supabase as sb } from "@/integrations/supabase/client";
import type { FaturamentoMes } from "./engine";

/** Primeira competência em que a receita passa a ser puxada da Apuração. */
export const FATURAMENTO_AUTO_A_PARTIR_DE = "2026-08-01";

/** Status de nota que não entram no faturamento. */
const STATUS_IGNORADOS = new Set(["rascunho", "cancelada", "cancelado"]);

export type NotasPorCompetencia = Record<string, Record<string, { total: number; qtd: number }>>;

export type OrigemCompetencia = {
  fonte: "manual" | "apuracao";
  qtdNotas?: number;
};

/** Soma as notas emitidas por empresa (texto da Apuração) e competência. */
export async function carregarNotasPorCompetencia(): Promise<NotasPorCompetencia> {
  const { data, error } = await sb
    .from("contabil_notas_fiscais")
    .select("empresa,data_emissao,valor_bruto,status")
    .gte("data_emissao", FATURAMENTO_AUTO_A_PARTIR_DE);
  if (error) throw error;

  const out: NotasPorCompetencia = {};
  for (const n of (data ?? []) as any[]) {
    if (!n.empresa || !n.data_emissao) continue;
    if (STATUS_IGNORADOS.has(String(n.status ?? "").toLowerCase())) continue;
    const comp = `${String(n.data_emissao).slice(0, 7)}-01`;
    const porEmpresa = (out[n.empresa] ??= {});
    const acc = (porEmpresa[comp] ??= { total: 0, qtd: 0 });
    acc.total += Number(n.valor_bruto) || 0;
    acc.qtd += 1;
  }
  return out;
}

/**
 * Mescla o histórico lançado com o faturamento vindo da Apuração.
 * Lançamento manual sempre prevalece sobre a Apuração (correção pontual).
 */
export function mesclarFaturamento(
  manual: FaturamentoMes[],
  notasDaEmpresa: Record<string, { total: number; qtd: number }> | undefined,
): { serie: FaturamentoMes[]; origem: Record<string, OrigemCompetencia> } {
  const origem: Record<string, OrigemCompetencia> = {};
  const mapa = new Map<string, FaturamentoMes>();

  for (const m of manual) {
    mapa.set(m.competencia, m);
    origem[m.competencia] = { fonte: "manual" };
  }

  for (const [comp, agg] of Object.entries(notasDaEmpresa ?? {})) {
    if (comp < FATURAMENTO_AUTO_A_PARTIR_DE) continue;
    if (mapa.has(comp)) continue; // manual prevalece
    mapa.set(comp, { competencia: comp, receita_bruta: agg.total, folha_bruta: 0 });
    origem[comp] = { fonte: "apuracao", qtdNotas: agg.qtd };
  }

  const serie = [...mapa.values()].sort((a, b) => a.competencia.localeCompare(b.competencia));
  return { serie, origem };
}
