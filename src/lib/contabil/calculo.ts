// Cálculo de impostos — Lucro Presumido (serviços, base 32%)
// Compatível com a planilha "Grupo Luminart – Contábil".

export type Aliquota = { imposto: string; aliquota: number; observacoes?: string | null };

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

const BASE_PRESUMIDA_SERVICOS = 0.32; // 32%
export const LIMITE_IRPJ_ADICIONAL_PADRAO = 20000; // R$ 20.000/mês de IRPJ apurado
export const ALIQUOTA_IRPJ_ADICIONAL_PADRAO = 10; // 10%

/** Extrai "limite=20000" do campo observacoes, se presente. */
export function extrairLimiteAdicional(observacoes?: string | null): number {
  if (!observacoes) return LIMITE_IRPJ_ADICIONAL_PADRAO;
  const m = /limite\s*=\s*([0-9]+(?:\.[0-9]+)?)/i.exec(observacoes);
  return m ? Number(m[1]) : LIMITE_IRPJ_ADICIONAL_PADRAO;
}

/**
 * Lucro Presumido — serviços (base 32%).
 * Adicional de IRPJ incide sobre o VALOR DO IRPJ APURADO que ultrapassar
 * o limite mensal (padrão R$ 20.000):
 *    excedente   = max(0, IRPJ_normal − limite)
 *    adicional   = excedente × alíquota_adicional
 */
export function calcularImpostosPresumido(
  faturamento: number,
  aliquotas: Aliquota[],
): ApuracaoResultado {
  const fat = Math.max(0, Number(faturamento) || 0);
  const basePresumida = +(fat * BASE_PRESUMIDA_SERVICOS).toFixed(2);

  const find = (nome: string) =>
    aliquotas.find((x) => x.imposto.toUpperCase() === nome.toUpperCase());
  const get = (nome: string) => {
    const a = find(nome);
    return a ? Number(a.aliquota) / 100 : 0;
  };

  const itens: ApuracaoResultado["itens"] = [];

  // PIS / COFINS sobre faturamento bruto
  for (const imp of ["PIS", "COFINS"]) {
    const aliq = get(imp);
    const valor = +(fat * aliq).toFixed(2);
    itens.push({ imposto: imp, base: fat, aliquota: aliq * 100, valor, adicional: 0, total: valor });
  }

  // IRPJ sobre lucro presumido + adicional sobre o IRPJ que excede o limite
  const aliqIRPJ = get("IRPJ");
  const irpjNormal = +(basePresumida * aliqIRPJ).toFixed(2);

  const cfgAdicional = find("IRPJ_ADICIONAL");
  const aliqAdicional = cfgAdicional ? Number(cfgAdicional.aliquota) : ALIQUOTA_IRPJ_ADICIONAL_PADRAO;
  const limite = extrairLimiteAdicional(cfgAdicional?.observacoes);
  const excedente = Math.max(0, +(irpjNormal - limite).toFixed(2));
  const adicionalIRPJ = +(excedente * (aliqAdicional / 100)).toFixed(2);

  itens.push({
    imposto: "IRPJ",
    base: basePresumida,
    aliquota: aliqIRPJ * 100,
    valor: irpjNormal,
    adicional: adicionalIRPJ,
    total: +(irpjNormal + adicionalIRPJ).toFixed(2),
  });

  // CSLL sobre lucro presumido
  const aliqCSLL = get("CSLL");
  const valorCSLL = +(basePresumida * aliqCSLL).toFixed(2);
  itens.push({
    imposto: "CSLL",
    base: basePresumida,
    aliquota: aliqCSLL * 100,
    valor: valorCSLL,
    adicional: 0,
    total: valorCSLL,
  });

  const totalImpostos = +itens.reduce((s, i) => s + i.total, 0).toFixed(2);

  return {
    faturamento: fat,
    basePresumida,
    itens,
    totalImpostos,
    irpjDetalhe: {
      irpjNormal,
      limite,
      excedente,
      aliquotaAdicional: aliqAdicional,
      adicional: adicionalIRPJ,
    },
  };
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export function mesIndex(nome: string): number {
  return MESES.findIndex((m) => m.toLowerCase() === nome.toLowerCase());
}
