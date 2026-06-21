import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  Cliente,
  ComercialCard,
  CardStatus,
  Proposta,
  PropostaStatus,
  CatalogoDescricao,
  TipoMedida,
} from "./types";
import { CONSULTORES_PADRAO } from "./types";

/* =====================================================================
 * Comercial store — persistência em Supabase com cache local sincronizado
 * por Realtime. Mantém a API existente (useComercial + mutadores) para
 * não quebrar as telas; createProposta e criarNovaVersaoProposta são
 * async porque dependem do RPC de numeração.
 * ===================================================================== */

const sb = supabase as any;
const MIGRATED_FLAG = "comercial.migrado.v1";
const LS_KEYS = {
  cards: "comercial.cards.v1",
  propostas: "comercial.propostas.v1",
  clientes: "comercial.clientes.v1",
  consultores: "comercial.consultores.v1",
  catalogo: "comercial.catalogo.v1",
};

type State = {
  cards: ComercialCard[];
  propostas: Proposta[];
  clientes: Cliente[];
  consultores: string[];
  catalogo: CatalogoDescricao[];
  loaded: boolean;
};

let state: State = {
  cards: [],
  propostas: [],
  clientes: [],
  consultores: [...CONSULTORES_PADRAO],
  catalogo: [],
  loaded: false,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function getSnapshot() {
  return state;
}

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

/* ---------- Mappers DB <-> Domain ---------- */
function clienteFromDb(r: any): Cliente {
  return {
    id: r.id,
    nome: r.nome ?? "",
    telefone: r.telefone ?? "",
    email: r.email ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}
function catalogoFromDb(r: any): CatalogoDescricao {
  return {
    id: r.id,
    nome: r.nome ?? "",
    tipoMedida: (r.tipo_medida ?? "unidade") as TipoMedida,
    valorUnitario: Number(r.valor_unitario) || 0,
    unidade: r.unidade ?? "un",
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}
function cardFromDb(r: any): ComercialCard {
  return {
    id: r.id,
    clienteId: r.cliente_id ?? null,
    clienteNome: r.cliente_nome ?? "",
    eventoNome: r.evento_nome ?? "",
    eventoDataInicio: r.evento_data_inicio ?? "",
    eventoDataFim: r.evento_data_fim ?? "",
    valorEstimado: Number(r.valor_estimado) || 0,
    status: (r.status ?? "lead") as CardStatus,
    responsavel: r.responsavel ?? "",
    observacoes: r.observacoes ?? "",
    motivoPerda: r.motivo_perda ?? undefined,
    propostaId: r.proposta_id ?? null,
    dataEnvio: r.data_envio ?? null,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}
function cardToDb(c: Partial<ComercialCard>) {
  const o: any = {};
  if (c.clienteId !== undefined) o.cliente_id = c.clienteId;
  if (c.clienteNome !== undefined) o.cliente_nome = c.clienteNome;
  if (c.eventoNome !== undefined) o.evento_nome = c.eventoNome;
  if (c.eventoDataInicio !== undefined) o.evento_data_inicio = c.eventoDataInicio || null;
  if (c.eventoDataFim !== undefined) o.evento_data_fim = c.eventoDataFim || null;
  if (c.valorEstimado !== undefined) o.valor_estimado = c.valorEstimado;
  if (c.status !== undefined) o.status = c.status;
  if (c.responsavel !== undefined) o.responsavel = c.responsavel;
  if (c.observacoes !== undefined) o.observacoes = c.observacoes;
  if (c.motivoPerda !== undefined) o.motivo_perda = c.motivoPerda ?? null;
  if (c.propostaId !== undefined) o.proposta_id = c.propostaId ?? null;
  if (c.dataEnvio !== undefined) o.data_envio = c.dataEnvio || null;
  return o;
}
function propostaFromDb(r: any): Proposta {
  return {
    id: r.id,
    numero: r.numero ?? 0,
    cardId: r.card_id ?? null,
    clienteId: r.cliente_id ?? "",
    cliente: r.cliente ?? { nome: "", telefone: "", email: "" },
    evento: r.evento ?? { tipo: "", dataInicio: "", dataFim: "", local: "", cidade: "", observacoes: "" },
    ambientes: r.ambientes ?? [],
    custos: r.custos ?? { frete: 0, montagem: 0, desmontagem: 0, outros: [] },
    resumo: r.resumo ?? { margem: 0, validade: "" },
    responsavel: r.responsavel ?? "",
    status: (r.status ?? "aguardando_aprovacao") as PropostaStatus,
    parentId: r.parent_id ?? null,
    version: r.version ?? 1,
    approvedAt: r.approved_at ?? null,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}
function propostaToDb(p: Partial<Proposta>) {
  const o: any = {};
  if (p.numero !== undefined) o.numero = p.numero;
  if (p.cardId !== undefined) o.card_id = p.cardId ?? null;
  if (p.clienteId !== undefined) o.cliente_id = p.clienteId || null;
  if (p.cliente !== undefined) o.cliente = p.cliente;
  if (p.evento !== undefined) o.evento = p.evento;
  if (p.ambientes !== undefined) o.ambientes = p.ambientes;
  if (p.custos !== undefined) o.custos = p.custos;
  if (p.resumo !== undefined) o.resumo = p.resumo;
  if (p.responsavel !== undefined) o.responsavel = p.responsavel;
  if (p.status !== undefined) o.status = p.status;
  if (p.parentId !== undefined) o.parent_id = p.parentId ?? null;
  if (p.version !== undefined) o.version = p.version;
  if (p.approvedAt !== undefined) o.approved_at = p.approvedAt ?? null;
  return o;
}

/* ---------- Fetch ---------- */
async function fetchAll() {
  try {
    const [cli, cat, cards, props, cons] = await Promise.all([
      sb.from("comercial_clientes").select("*").order("nome"),
      sb.from("comercial_catalogo").select("*").order("nome"),
      sb.from("comercial_cards").select("*").order("created_at", { ascending: false }),
      sb.from("comercial_propostas").select("*").order("created_at", { ascending: false }),
      sb.from("comercial_consultores").select("*").order("nome"),
    ]);
    const clientes = (cli.data ?? []).map(clienteFromDb);
    const catalogo = (cat.data ?? []).map(catalogoFromDb);
    const cardsArr = (cards.data ?? []).map(cardFromDb);
    const propostas = (props.data ?? []).map(propostaFromDb);
    const consultoresArr = (cons.data ?? []).map((c: any) => c.nome as string);
    setState({
      clientes,
      catalogo,
      cards: cardsArr,
      propostas,
      consultores: consultoresArr.length ? consultoresArr : [...CONSULTORES_PADRAO],
      loaded: true,
    });
  } catch (err) {
    console.error("[comercial] fetchAll failed", err);
    setState({ loaded: true });
  }
}

/* ---------- Migração única do localStorage ---------- */
async function maybeMigrate() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MIGRATED_FLAG) === "1") return;
  // só migra se o banco está vazio (evita duplicação)
  if (state.cards.length > 0 || state.propostas.length > 0 || state.clientes.length > 0 || state.catalogo.length > 0) {
    window.localStorage.setItem(MIGRATED_FLAG, "1");
    return;
  }
  try {
    const readLS = <T,>(k: string, fb: T): T => {
      try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; }
    };
    const lsClientes = readLS<any[]>(LS_KEYS.clientes, []);
    const lsCatalogo = readLS<any[]>(LS_KEYS.catalogo, []);
    const lsCards = readLS<any[]>(LS_KEYS.cards, []);
    const lsPropostas = readLS<any[]>(LS_KEYS.propostas, []);
    const lsConsultores = readLS<string[]>(LS_KEYS.consultores, []);

    if (
      lsClientes.length === 0 && lsCatalogo.length === 0 &&
      lsCards.length === 0 && lsPropostas.length === 0 && lsConsultores.length === 0
    ) {
      window.localStorage.setItem(MIGRATED_FLAG, "1");
      return;
    }

    if (lsClientes.length) {
      await sb.from("comercial_clientes").insert(lsClientes.map((c) => ({
        id: c.id, nome: c.nome, telefone: c.telefone ?? "", email: c.email ?? "",
        created_at: c.createdAt ?? new Date().toISOString(),
      })));
    }
    if (lsCatalogo.length) {
      await sb.from("comercial_catalogo").insert(lsCatalogo.map((c) => ({
        id: c.id, nome: c.nome, tipo_medida: c.tipoMedida ?? "unidade",
        valor_unitario: Number(c.valorUnitario) || 0, unidade: c.unidade ?? "un",
        created_at: c.createdAt ?? new Date().toISOString(),
      })));
    }
    if (lsCards.length) {
      await sb.from("comercial_cards").insert(lsCards.map((c) => ({
        id: c.id, cliente_id: c.clienteId ?? null, cliente_nome: c.clienteNome ?? "",
        evento_nome: c.eventoNome ?? "",
        evento_data_inicio: c.eventoDataInicio || null,
        evento_data_fim: (c.eventoDataFim || c.eventoDataInicio) || null,
        valor_estimado: Number(c.valorEstimado) || 0,
        status: c.status ?? "lead",
        responsavel: c.responsavel ?? "",
        observacoes: c.observacoes ?? "",
        motivo_perda: c.motivoPerda ?? null,
        proposta_id: c.propostaId ?? null,
        data_envio: c.dataEnvio || null,
        created_at: c.createdAt ?? new Date().toISOString(),
      })));
    }
    if (lsPropostas.length) {
      // Garante schema atualizado dos itens
      const norm = lsPropostas.map((p) => ({
        id: p.id, numero: p.numero,
        card_id: p.cardId ?? null,
        cliente_id: p.clienteId || null,
        cliente: p.cliente ?? { nome: "", telefone: "", email: "" },
        evento: p.evento ?? {},
        ambientes: p.ambientes ?? [],
        custos: p.custos ?? { frete: 0, montagem: 0, desmontagem: 0, outros: [] },
        resumo: p.resumo ?? { margem: 0, validade: "" },
        responsavel: p.responsavel ?? "",
        status: p.status ?? "aguardando_aprovacao",
        parent_id: p.parentId ?? null,
        version: p.version ?? 1,
        approved_at: p.approvedAt ?? null,
        created_at: p.createdAt ?? new Date().toISOString(),
      }));
      await sb.from("comercial_propostas").insert(norm);
      // Atualiza a sequência para o maior número + 1
      const maxNum = lsPropostas.reduce((m, p) => Math.max(m, Number(p.numero) || 0), 0);
      if (maxNum > 0) {
        await sb.from("comercial_proposta_seq").update({ valor: maxNum }).eq("id", true);
      }
    }
    if (lsConsultores.length) {
      const padrao = new Set([...CONSULTORES_PADRAO]);
      const novos = lsConsultores.filter((n) => !padrao.has(n));
      if (novos.length) {
        await sb.from("comercial_consultores").upsert(novos.map((nome) => ({ nome })), { onConflict: "nome" });
      }
    }

    window.localStorage.setItem(MIGRATED_FLAG, "1");
    console.info("[comercial] migração localStorage → Supabase concluída");
    await fetchAll();
  } catch (err) {
    console.error("[comercial] migração falhou", err);
  }
}

/* ---------- Boot (realtime + fetch inicial) ---------- */
let started = false;
function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  fetchAll().then(maybeMigrate);
  const channel = supabase.channel("comercial-sync");
  const refetch = () => { fetchAll(); };
  ["comercial_clientes", "comercial_catalogo", "comercial_cards", "comercial_propostas", "comercial_consultores"].forEach((t) => {
    channel.on("postgres_changes" as any, { event: "*", schema: "public", table: t }, refetch);
  });
  channel.subscribe();
}

export function useComercial() {
  useEffect(() => { ensureStarted(); }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ====================== CARDS ====================== */
export function createCard(input: Omit<ComercialCard, "id" | "createdAt" | "status"> & { status?: CardStatus }) {
  const card: ComercialCard = {
    id: uid(),
    createdAt: new Date().toISOString(),
    status: input.status ?? "lead",
    ...input,
  } as ComercialCard;
  setState({ cards: [card, ...state.cards] });
  sb.from("comercial_cards").insert({ id: card.id, ...cardToDb(card), created_at: card.createdAt })
    .then(({ error }: any) => { if (error) console.error("[comercial] createCard", error); });
  return card;
}

export function updateCard(id: string, patch: Partial<ComercialCard>) {
  setState({ cards: state.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  sb.from("comercial_cards").update(cardToDb(patch)).eq("id", id)
    .then(({ error }: any) => { if (error) console.error("[comercial] updateCard", error); });
}

export function deleteCard(id: string) {
  setState({ cards: state.cards.filter((c) => c.id !== id) });
  sb.from("comercial_cards").delete().eq("id", id)
    .then(({ error }: any) => { if (error) console.error("[comercial] deleteCard", error); });
}

export function moveCard(id: string, status: CardStatus, extra?: { motivoPerda?: string; dataEnvio?: string }) {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return;
  const patch: Partial<ComercialCard> = { status };
  if (status === "perda") patch.motivoPerda = extra?.motivoPerda ?? card.motivoPerda ?? "";
  if (status !== "perda") patch.motivoPerda = undefined;
  if (status === "orcamento_enviado") {
    patch.dataEnvio = extra?.dataEnvio ?? card.dataEnvio ?? new Date().toISOString().slice(0, 10);
  }
  updateCard(id, patch);
  if (card.propostaId) {
    if (status === "fechamento") updatePropostaStatus(card.propostaId, "fechado");
    if (status === "perda") updatePropostaStatus(card.propostaId, "perdido");
    if (status === "orcamento_enviado") updatePropostaStatus(card.propostaId, "enviado");
  }
}

export function getPropostasDoCard(cardId: string): Proposta[] {
  return state.propostas
    .filter((p) => p.cardId === cardId)
    .sort((a, b) => {
      if (a.numero !== b.numero) return b.numero - a.numero;
      return (b.version ?? 1) - (a.version ?? 1);
    });
}

/* ====================== CLIENTES ====================== */
export function upsertCliente(input: { nome: string; telefone: string; email: string }): Cliente {
  const existing = state.clientes.find(
    (c) => (input.email && c.email.toLowerCase() === input.email.toLowerCase()) || c.nome === input.nome,
  );
  if (existing) {
    const patched: Cliente = { ...existing, ...input };
    setState({ clientes: state.clientes.map((c) => (c.id === existing.id ? patched : c)) });
    sb.from("comercial_clientes").update({
      nome: input.nome, telefone: input.telefone, email: input.email,
    }).eq("id", existing.id).then(({ error }: any) => { if (error) console.error("[comercial] upsertCliente.update", error); });
    return patched;
  }
  const cliente: Cliente = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  setState({ clientes: [cliente, ...state.clientes] });
  sb.from("comercial_clientes").insert({
    id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, email: cliente.email,
    created_at: cliente.createdAt,
  }).then(({ error }: any) => { if (error) console.error("[comercial] upsertCliente.insert", error); });
  return cliente;
}

/* ====================== CONSULTORES ====================== */
export function addConsultor(nome: string) {
  const n = nome.trim();
  if (!n) return;
  if (state.consultores.some((c) => c.toLowerCase() === n.toLowerCase())) return;
  setState({ consultores: [...state.consultores, n] });
  sb.from("comercial_consultores").upsert({ nome: n }, { onConflict: "nome" })
    .then(({ error }: any) => { if (error) console.error("[comercial] addConsultor", error); });
}

/* ====================== CATÁLOGO ====================== */
export function createCatalogoDescricao(input: Omit<CatalogoDescricao, "id" | "createdAt">) {
  const item: CatalogoDescricao = { id: uid(), createdAt: new Date().toISOString(), ...input };
  setState({ catalogo: [item, ...state.catalogo] });
  sb.from("comercial_catalogo").insert({
    id: item.id, nome: item.nome, tipo_medida: item.tipoMedida,
    valor_unitario: item.valorUnitario, unidade: item.unidade ?? "un",
    created_at: item.createdAt,
  }).then(({ error }: any) => { if (error) console.error("[comercial] createCatalogo", error); });
  return item;
}
export function updateCatalogoDescricao(id: string, patch: Partial<CatalogoDescricao>) {
  setState({ catalogo: state.catalogo.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const o: any = {};
  if (patch.nome !== undefined) o.nome = patch.nome;
  if (patch.tipoMedida !== undefined) o.tipo_medida = patch.tipoMedida;
  if (patch.valorUnitario !== undefined) o.valor_unitario = patch.valorUnitario;
  if (patch.unidade !== undefined) o.unidade = patch.unidade;
  sb.from("comercial_catalogo").update(o).eq("id", id)
    .then(({ error }: any) => { if (error) console.error("[comercial] updateCatalogo", error); });
}
export function deleteCatalogoDescricao(id: string) {
  setState({ catalogo: state.catalogo.filter((c) => c.id !== id) });
  sb.from("comercial_catalogo").delete().eq("id", id)
    .then(({ error }: any) => { if (error) console.error("[comercial] deleteCatalogo", error); });
}

/* ====================== PROPOSTAS ====================== */
async function nextNumero(): Promise<number> {
  const { data, error } = await sb.rpc("next_proposta_numero");
  if (error || typeof data !== "number") {
    console.error("[comercial] next_proposta_numero", error);
    const max = state.propostas.reduce((m, p) => Math.max(m, p.numero), 1000);
    return max + 1;
  }
  return data;
}

export async function createProposta(
  p: Omit<Proposta, "id" | "numero" | "createdAt" | "status"> & { status?: PropostaStatus },
): Promise<Proposta> {
  const numero = await nextNumero();
  const proposta: Proposta = {
    id: uid(),
    numero,
    createdAt: new Date().toISOString(),
    status: p.status ?? "aguardando_aprovacao",
    version: 1,
    parentId: null,
    ...p,
  } as Proposta;
  setState({ propostas: [proposta, ...state.propostas] });
  const { error } = await sb.from("comercial_propostas").insert({
    id: proposta.id, ...propostaToDb(proposta), created_at: proposta.createdAt,
  });
  if (error) console.error("[comercial] createProposta", error);
  if (proposta.cardId) updateCard(proposta.cardId, { propostaId: proposta.id });
  return proposta;
}

export function updateProposta(id: string, patch: Partial<Proposta>) {
  setState({ propostas: state.propostas.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  sb.from("comercial_propostas").update(propostaToDb(patch)).eq("id", id)
    .then(({ error }: any) => { if (error) console.error("[comercial] updateProposta", error); });
}

export function updatePropostaStatus(id: string, status: PropostaStatus) {
  const approvedAtPatch: Partial<Proposta> = { status };
  const cur = state.propostas.find((p) => p.id === id);
  if (status === "enviado" && cur && !cur.approvedAt) {
    approvedAtPatch.approvedAt = new Date().toISOString();
  }
  updateProposta(id, approvedAtPatch);
}

export function aprovarProposta(id: string) {
  const p = state.propostas.find((x) => x.id === id);
  if (!p) return;
  updatePropostaStatus(id, "enviado");
  if (p.cardId) {
    const card = state.cards.find((c) => c.id === p.cardId);
    if (card && card.status !== "fechamento" && card.status !== "perda") {
      updateCard(p.cardId, { status: "orcamento_validado" });
    }
  }
}

export function reprovarProposta(id: string) {
  updatePropostaStatus(id, "em_revisao");
}

/* ---------- Excluir proposta / versão ---------- */
export function deleteProposta(id: string) {
  const alvo = state.propostas.find((p) => p.id === id);
  if (!alvo) return;
  const rootId = alvo.parentId ?? alvo.id;
  // Remove a versão
  const restantes = state.propostas.filter((p) => p.id !== id);
  // Se algum card aponta para essa versão, troca para a mais recente do mesmo grupo
  let cardsPatched = state.cards;
  const cardsAfetados = state.cards.filter((c) => c.propostaId === id);
  if (cardsAfetados.length) {
    const irmãs = restantes
      .filter((p) => (p.parentId ?? p.id) === rootId)
      .sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
    const fallback = irmãs[0]?.id ?? null;
    cardsPatched = state.cards.map((c) =>
      c.propostaId === id ? { ...c, propostaId: fallback } : c,
    );
    cardsAfetados.forEach((c) => {
      sb.from("comercial_cards").update({ proposta_id: fallback }).eq("id", c.id)
        .then(({ error }: any) => { if (error) console.error("[comercial] deleteProposta.cardUpd", error); });
    });
  }
  setState({ propostas: restantes, cards: cardsPatched });
  sb.from("comercial_propostas").delete().eq("id", id)
    .then(({ error }: any) => { if (error) console.error("[comercial] deleteProposta", error); });
}

/* ---------- Versionamento ---------- */
export function getRootPropostaId(p: Proposta): string {
  return p.parentId ?? p.id;
}

export function getVersoesProposta(rootId: string): Proposta[] {
  return state.propostas
    .filter((p) => (p.parentId ?? p.id) === rootId)
    .sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
}

export async function criarNovaVersaoProposta(propostaId: string): Promise<Proposta | null> {
  const orig = state.propostas.find((p) => p.id === propostaId);
  if (!orig) return null;
  const rootId = orig.parentId ?? orig.id;
  const versoes = getVersoesProposta(rootId);
  const maxVersion = versoes.reduce((m, v) => Math.max(m, v.version ?? 1), 1);

  const nova: Proposta = {
    ...orig,
    id: uid(),
    numero: orig.numero,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    status: "aguardando_aprovacao",
    parentId: rootId,
    version: maxVersion + 1,
  };

  setState({
    propostas: [
      nova,
      ...state.propostas.map((p) =>
        p.id === orig.id ? { ...p, status: "em_revisao" as PropostaStatus } : p,
      ),
    ],
  });

  const { error: e1 } = await sb.from("comercial_propostas").insert({
    id: nova.id, ...propostaToDb(nova), created_at: nova.createdAt,
  });
  if (e1) console.error("[comercial] criarNovaVersao.insert", e1);
  sb.from("comercial_propostas").update({ status: "em_revisao" }).eq("id", orig.id)
    .then(({ error }: any) => { if (error) console.error("[comercial] criarNovaVersao.updOrig", error); });

  if (orig.cardId) {
    updateCard(orig.cardId, { propostaId: nova.id, status: "projeto" });
  }

  return nova;
}
