export type ParcelaLinha = {
  id?: string;
  /** 1-based */
  numero: number;
  valor: number;
  /** Data prevista do pagamento (YYYY-MM-DD) */
  data_pagamento?: string | null;
  pago?: boolean | null;
  /** Data em que a baixa foi registrada (YYYY-MM-DD) */
  pago_em?: string | null;
};

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
  /** Parcelas individuais (PIX parcelado) */
  parcelas?: ParcelaLinha[];
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
    parcelado:
      datas.size >= 2
      || linhas.some((p) => parcelasDe(p.parcelamento) > 1)
      || linhas.length >= 2,

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

/** Divide um total em n parcelas, jogando o resíduo de centavos na última. */
export function distribuirValor(total: number, n: number): number[] {
  const t = Math.round(Number(total || 0) * 100);
  const base = Math.floor(t / n);
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] += t - base * n;
  return arr.map((c) => c / 100);
}

export function somaParcelas(p: PagamentoLinha): number {
  return (p.parcelas ?? []).reduce((s, x) => s + Number(x.valor || 0), 0);
}

/**
 * Garante que a linha tenha exatamente N parcelas quando for PIX parcelado
 * (preservando o que já foi preenchido) e nenhuma nos demais casos.
 */
export function sincronizarParcelas(p: PagamentoLinha): PagamentoLinha {
  if (!exigeControleParcelas(p)) {
    if (!p.parcelas && !p.data_pagamento && !p.pago && !p.pago_em) return p;
    return { ...p, parcelas: undefined, data_pagamento: null, pago: false, pago_em: null };
  }
  const n = parcelasDe(p.parcelamento);
  const atuais = p.parcelas ?? [];
  if (atuais.length === n) return p;

  const totalRef = atuais.length > 0 ? somaParcelas(p) || Number(p.valor || 0) : Number(p.valor || 0);
  const valores = distribuirValor(totalRef, n);
  const parcelas: ParcelaLinha[] = Array.from({ length: n }, (_, i) => {
    const antiga = atuais[i];
    return {
      numero: i + 1,
      valor: antiga ? Number(antiga.valor || 0) : valores[i],
      data_pagamento: antiga?.data_pagamento ?? (i === 0 ? p.data_pagamento ?? null : null),
      pago: antiga ? antiga.pago ?? null : i === 0 ? p.pago ?? null : null,
      pago_em: antiga?.pago_em ?? (i === 0 ? p.pago_em ?? null : null),
    };
  });
  // Ao aumentar o número de parcelas, redistribui igualmente quando o usuário
  // ainda não editou valores individuais.
  if (atuais.length === 0) {
    parcelas.forEach((x, i) => (x.valor = valores[i]));
  }
  const linha: PagamentoLinha = { ...p, parcelas };
  linha.valor = somaParcelas(linha);
  return linha;
}

/** Aplica sincronizarParcelas em todas as linhas. */
export function sincronizarLinhas(linhas: PagamentoLinha[]): PagamentoLinha[] {
  return linhas.map(sincronizarParcelas);
}

/** Pendências de preenchimento das linhas de PIX parcelado. */
export function validarPagamentos(linhas: PagamentoLinha[]): string[] {
  const erros: string[] = [];
  linhas.forEach((p, i) => {
    if (!exigeControleParcelas(p)) return;
    const parcelas = sincronizarParcelas(p).parcelas ?? [];
    parcelas.forEach((x, j) => {
      if (!(x.data_pagamento ?? "").trim()) {
        erros.push(`Forma ${i + 1} · parcela ${j + 1}: informe a data prevista.`);
      }
      if (x.pago === undefined || x.pago === null) {
        erros.push(`Forma ${i + 1} · parcela ${j + 1}: informe a situação (Pago ou Em aberto).`);
      }
    });
    const soma = parcelas.reduce((s, x) => s + Number(x.valor || 0), 0);
    if (Math.abs(soma - Number(p.valor || 0)) > PAGAMENTO_TOLERANCIA) {
      erros.push(`Forma ${i + 1}: a soma das parcelas difere do valor da forma.`);
    }
  });
  return erros;
}

type LinhaPersistida = {
  forma: string | null;
  parcelamento: string | null;
  valor: number;
  data_pagamento: string | null;
  pago: boolean;
  pago_em: string | null;
  ordem: number;
};

/** Expande cada forma em uma linha por parcela para gravação no banco. */
export function expandirPagamentos(linhas: PagamentoLinha[]): LinhaPersistida[] {
  const out: LinhaPersistida[] = [];
  linhas.forEach((p) => {
    const forma = p.forma?.trim() || null;
    const parcelamento = p.parcelamento?.trim() || null;
    const sincronizada = sincronizarParcelas(p);
    if (sincronizada.parcelas && sincronizada.parcelas.length > 0) {
      sincronizada.parcelas.forEach((x) => {
        out.push({
          forma,
          parcelamento,
          valor: Number(x.valor || 0),
          data_pagamento: x.data_pagamento || null,
          pago: !!x.pago,
          pago_em: x.pago ? x.pago_em || null : null,
          ordem: out.length,
        });
      });
    } else {
      out.push({
        forma,
        parcelamento,
        valor: Number(p.valor || 0),
        data_pagamento: null,
        pago: false,
        pago_em: null,
        ordem: out.length,
      });
    }
  });
  return out;
}

/** Reagrupa as linhas vindas do banco em formas com parcelas. */
export function agruparPagamentos(
  rows: Array<{
    id?: string;
    forma?: string | null;
    parcelamento?: string | null;
    valor?: number | string | null;
    data_pagamento?: string | null;
    pago?: boolean | null;
    pago_em?: string | null;
  }>,
): PagamentoLinha[] {
  const out: PagamentoLinha[] = [];
  for (const r of rows) {
    const base: PagamentoLinha = {
      id: r.id,
      forma: r.forma ?? null,
      parcelamento: r.parcelamento ?? null,
      valor: Number(r.valor ?? 0),
      data_pagamento: r.data_pagamento ?? null,
      pago: !!r.pago,
      pago_em: r.pago_em ?? null,
    };
    const anterior = out[out.length - 1];
    const agrupavel =
      exigeControleParcelas(base)
      && anterior
      && exigeControleParcelas(anterior)
      && (anterior.forma ?? "") === (base.forma ?? "")
      && (anterior.parcelamento ?? "") === (base.parcelamento ?? "")
      && (anterior.parcelas?.length ?? 0) < parcelasDe(base.parcelamento);

    if (agrupavel && anterior) {
      const parcelas = anterior.parcelas ?? [];
      parcelas.push({
        numero: parcelas.length + 1,
        valor: base.valor,
        data_pagamento: base.data_pagamento,
        pago: base.pago ?? null,
        pago_em: base.pago_em,
      });
      anterior.parcelas = parcelas;
      anterior.valor = somaParcelas(anterior);
      continue;
    }

    if (exigeControleParcelas(base)) {
      base.parcelas = [
        {
          numero: 1,
          valor: base.valor,
          data_pagamento: base.data_pagamento,
          pago: r.pago === null || r.pago === undefined ? null : !!r.pago,
          pago_em: base.pago_em,
        },
      ];
    }
    out.push(base);
  }
  return out.map((p) => sincronizarParcelas(p));
}

