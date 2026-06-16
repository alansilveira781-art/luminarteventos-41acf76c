// Cálculo de impostos — Lucro Presumido (serviços).
// Estrutura espelha a planilha "Grupo Luminart – Contábil":
//   Imposto | Base de Cálculo (%) | Alíquota (%) | Alíquota Adicional (%)
// Base 0% = aplica sobre faturamento bruto (PIS/COFINS).
// Base 32% = aplica sobre lucro presumido (IRPJ/CSLL).
// Adicional só é usado no IRPJ, sobre o valor de IRPJ apurado que ultrapassa o limite mensal.

export type Aliquota = {
  imposto: string;
  aliquota: number;
  base_calculo?: number | null;
  aliquota_adicional?: number | null;
  observacoes?: string | null;
};

export type ApuracaoResultado = {
  faturamento: number;
  basePresumida: number;
  itens: Array<{
    imposto: string;
    base: number;
    aliquota: number;
    valor: number;
    adicional: number;
    total: number;
  }>;
  totalImpostos: number;
  irpjDetalhe: {
    irpjNormal: number;
    limite: number;
    excedente: number;
    aliquotaAdicional: number;
    adicional: number;
  };
};

export const LIMITE_IRPJ_ADICIONAL_PADRAO = 20000; // R$ 20.000/mês de IRPJ apurado

/** Extrai o limite mensal do IRPJ a partir do campo observacoes.
 *  Aceita formatos: "limite=20000", "R$ 20.000,00", "20000" etc. */
export function extrairLimiteAdicional(observacoes?: string | null): number {
  if (!observacoes) return LIMITE_IRPJ_ADICIONAL_PADRAO;
  const m = observacoes.match(/([\d][\d.]*)(?:,(\d+))?/);
  if (!m) return LIMITE_IRPJ_ADICIONAL_PADRAO;
  const inteiro = m[1].replace(/\./g, "");
  const decimal = m[2] ?? "0";
  const n = Number(`${inteiro}.${decimal}`);
  return Number.isFinite(n) && n > 0 ? n : LIMITE_IRPJ_ADICIONAL_PADRAO;
}

export function calcularImpostosPresumido(
  faturamento: number,
  aliquotas: Aliquota[],
): ApuracaoResultado {
  const fat = Math.max(0, Number(faturamento) || 0);

  const find = (nome: string) =>
    aliquotas.find((x) => x.imposto.toUpperCase() === nome.toUpperCase());

  // Base presumida (32%) usada como referência no resultado
  const cfgIRPJ = find("IRPJ");
  const baseCalcIRPJ = cfgIRPJ?.base_calculo ?? 32;
  const basePresumida = +(fat * (baseCalcIRPJ / 100)).toFixed(2);

  const itens: ApuracaoResultado["itens"] = [];
  let irpjDetalhe: ApuracaoResultado["irpjDetalhe"] = {
    irpjNormal: 0,
    limite: LIMITE_IRPJ_ADICIONAL_PADRAO,
    excedente: 0,
    aliquotaAdicional: 0,
    adicional: 0,
  };

  for (const cfg of aliquotas) {
    const nome = cfg.imposto.toUpperCase();
    const baseCalc = Number(cfg.base_calculo ?? 0); // 0 = sobre faturamento bruto
    const aliq = Number(cfg.aliquota) || 0;
    const aliqAdic = Number(cfg.aliquota_adicional) || 0;

    const base = +(baseCalc > 0 ? fat * (baseCalc / 100) : fat).toFixed(2);
    const valor = +(base * (aliq / 100)).toFixed(2);

    let adicional = 0;
    if (nome === "IRPJ" && aliqAdic > 0) {
      const limite = extrairLimiteAdicional(cfg.observacoes);
      // Adicional incide sobre a BASE presumida que excede o limite mensal, não sobre o IRPJ apurado
      const excedente = Math.max(0, +(base - limite).toFixed(2));
      adicional = +(excedente * (aliqAdic / 100)).toFixed(2);
      irpjDetalhe = {
        irpjNormal: valor,
        limite,
        excedente,
        aliquotaAdicional: aliqAdic,
        adicional,
      };
    }

    itens.push({
      imposto: cfg.imposto,
      base,
      aliquota: aliq,
      valor,
      adicional,
      total: +(valor + adicional).toFixed(2),
    });
  }

  const totalImpostos = +itens.reduce((s, i) => s + i.total, 0).toFixed(2);

  return { faturamento: fat, basePresumida, itens, totalImpostos, irpjDetalhe };
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export function mesIndex(nome: string): number {
  return MESES.findIndex((m) => m.toLowerCase() === nome.toLowerCase());
}
