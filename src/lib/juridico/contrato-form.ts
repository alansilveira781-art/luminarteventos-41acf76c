export type ParcelaContrato = { n: number; vencimento: string; valor: number };

export const digitos = (v: string) => (v ?? "").replace(/\D/g, "");

export const fmtMoeda = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtData = (iso?: string | null) =>
  iso ? iso.split("-").reverse().join("/") : "";

export type EnderecoViaCep = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

/** Consulta o ViaCEP. Retorna null quando o CEP é inválido ou não encontrado. */
export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const d = digitos(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const data = await res.json();
    if (data?.erro) return null;
    return data as EnderecoViaCep;
  } catch {
    return null;
  }
}

/** Divide o total em N parcelas iguais, jogando o resto de centavos na última. */
export function dividirIgualmente(total: number, qtd: number): number[] {
  const q = Math.max(1, Math.floor(qtd || 1));
  const base = Math.floor((Number(total || 0) * 100) / q) / 100;
  const vals = Array.from({ length: q }, () => base);
  const soma = Number((base * q).toFixed(2));
  vals[q - 1] = Number((base + (Number(total || 0) - soma)).toFixed(2));
  return vals;
}

export function somaParcelas(parcelas: ParcelaContrato[]): number {
  return Number(
    (parcelas ?? []).reduce((a, p) => a + Number(p.valor || 0), 0).toFixed(2),
  );
}

export function renumerar(parcelas: ParcelaContrato[]): ParcelaContrato[] {
  return (parcelas ?? []).map((p, i) => ({ ...p, n: i + 1 }));
}

/** Aplica a divisão igual mantendo as datas já informadas. */
export function aplicarModoIgual(
  parcelas: ParcelaContrato[],
  total: number,
): ParcelaContrato[] {
  const valores = dividirIgualmente(total, parcelas.length || 1);
  return renumerar(parcelas).map((p, i) => ({ ...p, valor: valores[i] ?? 0 }));
}
