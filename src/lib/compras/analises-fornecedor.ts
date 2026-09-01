/**
 * Agregação de cards de Compras e Despesas por fornecedor, para a aba
 * Análises dentro de Compras › Relatórios.
 */

export type CardAnalise = {
  tipo: "COMPRA" | "DESPESA";
  id: string;
  numero: number | null;
  titulo: string | null;
  fornecedor: string | null;
  documento: string | null;
  status: string | null;
  data: string | null;
  valor: number;
  formas: string[];
  parcelamento: string | null;
  condicao: string | null;
};

export type FornecedorAgregado = {
  key: string;
  fornecedor: string;
  documento: string;
  qtd: number;
  valor: number;
  formas: string[];
  condicoes: string[];
  parcelamentos: string[];
  cards: CardAnalise[];
};

export const normalizarNome = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const addUnico = (arr: string[], v: string | null | undefined) => {
  const s = String(v ?? "").trim();
  if (s && !arr.includes(s)) arr.push(s);
};

export function agruparPorFornecedor(cards: CardAnalise[]): FornecedorAgregado[] {
  const map = new Map<string, FornecedorAgregado>();
  for (const c of cards) {
    const nome = String(c.fornecedor ?? "").trim();
    const key = normalizarNome(nome) || "__sem_fornecedor__";
    const cur =
      map.get(key) ??
      ({
        key,
        fornecedor: nome || "— Sem fornecedor —",
        documento: "",
        qtd: 0,
        valor: 0,
        formas: [],
        condicoes: [],
        parcelamentos: [],
        cards: [],
      } as FornecedorAgregado);
    cur.qtd += 1;
    cur.valor += Number(c.valor ?? 0);
    if (!cur.documento && c.documento) cur.documento = String(c.documento).trim();
    for (const f of c.formas) addUnico(cur.formas, f);
    addUnico(cur.condicoes, c.condicao);
    addUnico(cur.parcelamentos, c.parcelamento);
    cur.cards.push(c);
    map.set(key, cur);
  }
  const out = [...map.values()];
  for (const f of out) {
    f.cards.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }
  return out.sort((a, b) => b.valor - a.valor);
}
