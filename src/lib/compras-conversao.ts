import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

const num = (v: any) => (v == null || v === "" ? null : Number(v));

export const codigoCompra = (n: number | null | undefined) =>
  n != null ? `COMPRA-${n}` : "COMPRA";
export const codigoDemanda = (n: number | null | undefined) =>
  n != null ? `DESPESA-${n}` : "DESPESA";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function safeName(nome: string) {
  return (nome || "arquivo").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Resumo textual dos itens, usado quando o destino não usa grade de itens. */
export function itensParaTexto(itens: any[]): string {
  return (itens ?? [])
    .map((i) => {
      const q = Number(i.quantidade ?? 0);
      const un = i.unidade ? ` ${i.unidade}` : "";
      const vu = Number(i.valor_unitario ?? 0);
      const total = q * vu;
      return `${q}${un} x ${i.descricao ?? ""}${vu ? ` — ${brl(vu)} (total ${brl(total)})` : ""}`;
    })
    .join("\n");
}

function juntar(...partes: (string | null | undefined)[]) {
  return partes.filter((p) => p && String(p).trim()).join("\n\n") || null;
}

async function copiarAnexos(opts: {
  origemBucket: string;
  destinoBucket: string;
  origemTabela: string;
  destinoTabela: string;
  origemFk: string;
  destinoFk: string;
  origemId: string;
  destinoId: string;
}) {
  const { data: anexos } = await sb
    .from(opts.origemTabela)
    .select("*")
    .eq(opts.origemFk, opts.origemId);

  const paths: string[] = [];
  for (const a of anexos ?? []) {
    const { data: blob, error: dlErr } = await sb.storage
      .from(opts.origemBucket)
      .download(a.path);
    if (dlErr || !blob) throw new Error(`Falha ao ler o anexo "${a.nome}": ${dlErr?.message ?? "arquivo não encontrado"}`);

    const novoPath = `${opts.destinoId}/${Date.now()}_${safeName(a.nome)}`;
    const { error: upErr } = await sb.storage
      .from(opts.destinoBucket)
      .upload(novoPath, blob, { contentType: a.mime_type ?? undefined, upsert: false });
    if (upErr) throw new Error(`Falha ao copiar o anexo "${a.nome}": ${upErr.message}`);

    const { error: insErr } = await sb.from(opts.destinoTabela).insert({
      [opts.destinoFk]: opts.destinoId,
      nome: a.nome,
      path: novoPath,
      mime_type: a.mime_type,
      tamanho: a.tamanho,
      tipo: a.tipo ?? "anexo",
      uploaded_by: a.uploaded_by,
    });
    if (insErr) throw new Error(`Falha ao registrar o anexo "${a.nome}": ${insErr.message}`);
    paths.push(a.path);
  }
  return paths;
}

/** Compra → Despesa (tabela demandas). Retorna o id da nova despesa. */
export async function compraParaDemanda(
  compraId: string,
  tipoDemanda: string,
  exigeItens: boolean,
): Promise<{ id: string; numero: number | null }> {
  const { data: c, error } = await sb.from("compras").select("*").eq("id", compraId).maybeSingle();
  if (error) throw error;
  if (!c) throw new Error("Compra não encontrada.");

  const { data: itens } = await sb.from("compra_itens").select("*").eq("compra_id", compraId);
  const origemCod = codigoCompra(c.numero);

  const extras: string[] = [];
  if (c.data_servico) extras.push(`Data do serviço: ${c.data_servico}`);
  if (c.empresa_faturada) extras.push(`Empresa faturada: ${c.empresa_faturada}`);

  const descritivo = exigeItens ? null : itensParaTexto(itens ?? []) || null;

  const payload: any = {
    status: c.status,
    titulo: c.titulo,
    tipo_demanda: tipoDemanda,
    descritivo,
    solicitante: c.solicitante,
    solicitante_id: c.solicitante_id,
    solicitante_email: c.solicitante_email,
    fornecedor: c.fornecedor,
    fornecedor_id: c.fornecedor_id,
    documento: c.documento,
    comprador: c.comprador,
    data_solicitacao: c.data_solicitacao,
    data_compra: c.data_compra,
    parcelamento: c.parcelamento,
    condicao_pagamento: c.condicao_pagamento,
    valor_total: c.valor_total,
    observacoes: juntar(c.observacoes, extras.join("\n"), `Convertido de ${origemCod}.`),
    motivo_negacao: c.motivo_negacao,
    created_by: c.created_by,
    responsavel_id: c.responsavel_id,
    responsavel_nome: c.responsavel_nome,
    tem_nf: c.tem_nf,
    numero_nf: c.numero_nf,
    numeros_nf: c.numeros_nf,
    status_financeiro: c.status_financeiro,
    origem: c.origem,
    op_ordem_id: c.op_ordem_id,
    prazo: c.prazo,
    categoria_conta_azul: c.categoria_conta_azul,
  };

  const { data: nova, error: insErr } = await sb
    .from("demandas")
    .insert(payload)
    .select("id,numero")
    .single();
  if (insErr) throw insErr;
  const novaId = nova.id as string;

  try {
    if (exigeItens && (itens ?? []).length) {
      const { error: itErr } = await sb.from("demanda_itens").insert(
        itens.map((i: any) => ({
          demanda_id: novaId,
          item_id: i.item_id,
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
          cotacao: i.cotacao,
          desconto_percentual: i.desconto_percentual,
          ipi: num(i.ipi),
          frete: num(i.frete),
          outros_custos: num(i.outros),
          evento_projeto: i.evento_projeto,
          recebido: i.recebido,
          quantidade_recebida: i.quantidade_recebida,
          recebido_em: i.recebido_em,
        })),
      );
      if (itErr) throw itErr;
    }

    const { data: pags } = await sb.from("compra_pagamentos").select("*").eq("compra_id", compraId);
    if ((pags ?? []).length) {
      const { error: pErr } = await sb.from("demanda_pagamentos").insert(
        pags.map((p: any) => ({
          demanda_id: novaId,
          forma: p.forma,
          parcelamento: p.parcelamento,
          valor: p.valor,
          ordem: p.ordem,
          observacao: p.observacao,
          data_pagamento: p.data_pagamento,
          pago: p.pago,
          pago_em: p.pago_em,
        })),
      );
      if (pErr) throw pErr;
    }

    const { data: coms } = await sb.from("compra_comentarios").select("*").eq("compra_id", compraId);
    if ((coms ?? []).length) {
      const { error: cErr } = await sb.from("demanda_comentarios").insert(
        coms.map((m: any) => ({
          demanda_id: novaId,
          user_id: m.user_id,
          user_nome: m.user_nome,
          texto: m.texto,
          mencoes: m.mencoes,
          created_at: m.created_at,
        })),
      );
      if (cErr) throw cErr;
    }

    const antigos = await copiarAnexos({
      origemBucket: "compra-anexos",
      destinoBucket: "demanda-anexos",
      origemTabela: "compra_anexos",
      destinoTabela: "demanda_anexos",
      origemFk: "compra_id",
      destinoFk: "demanda_id",
      origemId: compraId,
      destinoId: novaId,
    });

    await sb.from("demanda_historico").insert({
      demanda_id: novaId,
      acao: "convertido",
      detalhes: `Convertido de ${origemCod}`,
    });

    // Limpeza do card original
    if (antigos.length) await sb.storage.from("compra-anexos").remove(antigos);
    await sb.from("compra_anexos").delete().eq("compra_id", compraId);
    await sb.from("compra_pagamentos").delete().eq("compra_id", compraId);
    await sb.from("compra_comentarios").delete().eq("compra_id", compraId);
    await sb.from("compra_historico").delete().eq("compra_id", compraId);
    await sb.from("compra_itens").delete().eq("compra_id", compraId);
    const { error: delErr } = await sb.from("compras").delete().eq("id", compraId);
    if (delErr) throw delErr;
  } catch (e: any) {
    // Não apaga nada do original: apenas remove o rascunho criado.
    await sb.from("demandas").delete().eq("id", novaId);
    throw e;
  }

  return { id: novaId, numero: nova.numero ?? null };
}

/** Despesa (demandas) → Compra. Retorna o id da nova compra. */
export async function demandaParaCompra(
  demandaId: string,
  tipoCompra: string,
): Promise<{ id: string; numero: number | null }> {
  const { data: d, error } = await sb.from("demandas").select("*").eq("id", demandaId).maybeSingle();
  if (error) throw error;
  if (!d) throw new Error("Despesa não encontrada.");

  const { data: itens } = await sb.from("demanda_itens").select("*").eq("demanda_id", demandaId);
  const origemCod = codigoDemanda(d.numero);

  const extras: string[] = [];
  if (d.descritivo) extras.push(`Descritivo:\n${d.descritivo}`);
  if (d.evento_projeto) extras.push(`Evento/Projeto: ${d.evento_projeto}`);

  const payload: any = {
    status: d.status,
    titulo: d.titulo,
    tipo_compra: tipoCompra || null,
    solicitante: d.solicitante,
    solicitante_id: d.solicitante_id,
    solicitante_email: d.solicitante_email,
    fornecedor: d.fornecedor,
    fornecedor_id: d.fornecedor_id,
    documento: d.documento,
    comprador: d.comprador,
    data_solicitacao: d.data_solicitacao,
    data_compra: d.data_compra,
    parcelamento: d.parcelamento,
    condicao_pagamento: d.condicao_pagamento,
    valor_total: d.valor_total,
    observacoes: juntar(d.observacoes, extras.join("\n\n"), `Convertido de ${origemCod}.`),
    motivo_negacao: d.motivo_negacao,
    created_by: d.created_by,
    responsavel_id: d.responsavel_id,
    responsavel_nome: d.responsavel_nome,
    tem_nf: d.tem_nf,
    numero_nf: d.numero_nf,
    numeros_nf: d.numeros_nf,
    status_financeiro: d.status_financeiro,
    origem: d.origem,
    op_ordem_id: d.op_ordem_id,
    prazo: d.prazo,
    categoria_conta_azul: d.categoria_conta_azul,
  };

  const { data: nova, error: insErr } = await sb
    .from("compras")
    .insert(payload)
    .select("id,numero")
    .single();
  if (insErr) throw insErr;
  const novaId = nova.id as string;

  try {
    if ((itens ?? []).length) {
      const { error: itErr } = await sb.from("compra_itens").insert(
        itens.map((i: any) => ({
          compra_id: novaId,
          item_id: i.item_id,
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
          cotacao: i.cotacao,
          desconto_percentual: i.desconto_percentual,
          ipi: num(i.ipi),
          frete: num(i.frete),
          // compra_itens não tem coluna de desconto em R$: entra abatendo "outros".
          outros: (Number(i.outros_custos ?? 0) || 0) - (Number(i.desconto ?? 0) || 0),
          evento_projeto: i.evento_projeto,
          recebido: i.recebido,
          quantidade_recebida: i.quantidade_recebida,
          recebido_em: i.recebido_em,
        })),
      );
      if (itErr) throw itErr;
    }

    const { data: pags } = await sb.from("demanda_pagamentos").select("*").eq("demanda_id", demandaId);
    if ((pags ?? []).length) {
      const { error: pErr } = await sb.from("compra_pagamentos").insert(
        pags.map((p: any) => ({
          compra_id: novaId,
          forma: p.forma,
          parcelamento: p.parcelamento,
          valor: p.valor,
          ordem: p.ordem,
          observacao: p.observacao,
          data_pagamento: p.data_pagamento,
          pago: p.pago,
          pago_em: p.pago_em,
        })),
      );
      if (pErr) throw pErr;
    }

    const { data: coms } = await sb.from("demanda_comentarios").select("*").eq("demanda_id", demandaId);
    if ((coms ?? []).length) {
      const { error: cErr } = await sb.from("compra_comentarios").insert(
        coms.map((m: any) => ({
          compra_id: novaId,
          user_id: m.user_id,
          user_nome: m.user_nome,
          texto: m.texto,
          mencoes: m.mencoes,
          created_at: m.created_at,
        })),
      );
      if (cErr) throw cErr;
    }

    const antigos = await copiarAnexos({
      origemBucket: "demanda-anexos",
      destinoBucket: "compra-anexos",
      origemTabela: "demanda_anexos",
      destinoTabela: "compra_anexos",
      origemFk: "demanda_id",
      destinoFk: "compra_id",
      origemId: demandaId,
      destinoId: novaId,
    });

    await sb.from("compra_historico").insert({
      compra_id: novaId,
      acao: "convertido",
      detalhes: `Convertido de ${origemCod}`,
    });

    if (antigos.length) await sb.storage.from("demanda-anexos").remove(antigos);
    await sb.from("demanda_anexos").delete().eq("demanda_id", demandaId);
    await sb.from("demanda_pagamentos").delete().eq("demanda_id", demandaId);
    await sb.from("demanda_comentarios").delete().eq("demanda_id", demandaId);
    await sb.from("demanda_historico").delete().eq("demanda_id", demandaId);
    await sb.from("demanda_itens").delete().eq("demanda_id", demandaId);
    const { error: delErr } = await sb.from("demandas").delete().eq("id", demandaId);
    if (delErr) throw delErr;
  } catch (e: any) {
    await sb.from("compras").delete().eq("id", novaId);
    throw e;
  }

  return { id: novaId, numero: nova.numero ?? null };
}
