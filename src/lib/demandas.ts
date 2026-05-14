export type {
  CompraStatus as DemandaStatus,
} from "./compras";
export { COMPRA_STATUSES as DEMANDA_STATUSES, STATUS_LABEL as DEMANDA_STATUS_LABEL } from "./compras";

export const TIPO_DEMANDA_OPTIONS = [
  { value: "estacionamento", label: "Estacionamento" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "material_limpeza", label: "Material de Limpeza" },
  { value: "manutencao_galpao", label: "Manutenção do Galpão" },
  { value: "manutencao_veiculos", label: "Manutenção de Veículos" },
] as const;

export type TipoDemanda = typeof TIPO_DEMANDA_OPTIONS[number]["value"];
