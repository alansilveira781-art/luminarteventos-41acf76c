import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Filtros } from "@/lib/comercial/vendas-metrics";
import type { VendaRow } from "@/lib/comercial/vendas.functions";
import { uniqueValues, getAno } from "@/lib/comercial/vendas-metrics";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type FiltroField = "empresa" | "ano" | "mes" | "trimestre" | "consultor" | "classificacao";

const DEFAULT_FIELDS: FiltroField[] = ["empresa", "ano", "mes", "consultor", "classificacao"];

export function FiltrosBar({
  rows,
  filtros,
  onChange,
  fields,
  // legacy props (mantidas p/ compatibilidade)
  showTrimestre,
  showMes,
}: {
  rows: VendaRow[];
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  fields?: FiltroField[];
  showTrimestre?: boolean;
  showMes?: boolean;
}) {
  let active: FiltroField[];
  if (fields) {
    active = fields;
  } else {
    active = [...DEFAULT_FIELDS];
    if (showMes === false) active = active.filter((f) => f !== "mes");
    if (showTrimestre) active.splice(active.indexOf("consultor"), 0, "trimestre");
  }

  const empresas = (uniqueValues(rows, (r) => r.empresa) as string[]).sort();
  const anosSet = new Set<number>();
  for (const r of rows) { const a = getAno(r); if (a) anosSet.add(a); }
  if (typeof filtros.ano === "number") anosSet.add(filtros.ano);
  const anos = [...anosSet].sort((a, b) => b - a);
  const consultores = (uniqueValues(rows, (r) => r.consultor) as string[]).sort();
  const classificacoes = (uniqueValues(rows, (r) => r.classificacao) as string[]).sort();

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });

  // Defensivo: se o valor atual não está nas opções, mostra "Todos"
  const safeStr = (v: string | number, opts: string[]) =>
    v === "Todos" || opts.includes(String(v)) ? String(v) : "Todos";
  const safeAno = (v: number | "Todos", opts: number[]) =>
    v === "Todos" || opts.includes(v as number) ? String(v) : "Todos";

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {active.includes("empresa") && (
        <Field label="Empresa">
          <Select value={safeStr(filtros.empresa, empresas)} onValueChange={(v) => set("empresa", v as Filtros["empresa"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      {active.includes("ano") && (
        <Field label="Ano">
          <Select value={safeAno(filtros.ano, anos)} onValueChange={(v) => set("ano", v === "Todos" ? "Todos" : Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      {active.includes("mes") && (
        <Field label="Mês">
          <Select value={String(filtros.mes)} onValueChange={(v) => set("mes", v as Filtros["mes"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      {active.includes("trimestre") && (
        <Field label="Trimestre">
          <Select value={String(filtros.trimestre)} onValueChange={(v) => set("trimestre", v === "Todos" ? "Todos" : (Number(v) as 1 | 2 | 3 | 4))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {[1, 2, 3, 4].map((t) => <SelectItem key={t} value={String(t)}>{t}º Trimestre</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      {active.includes("consultor") && (
        <Field label="Consultor">
          <Select value={safeStr(filtros.consultor, consultores)} onValueChange={(v) => set("consultor", v as Filtros["consultor"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {consultores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      {active.includes("classificacao") && (
        <Field label="Classificação">
          <Select value={safeStr(filtros.classificacao, classificacoes)} onValueChange={(v) => set("classificacao", v as Filtros["classificacao"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {classificacoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
