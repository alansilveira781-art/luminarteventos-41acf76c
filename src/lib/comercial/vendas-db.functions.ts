import { createServerFn } from "@tanstack/react-start";
import type { VendaRow } from "./vendas.functions";

export type ListVendasDbResult = {
  rows: VendaRow[];
  fetchedAt: string;
  error?: string;
};

const PAGE = 1000;

export const listVendasDb = createServerFn({ method: "GET" }).handler(
  async (): Promise<ListVendasDbResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { dbRowToVenda } = await import("./vendas-parse.server");
      const all: VendaRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from("comercial_vendas")
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as Record<string, unknown>[];
        for (const r of rows) all.push(dbRowToVenda(r));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return { rows: all, fetchedAt: new Date().toISOString() };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar vendas";
      return { rows: [], fetchedAt: new Date().toISOString(), error: msg };
    }
  },
);
