// Lista fixa de empresas do grupo Luminart.
// Usada nos cadastros de Entradas/Saídas, consultas SEFAZ e tributação.

export const EMPRESAS = [
  "Luminart Eventos",
  "Luminart Planejados",
  "Luminart Tecnologia",
] as const;

export type Empresa = (typeof EMPRESAS)[number];

export function isEmpresaValida(v: unknown): v is Empresa {
  return typeof v === "string" && (EMPRESAS as readonly string[]).includes(v);
}

// Regime tributário por empresa
export const EMPRESA_REGIME: Record<Empresa, "presumido" | "simples"> = {
  "Luminart Eventos": "presumido",
  "Luminart Planejados": "presumido",
  "Luminart Tecnologia": "simples",
};

export const REGIME_LABEL: Record<"presumido" | "simples", string> = {
  presumido: "Lucro Presumido",
  simples: "Simples Nacional",
};

// Impostos padrão por regime (sugestão inicial para a aba de configuração)
export const IMPOSTOS_POR_REGIME: Record<"presumido" | "simples", string[]> = {
  presumido: ["ISS", "PIS", "COFINS", "IRPJ", "IRPJ_ADICIONAL", "CSLL"],
  simples: ["DAS"],
};
