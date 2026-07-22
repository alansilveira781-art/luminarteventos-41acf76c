import type { Proposta, PropostaStatus } from "./types";
import { propostaTotal } from "./types";
import type { Filtros } from "./vendas-metrics";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseDataRegistro(p: Proposta): Date | null {
  const s = p.createdAt;
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function aplicarFiltrosPropostas(propostas: Proposta[], f: Filtros): Proposta[] {
  return propostas.filter((p) => {
    const d = parseDataRegistro(p);
    if (f.ano !== "Todos") {
      if (!d || d.getFullYear() !== f.ano) return false;
    }
    if (f.mes !== "Todos") {
      if (!d) return false;
      const mesNome = MESES[d.getMonth()];
      if (mesNome.toLowerCase() !== String(f.mes).toLowerCase()) return false;
    }
    if (f.empresa !== "Todos") {
      const emp = (p as unknown as { empresa?: string }).empresa;
      if (emp && emp !== f.empresa) return false;
    }
    return true;
  });
}

export type PropostasKpis = {
  criadas: number;
  enviadas: number;
  emNegociacao: number;
  fechadas: number;
  perdidas: number;
  taxaConversao: number; // 0-100
  ticketMedio: number;
  valorFechado: number;
};

const FECHADAS: PropostaStatus[] = ["fechado"];
const PERDIDAS: PropostaStatus[] = ["perdido"];
const ENVIADAS: PropostaStatus[] = ["enviado"];
const NEGOCIACAO: PropostaStatus[] = ["em_negociacao", "em_revisao", "aguardando_aprovacao"];

export function kpisPropostas(propostas: Proposta[]): PropostasKpis {
  const criadas = propostas.length;
  const enviadas = propostas.filter((p) => ENVIADAS.includes(p.status)).length;
  const emNegociacao = propostas.filter((p) => NEGOCIACAO.includes(p.status)).length;
  const fechadasArr = propostas.filter((p) => FECHADAS.includes(p.status));
  const fechadas = fechadasArr.length;
  const perdidas = propostas.filter((p) => PERDIDAS.includes(p.status)).length;
  const valorFechado = fechadasArr.reduce((s, p) => s + propostaTotal(p), 0);
  const ticketMedio = fechadas ? valorFechado / fechadas : 0;
  const taxaConversao = criadas ? (fechadas / criadas) * 100 : 0;
  return { criadas, enviadas, emNegociacao, fechadas, perdidas, taxaConversao, ticketMedio, valorFechado };
}

export function evolucaoMensalPropostas(propostas: Proposta[]) {
  const buckets = Array.from({ length: 12 }, () => ({ criadas: 0, fechadas: 0 }));
  for (const p of propostas) {
    const d = parseDataRegistro(p);
    if (!d) continue;
    const m = d.getMonth();
    buckets[m].criadas += 1;
    if (FECHADAS.includes(p.status)) buckets[m].fechadas += 1;
  }
  return buckets.map((b, i) => ({ mes: MESES[i].slice(0, 3), ...b }));
}

export function rankingConsultorPropostas(propostas: Proposta[]) {
  const map = new Map<string, { qtd: number; valor: number }>();
  for (const p of propostas) {
    if (!FECHADAS.includes(p.status)) continue;
    const nome = (p.responsavel || "—").trim() || "—";
    const cur = map.get(nome) ?? { qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += propostaTotal(p);
    map.set(nome, cur);
  }
  return [...map.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.valor - a.valor);
}
