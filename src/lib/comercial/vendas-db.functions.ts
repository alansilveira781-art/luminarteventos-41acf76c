import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VendaRow } from "./vendas.functions";

export type ListVendasDbResult = {
  rows: VendaRow[];
  fetchedAt: string;
  error?: string;
};

const PAGE = 1000;

export const listVendasDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListVendasDbResult> => {
    try {
      console.log("[listVendasDb] userId do token:", context.userId);
      const { dbRowToVenda } = await import("./vendas-parse.server");

      const { count, error: countErr } = await context.supabase
        .from("comercial_vendas")
        .select("*", { count: "exact", head: true });
      console.log(
        "[listVendasDb] COUNT via select head:",
        count,
        "| countErr=",
        JSON.stringify(countErr),
      );

      const all: VendaRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await context.supabase
          .from("comercial_vendas")
          .select("*")
          .range(from, from + PAGE - 1);
        console.log(
          "[listVendasDb] página from=",
          from,
          "| error=",
          JSON.stringify(error),
          "| count retornado=",
          (data ?? []).length,
        );
        if (error) throw error;
        const rows = (data ?? []) as Record<string, unknown>[];
        for (const r of rows) all.push(dbRowToVenda(r));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      console.log("[listVendasDb] TOTAL de linhas montadas:", all.length);
      return { rows: all, fetchedAt: new Date().toISOString() };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar vendas";
      return { rows: [], fetchedAt: new Date().toISOString(), error: msg };
    }
  });
