import { useSyncExternalStore } from "react";
import type {
  Cliente,
  ComercialCard,
  CardStatus,
  Proposta,
  PropostaStatus,
} from "./types";

const KEY_CARDS = "comercial.cards.v1";
const KEY_PROPOSTAS = "comercial.propostas.v1";
const KEY_CLIENTES = "comercial.clientes.v1";
const KEY_PROP_SEQ = "comercial.proposta.seq.v1";

type State = {
  cards: ComercialCard[];
  propostas: Proposta[];
  clientes: Cliente[];
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

let state: State = {
  cards: read<ComercialCard[]>(KEY_CARDS, []),
  propostas: read<Proposta[]>(KEY_PROPOSTAS, []),
  clientes: read<Cliente[]>(KEY_CLIENTES, []),
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
  // Sync proposta status if linked
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

// ----- Propostas -----
export function createProposta(p: Omit<Proposta, "id" | "numero" | "createdAt" | "status"> & { status?: PropostaStatus }) {
  const proposta: Proposta = {
    id: uid(),
    numero: nextPropostaNumero(),
    createdAt: new Date().toISOString(),
    status: p.status ?? "aguardando_aprovacao",
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
      updateCard(p.cardId, { status: "orcamento_enviado" });
    }
  }
}

export function reprovarProposta(id: string) {
  updatePropostaStatus(id, "em_revisao");
}
