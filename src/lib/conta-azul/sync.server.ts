// Sync helpers — server-only. Called from /api/contaazul/sync route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { caFetch } from "./client.server";

const sb = supabaseAdmin as any;
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap (50 * 100 = 5000 itens por recurso)
const UPSERT_BATCH = 500;

async function logStart(recurso: string, from?: string, to?: string): Promise<string> {
  const { data, error } = await sb
    .from("ca_sync_log")
    .insert({
      recurso,
      status: "em_andamento",
      started_at: new Date().toISOString(),
      date_from: from ?? null,
      date_to: to ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function logFinish(id: string, status: "ok" | "erro", qtd: number, mensagem?: string) {
  await sb
    .from("ca_sync_log")
    .update({
      status,
      qtd_registros: qtd,
      mensagem: mensagem ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

// Paginação da nova API (api-v2.contaazul.com):
//   - `pagina` começa em 1
//   - `tamanho_pagina` aceita apenas: 10, 20, 50, 100, 200, 500, 1000
//   - resposta: { itens_totais: number, items: [...] } (com fallbacks)
async function fetchPaged(
  path: string,
  extraParams: Record<string, string> = {},
  size = PAGE_SIZE,
) {
  const all: any[] = [];
  let pagina = 1;
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({
      ...extraParams,
      pagina: String(pagina),
      tamanho_pagina: String(size),
    });
    const sep = path.includes("?") ? "&" : "?";
    const result = await caFetch(`${path}${sep}${params.toString()}`);
    const items: any[] = Array.isArray(result)
      ? result
      : (result?.itens ?? result?.items ?? result?.content ?? result?.data ?? []);
    if (!items || items.length === 0) break;
    all.push(...items);
    const total = Number(result?.itens_totais ?? result?.total ?? NaN);
    if (Number.isFinite(total) && all.length >= total) break;
    if (items.length < size) break;
    pagina += 1;
  }
  return all;
}

async function upsertBatched(table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const chunk = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

export async function syncPlanoContas() {
  const logId = await logStart("plano_contas");
  try {
    // Plano de Contas = /categorias na API nova.
    // `permite_apenas_filhos` é parâmetro OBRIGATÓRIO (boolean).
    const items = await fetchPaged("/categorias", { permite_apenas_filhos: "false" });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id),
        codigo: it.codigo ?? null,
        nome: it.nome ?? "—",
        tipo: it.tipo ?? null,
        pai_external_id: it.categoria_pai ? String(it.categoria_pai) : null,
        ativo: true,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_plano_contas", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export async function syncCentrosCusto() {
  const logId = await logStart("centros_custo");
  try {
    const items = await fetchPaged("/centro-de-custo", { filtro_rapido: "TODOS" });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => ({
        external_id: String(it.id ?? it.uuid),
        nome: it.nome ?? it.descricao ?? it.name ?? "—",
        ativo: (it.ativo ?? it.active) !== false,
        synced_at: syncedAt,
      }));
      await upsertBatched("ca_centros_custo", rows, "external_id");
    }
    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

function normalizeStatus(s?: string) {
  if (!s) return null;
  const u = s.toUpperCase();
  // Enum oficial v2: PERDIDO | RECEBIDO | EM_ABERTO | RENEGOCIADO | RECEBIDO_PARCIAL | ATRASADO
  if (u === "RECEBIDO" || u === "PAGO" || u === "QUITADO") return "pago";
  if (u === "ATRASADO" || u === "PERDIDO" || u === "OVERDUE") return "atrasado";
  return "em_aberto";
}

function mapEvento(it: any, syncedAt: string, pessoaKey: "fornecedor_nome" | "cliente_nome") {
  const pessoaNome =
    pessoaKey === "fornecedor_nome"
      ? (it.fornecedor?.nome ?? null)
      : (it.cliente?.nome ?? it.fornecedor?.nome ?? null);
  return {
    external_id: String(it.id),
    descricao: it.descricao ?? null,
    [pessoaKey]: pessoaNome,
    categoria_external_id: it.categorias?.[0]?.id ? String(it.categorias[0].id) : null,
    centro_custo_external_id:
      it.centros_de_custo?.[0]?.id ? String(it.centros_de_custo[0].id)
      : it.centros_custo?.[0]?.id ? String(it.centros_custo[0].id)
      : null,
    valor: Number(it.total ?? 0),
    data_vencimento: it.data_vencimento ?? null,
    data_pagamento: it.data_pagamento ?? null,
    status: normalizeStatus(it.status_traduzido ?? it.status),
    documento: it.numero_documento ?? null,
    observacoes: it.observacoes ?? null,
    synced_at: syncedAt,
  };
}

/** Extrai linhas de rateio para `ca_lancamento_rateios`.
 *  Formato oficial v2 (endpoint de parcelas):
 *    it.evento.rateio = [
 *      { id_categoria, nome_categoria, valor, rateio_centro_custo: [
 *        { id_centro_custo, nome_centro_custo, valor }
 *      ] }, ...
 *    ]
 *  Se `evento.rateio[]` não estiver presente (lançamento sem detalhe enriquecido,
 *  ou payload de formato antigo), caímos nos formatos legados como fallback. */
function buildRateios(
  it: any,
  tipo: "pagar" | "receber",
  syncedAt: string,
) {
  const lancId = String(it.id);
  const total = Number(it.total ?? 0);

  // --- 1. Formato oficial v2: evento.rateio[] com rateio_centro_custo[] ---
  const eventoRateio: any[] | null =
    (Array.isArray(it.evento?.rateio) && it.evento.rateio) ||
    (Array.isArray(it.rateio) && it.rateio) ||
    null;

  if (eventoRateio && eventoRateio.length > 0) {
    const fatias: Array<{
      ordem: number;
      cc: string | null;
      cat: string | null;
      valor: number;
      pct: number | null;
    }> = [];
    let ordem = 0;
    for (const r of eventoRateio) {
      const catId = r.id_categoria ?? r.categoria?.id ?? r.categoria_id ?? null;
      const valorGrupo = r.valor != null ? Number(r.valor) : null;
      const ccList: any[] = Array.isArray(r.rateio_centro_custo) ? r.rateio_centro_custo : [];
      if (ccList.length > 0) {
        for (const c of ccList) {
          const ccId = c.id_centro_custo ?? c.centro_custo?.id ?? c.centro_custo_id ?? null;
          const valor = c.valor != null ? Number(c.valor) : (valorGrupo ?? 0);
          fatias.push({
            ordem: ordem++,
            cc: ccId ? String(ccId) : null,
            cat: catId ? String(catId) : null,
            valor: Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100,
            pct: null,
          });
        }
      } else {
        // grupo de rateio sem lista de centro de custo — usa o valor do grupo
        fatias.push({
          ordem: ordem++,
          cc: null,
          cat: catId ? String(catId) : null,
          valor: Math.round((valorGrupo ?? 0) * 100) / 100,
          pct: null,
        });
      }
    }
    return fatias.map((p) => ({
      lancamento_external_id: lancId,
      tipo,
      centro_custo_external_id: p.cc,
      categoria_external_id: p.cat,
      valor: p.valor,
      percentual: p.pct,
      ordem: p.ordem,
      synced_at: syncedAt,
    }));
  }

  // --- 2. Formatos legados (defensivo, itens não enriquecidos ou pré-parcelas) ---
  const nested = it.detalhe_rateio ?? it.rateios_detalhe ?? null;
  const pairedRaw: any[] | null =
    (Array.isArray(it.rateios) && it.rateios) ||
    (Array.isArray(it.alocacoes) && it.alocacoes) ||
    (Array.isArray(it.rateio_centros_custo) && it.rateio_centros_custo) ||
    (Array.isArray(it.rateios_centro_custo) && it.rateios_centro_custo) ||
    (Array.isArray(it.rateios_centros_custo) && it.rateios_centros_custo) ||
    (Array.isArray(it.centro_custo_rateios) && it.centro_custo_rateios) ||
    (nested && Array.isArray(nested.fatias) && nested.fatias) ||
    (nested && Array.isArray(nested.itens) && nested.itens) ||
    (nested && Array.isArray(nested.rateios) && nested.rateios) ||
    (nested && Array.isArray(nested.centros_de_custo) && nested.centros_de_custo) ||
    null;

  let pairs: Array<{ ordem: number; cc: string | null; cat: string | null; valorRaw: number | null; pct: number | null }>;
  if (pairedRaw && pairedRaw.length > 0) {
    pairs = pairedRaw.map((r: any, idx: number) => {
      const ccId =
        r.centro_custo?.id ??
        r.centro_de_custo?.id ??
        r.centro_custo_id ??
        r.centro_de_custo_id ??
        r.id_centro_custo ??
        r.cc?.id ??
        (typeof r.id === "string" && (r.centro_custo || r.centro_de_custo || r.tipo === "CENTRO_CUSTO") ? r.id : null) ??
        null;
      const catId =
        r.categoria?.id ??
        r.categoria_id ??
        r.id_categoria ??
        r.cat?.id ??
        null;
      const valorRaw =
        r.valor != null ? Number(r.valor) :
        r.valor_rateio != null ? Number(r.valor_rateio) :
        r.valor_fatia != null ? Number(r.valor_fatia) :
        r.montante != null ? Number(r.montante) :
        r.total != null ? Number(r.total) :
        null;
      const pct =
        r.percentual != null ? Number(r.percentual) :
        r.percentual_rateio != null ? Number(r.percentual_rateio) :
        r.porcentagem != null ? Number(r.porcentagem) :
        r.percent != null ? Number(r.percent) :
        null;
      return {
        ordem: idx,
        cc: ccId ? String(ccId) : null,
        cat: catId ? String(catId) : null,
        valorRaw,
        pct,
      };
    });
  } else {
    const ccs: any[] = Array.isArray(it.centros_de_custo)
      ? it.centros_de_custo
      : Array.isArray(it.centros_custo)
        ? it.centros_custo
        : [];
    const cats: any[] = Array.isArray(it.categorias) ? it.categorias : [];
    const n = Math.max(ccs.length, cats.length, 1);
    pairs = Array.from({ length: n }, (_, idx) => {
      const c = ccs[idx] ?? ccs[ccs.length - 1] ?? null;
      const k = cats[idx] ?? cats[cats.length - 1] ?? null;
      return {
        ordem: idx,
        cc: c?.id ? String(c.id) : null,
        cat: k?.id ? String(k.id) : null,
        valorRaw:
          c?.valor != null ? Number(c.valor) :
          c?.valor_rateio != null ? Number(c.valor_rateio) :
          k?.valor != null ? Number(k.valor) :
          k?.valor_rateio != null ? Number(k.valor_rateio) :
          null,
        pct:
          c?.percentual != null ? Number(c.percentual) :
          c?.porcentagem != null ? Number(c.porcentagem) :
          k?.percentual != null ? Number(k.percentual) :
          k?.porcentagem != null ? Number(k.porcentagem) :
          null,
      };
    });
  }

  const hasValor = pairs.some((p) => p.valorRaw != null && Number.isFinite(p.valorRaw));
  const hasPct = pairs.some((p) => p.pct != null && Number.isFinite(p.pct));
  const isRateado = pairs.length >= 2;
  if (isRateado && !hasValor && !hasPct) {
    // Fatiamento sem valor/percentual explícito — vamos cair em divisão igual.
    // Loga para investigação (throttled dentro de logRateioSemValor).
    logRateioSemValor(lancId, tipo, pairs.length).catch(() => {});
  }

  const valores = distribuirValores(pairs, total);
  return valores.map((p) => ({
    lancamento_external_id: lancId,
    tipo,
    centro_custo_external_id: p.cc,
    categoria_external_id: p.cat,
    valor: p.valor,
    percentual: p.pct,
    ordem: p.ordem,
    synced_at: syncedAt,
  }));
}




function distribuirValores(
  pairs: Array<{ ordem: number; cc: string | null; cat: string | null; valorRaw: number | null; pct: number | null }>,
  total: number,
) {
  const n = pairs.length;
  if (n === 0) return [];
  const hasValor = pairs.some((p) => p.valorRaw != null && Number.isFinite(p.valorRaw));
  const hasPct = pairs.some((p) => p.pct != null && Number.isFinite(p.pct));
  let valores: number[];
  if (hasValor) {
    valores = pairs.map((p) => (p.valorRaw != null && Number.isFinite(p.valorRaw) ? p.valorRaw! : 0));
    const soma = valores.reduce((s, v) => s + v, 0);
    if (Math.abs(soma - total) > 0.01 && hasPct) {
      const somaPct = pairs.reduce((s, p) => s + (p.pct ?? 0), 0) || 100;
      valores = pairs.map((p) => total * ((p.pct ?? 0) / somaPct));
    }
  } else if (hasPct) {
    const somaPct = pairs.reduce((s, p) => s + (p.pct ?? 0), 0) || 100;
    valores = pairs.map((p) => total * ((p.pct ?? 0) / somaPct));
  } else {
    const fatia = total / n;
    valores = pairs.map(() => fatia);
  }
  return pairs.map((p, i) => ({
    ordem: p.ordem,
    cc: p.cc,
    cat: p.cat,
    valor: Math.round(valores[i] * 100) / 100,
    pct: p.pct,
  }));
}

let _ratioProbeLogged = false;
async function logRatioProbe(items: any[], tipo: "pagar" | "receber") {
  if (_ratioProbeLogged) return;
  const sample = items.find(
    (it: any) =>
      (Array.isArray(it.centros_de_custo) && it.centros_de_custo.length >= 2) ||
      (Array.isArray(it.categorias) && it.categorias.length >= 2) ||
      Array.isArray(it.rateios) ||
      Array.isArray(it.alocacoes),
  );
  if (!sample) return;
  _ratioProbeLogged = true;
  try {
    await sb.from("ca_sync_log").insert({
      recurso: `probe_rateio_${tipo}`,
      status: "ok",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      qtd_registros: 0,
      mensagem: JSON.stringify(sample).slice(0, 8000),
    });
  } catch {}
}

const _detailProbeLogged: Record<"pagar" | "receber", boolean> = { pagar: false, receber: false };
async function logDetailProbe(detail: any, tipo: "pagar" | "receber") {
  if (_detailProbeLogged[tipo]) return;
  _detailProbeLogged[tipo] = true;
  try {
    await sb.from("ca_sync_log").insert({
      recurso: `probe_rateio_detalhe_${tipo}`,
      status: "ok",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      qtd_registros: 0,
      mensagem: JSON.stringify(detail).slice(0, 8000),
    });
  } catch {}
}

function isRateado(it: any): boolean {
  const ccs = Array.isArray(it.centros_de_custo) ? it.centros_de_custo : [];
  const cats = Array.isArray(it.categorias) ? it.categorias : [];
  return ccs.length >= 2 || cats.length >= 2;
}

/** A listagem v2 do Conta Azul omite `centros_de_custo` / `categorias` para
 *  boa parte dos lançamentos (inclusive os de 1 centro). Sem enriquecer, o
 *  campo `centro_custo_external_id` fica NULL na tabela pai e o DRE por
 *  evento perde essas linhas. Enriquecemos todo item que:
 *   - é rateado (>=2 centros ou categorias) — precisa do detalhe p/ valor da fatia; OU
 *   - não tem centro OU não tem categoria na listagem. */
function needsDetail(it: any): boolean {
  if (isRateado(it)) return true;
  const ccs = Array.isArray(it.centros_de_custo) ? it.centros_de_custo : [];
  const cats = Array.isArray(it.categorias) ? it.categorias : [];
  const ccId = ccs[0]?.id ?? null;
  const catId = cats[0]?.id ?? null;
  return !ccId || !catId;
}

/** Extrai o id da parcela para o endpoint /parcelas/{id}.
 *  Em lançamentos de parcela única, o próprio id do evento financeiro
 *  costuma servir. Quando a listagem trouxer explicitamente um id de
 *  parcela, damos preferência. */
function extractParcelaId(it: any): { parcelaId: string | null; source: string } {
  const p0 = Array.isArray(it.parcelas) && it.parcelas.length > 0 ? it.parcelas[0] : null;
  if (p0?.id) return { parcelaId: String(p0.id), source: "parcelas[0].id" };
  if (it.parcela_id) return { parcelaId: String(it.parcela_id), source: "parcela_id" };
  if (it.id_parcela) return { parcelaId: String(it.id_parcela), source: "id_parcela" };
  if (it.id) return { parcelaId: String(it.id), source: "fallback:it.id" };
  return { parcelaId: null, source: "none" };
}

const _rateioSemValorSeen = new Set<string>();
async function logRateioSemValor(lancId: string, tipo: "pagar" | "receber", n: number) {
  if (_rateioSemValorSeen.has(lancId)) return;
  _rateioSemValorSeen.add(lancId);
  if (_rateioSemValorSeen.size > 200) return; // não estourar
  try {
    await sb.from("ca_sync_log").insert({
      recurso: "rateio_sem_valor",
      status: "erro",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      qtd_registros: n,
      mensagem: `Lançamento ${tipo} ${lancId}: rateado (${n} fatias) sem valor nem percentual no payload — fallback divisão igual.`,
    });
  } catch {}
}

/** Busca o endpoint de parcelas para cada item que precisa (ver `needsDetail`).
 *  O endpoint correto na API v2 é /financeiro/eventos-financeiros/parcelas/{id}
 *  — os antigos /contas-a-pagar/{id} e /contas-a-receber/{id} retornam 404.
 *
 *  `deadline` (ms epoch) permite interromper o enrichment antes de estourar
 *  o wall-time do Worker (Cloudflare mata o processo silenciosamente e o log
 *  fica preso em `em_andamento`). Itens não enriquecidos ficam com o payload
 *  original da listagem — os rateios usam divisão igual como fallback.
 */
async function enrichItemsWithDetail(items: any[], tipo: "pagar" | "receber", deadline?: number): Promise<any[]> {
  const detailBase = "/financeiro/eventos-financeiros/parcelas";
  const idxs = items.map((it, i) => (needsDetail(it) ? i : -1)).filter((i) => i >= 0);
  if (idxs.length === 0) return items;

  // Conta Azul rate-limita agressivamente /parcelas/{id}. Concurrency 2 +
  // pequeno throttle entre chamadas evita 429 em massa (era 5, gerava
  // falhas de detalhe em ~30% dos itens).
  const CONCURRENCY = 2;
  const out = items.slice();
  let cursor = 0;
  let detalheFalhas = 0;
  let fallbackIdCount = 0;
  let abortedByDeadline = 0;
  const primeirosErros: string[] = [];
  const fallbackSample: string[] = [];

  async function worker() {
    while (true) {
      if (deadline && Date.now() >= deadline) {
        // Conta quantos ainda faltavam a partir daqui — sem consumir mais o cursor.
        return;
      }
      const my = cursor++;
      if (my >= idxs.length) return;
      const i = idxs[my];
      const { parcelaId, source } = extractParcelaId(items[i]);
      if (!parcelaId) continue;
      if (source === "fallback:it.id") {
        fallbackIdCount++;
        if (fallbackSample.length < 5) fallbackSample.push(parcelaId);
      }
      const url = `${detailBase}/${parcelaId}`;
      try {
        const detail = await caFetch(url);
        await logDetailProbe(detail, tipo);
        out[i] = { ...items[i], ...detail };
      } catch (e: any) {
        detalheFalhas++;
        if (primeirosErros.length < 3) {
          primeirosErros.push(`GET ${url} — ${String(e?.message ?? e).slice(0, 400)}`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, idxs.length) }, () => worker()));

  if (deadline && Date.now() >= deadline) {
    // Cursor pode ter avançado além do idxs.length; clamp.
    const processados = Math.min(cursor, idxs.length);
    abortedByDeadline = Math.max(0, idxs.length - processados);
  }

  if (detalheFalhas > 0) {
    try {
      await sb.from("ca_sync_log").insert({
        recurso: `detalhe_falha_${tipo}`,
        status: "erro",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        qtd_registros: detalheFalhas,
        mensagem: `Falhas ao buscar detalhe (${detailBase}/{id}) de ${detalheFalhas}/${idxs.length} lançamentos.\nPrimeiros erros:\n${primeirosErros.join("\n")}`,
      });
    } catch {}
  }

  if (abortedByDeadline > 0) {
    try {
      await sb.from("ca_sync_log").insert({
        recurso: `enrich_timeout_${tipo}`,
        status: "erro",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        qtd_registros: abortedByDeadline,
        mensagem: `Enrichment de detalhe interrompido por time budget: ${abortedByDeadline}/${idxs.length} lançamentos ficaram sem detalhe (rateios usarão fallback). Considere reduzir o período ou rodar a Carga Histórica em chunks mensais.`,
      });
    } catch {}
  }

  if (fallbackIdCount > 0) {
    try {
      await sb.from("ca_sync_log").insert({
        recurso: "parcela_id_ausente",
        status: "erro",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        qtd_registros: fallbackIdCount,
        mensagem: `Listagem ${tipo} não trouxe id de parcela em ${fallbackIdCount}/${idxs.length} lançamentos — usando it.id como fallback para /parcelas/{id}.\nAmostra: ${fallbackSample.join(", ")}`,
      });
    } catch {}
  }

  return out;
}



async function persistRateios(items: any[], tipo: "pagar" | "receber", syncedAt: string, deadline?: number) {
  await logRatioProbe(items, tipo);
  const enriched = await enrichItemsWithDetail(items, tipo, deadline);
  const allRateios: any[] = [];
  const lancIds: string[] = [];
  for (const it of enriched) {
    const rs = buildRateios(it, tipo, syncedAt);
    if (rs.length > 0) {
      allRateios.push(...rs);
      lancIds.push(String(it.id));
    }
  }
  if (lancIds.length === 0) return;
  for (let i = 0; i < lancIds.length; i += 500) {
    const chunk = lancIds.slice(i, i + 500);
    await sb.from("ca_lancamento_rateios").delete().eq("tipo", tipo).in("lancamento_external_id", chunk);
  }
  await upsertBatched("ca_lancamento_rateios", allRateios, "lancamento_external_id,tipo,ordem");
}


/** Remove do banco os registros com data_vencimento em [from,to] que não vieram
 *  na resposta da API — significa que foram excluídos no Conta Azul. Cascateia
 *  para ca_lancamento_rateios. Retorna a quantidade removida.
 */
async function reconciliarExclusoes(
  tabela: "ca_contas_pagar" | "ca_contas_receber",
  tipoRateio: "pagar" | "receber",
  from: string,
  to: string,
  activeIds: Set<string>,
): Promise<{ removidos: number; ids: string[] }> {
  const { data: existentes, error } = await sb
    .from(tabela)
    .select("external_id")
    .gte("data_vencimento", from)
    .lte("data_vencimento", to);
  if (error) throw error;
  const toDelete = (existentes ?? [])
    .map((r: any) => String(r.external_id))
    .filter((id: string) => !activeIds.has(id));
  if (toDelete.length === 0) return { removidos: 0, ids: [] };
  // Apaga em chunks (evita URL/param muito grande).
  for (let i = 0; i < toDelete.length; i += 500) {
    const chunk = toDelete.slice(i, i + 500);
    await sb
      .from("ca_lancamento_rateios")
      .delete()
      .eq("tipo", tipoRateio)
      .in("lancamento_external_id", chunk);
    await sb.from(tabela).delete().in("external_id", chunk);
  }
  return { removidos: toDelete.length, ids: toDelete };
}

export async function syncContasPagar(from: string, to: string) {
  const logId = await logStart("contas_pagar", from, to);
  try {
    const basePath = "/financeiro/eventos-financeiros/contas-a-pagar/buscar";
    const items = await fetchPaged(basePath, {
      data_vencimento_de: from,
      data_vencimento_ate: to,
    });
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => mapEvento(it, syncedAt, "fornecedor_nome"));
      await upsertBatched("ca_contas_pagar", rows, "external_id");
      await persistRateios(items, "pagar", syncedAt);
    }

    // Reconciliação: remove fantasmas (excluídos no CA) do range.
    try {
      const activeIds = new Set(items.map((it: any) => String(it.id)));
      const rec = await reconciliarExclusoes("ca_contas_pagar", "pagar", from, to, activeIds);
      if (rec.removidos > 0) {
        await sb.from("ca_sync_log").insert({
          recurso: "reconciliacao_pagar",
          status: "ok",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          date_from: from,
          date_to: to,
          qtd_registros: rec.removidos,
          mensagem: `Removidos ${rec.removidos} registro(s) excluídos no Conta Azul: ${rec.ids.slice(0, 20).join(", ")}${rec.ids.length > 20 ? "..." : ""}`,
        });
      }
    } catch (e: any) {
      await sb.from("ca_sync_log").insert({
        recurso: "reconciliacao_pagar",
        status: "erro",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        date_from: from,
        date_to: to,
        qtd_registros: 0,
        mensagem: String(e?.message ?? e),
      });
    }

    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export async function syncContasReceber(from: string, to: string) {
  const logId = await logStart("contas_receber", from, to);
  try {
    const basePath = "/financeiro/eventos-financeiros/contas-a-receber/buscar";
    const items = await fetchPaged(basePath, {
      data_vencimento_de: from,
      data_vencimento_ate: to,
    });

    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const rows = items.map((it: any) => mapEvento(it, syncedAt, "cliente_nome"));
      await upsertBatched("ca_contas_receber", rows, "external_id");
      await persistRateios(items, "receber", syncedAt);
    }

    // Reconciliação: remove fantasmas (excluídos no CA) do range.
    try {
      const activeIds = new Set(items.map((it: any) => String(it.id)));
      const rec = await reconciliarExclusoes("ca_contas_receber", "receber", from, to, activeIds);
      if (rec.removidos > 0) {
        await sb.from("ca_sync_log").insert({
          recurso: "reconciliacao_receber",
          status: "ok",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          date_from: from,
          date_to: to,
          qtd_registros: rec.removidos,
          mensagem: `Removidos ${rec.removidos} registro(s) excluídos no Conta Azul: ${rec.ids.slice(0, 20).join(", ")}${rec.ids.length > 20 ? "..." : ""}`,
        });
      }
    } catch (e: any) {
      await sb.from("ca_sync_log").insert({
        recurso: "reconciliacao_receber",
        status: "erro",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        date_from: from,
        date_to: to,
        qtd_registros: 0,
        mensagem: String(e?.message ?? e),
      });
    }

    await logFinish(logId, "ok", items.length);
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export async function syncExtrato(from: string, to: string) {
  // A nova plataforma não expõe um endpoint único de "Extrato Bancário".
  // Como aproximação, sincronizamos a lista de Contas Financeiras
  // (banco, caixa, cartão) com saldo atual. Um extrato completo de lançamentos
  // por dia exige combinar saldo-inicial + parcelas + transferências.
  const logId = await logStart("extrato", from, to);
  try {
    const items = await fetchPaged("/conta-financeira");
    if (items.length > 0) {
      const syncedAt = new Date().toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const rows = items.map((it: any) => {
        const valor = Number(it.saldo_atual ?? it.saldo ?? it.balance ?? 0);
        return {
          external_id: String(it.id ?? it.uuid),
          conta_bancaria: it.nome ?? it.descricao ?? it.name ?? null,
          data: today,
          descricao: `Saldo atual — ${it.nome ?? it.name ?? "conta"}`,
          valor,
          tipo: valor >= 0 ? "credito" : "debito",
          categoria_external_id: null,
          centro_custo_external_id: null,
          synced_at: syncedAt,
        };
      });
      await upsertBatched("ca_extrato", rows, "external_id");
    }
    await logFinish(
      logId,
      "ok",
      items.length,
      "Sincronizadas contas financeiras com saldo atual (a nova API não tem endpoint único de extrato).",
    );
    return items.length;
  } catch (e: any) {
    await logFinish(logId, "erro", 0, String(e?.message ?? e));
    throw e;
  }
}

export type Recurso =
  | "plano_contas"
  | "centros_custo"
  | "contas_pagar"
  | "contas_receber"
  | "extrato";

export async function syncRecurso(recurso: Recurso, from: string, to: string): Promise<number> {
  switch (recurso) {
    case "plano_contas":
      return syncPlanoContas();
    case "centros_custo":
      return syncCentrosCusto();
    case "contas_pagar":
      return syncContasPagar(from, to);
    case "contas_receber":
      return syncContasReceber(from, to);
    case "extrato":
      return syncExtrato(from, to);
  }
}

export async function syncTudo(from: string, to: string) {
  const result = {
    plano_contas: 0,
    centros_custo: 0,
    contas_pagar: 0,
    contas_receber: 0,
    extrato: 0,
    errors: [] as string[],
  };
  const tasks: Array<[Recurso, () => Promise<number>]> = [
    ["plano_contas", () => syncPlanoContas()],
    ["centros_custo", () => syncCentrosCusto()],
    ["contas_pagar", () => syncContasPagar(from, to)],
    ["contas_receber", () => syncContasReceber(from, to)],
    ["extrato", () => syncExtrato(from, to)],
  ];
  for (const [key, fn] of tasks) {
    try {
      (result as any)[key] = await fn();
    } catch (e: any) {
      result.errors.push(`${key}: ${e?.message ?? e}`);
    }
  }
  await upsertSyncState(from, to, result as any);
  return result;
}

async function upsertSyncState(
  from: string,
  to: string,
  counts: Record<string, number>,
) {
  const now = new Date().toISOString();
  const recursos = ["plano_contas", "centros_custo", "contas_pagar", "contas_receber", "extrato"] as const;
  for (const r of recursos) {
    const { data: existing } = await sb
      .from("ca_sync_state")
      .select("last_synced_from")
      .eq("recurso", r)
      .maybeSingle();
    const mergedFrom =
      existing?.last_synced_from && existing.last_synced_from < from
        ? existing.last_synced_from
        : from;
    await sb.from("ca_sync_state").upsert(
      {
        recurso: r,
        last_synced_from: mergedFrom,
        last_synced_to: to,
        last_run_at: now,
        qtd_total: counts[r] ?? 0,
        updated_at: now,
      },
      { onConflict: "recurso" },
    );
  }
}

/** Sincronização incremental D-1 → hoje. */
export async function syncIncrementalD1() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return syncTudo(from, today);
}

/** Enfileira um job de carga histórica. O processamento real acontece
 *  mês a mês via `processNextHistoricoChunk` (chamado pelo cron), porque
 *  o runtime Cloudflare Worker mata qualquer promise pendente depois que
 *  a resposta HTTP termina. */
export async function runHistoricoBackfill(from: string, to: string): Promise<string> {
  const meses = monthsBetween(from, to);
  const { data: job, error } = await sb
    .from("ca_sync_jobs")
    .insert({
      tipo: "historico",
      status: "pendente",
      date_from: from,
      date_to: to,
      progress: {
        total_meses: meses.length,
        concluidos: 0,
        mes_atual: null,
        meses,
        bootstrap_done: false,
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return job.id as string;
}

/** Processa um único mês do job histórico mais antigo pendente.
 *  Chamado a cada minuto pelo cron — e imediatamente após criar o job
 *  pela UI, para começar sem esperar. */
export async function processNextHistoricoChunk(): Promise<{ processed: boolean; jobId?: string; mes?: string; remaining?: number }> {
  const { data: job } = await sb
    .from("ca_sync_jobs")
    .select("*")
    .eq("tipo", "historico")
    .in("status", ["pendente", "em_andamento"])
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!job) return { processed: false };

  const jobId = job.id as string;
  let progress = (job.progress ?? {}) as any;
  let meses: Array<[string, string]> = Array.isArray(progress.meses) ? progress.meses : [];
  // Recupera jobs órfãos (criados antes desta correção, com meses vazios).
  if (meses.length === 0 && job.date_from && job.date_to) {
    meses = monthsBetween(job.date_from, job.date_to);
    progress = { ...progress, meses, total_meses: meses.length };
  }
  const total = meses.length;
  const done: number = Number(progress.concluidos ?? 0);

  try {
    // Bootstrap (plano de contas, centros de custo, extrato) só na 1ª execução.
    if (!progress.bootstrap_done) {
      await sb.from("ca_sync_jobs").update({
        status: "em_andamento",
        progress: { ...progress, mes_atual: "bootstrap" },
      }).eq("id", jobId);
      try { await syncPlanoContas(); } catch {}
      try { await syncCentrosCusto(); } catch {}
      try { await syncExtrato(job.date_from, job.date_to); } catch {}
      progress = { ...progress, bootstrap_done: true };
      await sb.from("ca_sync_jobs").update({ progress }).eq("id", jobId);
    }

    if (done >= total) {
      await upsertSyncState(job.date_from, job.date_to, {});
      await sb.from("ca_sync_jobs").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        progress: { ...progress, mes_atual: null },
      }).eq("id", jobId);
      return { processed: true, jobId, remaining: 0 };
    }

    const [mFrom, mTo] = meses[done];
    await sb.from("ca_sync_jobs").update({
      progress: { ...progress, mes_atual: mFrom },
    }).eq("id", jobId);

    try { await syncContasPagar(mFrom, mTo); } catch {}
    try { await syncContasReceber(mFrom, mTo); } catch {}

    const newDone = done + 1;
    const finished = newDone >= total;
    if (finished) {
      await upsertSyncState(job.date_from, job.date_to, {});
    }
    await sb.from("ca_sync_jobs").update({
      status: finished ? "ok" : "em_andamento",
      finished_at: finished ? new Date().toISOString() : null,
      progress: { ...progress, concluidos: newDone, mes_atual: finished ? null : mFrom },
    }).eq("id", jobId);

    return { processed: true, jobId, mes: mFrom, remaining: total - newDone };
  } catch (e: any) {
    await sb.from("ca_sync_jobs").update({
      status: "erro",
      mensagem: String(e?.message ?? e),
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    return { processed: true, jobId };
  }
}

function monthsBetween(from: string, to: string): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const mStart = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
    const mEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const a = mStart < start ? start : mStart;
    const b = mEnd > end ? end : mEnd;
    result.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return result;
}

/** Lista meses com falha no log de sincronização (deduplicado por recurso+mês).
 *  Para registros antigos sem date_from, tenta extrair a data da URL salva
 *  em `mensagem` via regex. */
export type FalhaItem = {
  recurso: "contas_pagar" | "contas_receber" | "extrato";
  mes_from: string;
  mes_to: string;
  mensagem: string | null;
  ultima_falha: string;
};

export async function listarFalhas(from: string, to: string): Promise<FalhaItem[]> {
  const { data, error } = await sb
    .from("ca_sync_log")
    .select("recurso,status,mensagem,date_from,date_to,started_at")
    .eq("status", "erro")
    .in("recurso", ["contas_pagar", "contas_receber", "extrato"])
    .order("started_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  const byKey = new Map<string, FalhaItem>();
  for (const row of (data ?? []) as any[]) {
    let dFrom: string | null = row.date_from ?? null;
    let dTo: string | null = row.date_to ?? null;
    if (!dFrom && typeof row.mensagem === "string") {
      const m = row.mensagem.match(/data_vencimento_de=(\d{4}-\d{2}-\d{2}).*?data_vencimento_ate=(\d{4}-\d{2}-\d{2})/);
      if (m) { dFrom = m[1]; dTo = m[2]; }
    }
    if (!dFrom || !dTo) continue;
    if (dFrom < from || dTo > to) continue;
    // Normaliza para o mês (1º dia → último dia)
    const d = new Date(dFrom + "T00:00:00Z");
    const mStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const mEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const mesFrom = mStart.toISOString().slice(0, 10);
    const mesTo = mEnd.toISOString().slice(0, 10);
    const key = `${row.recurso}|${mesFrom}`;
    if (byKey.has(key)) continue; // primeira (mais recente) ganha
    byKey.set(key, {
      recurso: row.recurso,
      mes_from: mesFrom,
      mes_to: mesTo,
      mensagem: row.mensagem ?? null,
      ultima_falha: row.started_at,
    });
  }

  // Filtra os meses que já tiveram sucesso DEPOIS do último erro
  const result: FalhaItem[] = [];
  for (const item of byKey.values()) {
    const { data: ok } = await sb
      .from("ca_sync_log")
      .select("id")
      .eq("recurso", item.recurso)
      .eq("status", "ok")
      .eq("date_from", item.mes_from)
      .gt("started_at", item.ultima_falha)
      .limit(1);
    if (!ok || ok.length === 0) result.push(item);
  }
  result.sort((a, b) => (a.mes_from < b.mes_from ? -1 : a.mes_from > b.mes_from ? 1 : a.recurso.localeCompare(b.recurso)));
  return result;
}

export async function reprocessarFalhas(
  from: string,
  to: string,
  alvo?: Array<{ recurso: FalhaItem["recurso"]; mes_from: string; mes_to: string }>,
): Promise<{ tentados: number; sucesso: number; falhas: Array<{ recurso: string; mes: string; mensagem: string }> }> {
  const itens = alvo && alvo.length > 0
    ? alvo
    : (await listarFalhas(from, to)).map((f) => ({ recurso: f.recurso, mes_from: f.mes_from, mes_to: f.mes_to }));

  let sucesso = 0;
  const falhas: Array<{ recurso: string; mes: string; mensagem: string }> = [];
  for (const it of itens) {
    try {
      if (it.recurso === "contas_pagar") await syncContasPagar(it.mes_from, it.mes_to);
      else if (it.recurso === "contas_receber") await syncContasReceber(it.mes_from, it.mes_to);
      else if (it.recurso === "extrato") await syncExtrato(it.mes_from, it.mes_to);
      sucesso += 1;
    } catch (e: any) {
      falhas.push({ recurso: it.recurso, mes: it.mes_from, mensagem: String(e?.message ?? e) });
    }
  }
  return { tentados: itens.length, sucesso, falhas };
}
