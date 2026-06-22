import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search, Check } from "lucide-react";
import { cn, normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PatItem = {
  id: string;
  id_item?: string | null;
  cod?: number | null;
  nome: string;
  especificacao?: string | null;
  dimensoes?: string | null;
  unidade?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  estado?: string | null;
  quantidade?: number | null;
};

export type PatGroup = {
  key: string;
  nome: string;
  especificacao: string;
  dimensoes: string;
  unidade: string;
  categoria: string;
  subcategoria: string;
  itens: PatItem[];
  total: number;
  disponivel: number;
  emUso: number;
  danificado: number;
};

const ESTADOS_BONS = new Set(["BOM", "OTIMO", "NOVO", "PERFEITO"]);

export function buildPatGroups(
  itens: PatItem[],
  emUsoPorItem: Map<string, number>,
  excludeItemIds: Set<string> = new Set(),
): PatGroup[] {
  const map = new Map<string, PatGroup>();
  for (const it of itens) {
    const key = [
      normalize(it.nome ?? ""),
      normalize(it.especificacao ?? ""),
      normalize(it.dimensoes ?? ""),
      normalize(it.unidade ?? ""),
      normalize(it.categoria ?? ""),
      normalize(it.subcategoria ?? ""),
    ].join("|");
    if (!map.has(key)) {
      map.set(key, {
        key,
        nome: it.nome ?? "",
        especificacao: it.especificacao ?? "",
        dimensoes: it.dimensoes ?? "",
        unidade: it.unidade ?? "",
        categoria: it.categoria ?? "",
        subcategoria: it.subcategoria ?? "",
        itens: [],
        total: 0,
        disponivel: 0,
        emUso: 0,
        danificado: 0,
      });
    }
    const g = map.get(key)!;
    g.itens.push(it);
    const qtd = Number(it.quantidade ?? 1);
    g.total += qtd;
    const estado = (it.estado ?? "").toUpperCase();
    const emUsoIgnorado = excludeItemIds.has(it.id) ? 0 : (emUsoPorItem.get(it.id) ?? 0);
    if (ESTADOS_BONS.has(estado)) {
      const livre = Math.max(0, qtd - emUsoIgnorado);
      g.disponivel += livre;
      g.emUso += Math.min(qtd, emUsoIgnorado);
    } else {
      g.danificado += qtd;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Aloca N peças disponíveis de um grupo (ordenado por cod asc, id asc), respeitando exclusões. */
export function allocateFromGroup(
  group: PatGroup,
  qtdNecessaria: number,
  emUsoPorItem: Map<string, number>,
  excludeItemIds: Set<string> = new Set(),
): string[] {
  const candidatos = group.itens
    .filter((it) => ESTADOS_BONS.has((it.estado ?? "").toUpperCase()))
    .map((it) => {
      const qtd = Number(it.quantidade ?? 1);
      const emUso = excludeItemIds.has(it.id) ? 0 : (emUsoPorItem.get(it.id) ?? 0);
      return { it, livre: Math.max(0, qtd - emUso) };
    })
    .filter((c) => c.livre > 0)
    .sort((a, b) => {
      const ca = a.it.cod ?? Number.POSITIVE_INFINITY;
      const cb = b.it.cod ?? Number.POSITIVE_INFINITY;
      if (ca !== cb) return ca - cb;
      return a.it.id.localeCompare(b.it.id);
    });

  const out: string[] = [];
  let restante = qtdNecessaria;
  for (const c of candidatos) {
    if (restante <= 0) break;
    const usar = Math.min(c.livre, restante);
    for (let k = 0; k < usar; k++) out.push(c.it.id);
    restante -= usar;
  }
  return out;
}

export function PatGroupSelect({
  groups,
  value,
  onChange,
  placeholder = "Buscar item por nome, especificação…",
  onAfterSelect,
}: {
  groups: PatGroup[];
  value: string;
  onChange: (key: string) => void;
  placeholder?: string;
  onAfterSelect?: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = groups.find((g) => g.key === value);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return groups;
    return groups.filter((g) => {
      const h = normalize([g.nome, g.especificacao, g.dimensoes, g.categoria, g.subcategoria, g.unidade].join(" "));
      return terms.every((t) => h.includes(t));
    });
  }, [groups, search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const select = (key: string) => {
    onChange(key);
    setSearch("");
    setOpen(false);
    if (onAfterSelect) setTimeout(() => onAfterSelect(key), 0);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button" variant="outline" role="combobox"
        className="w-full justify-between font-normal h-9"
        onClick={() => setOpen((c) => !c)}
      >
        <span className="truncate text-left">
          {selected ? (
            <>
              <span className="font-medium">{selected.nome}</span>
              {selected.especificacao && <span className="text-muted-foreground"> · {selected.especificacao}</span>}
              <span className="text-xs text-muted-foreground ml-2">
                ({selected.disponivel} disp. / {selected.total} tot.)
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[420px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder="Buscar por nome, especificação, dimensão…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[340px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum grupo encontrado.</div>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.key} type="button"
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent"
                  onPointerDown={(e) => { e.preventDefault(); select(g.key); }}
                >
                  <Check className={cn("h-4 w-4 shrink-0 mt-0.5", value === g.key ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">
                      <span className="font-medium">{g.nome}</span>
                      {g.especificacao && <span className="text-muted-foreground"> · {g.especificacao}</span>}
                      {g.dimensoes && <span className="text-muted-foreground"> · {g.dimensoes}</span>}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                      <span>Total: <b className="text-foreground">{g.total}</b></span>
                      <span className="text-emerald-600 dark:text-emerald-400">Disponíveis: <b>{g.disponivel}</b></span>
                      {g.emUso > 0 && <span>Em uso: <b>{g.emUso}</b></span>}
                      {g.danificado > 0 && <span className="text-amber-600 dark:text-amber-400">Danificados: <b>{g.danificado}</b></span>}
                      {g.categoria && <span>· {g.categoria}{g.subcategoria ? " / " + g.subcategoria : ""}</span>}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * PatItemSelect — lista PEÇA A PEÇA (um por id de pat_itens)
 * Busca por cod, id_item, nome, especificação, dimensão, categoria.
 * Ordena por cod asc, depois id.
 * ============================================================ */
export type PatItemOption = PatItem & { livre: number; emUso: number };

export function buildPatItemOptions(
  itens: PatItem[],
  emUsoPorItem: Map<string, number>,
  excludeItemIds: Set<string> = new Set(),
): PatItemOption[] {
  const out: PatItemOption[] = itens.map((it) => {
    const qtd = Number(it.quantidade ?? 1);
    const emUsoRaw = emUsoPorItem.get(it.id) ?? 0;
    const emUso = excludeItemIds.has(it.id) ? 0 : emUsoRaw;
    const estado = (it.estado ?? "").toUpperCase();
    const bom = ESTADOS_BONS.has(estado);
    const livre = bom ? Math.max(0, qtd - emUso) : 0;
    return { ...it, livre, emUso };
  });
  out.sort((a, b) => {
    const ca = a.cod ?? Number.POSITIVE_INFINITY;
    const cb = b.cod ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    return (a.id_item ?? a.id).localeCompare(b.id_item ?? b.id);
  });
  return out;
}

export function PatItemSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar por COD, ID ou nome…",
  onAfterSelect,
  onlyAvailable = false,
}: {
  options: PatItemOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  onAfterSelect?: (id: string) => void;
  onlyAvailable?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const base = onlyAvailable ? options.filter((o) => o.livre > 0 || o.id === value) : options;
    const raw = search.trim();
    const terms = normalize(raw).split(/\s+/).filter(Boolean);
    if (!terms.length && !raw) return base;
    return base.filter((o) => {
      const codStr = o.cod != null ? String(o.cod) : "";
      const haystack = normalize(
        [o.nome, o.especificacao, o.dimensoes, o.categoria, o.subcategoria, o.unidade, o.id_item ?? "", codStr]
          .filter(Boolean).join(" "),
      );
      // Match every normalized term
      const textOk = terms.every((t) => haystack.includes(t));
      // Match against raw code (numeric/alpha) as substring
      const rawN = raw.toLowerCase();
      const codOk = codStr.includes(rawN) || (o.id_item ?? "").toLowerCase().includes(rawN);
      return textOk || codOk;
    });
  }, [options, search, onlyAvailable, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const select = (id: string) => {
    onChange(id);
    setSearch("");
    setOpen(false);
    if (onAfterSelect) setTimeout(() => onAfterSelect(id), 0);
  };

  const fmtCod = (o: PatItem) => (o.cod != null ? `COD ${o.cod}` : (o.id_item ? `ID ${o.id_item}` : "—"));

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button" variant="outline" role="combobox"
        className="w-full justify-between font-normal h-9"
        onClick={() => setOpen((c) => !c)}
      >
        <span className="truncate text-left">
          {selected ? (
            <>
              <span className="font-mono text-xs text-muted-foreground mr-1">{fmtCod(selected)}</span>
              <span className="font-medium">{selected.nome}</span>
              {selected.especificacao && <span className="text-muted-foreground"> · {selected.especificacao}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[460px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder="Buscar por COD, ID, nome, especificação…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum item encontrado.</div>
            ) : (
              filtered.map((o) => {
                const indisponivel = o.livre <= 0;
                return (
                  <button
                    key={o.id} type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent",
                      indisponivel && onlyAvailable && "opacity-60",
                    )}
                    onPointerDown={(e) => { e.preventDefault(); select(o.id); }}
                  >
                    <Check className={cn("h-4 w-4 shrink-0 mt-0.5", value === o.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">
                        <span className="font-mono text-xs text-muted-foreground mr-1">{fmtCod(o)}</span>
                        <span className="font-medium">{o.nome}</span>
                        {o.especificacao && <span className="text-muted-foreground"> · {o.especificacao}</span>}
                        {o.dimensoes && <span className="text-muted-foreground"> · {o.dimensoes}</span>}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                        {o.estado && <span>Estado: <b className="text-foreground">{o.estado}</b></span>}
                        <span className={o.livre > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                          {o.livre > 0 ? <>Disponível: <b>{o.livre}</b></> : "Indisponível"}
                        </span>
                        {o.emUso > 0 && <span>Em uso: <b>{o.emUso}</b></span>}
                        {o.categoria && <span>· {o.categoria}{o.subcategoria ? " / " + o.subcategoria : ""}</span>}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
