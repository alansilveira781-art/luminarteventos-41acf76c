import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscreve às mudanças em `itens` e `movimentacoes` via Realtime do Supabase
 * e invalida as queries relevantes para manter Estoque/Entradas/Saídas em sincronia
 * imediata entre as telas (e entre usuários).
 */
export function useEstoqueRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    // Invalida apenas o que cada tabela realmente afeta.
    // Dashboards/selects ficam de fora (têm staleTime próprio e/ou recarregam por navegação).
    const onItens = () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["item"] });
      qc.invalidateQueries({ queryKey: ["item-info"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
    };
    const onMovimentacoes = () => {
      // Saldo é recalculado pelo trigger -> reflete em "itens"
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["item"] });
      qc.invalidateQueries({ queryKey: ["item-info"] });
      qc.invalidateQueries({ queryKey: ["item-movs"] });
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
    };

    const channel = supabase
      .channel("estoque-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "itens" }, onItens)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, onMovimentacoes)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
