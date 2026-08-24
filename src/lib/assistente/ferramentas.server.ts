// Ferramentas de leitura disponíveis para o assistente (Claude).
// Todas as consultas rodam com o client autenticado do usuário (RLS aplicada).
import type { SupabaseClient } from "@supabase/supabase-js";

type Sb = SupabaseClient<any, any, any>;

export const toolDefs = [
  {
    name: "listar_eventos",
    description:
      "Lista eventos por período (data do evento), com nome, código, local, cidade/UF, produtor e datas de montagem/desmontagem.",
    input_schema: {
      type: "object" as const,
      properties: {
        data_inicio: { type: "string", description: "Data inicial AAAA-MM-DD" },
        data_fim: { type: "string", description: "Data final AAAA-MM-DD" },
        busca: { type: "string", description: "Texto no nome, código ou local" },
        limite: { type: "integer", description: "Máximo de registros (padrão 50)" },
      },
    },
  },
  {
    name: "listar_compras",
    description:
      "Lista compras (módulo Compras) com status, solicitante, fornecedor, valor total, condição de pagamento e datas.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Ex.: em_andamento, finalizado" },
        data_inicio: { type: "string" },
        data_fim: { type: "string" },
        busca: { type: "string" },
        limite: { type: "integer" },
      },
    },
  },
  {
    name: "listar_aquisicoes",
    description:
      "Lista aquisições (antigas despesas) com tipo, status, evento/projeto, fornecedor, valor e datas.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string" },
        tipo_demanda: { type: "string" },
        data_inicio: { type: "string" },
        data_fim: { type: "string" },
        busca: { type: "string" },
        limite: { type: "integer" },
      },
    },
  },
  {
    name: "consultar_estoque",
    description:
      "Consulta itens do estoque por nome, código, categoria ou subcategoria, com saldo atual, mínimo, unidade e valor unitário.",
    input_schema: {
      type: "object" as const,
      properties: {
        busca: { type: "string" },
        categoria: { type: "string" },
        subcategoria: { type: "string" },
        somente_abaixo_minimo: { type: "boolean" },
        limite: { type: "integer" },
      },
    },
  },
  {
    name: "resumo_financeiro",
    description:
      "Consolida gastos de Compras e Aquisições em um período, com total geral e quebra por status.",
    input_schema: {
      type: "object" as const,
      properties: {
        data_inicio: { type: "string" },
        data_fim: { type: "string" },
        base_data: { type: "string", enum: ["solicitacao", "compra"] },
      },
      required: ["data_inicio", "data_fim"],
    },
  },
  {
    name: "gastos_por_centro_custo",
    description:
      "Soma os rateios do Conta Azul por centro de custo (evento) em um período, separando entradas e saídas. Útil para custo por evento.",
    input_schema: {
      type: "object" as const,
      properties: {
        centro_custo: { type: "string", description: "Filtro por nome do centro de custo" },
        tipo: { type: "string", enum: ["entrada", "saida"] },
        limite: { type: "integer" },
      },
    },
  },
  {
    name: "consultar_uber",
    description:
      "Consulta corridas da Uber importadas no sistema (tabela uber_corridas). Retorna total gasto, quantidade de corridas e detalhes por período, colaborador, serviço, cidade ou projeto/evento.",
    input_schema: {
      type: "object" as const,
      properties: {
        data_inicio: { type: "string", description: "Data inicial AAAA-MM-DD" },
        data_fim: { type: "string", description: "Data final AAAA-MM-DD" },
        busca: { type: "string", description: "Texto em nome, projeto, endereço, serviço, cidade ou detalhamento" },
        colaborador: { type: "string", description: "Nome/sobrenome/e-mail do colaborador" },
        servico: { type: "string", description: "Tipo de serviço Uber" },
        projeto: { type: "string", description: "Nome do projeto/evento vinculado" },
        valor_min: { type: "number", description: "Valor mínimo da corrida" },
        valor_max: { type: "number", description: "Valor máximo da corrida" },
        limite: { type: "integer", description: "Máximo de registros detalhados (padrão 500)" },
        incluir_detalhes: { type: "boolean", description: "Se verdadeiro, retorna lista de corridas; se falso, apenas agregações" },
      },
    },
  },
] as const;

function lim(v: any, def = 50) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 300) : def;
}

export async function runTool(sb: Sb, name: string, input: any): Promise<unknown> {
  const a = input ?? {};
  switch (name) {
    case "listar_eventos": {
      let q = sb
        .from("eventos")
        .select("codigo_evento,nome,local,cidade,uf,produtor,data_evento,data_evento_fim,data_montagem,data_desmontagem,situacao")
        .order("data_evento", { ascending: true })
        .limit(lim(a.limite));
      if (a.data_inicio) q = q.gte("data_evento", a.data_inicio);
      if (a.data_fim) q = q.lte("data_evento", a.data_fim);
      if (a.busca) q = q.or(`nome.ilike.%${a.busca}%,local.ilike.%${a.busca}%,codigo_evento.ilike.%${a.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
    case "listar_compras": {
      let q = sb
        .from("compras")
        .select("numero,titulo,status,solicitante,fornecedor,valor_total,condicao_pagamento,data_solicitacao,data_compra,data_servico")
        .order("data_solicitacao", { ascending: false })
        .limit(lim(a.limite));
      if (a.status) q = q.eq("status", a.status);
      if (a.data_inicio) q = q.gte("data_solicitacao", a.data_inicio);
      if (a.data_fim) q = q.lte("data_solicitacao", a.data_fim);
      if (a.busca) q = q.or(`titulo.ilike.%${a.busca}%,fornecedor.ilike.%${a.busca}%,solicitante.ilike.%${a.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
    case "listar_aquisicoes": {
      let q = sb
        .from("demandas")
        .select("numero,titulo,status,tipo_demanda,evento_projeto,solicitante,fornecedor,valor_total,data_solicitacao,data_compra")
        .order("data_solicitacao", { ascending: false })
        .limit(lim(a.limite));
      if (a.status) q = q.eq("status", a.status);
      if (a.tipo_demanda) q = q.eq("tipo_demanda", a.tipo_demanda);
      if (a.data_inicio) q = q.gte("data_solicitacao", a.data_inicio);
      if (a.data_fim) q = q.lte("data_solicitacao", a.data_fim);
      if (a.busca) q = q.or(`titulo.ilike.%${a.busca}%,fornecedor.ilike.%${a.busca}%,evento_projeto.ilike.%${a.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
    case "consultar_estoque": {
      let q = sb
        .from("itens")
        .select("codigo,nome,categoria,subcategoria,unidade,quantidade_atual,quantidade_minima,localizacao,valor_unitario,status")
        .order("nome")
        .limit(lim(a.limite));
      if (a.categoria) q = q.eq("categoria", a.categoria);
      if (a.subcategoria) q = q.eq("subcategoria", a.subcategoria);
      if (a.busca) q = q.or(`nome.ilike.%${a.busca}%,codigo.ilike.%${a.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return a.somente_abaixo_minimo
        ? rows.filter((r) => Number(r.quantidade_atual ?? 0) < Number(r.quantidade_minima ?? 0))
        : rows;
    }
    case "resumo_financeiro": {
      const campo = a.base_data === "compra" ? "data_compra" : "data_solicitacao";
      const carregar = async (tabela: "compras" | "demandas") => {
        const { data, error } = await sb
          .from(tabela)
          .select(`status,valor_total,${campo}`)
          .gte(campo, a.data_inicio)
          .lte(campo, a.data_fim)
          .limit(5000);
        if (error) throw error;
        return (data ?? []) as any[];
      };
      const [compras, aquisicoes] = await Promise.all([carregar("compras"), carregar("demandas")]);
      const agregar = (rows: any[]) => {
        const porStatus: Record<string, { qtd: number; total: number }> = {};
        let total = 0;
        for (const r of rows) {
          const v = Number(r.valor_total ?? 0);
          total += v;
          const k = String(r.status ?? "-");
          porStatus[k] = { qtd: (porStatus[k]?.qtd ?? 0) + 1, total: (porStatus[k]?.total ?? 0) + v };
        }
        return { quantidade: rows.length, total, por_status: porStatus };
      };
      const c = agregar(compras);
      const d = agregar(aquisicoes);
      return {
        periodo: { inicio: a.data_inicio, fim: a.data_fim, base_data: a.base_data ?? "solicitacao" },
        compras: c,
        aquisicoes: d,
        total_geral: c.total + d.total,
      };
    }
    case "gastos_por_centro_custo": {
      const { data: centros, error: e1 } = await sb
        .from("ca_centros_custo")
        .select("external_id,nome")
        .limit(2000);
      if (e1) throw e1;
      const nomes = new Map((centros ?? []).map((c: any) => [c.external_id, c.nome]));
      let q = sb.from("ca_lancamento_rateios").select("centro_custo_external_id,tipo,valor").limit(20000);
      if (a.tipo) q = q.eq("tipo", a.tipo);
      const { data, error } = await q;
      if (error) throw error;
      const acc: Record<string, { centro_custo: string; entradas: number; saidas: number }> = {};
      for (const r of (data ?? []) as any[]) {
        const nome = nomes.get(r.centro_custo_external_id) ?? "(sem centro de custo)";
        if (a.centro_custo && !String(nome).toLowerCase().includes(String(a.centro_custo).toLowerCase())) continue;
        acc[nome] ??= { centro_custo: nome, entradas: 0, saidas: 0 };
        const v = Number(r.valor ?? 0);
        if (r.tipo === "entrada") acc[nome].entradas += v;
        else acc[nome].saidas += v;
      }
      return Object.values(acc)
        .sort((x, y) => y.saidas - x.saidas)
        .slice(0, lim(a.limite, 30));
    }
    case "consultar_uber": {
      let q = sb
        .from("uber_corridas")
        .select("id,data_solicitacao,hora_solicitacao,nome,sobrenome,servico,cidade,endereco_partida,endereco_destino,valor,projeto,detalhamento")
        .order("data_solicitacao", { ascending: false })
        .limit(lim(a.limite, 500));
      if (a.data_inicio) q = q.gte("data_solicitacao", a.data_inicio);
      if (a.data_fim) q = q.lte("data_solicitacao", a.data_fim);
      if (a.busca) {
        const termo = `%${a.busca}%`;
        q = q.or(
          `nome.ilike.${termo},sobrenome.ilike.${termo},projeto.ilike.${termo},endereco_partida.ilike.${termo},endereco_destino.ilike.${termo},servico.ilike.${termo},cidade.ilike.${termo},detalhamento.ilike.${termo}`,
        );
      }
      if (a.colaborador) {
        const termo = `%${a.colaborador}%`;
        q = q.or(`nome.ilike.${termo},sobrenome.ilike.${termo}`);
      }
      if (a.servico) q = q.ilike("servico", `%${a.servico}%`);
      if (a.projeto) q = q.ilike("projeto", `%${a.projeto}%`);
      if (typeof a.valor_min === "number") q = q.gte("valor", a.valor_min);
      if (typeof a.valor_max === "number") q = q.lte("valor", a.valor_max);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const total = rows.reduce((s, r) => s + Number(r.valor ?? 0), 0);
      const porProjeto: Record<string, { qtd: number; total: number }> = {};
      const porServico: Record<string, { qtd: number; total: number }> = {};
      const porColaborador: Record<string, { qtd: number; total: number }> = {};
      for (const r of rows) {
        const v = Number(r.valor ?? 0);
        const proj = r.projeto ?? "(sem projeto)";
        const serv = r.servico ?? "(sem serviço)";
        const colab = `${r.nome ?? ""} ${r.sobrenome ?? ""}`.trim() || "(não identificado)";
        porProjeto[proj] = { qtd: (porProjeto[proj]?.qtd ?? 0) + 1, total: (porProjeto[proj]?.total ?? 0) + v };
        porServico[serv] = { qtd: (porServico[serv]?.qtd ?? 0) + 1, total: (porServico[serv]?.total ?? 0) + v };
        porColaborador[colab] = { qtd: (porColaborador[colab]?.qtd ?? 0) + 1, total: (porColaborador[colab]?.total ?? 0) + v };
      }
      return {
        quantidade: rows.length,
        total,
        periodo: { inicio: a.data_inicio, fim: a.data_fim },
        por_projeto: porProjeto,
        por_servico: porServico,
        por_colaborador: porColaborador,
        corridas: a.incluir_detalhes !== false ? rows : undefined,
      };
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}
