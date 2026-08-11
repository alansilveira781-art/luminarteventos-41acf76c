import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { CadastroCombobox } from "@/components/comercial/CadastroCombobox";
import { useVendedores, useCerimoniais } from "@/lib/comercial/cadastros";
import { matchCadastro } from "@/lib/comercial/comissao";
import { AlertTriangle } from "lucide-react";
import { EMPRESAS_VENDA, type VendaFormState } from "@/lib/comercial/venda-form";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function VendaField({
  label, children, className = "",
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px] uppercase">{label}</Label>
      {children}
    </div>
  );
}

export function SelectFree({
  value, options, onChange,
}: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(value !== "" && !options.includes(value));
  useEffect(() => {
    if (value !== "" && !options.includes(value)) setCustom(true);
  }, [value, options]);
  if (custom) {
    return (
      <div className="flex gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => { setCustom(false); onChange(""); }}>↺</Button>
      </div>
    );
  }
  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => {
        if (v === "__other__") { setCustom(true); onChange(""); return; }
        if (v === "__none__") { onChange(""); return; }
        onChange(v);
      }}
    >
      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="__other__">Outro...</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Campos do cadastro de venda, reutilizados na aba Vendas e no fluxo do Jurídico. */
export function VendaFormFields({
  form, setForm, derived,
}: {
  form: VendaFormState;
  setForm: (f: VendaFormState) => void;
  derived: { valor_final: number; valor_bv: number; valor_comissao: number };
}) {
  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedores();
  const { data: cerimoniais = [], isLoading: loadingCerimoniais } = useCerimoniais();
  const cadastrosCarregando = loadingVendedores || loadingCerimoniais;

  const consultorSemCadastro = useMemo(
    () => !!form.consultor && !matchCadastro(form.consultor, vendedores as any),
    [form.consultor, vendedores],
  );
  const consultorGatilho = useMemo(
    () => (matchCadastro(form.consultor, vendedores as any) as any)?.tipo_comissao === "gatilho",
    [form.consultor, vendedores],
  );
  void cerimoniais;

  return (
    <>
      <VendaField label="Data do Evento">
        <Input type="date" value={form.data_evento}
          onChange={(e) => setForm({ ...form, data_evento: e.target.value })} required />
      </VendaField>
      <VendaField label="Data de Registro">
        <Input type="date" value={form.data_registro}
          onChange={(e) => setForm({ ...form, data_registro: e.target.value })} required />
      </VendaField>
      <VendaField label="Tipo">
        <Select value={form.tipo || "Venda"} onValueChange={(v) => setForm({ ...form, tipo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Venda">Venda</SelectItem>
            <SelectItem value="Extra">Extra</SelectItem>
          </SelectContent>
        </Select>
      </VendaField>
      <VendaField label="Empresa">
        <SelectFree value={form.empresa} options={EMPRESAS_VENDA}
          onChange={(v) => setForm({ ...form, empresa: v })} />
      </VendaField>
      <VendaField label="Nome do Evento" className="sm:col-span-2 lg:col-span-3">
        <Input value={form.nome_evento}
          onChange={(e) => setForm({ ...form, nome_evento: e.target.value })} required />
      </VendaField>
      <VendaField label="Local">
        <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
      </VendaField>
      <VendaField label="Cidade">
        <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
      </VendaField>
      <VendaField label="Estado">
        <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
      </VendaField>
      <VendaField label="Classificação">
        <CadastroCombobox
          table="comercial_classificacoes"
          queryKey="comercial-classificacoes"
          value={form.classificacao}
          onChange={(v) => setForm({ ...form, classificacao: v })}
        />
      </VendaField>
      <VendaField label="Consultor(a)">
        <CadastroCombobox
          table="comercial_vendedores"
          queryKey="comercial-vendedores"
          value={form.consultor}
          onChange={(v) => setForm({ ...form, consultor: v })}
          extraFields={[{ key: "percentual_comissao", label: "% Comissão", type: "number", default: 0 }]}
        />
        {consultorSemCadastro && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Consultor(a) sem cadastro — comissão ficará zerada. Cadastre o percentual em Configurações.
          </p>
        )}
      </VendaField>
      <VendaField label="Cerimonial">
        <CadastroCombobox
          table="comercial_cerimoniais"
          queryKey="comercial-cerimoniais"
          value={form.cerimonial}
          onChange={(v) => setForm({ ...form, cerimonial: v })}
          extraFields={[{ key: "percentual_bv", label: "% BV", type: "number", default: 0 }]}
        />
      </VendaField>
      <VendaField label="Decorador(a)/Agência">
        <CadastroCombobox
          table="comercial_decoradores"
          queryKey="comercial-decoradores"
          value={form.decorador}
          onChange={(v) => setForm({ ...form, decorador: v })}
        />
      </VendaField>
      <VendaField label="Valor da Proposta">
        <MoneyInput value={form.valor_proposta}
          onChange={(n) => setForm({ ...form, valor_proposta: n })} />
      </VendaField>
      <VendaField label="Desconto">
        <MoneyInput value={form.desconto} onChange={(n) => setForm({ ...form, desconto: n })} />
      </VendaField>
      <VendaField label="Valor Final (calculado)">
        <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/40 font-medium tabular-nums">
          {brl(derived.valor_final)}
        </div>
      </VendaField>
      <VendaField label="Valor BV (calculado)">
        <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/40 tabular-nums">
          {brl(derived.valor_bv)}
        </div>
      </VendaField>
      <VendaField label="Valor Comissão (calculado)">
        <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/40 tabular-nums">
          {brl(derived.valor_comissao)}
        </div>
      </VendaField>
      <div className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground flex items-start gap-1">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Valor Final = Proposta − Desconto. BV e Comissão usam os percentuais cadastrados no
          consultor/cerimonial.
          {consultorGatilho && " Este consultor tem comissão por gatilho (meta), por isso a comissão da venda fica zerada."}
          {cadastrosCarregando && " Carregando cadastros de consultores/cerimoniais…"}
        </span>
      </div>
    </>
  );
}
