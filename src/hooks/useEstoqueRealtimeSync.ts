import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isEstoqueItensSuppressed,
  notifyEstoqueItensPending,
} from "@/lib/estoque-realtime-control";


/**
 * Subscreve às mudanças em `itens`, `movimentacoes`, `movimentacao_itens` e
 * tabelas de compras via Realtime do Supabase e invalida as queries relevantes
 * para manter Estoque/Entradas/Saídas/Devoluções/A Receber em sincronia
 * imediata entre as telas (e entre usuários/abas).
 */
export function useEstoqueRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidateItens = () => {
      if (isEstoqueItensSuppressed()) {
        notifyEstoqueItensPending();
        return;
      }
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["item"] });
      qc.invalidateQueries({ queryKey: ["item-info"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      qc.invalidateQueries({ queryKey: ["itens-busca"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["alerta-estoque"] });
    };
    const onItens = () => {
      invalidateItens();
    };
    const onMovimentacoes = () => {
      invalidateItens();
      qc.invalidateQueries({ queryKey: ["item-movs"] });
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["devolucoes"] });
      qc.invalidateQueries({ queryKey: ["saidas-abertas"] });
      qc.invalidateQueries({ queryKey: ["devolvido-por-origem"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      qc.invalidateQueries({ queryKey: ["alerta-estoque-saidas"] });
    };

    const onCompras = () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
      qc.invalidateQueries({ queryKey: ["compra-receber-info"] });
      qc.invalidateQueries({ queryKey: ["compra-itens"] });
      qc.invalidateQueries({ queryKey: ["compra-anexos"] });
    };
    const onDemandas = () => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demandas-receber"] });
      qc.invalidateQueries({ queryKey: ["demanda-a-receber-info"] });
      qc.invalidateQueries({ queryKey: ["demanda-itens"] });
      qc.invalidateQueries({ queryKey: ["demanda-anexos"] });
    };

    const onPatItens = () => {
      qc.invalidateQueries({ queryKey: ["pat_itens_dash"] });
      qc.invalidateQueries({ queryKey: ["pat_itens"] });
    };
    const onPatMovs = () => {
      qc.invalidateQueries({ queryKey: ["pat_itens_dash"] });
      qc.invalidateQueries({ queryKey: ["pat_itens"] });
      qc.invalidateQueries({ queryKey: ["pat_movs_dash"] });
      qc.invalidateQueries({ queryKey: ["pat_movs"] });
      qc.invalidateQueries({ queryKey: ["pat_saidas_abertas"] });
      qc.invalidateQueries({ queryKey: ["pat_saidas_abertas_alertas"] });
      qc.invalidateQueries({ queryKey: ["pat_devolvido_por_origem"] });
      qc.invalidateQueries({ queryKey: ["pat_devolvido_por_origem_alertas"] });
    };
    const onPatOS = () => {
      qc.invalidateQueries({ queryKey: ["pat_os"] });
      qc.invalidateQueries({ queryKey: ["pat_os_itens"] });
      qc.invalidateQueries({ queryKey: ["pat_os_devolucoes"] });
      qc.invalidateQueries({ queryKey: ["pat_itens_os"] });
    };

    // Nome de canal único por aba evita colisão entre múltiplas abas do mesmo navegador
    const channelName = `estoque-sync-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "itens" }, onItens)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, onMovimentacoes)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacao_itens" }, onMovimentacoes)
      .on("postgres_changes", { event: "*", schema: "public", table: "compras" }, onCompras)
      .on("postgres_changes", { event: "*", schema: "public", table: "compra_itens" }, onCompras)
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, onDemandas)
      .on("postgres_changes", { event: "*", schema: "public", table: "demanda_itens" }, onDemandas)
      .on("postgres_changes", { event: "*", schema: "public", table: "demanda_anexos" }, onDemandas)
      .on("postgres_changes", { event: "*", schema: "public", table: "pat_itens" }, onPatItens)
      .on("postgres_changes", { event: "*", schema: "public", table: "pat_movimentacoes" }, onPatMovs)
      .on("postgres_changes", { event: "*", schema: "public", table: "pat_os" }, onPatOS)
      .on("postgres_changes", { event: "*", schema: "public", table: "pat_os_itens" }, onPatOS)
      .on("postgres_changes", { event: "*", schema: "public", table: "pat_os_devolucoes" }, onPatOS)
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_solicitacoes_saida" }, () =>
        qc.invalidateQueries({ queryKey: ["solicitacoes-saida"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_solicitacoes_saida_itens" }, () =>
        qc.invalidateQueries({ queryKey: ["solicitacoes-saida"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
