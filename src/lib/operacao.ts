export type Setor = {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  responsavel_id: string | null;
  fixo?: boolean;
};

export type Etapa = {
  id: string;
  setor_id: string;
  nome: string;
  descricao?: string | null;
  ordem: number;
};

export type Ordem = {
  id: string;
  numero: number;
  setor_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo_unidade: string | null;
  quantidade: number | null;
  evento_ref: string | null;
  origem: string;
  status: string;
  prazo: string | null;
  data_inicio: string | null;
  responsavel_id: string | null;
  created_at: string;
};

export type OrdemSetor = {
  id: string;
  ordem_id: string;
  setor_id: string;
  posicao: number;
  status: "pendente" | "em_andamento" | "concluido";
  iniciado_em: string | null;
  concluido_em: string | null;
};

export type ChecklistItem = {
  id: string;
  ordem_id: string;
  setor_id: string;
  etapa_id: string | null;
  nome: string;
  ordem: number;
  concluido: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
};

export const STATUS_COLORS: Record<string, string> = {
  aberta: "bg-slate-400",
  em_andamento: "bg-blue-500",
  bloqueada: "bg-rose-500",
  finalizada: "bg-emerald-500",
  cancelada: "bg-zinc-400",
};

export const SETOR_BAR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-orange-500",
];

export function corDoSetor(setores: Setor[], setorId: string | null | undefined) {
  if (!setorId) return "bg-slate-400";
  const i = setores.findIndex((s) => s.id === setorId);
  return SETOR_BAR_COLORS[(i < 0 ? 0 : i) % SETOR_BAR_COLORS.length];
}

/** Progresso considerando setores concluídos + o checklist do setor atual. */
export function progressoOrdem(
  roteiro: OrdemSetor[],
  checklist: ChecklistItem[],
  setorAtualId: string | null,
) {
  const total = roteiro.length || 1;
  const concluidos = roteiro.filter((r) => r.status === "concluido").length;
  const itens = checklist.filter((c) => c.setor_id === setorAtualId);
  const feitos = itens.filter((c) => c.concluido).length;
  const parcial = itens.length > 0 ? feitos / itens.length : 0;
  const pct = Math.min(100, Math.round(((concluidos + parcial) / total) * 100));
  return { pct, concluidos, total, itensFeitos: feitos, itensTotal: itens.length };
}

export function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v);
  return d.toLocaleDateString("pt-BR");
}
