// Lista fixa de empresas do grupo Luminart.
// Usada nos cadastros de Entradas/Saídas e em consultas SEFAZ.

export const EMPRESAS = [
  "Luminart Eventos",
  "Luminart Planejados",
  "Luminart Tecnologia",
] as const;

export type Empresa = (typeof EMPRESAS)[number];

export function isEmpresaValida(v: unknown): v is Empresa {
  return typeof v === "string" && (EMPRESAS as readonly string[]).includes(v);
}
