import type { CompraStatus } from "./compras";

// Status reaproveitam o enum compra_status no banco, mas o módulo Financeiro
// tem rótulos e ordem próprios (sem "Compras a Receber").
export type DemandaStatus = CompraStatus;

export const DEMANDA_STATUSES: { key: DemandaStatus; label: string; color: string }[] = [
  { key: "solicitacao", label: "Solicitação de Despesa", color: "bg-slate-500" },
  { key: "analise", label: "Análise", color: "bg-blue-500" },
  { key: "pendente_aprovacao", label: "Pendente Aprovação", color: "bg-amber-500" },
  { key: "aprovada", label: "Despesa Aprovada", color: "bg-emerald-500" },
  { key: "em_andamento", label: "Despesa Em Andamento", color: "bg-indigo-500" },
  { key: "a_receber", label: "A Receber", color: "bg-cyan-500" },
  { key: "finalizado", label: "Finalizado", color: "bg-success" },
  { key: "negada", label: "Despesa Negada", color: "bg-destructive" },
];

// Tipos que exigem grid de ITENS no lugar do descritivo livre
export const TIPOS_COM_ITENS: string[] = [
  "fardamento",
  "material_limpeza",
  "material_escritorio",
  "imobilizado",
];

// Tipos que geram entrada em ESTOQUE (validação em /estoque/a-receber)
export const TIPOS_QUE_VAO_PARA_ESTOQUE: string[] = [
  "fardamento",
  "material_limpeza",
  "material_escritorio",
  "reposicao_estoque",
];


// Tipos que geram entrada em PATRIMÔNIO (validação em /patrimonio/a-receber)
export const TIPOS_QUE_VAO_PARA_PATRIMONIO: string[] = ["imobilizado"];

// Qualquer tipo que precise passar por "A Receber" antes de "Finalizado"
export const TIPOS_QUE_VAO_PARA_RECEBIMENTO: string[] = [
  ...TIPOS_QUE_VAO_PARA_ESTOQUE,
  ...TIPOS_QUE_VAO_PARA_PATRIMONIO,
];

export function proximoStatusDemanda(
  status: DemandaStatus,
  tipo?: string | null,
): DemandaStatus | null {
  if (status === "em_andamento") {
    return TIPOS_QUE_VAO_PARA_RECEBIMENTO.includes(tipo ?? "") ? "a_receber" : "finalizado";
  }
  const ordem: DemandaStatus[] = [
    "solicitacao",
    "analise",
    "pendente_aprovacao",
    "aprovada",
    "em_andamento",
    "a_receber",
    "finalizado",
  ];
  const idx = ordem.indexOf(status);
  if (idx < 0 || idx >= ordem.length - 1) return null;
  return ordem[idx + 1];
}

export const DEMANDA_STATUS_LABEL: Record<DemandaStatus, string> = DEMANDA_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<DemandaStatus, string>,
);

export const TIPO_DEMANDA_OPTIONS = [
  { value: "estacionamento", label: "Estacionamento" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "manutencao_galpao", label: "Manutenção do Galpão" },
  { value: "manutencao_veiculos", label: "Manutenção de Veículos" },
  { value: "manutencao_maquinario", label: "Manutenção de Maquinário" },
  { value: "fardamento", label: "Fardamento" },
  { value: "frete", label: "Frete" },
  { value: "reformas_construcoes", label: "Reformas & Construções" },
  { value: "imobilizado", label: "Imobilizado" },
  { value: "material_limpeza", label: "Material de Limpeza" },
  { value: "material_escritorio", label: "Material de Escritório" },
  { value: "reposicao_estoque", label: "Reposição de Estoque" },
  { value: "departamento_pessoal", label: "Departamento Pessoal" },
  { value: "recursos_humanos", label: "Recursos Humanos" },
] as const;




// Valores legados que foram unificados em "reformas_construcoes" — usados só
// para rotular registros antigos no dashboard. Não aparecem no <Select>.
export const TIPO_DEMANDA_LEGACY_LABELS: Record<string, string> = {
  reformas: "Reformas & Construções",
  construcoes: "Reformas & Construções",
};

export type TipoDemanda = typeof TIPO_DEMANDA_OPTIONS[number]["value"];
