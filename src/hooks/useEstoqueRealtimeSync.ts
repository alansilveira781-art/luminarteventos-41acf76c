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
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["itens"] });
      qc.invalidateQueries({ queryKey: ["itens-select"] });
      qc.invalidateQueries({ queryKey: ["itens-select-saida"] });
      qc.invalidateQueries({ queryKey: ["itens-busca"] });
      qc.invalidateQueries({ queryKey: ["itens-min"] });
      qc.invalidateQueries({ queryKey: ["item"] });
      qc.invalidateQueries({ queryKey: ["item-info"] });
      qc.invalidateQueries({ queryKey: ["item-movs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-itens"] });
      qc.invalidateQueries({ queryKey: ["entradas"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-movs"] });
    };

    const channel = supabase
      .channel("estoque-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "itens" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, invalidateAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
