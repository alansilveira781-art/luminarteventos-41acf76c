/**
 * Resolução de nome/documento (CNPJ/CPF) de fornecedor para os relatórios de
 * Compras. Cascata: documento gravado no card → cadastro geral `fornecedores`
 * (por id e por nome/nome fantasia) → `compras_fornecedores`.
 */
import { fetchAllRows } from "@/lib/fetch-all";

export type ResolverFornecedor = {
  documento: (card: { documento?: string | null; fornecedor_id?: string | null; fornecedor?: string | null }) => string;
  nome: (card: { fornecedor?: string | null; fornecedor_id?: string | null }) => string;
};

const chave = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export async function carregarResolverFornecedor(): Promise<ResolverFornecedor> {
  const [gerais, compras] = await Promise.all([
    fetchAllRows<any>("fornecedores", "id, nome, nome_fantasia, documento").catch(() => [] as any[]),
    fetchAllRows<any>("compras_fornecedores", "id, nome, documento").catch(() => [] as any[]),
  ]);

  const porId = new Map<string, { nome: string; documento: string }>();
  const porNome = new Map<string, string>(); // nome normalizado -> documento

  const registrar = (r: any) => {
    const doc = String(r?.documento ?? "").trim();
    const nome = String(r?.nome ?? "").trim();
    if (r?.id) porId.set(String(r.id), { nome, documento: doc });
    if (!doc) return;
    for (const n of [nome, r?.nome_fantasia]) {
      const k = chave(n);
      if (k && !porNome.has(k)) porNome.set(k, doc);
    }
  };

  // `compras_fornecedores` primeiro para que `fornecedores` (que tem documento
  // preenchido) sobrescreva o mapa por nome.
  compras.forEach(registrar);
  gerais.forEach(registrar);

  const soDigitos = (s: string) => s.replace(/[^\d]/g, "");

  return {
    // Atenção: `compras.documento` / `demandas.documento` guardam o número da
    // nota/documento do card, NÃO o CNPJ/CPF — por isso não entram na cascata.
    documento: (card) => {
      const porVinculo = card.fornecedor_id ? porId.get(String(card.fornecedor_id))?.documento : "";
      if (porVinculo) return soDigitos(porVinculo);
      const k = chave(card.fornecedor);
      const achado = k ? porNome.get(k) : "";
      return achado ? soDigitos(achado) : "";
    },

    nome: (card) => {
      const n = String(card.fornecedor ?? "").trim();
      if (n) return n;
      return (card.fornecedor_id ? porId.get(String(card.fornecedor_id))?.nome : "") || "";
    },
  };
}
