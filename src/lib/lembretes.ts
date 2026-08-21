export type LembreteProjeto = {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type LembreteRecorrencia = "nenhuma" | "diaria" | "semanal" | "mensal";
export type LembretePrioridade = "baixa" | "normal" | "alta";
export type LembreteStatus = "pendente" | "concluida" | "cancelada";

export type LembreteTarefa = {
  id: string;
  user_id: string;
  projeto_id: string | null;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  dia_inteiro: boolean;
  duracao_min: number;
  lembrete_min: number;
  recorrencia: LembreteRecorrencia;
  recorrencia_intervalo?: number | null;
  recorrencia_fim?: string | null;
  recorrencia_qtd?: number | null;
  serie_id?: string | null;
  prioridade: LembretePrioridade;
  status: LembreteStatus;
  concluida_em: string | null;
  notificada_em: string | null;
  created_at: string;
  updated_at: string;
};

export const RECORRENCIAS: { value: LembreteRecorrencia; label: string }[] = [
  { value: "nenhuma", label: "Não se repete" },
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
];

export const PRIORIDADES: { value: LembretePrioridade; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
];

export const STATUSES: { value: LembreteStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

export const CORES_PROJETO = [
  "#2C3E50",
  "#1F6FEB",
  "#0F766E",
  "#B45309",
  "#B91C1C",
  "#6D28D9",
  "#4B5563",
  "#047857",
];

/** yyyy-mm-dd no fuso local */
export function toDateKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dia = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Segunda-feira da semana da data informada */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = domingo
  return addDays(x, dow === 0 ? -6 : 1 - dow);
}

export function weekDays(base: Date): Date[] {
  const inicio = startOfWeek(base);
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Grade do mês (segunda a domingo), sempre completa nas bordas. */
export function monthGrid(base: Date): Date[] {
  const inicio = startOfWeek(startOfMonth(base));
  const fimMes = addMonths(base, 1);
  const dias: Date[] = [];
  let cur = inicio;
  while (cur < fimMes || dias.length % 7 !== 0) {
    dias.push(cur);
    cur = addDays(cur, 1);
    if (dias.length > 42) break;
  }
  return dias;
}

export function mesPorExtenso(d: Date): string {
  const txt = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}


/** Combina data (yyyy-mm-dd) e hora (HH:mm) em Date local */
export function combinarDataHora(data: string, hora: string | null, diaInteiro: boolean): Date {
  const [y, m, d] = data.split("-").map(Number);
  if (diaInteiro || !hora) return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function horaLocal(iso: string): string {
  const d = new Date(iso);
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

export function dataLocal(iso: string): string {
  return toDateKey(new Date(iso));
}

export function formatarDataHora(iso: string, diaInteiro: boolean): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR");
  return diaInteiro ? `${data} · dia inteiro` : `${data} ${horaLocal(iso)}`;
}

export function dataPorExtenso(d: Date): string {
  const txt = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function estaAtrasada(t: LembreteTarefa): boolean {
  if (t.status !== "pendente" || t.dia_inteiro) return false;
  return new Date(t.data_hora).getTime() < Date.now();
}

/** Retorna o timestamp em que o lembrete da tarefa deve ser disparado. */
export function horarioLembrete(t: LembreteTarefa): number {
  return new Date(t.data_hora).getTime() - (t.lembrete_min || 0) * 60_000;
}

/** Verifica se o lembrete da tarefa já chegou e ainda não foi notificado. */
export function lembreteVenceu(t: LembreteTarefa): boolean {
  if (t.status !== "pendente") return false;
  if (t.notificada_em) return false;
  return horarioLembrete(t) <= Date.now();
}

/** Toca um beep curto usando Web Audio API (sem arquivo externo). */
export async function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Recorrência                                                         */
/* ------------------------------------------------------------------ */

export const MAX_OCORRENCIAS = 200;

/** Soma meses preservando o dia quando possível (31/01 + 1 mês = 28/02). */
function addMonthsKeepDay(base: Date, n: number): Date {
  const dia = base.getDate();
  const x = new Date(base);
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const ultimoDia = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(dia, ultimoDia));
  x.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return x;
}

export type FimRecorrencia =
  | { tipo: "qtd"; qtd: number }
  | { tipo: "ate"; ate: string }
  | { tipo: "nunca" };

/** Empurra sábado/domingo para a segunda-feira seguinte. */
export function proximoDiaUtil(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  if (dow === 6) x.setDate(x.getDate() + 2);
  else if (dow === 0) x.setDate(x.getDate() + 1);
  return x;
}

/**
 * Gera as datas de uma série a partir da data inicial (inclusive).
 * Limitada a MAX_OCORRENCIAS; "nunca" gera 1 ano de ocorrências.
 */
export function gerarOcorrencias(
  inicio: Date,
  recorrencia: LembreteRecorrencia,
  intervalo: number,
  fim: FimRecorrencia,
  somenteDiasUteis = false,
): Date[] {
  if (recorrencia === "nenhuma") {
    return [somenteDiasUteis ? proximoDiaUtil(inicio) : inicio];
  }
  const passo = Math.max(1, Math.floor(intervalo) || 1);

  let limiteQtd = MAX_OCORRENCIAS;
  let limiteData: Date | null = null;

  if (fim.tipo === "qtd") {
    limiteQtd = Math.min(MAX_OCORRENCIAS, Math.max(1, Math.floor(fim.qtd) || 1));
  } else if (fim.tipo === "ate") {
    const [y, m, d] = fim.ate.split("-").map(Number);
    limiteData = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
  } else {
    limiteData = addMonthsKeepDay(inicio, 12);
  }

  const datas: Date[] = [];
  const vistos = new Set<number>();
  for (let i = 0; i < MAX_OCORRENCIAS * 2; i++) {
    let atual: Date;
    if (recorrencia === "diaria") atual = addDays(inicio, i * passo);
    else if (recorrencia === "semanal") atual = addDays(inicio, i * passo * 7);
    else atual = addMonthsKeepDay(inicio, i * passo);

    if (recorrencia !== "mensal") {
      atual.setHours(inicio.getHours(), inicio.getMinutes(), 0, 0);
    }
    if (somenteDiasUteis) {
      atual = proximoDiaUtil(atual);
      atual.setHours(inicio.getHours(), inicio.getMinutes(), 0, 0);
    }
    if (limiteData && atual.getTime() > limiteData.getTime()) break;
    if (!vistos.has(atual.getTime())) {
      vistos.add(atual.getTime());
      datas.push(atual);
      if (datas.length >= limiteQtd) break;
    }
  }

  return datas.length > 0 ? datas : [inicio];
}


export function descreverRecorrencia(
  recorrencia: LembreteRecorrencia,
  intervalo: number,
  fim: FimRecorrencia,
  qtdGerada?: number,
  somenteDiasUteis = false,
): string {
  if (recorrencia === "nenhuma") return "Não se repete";
  const n = Math.max(1, Math.floor(intervalo) || 1);
  const unidade =
    recorrencia === "diaria" ? (n === 1 ? "dia" : "dias") :
    recorrencia === "semanal" ? (n === 1 ? "semana" : "semanas") :
    n === 1 ? "mês" : "meses";
  const base = n === 1 ? `A cada ${unidade}` : `A cada ${n} ${unidade}`;

  let sufixo = "";
  if (fim.tipo === "qtd") sufixo = `, ${Math.max(1, fim.qtd)} vezes`;
  else if (fim.tipo === "ate" && fim.ate) {
    const [y, m, d] = fim.ate.split("-");
    sufixo = `, até ${d}/${m}/${y}`;
  } else sufixo = ", por 1 ano";

  const uteis = somenteDiasUteis ? ", somente dias úteis" : "";
  const total = qtdGerada != null ? ` — ${qtdGerada} tarefa${qtdGerada === 1 ? "" : "s"}` : "";
  return `${base}${sufixo}${uteis}${total}`;
}


export function rotuloRecorrencia(t: LembreteTarefa): string {
  const r = RECORRENCIAS.find((x) => x.value === t.recorrencia);
  const n = t.recorrencia_intervalo ?? 1;
  if (!r || t.recorrencia === "nenhuma") return "";
  return n > 1 ? `${r.label} (a cada ${n})` : r.label;
}
