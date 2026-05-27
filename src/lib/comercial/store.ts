import { useSyncExternalStore } from "react";
import type {
  Cliente,
  ComercialCard,
  CardStatus,
  Proposta,
  PropostaStatus,
  Ambiente,
  CatalogoDescricao,
  DescricaoItem,
} from "./types";
import { CONSULTORES_PADRAO } from "./types";

const KEY_CARDS = "comercial.cards.v1";
const KEY_PROPOSTAS = "comercial.propostas.v1";
const KEY_CLIENTES = "comercial.clientes.v1";
const KEY_PROP_SEQ = "comercial.proposta.seq.v1";
const KEY_CONSULTORES = "comercial.consultores.v1";
const KEY_CATALOGO = "comercial.catalogo.v1";

type State = {
  cards: ComercialCard[];
  propostas: Proposta[];
  clientes: Cliente[];
  consultores: string[];
  catalogo: CatalogoDescricao[];
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ----- Migrations -----
function migrateCards(raw: any[]): ComercialCard[] {
  return (raw || []).map((c) => {
    if (c.eventoDataInicio !== undefined) return c as ComercialCard;
    const data = c.eventoData || "";
    return { ...c, eventoDataInicio: data, eventoDataFim: data } as ComercialCard;
  });
}

function migrateDescricao(d: any): DescricaoItem {
  return {
    id: d.id || uid(),
    catalogoId: d.catalogoId ?? null,
    descricao: d.descricao || "",
    tipoMedida: d.tipoMedida || "unidade",
    unidade: d.unidade || "un",
    largura: d.largura,
    altura: d.altura,
    comprimento: d.comprimento,
    quantidade: Number(d.quantidade) || 0,
    valorUnitario: Number(d.valorUnitario) || 0,
  };
}

function migratePropostas(raw: any[]): Proposta[] {
  return (raw || []).map((p) => {
    let evento = p.evento || {};
    if (evento.dataInicio === undefined) {
      evento = {
        tipo: evento.tipo ?? "",
        dataInicio: evento.data || "",
        dataFim: evento.data || "",
        local: evento.local || "",
        cidade: evento.cidade || "",
        observacoes: evento.observacoes || "",
      };
    }
    let ambientes: Ambiente[] = p.ambientes;
    if (!ambientes) {
      const oldItens = p.itens || [];
      ambientes = oldItens.length
        ? [{
            id: uid(),
            nome: "Geral",
            imagens: [],
            itens: oldItens.map((it: any) => ({
              id: uid(),
              nome: it.nome || "Item",
              descricoes: [migrateDescricao({
                id: it.id,
                descricao: it.nome || "",
                unidade: it.unidade || "un",
                quantidade: it.quantidade,
                valorUnitario: it.valorUnitario,
                tipoMedida: "unidade",
              })],
            })),
          }]
        : [];
    } else {
      ambientes = ambientes.map((a) => ({
        ...a,
        itens: (a.itens || []).map((it) => ({
          ...it,
          descricoes: (it.descricoes || []).map(migrateDescricao),
        })),
      }));
    }
    const { itens: _drop, ...rest } = p;
    return { ...rest, evento, ambientes } as Proposta;
  });
}

let state: State = {
  cards: migrateCards(read<any[]>(KEY_CARDS, [])),
  propostas: migratePropostas(read<any[]>(KEY_PROPOSTAS, [])),
  clientes: read<Cliente[]>(KEY_CLIENTES, []),
  consultores: read<string[]>(KEY_CONSULTORES, [...CONSULTORES_PADRAO]),
  catalogo: read<CatalogoDescricao[]>(KEY_CATALOGO, []),
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return state;
}

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.cards) write(KEY_CARDS, next.cards);
  if (next.propostas) write(KEY_PROPOSTAS, next.propostas);
  if (next.clientes) write(KEY_CLIENTES, next.clientes);
  if (next.consultores) write(KEY_CONSULTORES, next.consultores);
  if (next.catalogo) write(KEY_CATALOGO, next.catalogo);
  emit();
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nextPropostaNumero(): number {
  const cur = read<number>(KEY_PROP_SEQ, 1000);
  const next = cur + 1;
  write(KEY_PROP_SEQ, next);
  return next;
}

// ----- Hooks -----
export function useComercial() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ----- Cards -----
export function createCard(input: Omit<ComercialCard, "id" | "createdAt" | "status"> & { status?: CardStatus }) {
  const card: ComercialCard = {
    id: uid(),
    createdAt: new Date().toISOString(),
    status: input.status ?? "lead",
    ...input,
  } as ComercialCard;
  setState({ cards: [card, ...state.cards] });
  return card;
}

export function updateCard(id: string, patch: Partial<ComercialCard>) {
  setState({
    cards: state.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  });
}

export function deleteCard(id: string) {
  setState({ cards: state.cards.filter((c) => c.id !== id) });
}

export function moveCard(id: string, status: CardStatus, motivoPerda?: string) {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return;
  const patch: Partial<ComercialCard> = { status };
  if (status === "perda") patch.motivoPerda = motivoPerda ?? card.motivoPerda ?? "";
  if (status !== "perda") patch.motivoPerda = undefined;
  updateCard(id, patch);
  if (card.propostaId) {
    if (status === "fechamento") updatePropostaStatus(card.propostaId, "fechado");
    if (status === "perda") updatePropostaStatus(card.propostaId, "perdido");
    if (status === "orcamento_enviado") updatePropostaStatus(card.propostaId, "enviado");
  }
}

// ----- Clientes -----
export function upsertCliente(input: { nome: string; telefone: string; email: string }) {
  const existing = state.clientes.find(
    (c) => (input.email && c.email.toLowerCase() === input.email.toLowerCase()) || c.nome === input.nome,
  );
  if (existing) {
    const patched: Cliente = { ...existing, ...input };
    setState({
      clientes: state.clientes.map((c) => (c.id === existing.id ? patched : c)),
    });
    return patched;
  }
  const cliente: Cliente = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  setState({ clientes: [cliente, ...state.clientes] });
  return cliente;
}

// ----- Consultores -----
export function addConsultor(nome: string) {
  const n = nome.trim();
  if (!n) return;
  if (state.consultores.some((c) => c.toLowerCase() === n.toLowerCase())) return;
  setState({ consultores: [...state.consultores, n] });
}

// ----- Catálogo -----
export function createCatalogoDescricao(input: Omit<CatalogoDescricao, "id" | "createdAt">) {
  const item: CatalogoDescricao = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  setState({ catalogo: [item, ...state.catalogo] });
  return item;
}
export function updateCatalogoDescricao(id: string, patch: Partial<CatalogoDescricao>) {
  setState({ catalogo: state.catalogo.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
}
export function deleteCatalogoDescricao(id: string) {
  setState({ catalogo: state.catalogo.filter((c) => c.id !== id) });
}

// ----- Propostas -----
export function createProposta(p: Omit<Proposta, "id" | "numero" | "createdAt" | "status"> & { status?: PropostaStatus }) {
  const proposta: Proposta = {
    id: uid(),
    numero: nextPropostaNumero(),
    createdAt: new Date().toISOString(),
    status: p.status ?? "aguardando_aprovacao",
    version: 1,
    parentId: null,
    ...p,
  } as Proposta;
  setState({ propostas: [proposta, ...state.propostas] });
  if (proposta.cardId) updateCard(proposta.cardId, { propostaId: proposta.id });
  return proposta;
}

export function updateProposta(id: string, patch: Partial<Proposta>) {
  setState({
    propostas: state.propostas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function updatePropostaStatus(id: string, status: PropostaStatus) {
  setState({
    propostas: state.propostas.map((p) =>
      p.id === id
        ? { ...p, status, approvedAt: status === "enviado" && !p.approvedAt ? new Date().toISOString() : p.approvedAt }
        : p,
    ),
  });
}

export function aprovarProposta(id: string) {
  const p = state.propostas.find((x) => x.id === id);
  if (!p) return;
  updatePropostaStatus(id, "enviado");
  if (p.cardId) {
    const card = state.cards.find((c) => c.id === p.cardId);
    if (card && card.status !== "fechamento" && card.status !== "perda") {
      // Ao validar/aprovar a proposta o card vai para "Orçamento Validado".
      // Movimentação para "Orçamento Enviado" acontece quando o time enviar
      // a proposta ao cliente (ação separada no módulo Propostas).
      updateCard(p.cardId, { status: "orcamento_validado" });
    }
  }
}

export function reprovarProposta(id: string) {
  updatePropostaStatus(id, "em_revisao");
}

// ----- Versionamento de propostas -----
export function getRootPropostaId(p: Proposta): string {
  return p.parentId ?? p.id;
}

export function getVersoesProposta(rootId: string): Proposta[] {
  return state.propostas
    .filter((p) => (p.parentId ?? p.id) === rootId)
    .sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
}

/**
 * Cria nova versão de uma proposta (usado quando o cliente pede ajustes
 * em negociação). Clona o conteúdo, incrementa version, mantém parentId
 * apontando para a raiz e marca a versão anterior como "em_revisao".
 * Move o card vinculado de volta para "projeto".
 */
export function criarNovaVersaoProposta(propostaId: string): Proposta | null {
  const orig = state.propostas.find((p) => p.id === propostaId);
  if (!orig) return null;
  const rootId = orig.parentId ?? orig.id;
  const versoes = getVersoesProposta(rootId);
  const maxVersion = versoes.reduce((m, v) => Math.max(m, v.version ?? 1), 1);

  const nova: Proposta = {
    ...orig,
    id: uid(),
    numero: orig.numero, // mesmo número, versão diferente
    createdAt: new Date().toISOString(),
    approvedAt: null,
    status: "aguardando_aprovacao",
    parentId: rootId,
    version: maxVersion + 1,
  };

  // marca a versão anterior como em revisão (substituída por nova versão)
  setState({
    propostas: [
      nova,
      ...state.propostas.map((p) =>
        p.id === orig.id ? { ...p, status: "em_revisao" as PropostaStatus } : p,
      ),
    ],
  });

  // card vinculado: aponta para a nova proposta e volta para "projeto"
  if (orig.cardId) {
    updateCard(orig.cardId, { propostaId: nova.id, status: "projeto" });
  }

  return nova;
}
