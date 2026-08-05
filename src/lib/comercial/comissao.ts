import { normalize } from "@/lib/utils";

export type CadastroPct = { nome: string; [k: string]: unknown };

/** Busca no cadastro ignorando maiúsculas, acentos e espaços extras. */
export function matchCadastro<T extends { nome: string }>(
  nome: string | null | undefined,
  lista: T[],
): T | undefined {
  const alvo = normalize(nome ?? "").trim();
  if (!alvo) return undefined;
  return lista.find((c) => normalize(c.nome).trim() === alvo);
}

export type DerivadosInput = {
  valor_proposta: number;
  desconto: number;
  consultor: string | null | undefined;
  cerimonial: string | null | undefined;
};

export type Derivados = {
  valor_final: number;
  valor_bv: number;
  valor_comissao: number;
};

/** Calcula valor final, BV e comissão a partir dos cadastros. */
export function calcularDerivados(
  input: DerivadosInput,
  vendedores: Array<{ nome: string; percentual_comissao: number }>,
  cerimoniais: Array<{ nome: string; percentual_bv: number }>,
): Derivados {
  const valor_final = Math.max(0, (input.valor_proposta || 0) - (input.desconto || 0));
  const vend = matchCadastro(input.consultor, vendedores);
  const ceri = matchCadastro(input.cerimonial, cerimoniais);
  const valor_comissao = vend ? (valor_final * (Number(vend.percentual_comissao) || 0)) / 100 : 0;
  const valor_bv = ceri ? (valor_final * (Number(ceri.percentual_bv) || 0)) / 100 : 0;
  return {
    valor_final: Number(valor_final.toFixed(2)),
    valor_bv: Number(valor_bv.toFixed(2)),
    valor_comissao: Number(valor_comissao.toFixed(2)),
  };
}
