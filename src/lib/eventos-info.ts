import { useQuery } from "@tanstack/react-query";
import { listEventos, type EventoSheetRow } from "@/lib/sheets.functions";
import { supabase } from "@/integrations/supabase/client";
import { normalize } from "@/lib/utils";

export type EventoInfo = {
  id: string;
  nome: string;
  local: string;
  uf: string;
  produtor: string;
  dataInicio: string;
  dataFim: string;
  montagemInicio: string;
  montagemFim: string;
  desmontagemInicio: string;
  desmontagemFim: string;
};

/** Converte "DD/MM/AAAA" ou "AAAA-MM-DD" em "AAAA-MM-DD" (ou "" quando inválido). */
export function toISODate(v?: string | null): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const [, d, m, y] = br;
    const ano = y.length === 2 ? `20${y}` : y;
    return `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : "";
}

export function formatBRDate(v?: string | null): string {
  const iso = toISODate(v);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Lista unificada de eventos (calendário + planilha), usada para enriquecer cards. */
export function useEventosInfo() {
  const sheets = useQuery({
    queryKey: ["sheets-eventos"],
    queryFn: async () => await listEventos(),
    staleTime: 5 * 60 * 1000,
  });

  const calendario = useQuery({
    queryKey: ["eventos-info-calendario"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eventos")
        .select(
          "codigo_evento, nome, local, cidade, uf, produtor, data_evento, data_evento_fim, data_montagem, data_desmontagem",
        )
        .not("codigo_evento", "is", null);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const sheetRows: EventoInfo[] = ((sheets.data?.rows ?? []) as EventoSheetRow[]).map((r) => ({
    id: r.id,
    nome: r.nome,
    local: r.local,
    uf: r.uf,
    produtor: r.produtor,
    dataInicio: r.dataInicio,
    dataFim: r.dataFim,
    montagemInicio: r.montagemInicio,
    montagemFim: r.montagemFim,
    desmontagemInicio: r.desmontagemInicio,
    desmontagemFim: r.desmontagemFim,
  }));

  const calRows: EventoInfo[] = ((calendario.data ?? []) as any[]).map((r) => ({
    id: r.codigo_evento ?? "",
    nome: r.nome ?? "",
    local: r.local ?? "",
    uf: [r.cidade, r.uf].filter(Boolean).join("/"),
    produtor: r.produtor ?? "",
    dataInicio: r.data_evento ?? "",
    dataFim: r.data_evento_fim ?? r.data_evento ?? "",
    montagemInicio: r.data_montagem ?? "",
    montagemFim: "",
    desmontagemInicio: r.data_desmontagem ?? "",
    desmontagemFim: "",
  }));

  const seen = new Set<string>();
  const eventos = [...calRows, ...sheetRows].filter((e) => {
    const k = normalize(e.id);
    if (!e.id || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { eventos, isLoading: sheets.isLoading || calendario.isLoading };
}

/** Busca um evento pelo código/nome informado no card (casamento flexível). */
export function acharEvento(eventos: EventoInfo[], valor?: string | null): EventoInfo | null {
  const v = normalize((valor ?? "").trim());
  if (!v) return null;
  return (
    eventos.find((e) => normalize(e.id) === v)
    ?? eventos.find((e) => normalize(e.nome) === v)
    ?? eventos.find((e) => normalize(e.id).includes(v) || v.includes(normalize(e.id)))
    ?? eventos.find((e) => e.nome && (normalize(e.nome).includes(v) || v.includes(normalize(e.nome))))
    ?? null
  );
}

/**
 * Classificação de uma data em relação ao período do evento.
 * Considera montagem (início) e desmontagem (fim) quando informadas.
 */
export function periodoEvento(e: EventoInfo) {
  const inicio = toISODate(e.montagemInicio) || toISODate(e.dataInicio);
  const fim = toISODate(e.desmontagemFim) || toISODate(e.desmontagemInicio) || toISODate(e.dataFim) || toISODate(e.dataInicio);
  return { inicio, fim };
}

export function classificarData(
  data: string | null | undefined,
  e: EventoInfo,
): "antes" | "durante" | "depois" | null {
  const d = toISODate(data);
  const { inicio, fim } = periodoEvento(e);
  if (!d || !inicio) return null;
  if (d < inicio) return "antes";
  if (fim && d > fim) return "depois";
  return "durante";
}
