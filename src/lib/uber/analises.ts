export type Granularidade = "dia" | "semana" | "mes" | "ano";
export type GranularidadeOpt = "auto" | Granularidade;

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function parseIso(d: string): Date {
  return new Date(d.slice(0, 10) + "T00:00:00");
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86400000) + 1;
}

/** Escolhe granularidade pelo tamanho do período. */
export function escolherGranularidade(dias: number): Granularidade {
  if (dias <= 14) return "dia";
  if (dias <= 70) return "semana";
  if (dias <= 1100) return "mes";
  return "ano";
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dow);
  return x;
}

const ddmm = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Chave + rótulo do bucket a que a data pertence. */
export function bucketDe(dataIso: string, g: Granularidade): { key: string; label: string } {
  const d = parseIso(dataIso);
  if (g === "dia") {
    return { key: iso(d), label: d.toLocaleDateString("pt-BR") };
  }
  if (g === "semana") {
    const ini = inicioSemana(d);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 6);
    return { key: iso(ini), label: `${ddmm(ini)}–${ddmm(fim)}` };
  }
  if (g === "mes") {
    const key = dataIso.slice(0, 7);
    return { key, label: `${MESES_PT[d.getMonth()]}/${d.getFullYear()}` };
  }
  const y = String(d.getFullYear());
  return { key: y, label: y };
}

export const granularidadeLabel: Record<Granularidade, string> = {
  dia: "dia",
  semana: "semana",
  mes: "mês",
  ano: "ano",
};

export const granularidadeLabelPlural: Record<Granularidade, string> = {
  dia: "dias",
  semana: "semanas",
  mes: "meses",
  ano: "anos",
};

/** Faixa de horário a partir do texto de hora importado da Uber. */
export function faixaHoraria(hora: string | null): string {
  if (!hora) return "Sem horário";
  const m = hora.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return "Sem horário";
  let h = parseInt(m[1], 10);
  const ampm = (m[3] || "").toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (h < 6) return "Madrugada (00h–06h)";
  if (h < 12) return "Manhã (06h–12h)";
  if (h < 18) return "Tarde (12h–18h)";
  return "Noite (18h–24h)";
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function diaDaSemana(dataIso: string): { idx: number; label: string } {
  const d = parseIso(dataIso);
  return { idx: d.getDay(), label: DIAS_SEMANA[d.getDay()] };
}
