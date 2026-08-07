/**
 * Motor de projeção tributária.
 *
 * Módulo puro: sem React, sem Supabase. Recebe todos os dados por parâmetro
 * para poder ser testado isoladamente.
 *
 * Convenção: todo percentual é armazenado em base 100 (16 significa 16%).
 * A conversão para decimal acontece só dentro do cálculo. Nenhum
 * arredondamento intermediário — só na formatação para exibição.
 */

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export type Regime = "simples" | "presumido" | "real";

export type FaixaSimples = {
  anexo: number;
  faixa: number;
  limite_min: number;
  limite_max: number;
  aliquota_nominal: number;
  parcela_deduzir: number;
  rep_irpj: number | null;
  rep_csll: number | null;
  rep_cofins: number | null;
  rep_pis: number | null;
  rep_cpp: number | null;
  rep_iss: number | null;
  rep_icms: number | null;
};

export type EmpresaFiscal = {
  id: string;
  nome: string;
  cnpj: string | null;
  regime: Regime;
  anexo: number | null;
  inicio_atividade: string | null;
  iss_aliquota: number;
  rat: number;
  presuncao_irpj: number;
  presuncao_csll: number;
  adicional_irpj_ativo: boolean;
  cnaes: string[];
  atividades: string[];
  ativo: boolean;
};

export type FaturamentoMes = {
  competencia: string; // "YYYY-MM-DD" (dia 1)
  receita_bruta: number;
  folha_bruta: number;
};

export type PassoCalculo = {
  ordem: number;
  titulo: string;
  formula: string;
  substituicao: string;
  resultado: string;
  nota?: string;
};

export type Severidade = "informativa" | "atencao" | "alta" | "critica";

export type Alerta = { severidade: Severidade; texto: string };

export type LinhaTributo = {
  tributo: string;
  base: number;
  aliquota: number; // base 100
  valor: number;
  nota?: string;
};

export type MesProjecao = {
  rotulo: string;
  competencia: string;
  receita: number;
  rbt12: number;
  aliquotaEfetiva: number; // base 100
  das: number;
};

export type ResultadoEmpresa = {
  empresa: EmpresaFiscal;
  bloqueada: boolean;
  motivoBloqueio?: string;
  regimeLabel: string;

  rbt12: number;
  regraRbt12: "normal" | "inicio_atividade" | "sem_historico";
  mesesHistorico: number;
  faixa: number | null;
  anexoAplicado: number | null;
  trocaAnexoFatorR: boolean;
  fatorR: number | null;
  folha12: number;
  receitaMedia: number;

  aliquotaEfetiva: number; // sobre a nota, base 100
  custoImediato: number;
  arrasto: number;
  custoTotal: number;
  aliquotaMarginal: number; // base 100

  encargoFolhaInformativo: number;
  encargoFolhaNota?: string;

  composicao: LinhaTributo[];
  repartricaoIndisponivel: boolean;
  descritivo: string;
  memoria: PassoCalculo[];
  alertas: Alerta[];
  projecaoBase: MesProjecao[];
  projecaoComNota: MesProjecao[];
};

export type ResultadoAnalise = {
  valor: number;
  atividade: string | null;
  competencia: string;
  empresas: ResultadoEmpresa[];
  vencedoraId: string | null;
  economia: number;
  diferencaIrrelevante: boolean;
};

// ─────────────────────────────────────────────────────────────
// Formatação (usada nas substituições da memória de cálculo)
// ─────────────────────────────────────────────────────────────

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0,
  );

export const pct = (v: number, casas = 2) =>
  `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number.isFinite(v) ? v : 0)}%`;

const num = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    Number.isFinite(v) ? v : 0,
  );

// ─────────────────────────────────────────────────────────────
// Datas de competência
// ─────────────────────────────────────────────────────────────

export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMeses(competencia: string, n: number): string {
  const [y, m] = competencia.split("-").map(Number);
  const total = (y ?? 1970) * 12 + ((m ?? 1) - 1) + n;
  const ay = Math.floor(total / 12);
  const am = (total % 12) + 1;
  return `${ay}-${String(am).padStart(2, "0")}-01`;
}

export function rotuloCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-");
  return `${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────
// 3.1 RBT12
// ─────────────────────────────────────────────────────────────

/**
 * RBT12 a partir da série de receitas anteriores à competência
 * (ordem cronológica crescente, a mais recente por último).
 *
 * 12 meses ou mais  → soma dos 12 meses anteriores.
 * Início de atividade:
 *   1 mês de histórico  → receita do próprio mês × 12
 *   2 a 11 meses        → média aritmética dos meses anteriores × 12
 */
export function calcularRbt12(receitasAnteriores: number[]): {
  rbt12: number;
  regra: "normal" | "inicio_atividade" | "sem_historico";
  meses: number;
} {
  const meses = receitasAnteriores.length;
  if (meses === 0) return { rbt12: 0, regra: "sem_historico", meses: 0 };
  if (meses >= 12) {
    const ultimos = receitasAnteriores.slice(-12);
    return { rbt12: ultimos.reduce((a, b) => a + b, 0), regra: "normal", meses };
  }
  const media = receitasAnteriores.reduce((a, b) => a + b, 0) / meses;
  return { rbt12: media * 12, regra: "inicio_atividade", meses };
}

// ─────────────────────────────────────────────────────────────
// 3.2 Faixa e alíquota efetiva
// ─────────────────────────────────────────────────────────────

export function faixaDoRbt12(faixas: FaixaSimples[], anexo: number, rbt12: number) {
  const doAnexo = faixas
    .filter((f) => f.anexo === anexo)
    .sort((a, b) => a.faixa - b.faixa);
  if (doAnexo.length === 0) return null;
  return doAnexo.find((f) => rbt12 <= f.limite_max) ?? doAnexo[doAnexo.length - 1]!;
}

/** Alíquota efetiva em base 100. */
export function aliquotaEfetiva(faixa: FaixaSimples, rbt12: number): number {
  if (rbt12 <= 0) return faixa.aliquota_nominal;
  return ((rbt12 * (faixa.aliquota_nominal / 100) - faixa.parcela_deduzir) / rbt12) * 100;
}

// ─────────────────────────────────────────────────────────────
// 3.3 Fator R
// ─────────────────────────────────────────────────────────────

export function calcularFatorR(folha12: number, rbt12: number): number | null {
  if (rbt12 <= 0) return null;
  return folha12 / rbt12;
}

// ─────────────────────────────────────────────────────────────
// 3.5 Encargos sobre folha
// ─────────────────────────────────────────────────────────────

export function percentualEncargoFolha(rat: number): number {
  return 20 + rat + 5.8;
}

// ─────────────────────────────────────────────────────────────
// 3.4 Simulação de 12 meses
// ─────────────────────────────────────────────────────────────

/**
 * Projeta a competência (mês 0) e os 12 meses seguintes.
 * `historico` são as receitas anteriores à competência, em ordem cronológica.
 */
function projetar(
  faixas: FaixaSimples[],
  anexo: number,
  competencia: string,
  historico: number[],
  receitaMedia: number,
  valorNoMesZero: number,
): MesProjecao[] {
  const serie = [...historico];
  const meses: MesProjecao[] = [];

  for (let k = 0; k <= 12; k++) {
    const { rbt12 } = calcularRbt12(serie);
    const faixa = faixaDoRbt12(faixas, anexo, rbt12);
    const aliq = faixa ? aliquotaEfetiva(faixa, rbt12) : 0;
    const receita = receitaMedia + (k === 0 ? valorNoMesZero : 0);
    const comp = addMeses(competencia, k);
    meses.push({
      rotulo: k === 0 ? `${rotuloCompetencia(comp)} (competência)` : rotuloCompetencia(comp),
      competencia: comp,
      receita,
      rbt12,
      aliquotaEfetiva: aliq,
      das: receita * (aliq / 100),
    });
    serie.push(receita);
  }
  return meses;
}

const somaDas = (meses: MesProjecao[]) => meses.reduce((a, m) => a + m.das, 0);

// ─────────────────────────────────────────────────────────────
// Cálculo por empresa
// ─────────────────────────────────────────────────────────────

export const REGIME_LABEL_FISCAL: Record<Regime, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
};

const MSG_BLOQUEIO =
  "Esta empresa não tem CNAE compatível com a atividade selecionada. A nota precisa ser emitida pela empresa que efetivamente prestou o serviço — direcionar receita entre CNPJs apenas pela alíquota configura simulação fiscal.";

export function calcularEmpresa(params: {
  empresa: EmpresaFiscal;
  faturamento: FaturamentoMes[];
  faixas: FaixaSimples[];
  valor: number;
  competencia: string;
  atividade: string | null;
  folhaIncremental?: number;
}): ResultadoEmpresa {
  const { empresa, faturamento, faixas, valor, competencia, atividade } = params;
  const folhaIncremental = params.folhaIncremental ?? 0;

  const anteriores = faturamento
    .filter((f) => f.competencia < competencia)
    .sort((a, b) => a.competencia.localeCompare(b.competencia));

  const receitas = anteriores.map((f) => Number(f.receita_bruta) || 0);
  const folhas = anteriores.map((f) => Number(f.folha_bruta) || 0);
  const { rbt12, regra, meses } = calcularRbt12(receitas);
  const folha12 = folhas.slice(-12).reduce((a, b) => a + b, 0);
  const receitaMedia = receitas.length ? receitas.slice(-12).reduce((a, b) => a + b, 0) / Math.min(receitas.length, 12) : 0;

  const bloqueada =
    !!atividade && !(empresa.atividades ?? []).includes(atividade);

  const base = {
    empresa,
    bloqueada,
    motivoBloqueio: bloqueada ? MSG_BLOQUEIO : undefined,
    rbt12,
    regraRbt12: regra,
    mesesHistorico: meses,
    folha12,
    receitaMedia,
  };

  if (empresa.regime === "simples") {
    return calcularSimples({ ...params, ...base, receitas });
  }
  return calcularPresumido({ ...params, ...base, folhaIncremental });
}

// ── Simples Nacional ──────────────────────────────────────────

function calcularSimples(p: {
  empresa: EmpresaFiscal;
  faixas: FaixaSimples[];
  valor: number;
  competencia: string;
  bloqueada: boolean;
  motivoBloqueio?: string;
  rbt12: number;
  regraRbt12: "normal" | "inicio_atividade" | "sem_historico";
  mesesHistorico: number;
  folha12: number;
  receitaMedia: number;
  receitas: number[];
}): ResultadoEmpresa {
  const { empresa, faixas, valor, competencia, rbt12, folha12, receitaMedia, receitas } = p;
  const memoria: PassoCalculo[] = [];
  const alertas: Alerta[] = [];
  let ordem = 1;

  const anexoOriginal = empresa.anexo ?? 3;
  const fatorR = calcularFatorR(folha12, rbt12);

  // Passo — RBT12
  memoria.push({
    ordem: ordem++,
    titulo: "RBT12 (receita bruta dos 12 meses anteriores)",
    formula:
      p.regraRbt12 === "normal"
        ? "soma das receitas dos 12 meses anteriores à competência"
        : "média das receitas dos meses anteriores × 12 (regra de início de atividade)",
    substituicao:
      p.regraRbt12 === "normal"
        ? `soma de ${p.mesesHistorico >= 12 ? 12 : p.mesesHistorico} meses lançados`
        : `${brl(receitaMedia)} × 12`,
    resultado: brl(rbt12),
    nota:
      p.regraRbt12 === "inicio_atividade"
        ? `Regra de início de atividade aplicada: a empresa tem ${p.mesesHistorico} ${p.mesesHistorico === 1 ? "mês" : "meses"} de histórico lançado.`
        : p.regraRbt12 === "sem_historico"
          ? "Nenhum faturamento lançado. Cadastre a receita mensal para uma projeção fiel."
          : `Regra normal: ${p.mesesHistorico} meses de histórico lançado.`,
  });

  // Passo — Fator R / anexo aplicado
  let anexoAplicado = anexoOriginal;
  let trocaAnexoFatorR = false;
  if (fatorR !== null) {
    if (anexoOriginal === 5 && fatorR >= 0.28) {
      anexoAplicado = 3;
      trocaAnexoFatorR = true;
    }
    memoria.push({
      ordem: ordem++,
      titulo: "Fator R",
      formula: "folha dos últimos 12 meses ÷ RBT12",
      substituicao: `${brl(folha12)} ÷ ${brl(rbt12)}`,
      resultado: pct(fatorR * 100),
      nota: trocaAnexoFatorR
        ? "Fator R igual ou acima de 28%: a tributação passa do Anexo V para o Anexo III."
        : anexoOriginal === 5
          ? "Fator R abaixo de 28%: permanece no Anexo V."
          : undefined,
    });
  }

  const faixa = faixaDoRbt12(faixas, anexoAplicado, rbt12);
  const aliq = faixa ? aliquotaEfetiva(faixa, rbt12) : 0;

  if (faixa) {
    memoria.push({
      ordem: ordem++,
      titulo: "Faixa do anexo",
      formula: "primeira faixa do anexo em que RBT12 ≤ limite superior",
      substituicao: `${brl(rbt12)} ≤ ${brl(faixa.limite_max)}`,
      resultado: `Anexo ${anexoAplicado} · ${faixa.faixa}ª faixa (nominal ${pct(faixa.aliquota_nominal)}, dedução ${brl(faixa.parcela_deduzir)})`,
    });
    memoria.push({
      ordem: ordem++,
      titulo: "Alíquota efetiva",
      formula: "(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12",
      substituicao:
        rbt12 > 0
          ? `(${brl(rbt12)} × ${pct(faixa.aliquota_nominal)} − ${brl(faixa.parcela_deduzir)}) ÷ ${brl(rbt12)}`
          : "RBT12 igual a zero — usada a alíquota nominal da 1ª faixa",
      resultado: pct(aliq),
    });
  }

  const custoImediato = valor * (aliq / 100);
  memoria.push({
    ordem: ordem++,
    titulo: "DAS imediato sobre a nota",
    formula: "valor da nota × alíquota efetiva",
    substituicao: `${brl(valor)} × ${pct(aliq)}`,
    resultado: brl(custoImediato),
  });

  // Simulação dos 12 meses seguintes
  const projecaoBase = projetar(faixas, anexoAplicado, competencia, receitas, receitaMedia, 0);
  const projecaoComNota = projetar(faixas, anexoAplicado, competencia, receitas, receitaMedia, valor);
  const totalBase = somaDas(projecaoBase);
  const totalComNota = somaDas(projecaoComNota);
  const arrasto = totalComNota - totalBase - custoImediato;
  const custoTotal = custoImediato + arrasto;
  const marginal = valor > 0 ? (custoTotal / valor) * 100 : 0;

  memoria.push({
    ordem: ordem++,
    titulo: "Arrasto sobre os 12 meses seguintes",
    formula: "DAS total do cenário com a nota − DAS total do cenário base − DAS imediato",
    substituicao: `${brl(totalComNota)} − ${brl(totalBase)} − ${brl(custoImediato)}`,
    resultado: brl(arrasto),
    nota: "Como o Simples é progressivo, a nota permanece no RBT12 por 12 meses e eleva a alíquota de toda a receita desse período.",
  });
  memoria.push({
    ordem: ordem++,
    titulo: "Custo total e alíquota marginal",
    formula: "custo total = DAS imediato + arrasto · alíquota marginal = custo total ÷ valor da nota",
    substituicao: `${brl(custoImediato)} + ${brl(arrasto)} · ${brl(custoTotal)} ÷ ${brl(valor)}`,
    resultado: `${brl(custoTotal)} · ${pct(marginal)}`,
  });

  // Encargo de folha
  const encargoPct = percentualEncargoFolha(empresa.rat);
  let encargoFolhaInformativo = 0;
  let encargoFolhaNota: string | undefined;
  if (anexoAplicado === 4) {
    encargoFolhaInformativo = (folha12 / 12) * (encargoPct / 100);
    encargoFolhaNota = `O Anexo IV não inclui a CPP no DAS. Encargo de ${pct(encargoPct)} sobre a folha mensal média (${brl(folha12 / 12)}) — custo fixo mensal, não atribuível a esta nota.`;
    memoria.push({
      ordem: ordem++,
      titulo: "Encargo sobre a folha (Anexo IV)",
      formula: "(20% INSS patronal + RAT + 5,8% terceiros) × folha mensal média",
      substituicao: `(20% + ${pct(empresa.rat)} + 5,80%) × ${brl(folha12 / 12)}`,
      resultado: brl(encargoFolhaInformativo),
      nota: "Custo fixo mensal, exibido apenas como informação — não entra no custo da nota.",
    });
  } else {
    encargoFolhaNota =
      "CPP já embutida no DAS neste anexo. Não há encargo previdenciário adicional sobre a folha.";
  }

  // Composição por tributo
  const composicao: LinhaTributo[] = [];
  const repartricaoIndisponivel =
    !faixa ||
    [faixa.rep_irpj, faixa.rep_csll, faixa.rep_cofins, faixa.rep_pis, faixa.rep_cpp].every(
      (v) => v === null || v === undefined,
    );

  if (faixa && !repartricaoIndisponivel) {
    const reps: Array<[string, number | null]> = [
      ["IRPJ", faixa.rep_irpj],
      ["CSLL", faixa.rep_csll],
      ["COFINS", faixa.rep_cofins],
      ["PIS/Pasep", faixa.rep_pis],
      ["CPP (INSS)", faixa.rep_cpp],
      ["ISS", faixa.rep_iss],
      ["ICMS", faixa.rep_icms],
    ];
    for (const [nome, rep] of reps) {
      if (rep === null || rep === undefined) continue;
      composicao.push({
        tributo: nome,
        base: valor,
        aliquota: aliq * (rep / 100),
        valor: custoImediato * (rep / 100),
        nota: `${pct(rep)} do DAS`,
      });
    }
  } else {
    composicao.push({
      tributo: "DAS (guia única)",
      base: valor,
      aliquota: aliq,
      valor: custoImediato,
      nota: "Repartição não cadastrada para este anexo",
    });
  }

  // Alertas
  const rbt12ComNota = rbt12 + valor;
  if (faixa) {
    const faixaNova = faixaDoRbt12(faixas, anexoAplicado, rbt12ComNota);
    if (faixaNova && faixaNova.faixa !== faixa.faixa) {
      alertas.push({
        severidade: "atencao",
        texto: `Esta nota muda a faixa: a alíquota efetiva sobe de ${pct(aliq)} para ${pct(aliquotaEfetiva(faixaNova, rbt12ComNota))}.`,
      });
    }
  }
  if (rbt12ComNota > 4800000) {
    alertas.push({
      severidade: "critica",
      texto:
        "Ultrapassa o limite do Simples Nacional (R$ 4.800.000). Exclusão do regime no ano seguinte.",
    });
  } else if (rbt12ComNota > 3600000) {
    alertas.push({
      severidade: "alta",
      texto:
        "Ultrapassa o sublimite de R$ 3.600.000. ICMS e ISS passam a ser recolhidos fora do DAS.",
    });
  }
  if (anexoOriginal === 5 && fatorR !== null && fatorR >= 0.25 && fatorR < 0.28) {
    const folhaNecessaria = 0.28 * rbt12 - folha12;
    alertas.push({
      severidade: "atencao",
      texto: `Fator R em ${pct(fatorR * 100)}. Faltam ${brl(folhaNecessaria)} de folha nos 12 meses para cair no Anexo III.`,
    });
  }
  if (anexoAplicado === 4) {
    alertas.push({
      severidade: "atencao",
      texto: "O Anexo IV não inclui a CPP. Some o INSS patronal sobre a folha.",
    });
  }
  if (trocaAnexoFatorR) {
    alertas.push({
      severidade: "informativa",
      texto: "Fator R igual ou acima de 28%: cálculo migrado do Anexo V para o Anexo III.",
    });
  }

  const descritivo =
    `A ${empresa.nome} está no Anexo ${anexoAplicado} com RBT12 de ${brl(rbt12)}, o que coloca a empresa na ${faixa?.faixa ?? "—"}ª faixa e resulta em alíquota efetiva de ${pct(aliq)}. ` +
    `Uma nota de ${brl(valor)} gera ${brl(custoImediato)} de DAS no mês da emissão. ` +
    `Como o Simples é progressivo, essa nota também eleva o RBT12 dos 12 meses seguintes, aumentando o DAS de toda a receita futura em mais ${brl(arrasto)}. ` +
    `O custo real da nota é de ${brl(custoTotal)}, ou seja, ${pct(marginal)} — ${marginal > aliq ? "bem acima dos" : "próximo dos"} ${pct(aliq)} que aparecem na guia.`;

  return {
    empresa,
    bloqueada: p.bloqueada,
    motivoBloqueio: p.motivoBloqueio,
    regimeLabel: `Simples Nacional · Anexo ${anexoAplicado}`,
    rbt12,
    regraRbt12: p.regraRbt12,
    mesesHistorico: p.mesesHistorico,
    faixa: faixa?.faixa ?? null,
    anexoAplicado,
    trocaAnexoFatorR,
    fatorR,
    folha12,
    receitaMedia,
    aliquotaEfetiva: aliq,
    custoImediato,
    arrasto,
    custoTotal,
    aliquotaMarginal: marginal,
    encargoFolhaInformativo,
    encargoFolhaNota,
    composicao,
    repartricaoIndisponivel,
    descritivo,
    memoria,
    alertas,
    projecaoBase,
    projecaoComNota,
  };
}

// ── Lucro Presumido ───────────────────────────────────────────

function calcularPresumido(p: {
  empresa: EmpresaFiscal;
  valor: number;
  bloqueada: boolean;
  motivoBloqueio?: string;
  rbt12: number;
  regraRbt12: "normal" | "inicio_atividade" | "sem_historico";
  mesesHistorico: number;
  folha12: number;
  receitaMedia: number;
  folhaIncremental: number;
}): ResultadoEmpresa {
  const { empresa, valor, folha12, folhaIncremental } = p;
  const memoria: PassoCalculo[] = [];
  const alertas: Alerta[] = [];
  let ordem = 1;

  const pis = valor * 0.0065;
  const cofins = valor * 0.03;
  const baseIrpj = valor * (empresa.presuncao_irpj / 100);
  const irpj = baseIrpj * 0.15;
  const adicional = empresa.adicional_irpj_ativo
    ? baseIrpj * 0.1
    : Math.max(0, baseIrpj - 20000) * 0.1;
  const baseCsll = valor * (empresa.presuncao_csll / 100);
  const csll = baseCsll * 0.09;
  const iss = valor * (empresa.iss_aliquota / 100);

  const custoTotal = pis + cofins + irpj + adicional + csll + iss;
  const marginal = valor > 0 ? (custoTotal / valor) * 100 : 0;

  memoria.push({
    ordem: ordem++,
    titulo: "PIS",
    formula: "valor da nota × 0,65%",
    substituicao: `${brl(valor)} × 0,65%`,
    resultado: brl(pis),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "COFINS",
    formula: "valor da nota × 3,00%",
    substituicao: `${brl(valor)} × 3,00%`,
    resultado: brl(cofins),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "Base presumida do IRPJ",
    formula: "valor da nota × percentual de presunção",
    substituicao: `${brl(valor)} × ${pct(empresa.presuncao_irpj)}`,
    resultado: brl(baseIrpj),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "IRPJ",
    formula: "base presumida × 15%",
    substituicao: `${brl(baseIrpj)} × 15%`,
    resultado: brl(irpj),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "Adicional de IRPJ",
    formula: empresa.adicional_irpj_ativo
      ? "base presumida × 10% (empresa já ultrapassa o limite mensal)"
      : "(base presumida − R$ 20.000) × 10%",
    substituicao: empresa.adicional_irpj_ativo
      ? `${brl(baseIrpj)} × 10%`
      : `máx(0; ${brl(baseIrpj)} − ${brl(20000)}) × 10%`,
    resultado: brl(adicional),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "Base presumida da CSLL",
    formula: "valor da nota × percentual de presunção",
    substituicao: `${brl(valor)} × ${pct(empresa.presuncao_csll)}`,
    resultado: brl(baseCsll),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "CSLL",
    formula: "base presumida × 9%",
    substituicao: `${brl(baseCsll)} × 9%`,
    resultado: brl(csll),
  });
  memoria.push({
    ordem: ordem++,
    titulo: "ISS",
    formula: "valor da nota × alíquota municipal",
    substituicao: `${brl(valor)} × ${pct(empresa.iss_aliquota)}`,
    resultado: brl(iss),
    nota: empresa.iss_aliquota === 0 ? "ISS municipal não cadastrado para esta empresa." : undefined,
  });
  memoria.push({
    ordem: ordem++,
    titulo: "Custo total",
    formula: "PIS + COFINS + IRPJ + adicional + CSLL + ISS",
    substituicao: `${brl(pis)} + ${brl(cofins)} + ${brl(irpj)} + ${brl(adicional)} + ${brl(csll)} + ${brl(iss)}`,
    resultado: `${brl(custoTotal)} · ${pct(marginal)}`,
  });
  memoria.push({
    ordem: ordem++,
    titulo: "Arrasto",
    formula: "não se aplica",
    substituicao: "—",
    resultado: brl(0),
    nota: "No Lucro Presumido a alíquota não varia com o acumulado: a nota não afeta a tributação dos meses seguintes. Essa é justamente a diferença conceitual em relação ao Simples.",
  });

  const encargoPct = percentualEncargoFolha(empresa.rat);
  const folhaBase = folhaIncremental > 0 ? folhaIncremental : folha12 / 12;
  const encargoFolhaInformativo = folhaBase * (encargoPct / 100);
  memoria.push({
    ordem: ordem++,
    titulo: "Encargo sobre a folha",
    formula: "(20% INSS patronal + RAT + 5,8% terceiros) × folha",
    substituicao: `(20% + ${pct(empresa.rat)} + 5,80%) × ${brl(folhaBase)}`,
    resultado: brl(encargoFolhaInformativo),
    nota:
      folhaIncremental > 0
        ? "Folha incremental informada para este serviço — somada ao custo da nota."
        : "Custo fixo mensal, não atribuível a esta nota.",
  });

  const custoFinal =
    folhaIncremental > 0 ? custoTotal + encargoFolhaInformativo : custoTotal;
  const marginalFinal = valor > 0 ? (custoFinal / valor) * 100 : 0;

  if (baseIrpj > 20000) {
    alertas.push({
      severidade: "informativa",
      texto: "Adicional de IRPJ incidindo: +3,2% marginal sobre a receita presumida.",
    });
  }

  const composicao: LinhaTributo[] = [
    { tributo: "PIS", base: valor, aliquota: 0.65, valor: pis },
    { tributo: "COFINS", base: valor, aliquota: 3, valor: cofins },
    { tributo: "IRPJ", base: baseIrpj, aliquota: 15, valor: irpj },
    {
      tributo: "Adicional de IRPJ",
      base: empresa.adicional_irpj_ativo ? baseIrpj : Math.max(0, baseIrpj - 20000),
      aliquota: 10,
      valor: adicional,
    },
    { tributo: "CSLL", base: baseCsll, aliquota: 9, valor: csll },
    { tributo: "ISS", base: valor, aliquota: empresa.iss_aliquota, valor: iss },
  ];

  const descritivo =
    `A ${empresa.nome} apura pelo Lucro Presumido, onde a alíquota não varia com o acumulado. ` +
    `Uma nota de ${brl(valor)} gera ${brl(pis)} de PIS, ${brl(cofins)} de COFINS, ${brl(irpj)} de IRPJ, ${brl(adicional)} de adicional de IRPJ, ${brl(csll)} de CSLL e ${brl(iss)} de ISS, ` +
    `totalizando ${brl(custoTotal)} — ${pct(marginal)}. Não há efeito sobre os meses seguintes.`;

  return {
    empresa,
    bloqueada: p.bloqueada,
    motivoBloqueio: p.motivoBloqueio,
    regimeLabel: REGIME_LABEL_FISCAL[empresa.regime],
    rbt12: p.rbt12,
    regraRbt12: p.regraRbt12,
    mesesHistorico: p.mesesHistorico,
    faixa: null,
    anexoAplicado: null,
    trocaAnexoFatorR: false,
    fatorR: null,
    folha12,
    receitaMedia: p.receitaMedia,
    aliquotaEfetiva: marginal,
    custoImediato: custoTotal,
    arrasto: 0,
    custoTotal: custoFinal,
    aliquotaMarginal: marginalFinal,
    encargoFolhaInformativo,
    encargoFolhaNota:
      folhaIncremental > 0
        ? `Encargo de ${pct(encargoPct)} sobre a folha incremental de ${brl(folhaIncremental)}, somado ao custo da nota.`
        : `Encargo de ${pct(encargoPct)} sobre a folha mensal média (${brl(folhaBase)}) — custo fixo mensal, não atribuível a esta nota.`,
    composicao,
    repartricaoIndisponivel: false,
    descritivo,
    memoria,
    alertas,
    projecaoBase: [],
    projecaoComNota: [],
  };
}

// ─────────────────────────────────────────────────────────────
// Análise completa
// ─────────────────────────────────────────────────────────────

export function analisar(params: {
  empresas: EmpresaFiscal[];
  faturamentoPorEmpresa: Record<string, FaturamentoMes[]>;
  faixas: FaixaSimples[];
  valor: number;
  competencia: string;
  atividade: string | null;
  folhaIncremental?: number;
}): ResultadoAnalise {
  const { empresas, faturamentoPorEmpresa, faixas, valor, competencia, atividade } = params;

  const resultados = empresas
    .filter((e) => e.ativo)
    .map((empresa) =>
      calcularEmpresa({
        empresa,
        faturamento: faturamentoPorEmpresa[empresa.id] ?? [],
        faixas,
        valor,
        competencia,
        atividade,
        folhaIncremental: params.folhaIncremental,
      }),
    );

  resultados.sort((a, b) => {
    if (a.bloqueada !== b.bloqueada) return a.bloqueada ? 1 : -1;
    return a.custoTotal - b.custoTotal;
  });

  const elegiveis = resultados.filter((r) => !r.bloqueada);
  const vencedora = elegiveis[0] ?? null;
  const segunda = elegiveis[1] ?? null;
  const economia = vencedora && segunda ? segunda.custoTotal - vencedora.custoTotal : 0;
  const diferencaIrrelevante = !!segunda && valor > 0 && economia < valor * 0.02;

  return {
    valor,
    atividade,
    competencia,
    empresas: resultados,
    vencedoraId: vencedora?.empresa.id ?? null,
    economia,
    diferencaIrrelevante,
  };
}

export const AVISO_LEGAL =
  "Projeção baseada nos parâmetros cadastrados. Não substitui a apuração da contabilidade. Confirme o enquadramento e as alíquotas municipais antes de decidir.";

export const _internals = { num };
