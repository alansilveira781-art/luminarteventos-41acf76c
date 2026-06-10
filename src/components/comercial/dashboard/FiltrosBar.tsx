import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Filtros } from "@/lib/comercial/vendas-metrics";
import type { VendaRow } from "@/lib/comercial/vendas.functions";
import { uniqueValues } from "@/lib/comercial/vendas-metrics";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function FiltrosBar({
  rows,
  filtros,
  onChange,
  showTrimestre = false,
  showMes = true,
}: {
  rows: VendaRow[];
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  showTrimestre?: boolean;
  showMes?: boolean;
}) {
  const empresas = (uniqueValues(rows, (r) => r.empresa) as string[]).sort();
  const anos = (uniqueValues(rows, (r) => r.anoEvento ?? r.ano) as number[]).sort((a, b) => b - a);
  const consultores = (uniqueValues(rows, (r) => r.consultor) as string[]).sort();
  const classificacoes = (uniqueValues(rows, (r) => r.classificacao) as string[]).sort();

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      <Field label="Empresa">
        <Select value={String(filtros.empresa)} onValueChange={(v) => set("empresa", v as Filtros["empresa"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Ano">
        <Select value={String(filtros.ano)} onValueChange={(v) => set("ano", v === "Todos" ? "Todos" : Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {showMes && (
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
      {showTrimestre && (
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
      <Field label="Consultor">
        <Select value={String(filtros.consultor)} onValueChange={(v) => set("consultor", v as Filtros["consultor"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {consultores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Classificação">
        <Select value={String(filtros.classificacao)} onValueChange={(v) => set("classificacao", v as Filtros["classificacao"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {classificacoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
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
