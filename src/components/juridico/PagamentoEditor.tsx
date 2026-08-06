import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  aplicarModoIgual,
  fmtMoeda,
  renumerar,
  somaParcelas,
  type ParcelaContrato,
} from "@/lib/juridico/contrato-form";

export function PagamentoEditor({
  forma,
  modo,
  parcelas,
  total,
  onChange,
}: {
  forma: string | null;
  modo: string | null;
  parcelas: ParcelaContrato[];
  total: number;
  onChange: (patch: {
    pagamento_forma?: string | null;
    pagamento_modo?: string | null;
    pagamento_parcelas?: ParcelaContrato[];
  }) => void;
}) {
  const lista = renumerar(parcelas ?? []);
  const igual = (modo ?? "igual") !== "diferente";
  const soma = somaParcelas(lista);
  const bate = Math.abs(soma - Number(total || 0)) < 0.01;

  const setParcelas = (rows: ParcelaContrato[]) =>
    onChange({ pagamento_parcelas: igual ? aplicarModoIgual(rows, total) : renumerar(rows) });

  const add = () =>
    setParcelas([...lista, { n: lista.length + 1, vencimento: "", valor: 0 }]);

  const remove = (i: number) => setParcelas(lista.filter((_, j) => j !== i));

  return (
    <div className="col-span-2 rounded-md border p-3 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground">Pagamento</div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Forma</Label>
          <Select
            value={forma ?? "pix"}
            onValueChange={(v) => onChange({ pagamento_forma: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Modo</Label>
          <Select
            value={igual ? "igual" : "diferente"}
            onValueChange={(v) =>
              onChange({
                pagamento_modo: v,
                pagamento_parcelas: v === "igual" ? aplicarModoIgual(lista, total) : lista,
              })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="igual">Parcelas iguais</SelectItem>
              <SelectItem value="diferente">Valores diferentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Nº de parcelas</Label>
          <Input
            type="number"
            min={1}
            value={lista.length || 1}
            onChange={(e) => {
              const q = Math.max(1, Number(e.target.value || 1));
              const rows: ParcelaContrato[] = Array.from({ length: q }, (_, i) =>
                lista[i] ?? { n: i + 1, vencimento: "", valor: 0 },
              );
              setParcelas(rows);
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        {lista.map((p, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="text-xs text-muted-foreground pb-2 w-16">{p.n}ª</div>
            <div className="flex-1">
              <Label className="text-xs">Vencimento</Label>
              <Input
                type="date"
                value={p.vencimento ?? ""}
                onChange={(e) =>
                  setParcelas(lista.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))
                }
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">Valor</Label>
              <Input
                type="number"
                step="0.01"
                disabled={igual}
                value={p.valor ?? 0}
                onChange={(e) =>
                  onChange({
                    pagamento_parcelas: renumerar(
                      lista.map((x, j) => (j === i ? { ...x, valor: Number(e.target.value || 0) } : x)),
                    ),
                  })
                }
              />
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} title="Remover">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar parcela
        </Button>
        <div className={`text-sm ${bate ? "text-muted-foreground" : "text-destructive font-medium"}`}>
          Soma: {fmtMoeda(soma)} · Total: {fmtMoeda(Number(total || 0))}
        </div>
      </div>
    </div>
  );
}
