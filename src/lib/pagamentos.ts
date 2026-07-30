export type PagamentoLinha = {
  id?: string;
  forma?: string | null;
  parcelamento?: string | null;
  valor: number;
  observacao?: string | null;
};

export const PAGAMENTO_TOLERANCIA = 0.01;

export function somaPagamentos(linhas: PagamentoLinha[]): number {
  return linhas.reduce((s, p) => s + Number(p.valor || 0), 0);
}

export function pagamentosBatem(linhas: PagamentoLinha[], total: number): boolean {
  if (linhas.length === 0) return true;
  return Math.abs(somaPagamentos(linhas) - Number(total || 0)) <= PAGAMENTO_TOLERANCIA;
}

/**
 * Resumo gravado nos campos legados `condicao_pagamento` / `parcelamento`
 * das tabelas `compras` / `demandas`, para que telas antigas continuem
 * funcionando: forma de maior valor, ou "Múltiplas" quando houver mais de uma.
 */
export function resumoPagamentos(linhas: PagamentoLinha[]): {
  condicao_pagamento: string | null;
  parcelamento: string | null;
} {
  const validas = linhas.filter((p) => (p.forma ?? "").trim() || (p.parcelamento ?? "").trim());
  if (validas.length === 0) return { condicao_pagamento: null, parcelamento: null };
  if (validas.length === 1) {
    return {
      condicao_pagamento: validas[0].forma?.trim() || null,
      parcelamento: validas[0].parcelamento?.trim() || null,
    };
  }
  const maior = [...validas].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))[0];
  return {
    condicao_pagamento: maior.forma?.trim() || "Múltiplas",
    parcelamento: "Múltiplas",
  };
}

export function formatBRL(v: number | null | undefined): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function descreverPagamento(p: PagamentoLinha): string {
  const partes = [p.forma?.trim() || "Sem forma"];
  if (p.parcelamento?.trim()) partes.push(p.parcelamento.trim());
  partes.push(formatBRL(p.valor));
  return partes.join(" · ");
}
