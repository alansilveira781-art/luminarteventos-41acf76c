// Cálculo centralizado para apontamentos de diaristas.
// Regras:
// - Horas trabalhadas = (final - inicial) - intervalo (em minutos), com virada de meia-noite.
// - Diária cheia = valor/hora x 8.
// - Com "diária mínima" ligada, paga em diárias fechadas de 8h (arredonda p/ cima).
// - Total = diária + extra manual.
// Trabalha exclusivamente com componentes hora/minuto para evitar problemas de fuso.

export type Local = "Fortaleza" | "Fora";

export type ApontamentoInput = {
  hora_inicial: string; // "HH:MM" ou "HH:MM:SS"
  hora_final: string;
  intervalo_minutos: number;
  local: Local | string;
  extra_manual?: number | null;
  almoco?: boolean | null;
  janta?: boolean | null;
  /** Paga em diárias fechadas de 8h, arredondando para cima (padrão: true) */
  diaria_minima?: boolean | null;
  /** Empeleita: registra apenas o horário, sem gerar valor */
  empeleita?: boolean | null;
};

export type DiaristaTarifa = {
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  /** Jornada da diária em horas (padrão 8) */
  horas_diaria?: number | null;
  /** Valores gerais de refeição (configuração do módulo) */
  valor_almoco?: number | null;
  valor_janta?: number | null;
};

/** Jornada da diária do diarista, com fallback de 8h. */
export function jornadaDiaria(t: DiaristaTarifa): number {
  const h = Number(t?.horas_diaria);
  return Number.isFinite(h) && h > 0 ? h : 8;
}

export type CalcResult = {
  minutosTrabalhados: number;
  horasTrabalhadas: number; // decimal (ex.: 8.5)
  horasLabel: string; // "8h30"
  valorHora: number;
  diaria: number;
  extra: number;
  refeicoes: number;
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

export function valorRefeicoes(a: ApontamentoInput, t: DiaristaTarifa): number {
  const almoco = a.almoco ? Number(t.valor_almoco) || 0 : 0;
  const janta = a.janta ? Number(t.valor_janta) || 0 : 0;
  return almoco + janta;
}

function montarResultado(
  minutosTrab: number,
  valorHora: number,
  extraManual: number,
  refeicoes = 0,
  diariaMinima = true,
): CalcResult {
  const horasTrab = minutosTrab / 60;
  const diariaCheia = valorHora * 8;
  // Com a regra ligada, paga em diárias fechadas de 8h (arredonda para cima).
  const diaria = diariaMinima
    ? Math.max(1, Math.ceil(horasTrab / 8)) * diariaCheia
    : horasTrab * valorHora;
  const extra = Number(extraManual) || 0;
  const ref = Number(refeicoes) || 0;
  return {
    minutosTrabalhados: minutosTrab,
    horasTrabalhadas: horasTrab,
    horasLabel: formatHoras(minutosTrab),
    valorHora,
    diaria,
    extra,
    refeicoes: ref,
    total: diaria + extra + ref,
  };
}

export function usaDiariaMinima(a: ApontamentoInput): boolean {
  return a.diaria_minima == null ? true : !!a.diaria_minima;
}

export function isEmpeleita(a: ApontamentoInput): boolean {
  return !!a.empeleita;
}

/** Empeleita: mantém horas/horários mas zera qualquer valor. */
function zerarValores<T extends CalcResult>(r: T): T {
  return { ...r, diaria: 0, extra: 0, refeicoes: 0, total: 0 };
}

export function calcularApontamento(a: ApontamentoInput, t: DiaristaTarifa): CalcResult {
  const bruto = minutosEntre(a.hora_inicial, a.hora_final);
  const minutosTrab = Math.max(0, bruto - (Number(a.intervalo_minutos) || 0));
  const res = montarResultado(
    minutosTrab,
    valorHoraDoLocal(a.local, t),
    a.extra_manual ?? 0,
    valorRefeicoes(a, t),
    usaDiariaMinima(a),
  );
  return isEmpeleita(a) ? zerarValores(res) : res;
}


// ─────────────────────────────────────────────────────────────
// Divisão do dia entre 2 ou mais eventos
// ─────────────────────────────────────────────────────────────

export type ModoDivisao = "unico" | "horarios" | "igual";

export type EventoApontamento = {
  evento_nome: string;
  hora_inicial?: string | null;
  hora_final?: string | null;
  intervalo_minutos?: number | null;
  /** Eventos com o mesmo bloco compartilham o horário e dividem as horas igualmente */
  bloco?: number | null;
  /** Bloco de empreitada: registra as horas mas não gera valor nem entra no cálculo do dia */
  empeleita?: boolean | null;
};

export type RateioEvento = {
  evento_nome: string;
  minutos: number;
  horasLabel: string;
  valor: number;
  /** Bloco de empreitada: horas registradas sem valor */
  empeleita?: boolean;
};

export type CalcComEventos = CalcResult & { rateio: RateioEvento[] };

/**
 * Horário de exibição do dia: primeira entrada e última saída.
 * Quando o apontamento é dividido por horários, considera os horários dos
 * eventos; caso contrário usa o horário do próprio apontamento.
 */
export function intervaloExibicao(
  a: { hora_inicial: string; hora_final: string },
  eventos: EventoApontamento[] | undefined,
  modo: ModoDivisao | null | undefined,
): { inicio: string; fim: string; label: string } {
  const hm = (s: string) => (s || "").slice(0, 5);
  let inicio = hm(a.hora_inicial);
  let fim = hm(a.hora_final);

  const lista = (eventos ?? []).filter(
    (e) => (e.hora_inicial ?? "") !== "" && (e.hora_final ?? "") !== "",
  );

  if (modo === "horarios" && lista.length > 0) {
    const inicios = lista.map((e) => hm(e.hora_inicial as string)).sort();
    const fins = lista.map((e) => hm(e.hora_final as string)).sort();
    inicio = inicios[0] ?? inicio;
    fim = fins[fins.length - 1] ?? fim;
  }

  return { inicio, fim, label: `${inicio}–${fim}` };
}


/**
 * Calcula o dia e o rateio por evento.
 * - "horarios": as horas de cada evento vêm dos horários informados; o valor do
 *   dia é rateado proporcionalmente às horas de cada evento.
 * - "igual": o horário do dia é único e o valor total é dividido em partes
 *   iguais entre os eventos.
 */
export function calcularApontamentoComEventos(
  a: ApontamentoInput,
  t: DiaristaTarifa,
  modo: ModoDivisao,
  eventos: EventoApontamento[],
): CalcComEventos {
  const valorHora = valorHoraDoLocal(a.local, t);
  const lista = (eventos ?? []).filter((e) => (e.evento_nome ?? "").trim() !== "");

  if (modo === "horarios" && lista.length > 0) {
    // Agrupa por bloco: eventos do mesmo bloco compartilham o horário e
    // dividem as horas (e o valor) em partes iguais.
    const blocos = new Map<number, number>(); // bloco -> minutos do bloco
    const blocoEmpeleita = new Map<number, boolean>();
    lista.forEach((e, i) => {
      const b = e.bloco ?? i;
      if (e.empeleita) blocoEmpeleita.set(b, true);
      if (blocos.has(b)) return;
      blocos.set(
        b,
        Math.max(
          0,
          minutosEntre(e.hora_inicial || "00:00", e.hora_final || "00:00") -
            (Number(e.intervalo_minutos) || 0),
        ),
      );
    });
    const qtdPorBloco = new Map<number, number>();
    lista.forEach((e, i) => {
      const b = e.bloco ?? i;
      qtdPorBloco.set(b, (qtdPorBloco.get(b) ?? 0) + 1);
    });

    const minutosPorEvento = lista.map((e, i) => {
      const b = e.bloco ?? i;
      const min = blocos.get(b) ?? 0;
      const n = qtdPorBloco.get(b) ?? 1;
      return Math.round(min / n);
    });
    const ehEmpeleita = lista.map((e, i) => !!blocoEmpeleita.get(e.bloco ?? i));
    // Apenas blocos normais entram no cálculo do valor do dia.
    let totalMin = 0;
    blocos.forEach((min, b) => {
      if (!blocoEmpeleita.get(b)) totalMin += min;
    });
    const somaRateio =
      minutosPorEvento.reduce((acc, m, i) => acc + (ehEmpeleita[i] ? 0 : m), 0) || 1;
    const base = montarResultado(totalMin, valorHora, a.extra_manual ?? 0, valorRefeicoes(a, t), usaDiariaMinima(a));
    const baseFinal = isEmpeleita(a) ? zerarValores(base) : base;
    const ultimoPago = ehEmpeleita.lastIndexOf(false);
    let acumulado = 0;
    const rateio = lista.map((e, i) => {
      const min = minutosPorEvento[i] ?? 0;
      let valor = 0;
      if (!ehEmpeleita[i]) {
        valor =
          i === ultimoPago
            ? Number((baseFinal.total - acumulado).toFixed(2))
            : Number(((baseFinal.total * min) / somaRateio).toFixed(2));
        acumulado += valor;
      }
      return {
        evento_nome: e.evento_nome,
        minutos: min,
        horasLabel: formatHoras(min),
        valor,
        empeleita: ehEmpeleita[i],
      };
    });
    return { ...baseFinal, rateio };
  }

  if (modo === "igual" && lista.length > 0) {
    const base = calcularApontamento(a, t);
    const n = lista.length;
    const parteMin = Math.round(base.minutosTrabalhados / n);
    let acumulado = 0;
    const rateio = lista.map((e, i) => {
      const ultimo = i === n - 1;
      const valor = ultimo
        ? Number((base.total - acumulado).toFixed(2))
        : Number((base.total / n).toFixed(2));
      acumulado += valor;
      return {
        evento_nome: e.evento_nome,
        minutos: parteMin,
        horasLabel: formatHoras(parteMin),
        valor,
      };
    });
    return { ...base, rateio };
  }

  return { ...calcularApontamento(a, t), rateio: [] };
}
