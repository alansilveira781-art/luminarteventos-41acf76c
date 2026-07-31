export type PagamentoLinha = {
  id?: string;
  forma?: string | null;
  parcelamento?: string | null;
  valor: number;
  observacao?: string | null;
  /** Data prevista do pagamento (YYYY-MM-DD) */
  data_pagamento?: string | null;
  pago?: boolean;
  /** Data em que a baixa foi registrada (YYYY-MM-DD) */
  pago_em?: string | null;
};

export type StatusPagamentos = {
  /** true quando há 2+ datas de pagamento distintas informadas */
  parcelado: boolean;
  total: number;
  totalPago: number;
  restante: number;
  quitado: boolean;
  /** Próxima parcela em aberto (data mais antiga não paga) */
  proximaData: string | null;
  /** Parcelas em aberto com data anterior a hoje */
  vencidas: number;
  parcelasAbertas: number;
};

export function hojeISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Consolida as linhas de pagamento de uma compra para exibição no card do
 * quadro: identifica parcelamento por datas distintas, total pago e pendências.
 */
export function statusPagamentos(linhas: PagamentoLinha[]): StatusPagamentos {
  const total = somaPagamentos(linhas);
  const totalPago = linhas.reduce((s, p) => s + (p.pago ? Number(p.valor || 0) : 0), 0);
  const datas = new Set(
    linhas.map((p) => (p.data_pagamento ?? "").slice(0, 10)).filter(Boolean),
  );
  const abertas = linhas.filter((p) => !p.pago);
  const datasAbertas = abertas
    .map((p) => (p.data_pagamento ?? "").slice(0, 10))
    .filter(Boolean)
    .sort();
  const hoje = hojeISO();
  return {
    parcelado: datas.size >= 2,
    total,
    totalPago,
    restante: total - totalPago,
    quitado: linhas.length > 0 && abertas.length === 0,
    proximaData: datasAbertas[0] ?? null,
    vencidas: datasAbertas.filter((d) => d < hoje).length,
    parcelasAbertas: abertas.length,
  };
}

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

/** Número de parcelas a partir de textos como "1x", "3x", "3 vezes", "À vista". */
export function parcelasDe(parcelamento?: string | null): number {
  const txt = (parcelamento ?? "").trim();
  if (!txt) return 1;
  const norm = txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (norm.includes("vista")) return 1;
  const m = norm.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** true quando a forma de pagamento é PIX (ignora acentos/caixa). */
export function ehPix(forma?: string | null): boolean {
  const norm = (forma ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return norm.includes("pix");
}

/** PIX com mais de uma parcela exige controle de datas e situação. */
export function exigeControleParcelas(p: PagamentoLinha): boolean {
  return ehPix(p.forma) && parcelasDe(p.parcelamento) > 1;
}

/** Pendências de preenchimento das linhas de PIX parcelado. */
export function validarPagamentos(linhas: PagamentoLinha[]): string[] {
  const erros: string[] = [];
  linhas.forEach((p, i) => {
    if (!exigeControleParcelas(p)) return;
    if (!(p.data_pagamento ?? "").trim()) {
      erros.push(`Forma ${i + 1}: informe a data prevista do PIX parcelado.`);
    }
    if (p.pago === undefined || p.pago === null) {
      erros.push(`Forma ${i + 1}: informe a situação (Pago ou Em aberto).`);
    }
  });
  return erros;
}
