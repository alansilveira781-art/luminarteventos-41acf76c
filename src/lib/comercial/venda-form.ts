const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const EMPRESAS_VENDA = ["Planejados", "Eventos"];

export function mesNomeFrom(iso: string | null): string | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  return m ? (MESES_PT[m - 1] ?? null) : null;
}

export function anoFrom(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function trimestreFrom(iso: string | null): 1 | 2 | 3 | 4 | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  if (!m) return null;
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 9) return 3;
  return 4;
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type VendaFormState = {
  data_registro: string;
  data_evento: string;
  tipo: string;
  nome_evento: string;
  local: string;
  cidade: string;
  estado: string;
  classificacao: string;
  consultor: string;
  cerimonial: string;
  decorador: string;
  empresa: string;
  valor_proposta: number;
  desconto: number;
};

export function emptyVendaForm(): VendaFormState {
  return {
    data_registro: todayIso(),
    data_evento: "",
    tipo: "Venda",
    nome_evento: "",
    local: "",
    cidade: "",
    estado: "",
    classificacao: "",
    consultor: "",
    cerimonial: "",
    decorador: "",
    empresa: "",
    valor_proposta: 0,
    desconto: 0,
  };
}

export function buildVendaDbPayload(
  f: VendaFormState,
  derived: { valor_final: number; valor_bv: number; valor_comissao: number },
) {
  const data = f.data_registro || null;
  const dataEvento = f.data_evento || null;
  const baseEvento = dataEvento ?? data;
  return {
    data_registro: data,
    data_evento: dataEvento,
    tipo: f.tipo || null,
    nome_evento: f.nome_evento || null,
    local: f.local || null,
    cidade: f.cidade || null,
    estado: f.estado || null,
    classificacao: f.classificacao || null,
    consultor: f.consultor || null,
    cerimonial: f.cerimonial || null,
    decorador: f.decorador || null,
    empresa: f.empresa || null,
    valor_proposta: f.valor_proposta || 0,
    desconto: f.desconto || 0,
    valor_final: derived.valor_final,
    valor_bv: derived.valor_bv,
    valor_comissao: derived.valor_comissao,
    ano: anoFrom(data),
    mes: mesNomeFrom(data),
    mes_evento: mesNomeFrom(baseEvento),
    ano_evento: anoFrom(baseEvento),
    trimestre_evento: trimestreFrom(baseEvento),
  };
}
