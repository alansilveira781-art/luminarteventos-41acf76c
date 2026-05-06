import { supabase } from "@/integrations/supabase/client";

export async function fetchAllRows<T = any>(
  table: string,
  select: string = "*",
  opts: { orderBy?: { column: string; ascending?: boolean }; pageSize?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table as any).select(select).range(from, from + pageSize - 1);
    if (opts.orderBy) q = q.order(opts.orderBy.column, { ascending: opts.orderBy.ascending ?? true });
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
