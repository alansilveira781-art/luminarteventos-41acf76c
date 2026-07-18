export type CategoriaCentroCusto = "corporativo" | "stand" | "social" | "cenografia";

export const CATEGORIAS_CENTRO_CUSTO: { value: CategoriaCentroCusto; label: string }[] = [
  { value: "corporativo", label: "Corporativo" },
  { value: "stand", label: "Stand" },
  { value: "social", label: "Social" },
  { value: "cenografia", label: "Cenografia" },
];

export const CATEGORIA_LABEL: Record<CategoriaCentroCusto, string> = {
  corporativo: "Corporativo",
  stand: "Stand",
  social: "Social",
  cenografia: "Cenografia",
};
