import type { CompraStatus } from "./compras";

// Status reaproveitam o enum compra_status no banco, mas o módulo Financeiro
// tem rótulos e ordem próprios (sem "Compras a Receber").
export type DemandaStatus = CompraStatus;

export const DEMANDA_STATUSES: { key: DemandaStatus; label: string; color: string }[] = [
  { key: "solicitacao", label: "Solicitação de Demanda", color: "bg-slate-500" },
  { key: "analise", label: "Análise", color: "bg-blue-500" },
  { key: "pendente_aprovacao", label: "Pendente Aprovação", color: "bg-amber-500" },
  { key: "aprovada", label: "Demanda Aprovada", color: "bg-emerald-500" },
  { key: "em_andamento", label: "Demanda Em Andamento", color: "bg-indigo-500" },
  { key: "finalizado", label: "Finalizado", color: "bg-success" },
  { key: "negada", label: "Demanda Negada", color: "bg-destructive" },
];

export const DEMANDA_STATUS_LABEL: Record<DemandaStatus, string> = DEMANDA_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<DemandaStatus, string>,
);

export const TIPO_DEMANDA_OPTIONS = [
  { value: "estacionamento", label: "Estacionamento" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "material_limpeza", label: "Material de Limpeza" },
  { value: "manutencao_galpao", label: "Manutenção do Galpão" },
  { value: "manutencao_veiculos", label: "Manutenção de Veículos" },
] as const;

export type TipoDemanda = typeof TIPO_DEMANDA_OPTIONS[number]["value"];
