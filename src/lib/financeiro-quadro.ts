export type FinanceiroStatus =
  | "caixa_entrada"
  | "analise_financeira"
  | "lancamento"
  | "finalizado_fin";

export const FINANCEIRO_STATUSES: { key: FinanceiroStatus; label: string; color: string }[] = [
  { key: "caixa_entrada", label: "Caixa de Entrada", color: "bg-slate-500" },
  { key: "analise_financeira", label: "Análise Financeira", color: "bg-blue-500" },
  { key: "lancamento", label: "Lançamento", color: "bg-indigo-500" },
  { key: "finalizado_fin", label: "Finalizado", color: "bg-emerald-600" },
];

export const FINANCEIRO_STATUS_LABEL: Record<FinanceiroStatus, string> = FINANCEIRO_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<FinanceiroStatus, string>,
);
