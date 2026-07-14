import { useMemo, useState } from "react";
import { Filter, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export type FieldType = "multi" | "date-range" | "number-range";

export type FieldDef<T> = {
  key: string;
  label: string;
  type: FieldType;
  /** Para "multi": retornar string | null. Para date: retornar ISO/yyyy-mm-dd. Para number: number|null */
  getValue: (row: T) => any;
  /** Formatter opcional para exibição de rótulo de valor (multi) */
  formatValue?: (v: string) => string;
};

export type FilterValue =
  | { type: "multi"; values: string[] }
  | { type: "date-range"; from?: string; to?: string }
  | { type: "number-range"; min?: number; max?: number };

export type Filters = Record<string, FilterValue>;

export function applyKanbanFilters<T>(rows: T[], filters: Filters, fields: FieldDef<T>[]): T[] {
  const active = Object.entries(filters).filter(([, v]) => isActive(v));
  if (active.length === 0) return rows;
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  return rows.filter((row) =>
    active.every(([key, val]) => {
      const f = fieldMap.get(key);
      if (!f) return true;
      const raw = f.getValue(row);
      if (val.type === "multi") {
        const s = raw == null || String(raw).trim() === "" ? "__empty__" : String(raw);
        return val.values.includes(s);
      }
      if (val.type === "date-range") {
        if (!raw) return false;
        const d = String(raw).slice(0, 10);
        if (val.from && d < val.from) return false;
        if (val.to && d > val.to) return false;
        return true;
      }
      if (val.type === "number-range") {
        const n = typeof raw === "number" ? raw : raw == null ? null : Number(raw);
        if (n == null || Number.isNaN(n)) return false;
        if (val.min != null && n < val.min) return false;
        if (val.max != null && n > val.max) return false;
        return true;
      }
      return true;
    }),
  );
}

function isActive(v: FilterValue): boolean {
  if (v.type === "multi") return v.values.length > 0;
  if (v.type === "date-range") return !!(v.from || v.to);
  if (v.type === "number-range") return v.min != null || v.max != null;
  return false;
}

export function KanbanFilters<T>({
  rows,
  fields,
  value,
  onChange,
}: {
  rows: T[];
  fields: FieldDef<T>[];
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const allEntries = Object.entries(value);
  const usedKeys = new Set(allEntries.map(([k]) => k));
  const availableFields = fields.filter((f) => !usedKeys.has(f.key));


  function startField(f: FieldDef<T>) {
    const init: FilterValue =
      f.type === "multi"
        ? { type: "multi", values: [] }
        : f.type === "date-range"
        ? { type: "date-range" }
        : { type: "number-range" };
    onChange({ ...value, [f.key]: init });
    setPickerOpen(false);
    setEditingKey(f.key);
  }

  function updateFilter(key: string, next: FilterValue) {
    onChange({ ...value, [key]: next });
  }

  function removeFilter(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
    if (editingKey === key) setEditingKey(null);
  }

  function clearAll() {
    onChange({});
    setEditingKey(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-4 w-4 mr-1" /> Filtro
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          {availableFields.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">Todos os campos já foram adicionados.</div>
          ) : (
            <div className="flex flex-col">
              {availableFields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => startField(f)}
                  className="text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
                >
                  <Plus className="h-3 w-3 inline mr-1 text-muted-foreground" />
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {allEntries.map(([key, val]) => {
        const f = fields.find((x) => x.key === key);
        if (!f) return null;
        const summary = summarize(f, val);
        return (
          <Popover
            key={key}
            open={editingKey === key}
            onOpenChange={(o) => setEditingKey(o ? key : null)}
          >
            <PopoverTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1 h-9 px-2 text-xs font-normal"
              >
                <span className="font-medium">{f.label}:</span>
                <span className="max-w-[180px] truncate">{summary}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFilter(key);
                  }}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remover filtro ${f.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <FilterEditor field={f} rows={rows} value={val} onChange={(v) => updateFilter(key, v)} />
            </PopoverContent>
          </Popover>
        );
      })}

      {allEntries.length > 0 && (
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearAll}>
          Limpar
        </Button>
      )}
    </div>
  );
}

function summarize<T>(f: FieldDef<T>, v: FilterValue): string {
  if (v.type === "multi") {
    if (v.values.length === 0) return "Selecionar…";

    const fmt = (s: string) => (s === "__empty__" ? "(vazio)" : f.formatValue ? f.formatValue(s) : s);
    if (v.values.length <= 2) return v.values.map(fmt).join(", ");
    return `${v.values.length} selecionados`;
  }
  if (v.type === "date-range") {
    const from = v.from ? brDate(v.from) : "";
    const to = v.to ? brDate(v.to) : "";
    if (from && to) return `${from} → ${to}`;
    if (from) return `a partir de ${from}`;
    if (to) return `até ${to}`;
    return "Definir período…";

  }
  if (v.type === "number-range") {
    const min = v.min != null ? v.min.toLocaleString("pt-BR") : "";
    const max = v.max != null ? v.max.toLocaleString("pt-BR") : "";
    if (min && max) return `${min} – ${max}`;
    if (min) return `≥ ${min}`;
    if (max) return `≤ ${max}`;
    return "Definir intervalo…";
  }
  return "";
}

function brDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function FilterEditor<T>({
  field,
  rows,
  value,
  onChange,
}: {
  field: FieldDef<T>;
  rows: T[];
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  if (field.type === "multi" && value.type === "multi") {
    return <MultiEditor field={field} rows={rows} value={value} onChange={onChange} />;
  }
  if (field.type === "date-range" && value.type === "date-range") {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
          />
        </div>
      </div>
    );
  }
  if (field.type === "number-range" && value.type === "number-range") {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Mínimo</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={value.min ?? ""}
            onChange={(e) =>
              onChange({ ...value, min: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Máximo</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={value.max ?? ""}
            onChange={(e) =>
              onChange({ ...value, max: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </div>
      </div>
    );
  }
  return null;
}

function MultiEditor<T>({
  field,
  rows,
  value,
  onChange,
}: {
  field: FieldDef<T>;
  rows: T[];
  value: Extract<FilterValue, { type: "multi" }>;
  onChange: (v: FilterValue) => void;
}) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const s = new Set<string>();
    let hasEmpty = false;
    for (const r of rows) {
      const raw = field.getValue(r);
      if (raw == null || String(raw).trim() === "") {
        hasEmpty = true;
      } else {
        s.add(String(raw));
      }
    }
    const arr = [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (hasEmpty) arr.push("__empty__");
    return arr;
  }, [rows, field]);

  const filtered = q.trim()
    ? options.filter((o) => {
        const label = o === "__empty__" ? "(vazio)" : field.formatValue ? field.formatValue(o) : o;
        return label.toLowerCase().includes(q.toLowerCase());
      })
    : options;

  const toggle = (opt: string) => {
    const set = new Set(value.values);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    onChange({ type: "multi", values: [...set] });
  };

  return (
    <div className="space-y-2">
      <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8" />
      <div className="max-h-60 overflow-y-auto -mx-1">
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhuma opção</div>
        )}
        {filtered.map((opt) => {
          const label = opt === "__empty__" ? "(vazio)" : field.formatValue ? field.formatValue(opt) : opt;
          const checked = value.values.includes(opt);
          return (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer"
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(opt)} />
              <span className="flex-1 truncate">{label}</span>
            </label>
          );
        })}
      </div>
      {value.values.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => onChange({ type: "multi", values: [] })}
        >
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
