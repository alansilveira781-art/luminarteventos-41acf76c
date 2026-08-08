/** Prefixo do ID (id_item) por categoria de patrimônio. */
const MAPA: Record<string, string> = {
  ACERVO: "ACE",
  ESTOQUE: "SKU",
  ESTRUTURAS: "STR",
  ESTRUTURA: "STR",
  FERRAMENTAS: "FER",
  ILUMINACAO: "ILU",
  IMOBILIZADO: "IMO",
  MAQUINARIOS: "MAQ",
  VEICULOS: "VEI",
};

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/** Retorna o prefixo de 3 letras usado nos IDs da categoria. */
export function prefixoCategoria(categoria?: string | null): string {
  const c = normalizar(String(categoria ?? ""));
  if (!c) return "";
  return MAPA[c] ?? c.slice(0, 3);
}
