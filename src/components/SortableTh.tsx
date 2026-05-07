import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortState = { key: string; dir: "desc" | "asc" } | null;

export function useSort() {
  const [sort, setSort] = useState<SortState>(null);
  function toggleSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }
  function applySort<T extends Record<string, any>>(arr: T[], getValue?: (row: T, key: string) => any): T[] {
    if (!sort) return arr;
    const { key, dir } = sort;
    return [...arr].sort((a, b) => {
      const va = getValue ? getValue(a, key) : a[key];
      const vb = getValue ? getValue(b, key) : b[key];
      const na = typeof va === "number" ? va : Number(va);
      const nb = typeof vb === "number" ? vb : Number(vb);
      let cmp: number;
      if (!isNaN(na) && !isNaN(nb) && (typeof va !== "string" || typeof vb !== "string")) {
        cmp = na - nb;
      } else {
        cmp = String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true });
      }
      return dir === "desc" ? -cmp : cmp;
    });
  }
  return { sort, toggleSort, applySort };
}

export function SortIcon({ sort, k }: { sort: SortState; k: string }) {
  if (!sort || sort.key !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sort.dir === "desc" ? <ArrowDown className="h-3 w-3 text-primary" /> : <ArrowUp className="h-3 w-3 text-primary" />;
}

export function SortableTh({
  sort,
  onToggle,
  k,
  label,
  align = "left",
  className = "",
}: {
  sort: SortState;
  onToggle: (k: string) => void;
  k: string;
  label: string;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-medium text-${align} cursor-pointer select-none ${className}`}
      onClick={() => onToggle(k)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""}`}>
        {label} <SortIcon sort={sort} k={k} />
      </span>
    </th>
  );
}
