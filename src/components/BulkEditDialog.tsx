import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { CadastroCombobox } from "@/components/comercial/CadastroCombobox";

export type BulkField =
  | { key: string; label: string; type: "text" }
  | {
      key: string;
      label: string;
      type: "cadastro";
      table:
        | "comercial_vendedores"
        | "comercial_cerimoniais"
        | "comercial_decoradores"
        | "comercial_classificacoes";
      queryKey: string;
      extraFields?: Array<{ key: string; label: string; type: "number"; default?: number }>;
      allowClear?: boolean;
    }
  | { key: string; label: string; type: "textarea" }
  | { key: string; label: string; type: "number"; step?: string }
  | { key: string; label: string; type: "money" }
  | { key: string; label: string; type: "date" }
  | { key: string; label: string; type: "datetime" }
  | {
      key: string;
      label: string;
      type: "select";
      options: Array<{ value: string; label: string }>;
      allowClear?: boolean;
    };

export function BulkEditDialog({
  open,
  onOpenChange,
  count,
  fields,
  onSubmit,
  submitting,
  title = "Editar em massa",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  fields: BulkField[];
  onSubmit: (patch: Record<string, any>) => void;
  submitting?: boolean;
  title?: string;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, any>>({});

  const set = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Record<string, any> = {};
    for (const f of fields) {
      if (!enabled[f.key]) continue;
      let v = values[f.key];
      if (f.type === "number") v = v === "" || v == null ? null : Number(v);
      else if (v === "") v = null;
      else if (f.type === "datetime") v = v ? new Date(v).toISOString() : null;
      patch[f.key] = v;
    }
    onSubmit(patch);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setEnabled({});
          setValues({});
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {title} <span className="text-muted-foreground font-normal">({count} selecionados)</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Marque os campos que deseja alterar. Apenas os campos marcados serão atualizados em todos os
            registros selecionados.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-auto pr-1">
            {fields.map((f) => (
              <div key={f.key} className="rounded-md border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!enabled[f.key]}
                    onCheckedChange={(c) => setEnabled((p) => ({ ...p, [f.key]: !!c }))}
                  />
                  <span className="text-sm font-medium">{f.label}</span>
                </label>
                {enabled[f.key] && (
                  <div>
                    {f.type === "text" && (
                      <Input value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                    )}
                    {f.type === "textarea" && (
                      <Textarea
                        rows={2}
                        value={values[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                    {f.type === "number" && (
                      <Input
                        type="number"
                        step={f.step ?? "0.01"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                    {f.type === "money" && (
                      <MoneyInput
                        value={Number(values[f.key] ?? 0)}
                        onChange={(n) => set(f.key, String(n))}
                      />
                    )}
                    {f.type === "date" && (
                      <Input
                        type="date"
                        value={values[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                    {f.type === "datetime" && (
                      <Input
                        type="datetime-local"
                        value={values[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                    {f.type === "select" && (
                      <Select value={values[f.key] ?? ""} onValueChange={(v) => set(f.key, v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={f.allowClear ? "(limpar)" : "Selecione…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {f.allowClear && <SelectItem value="__null__">— Limpar —</SelectItem>}
                          {f.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || Object.values(enabled).every((v) => !v)}
            >
              {submitting ? "Salvando…" : `Aplicar a ${count} registro(s)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Helper: sanitiza patch trocando "__null__" por null
export function normalizeBulkPatch(patch: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v === "__null__" ? null : v;
  }
  return out;
}
