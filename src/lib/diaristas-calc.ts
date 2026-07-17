// Cálculo centralizado para apontamentos de diaristas.
// Regras:
// - Horas trabalhadas = (final - inicial) - intervalo (em minutos), com virada de meia-noite.
// - Diária cheia = valor/hora x 8 (mínimo garantido, mesmo com < 8h).
// - Excedente > 8h é pago por hora ao valor/hora do local.
// - Total = diária + extra manual.
// Trabalha exclusivamente com componentes hora/minuto para evitar problemas de fuso.

export type Local = "Fortaleza" | "Fora";

export type ApontamentoInput = {
  hora_inicial: string; // "HH:MM" ou "HH:MM:SS"
  hora_final: string;
  intervalo_minutos: number;
  local: Local | string;
  extra_manual?: number | null;
};

export type DiaristaTarifa = {
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
};

export type CalcResult = {
  minutosTrabalhados: number;
  horasTrabalhadas: number; // decimal (ex.: 8.5)
  horasLabel: string; // "8h30"
  valorHora: number;
  diaria: number;
  extra: number;
  total: number;
};

function parseHM(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

export function minutosEntre(inicial: string, final: string): number {
  const ini = parseHM(inicial);
  let fim = parseHM(final);
  if (fim < ini) fim += 24 * 60; // virada de meia-noite
  return Math.max(0, fim - ini);
}

export function formatHoras(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h${String(rem).padStart(2, "0")}`;
}

export function valorHoraDoLocal(local: string, t: DiaristaTarifa): number {
  return local === "Fora" ? Number(t.valor_hora_fora) || 0 : Number(t.valor_hora_fortaleza) || 0;
}

export function calcularApontamento(a: ApontamentoInput, t: DiaristaTarifa): CalcResult {
  const bruto = minutosEntre(a.hora_inicial, a.hora_final);
  const minutosTrab = Math.max(0, bruto - (Number(a.intervalo_minutos) || 0));
  const horasTrab = minutosTrab / 60;
  const valorHora = valorHoraDoLocal(a.local, t);
  const diariaCheia = valorHora * 8;
  let diaria: number;
  if (horasTrab <= 8) {
    diaria = diariaCheia;
  } else {
    diaria = diariaCheia + (horasTrab - 8) * valorHora;
  }
  const extra = Number(a.extra_manual) || 0;
  const total = diaria + extra;
  return {
    minutosTrabalhados: minutosTrab,
    horasTrabalhadas: horasTrab,
    horasLabel: formatHoras(minutosTrab),
    valorHora,
    diaria,
    extra,
    total,
  };
}
