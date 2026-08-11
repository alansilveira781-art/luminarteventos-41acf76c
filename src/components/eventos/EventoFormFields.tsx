import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { fetchEstados, fetchMunicipios } from "@/lib/ibge";

export const TIPOS_EVENTO = ["Social", "Corporativo", "Cenografia", "Stand"];
export const SITUACOES_EVENTO = ["Aprovado", "Em Aprovação", "Reservado"];

export type EventoFormBase = {
  nome: string;
  local: string;
  cidade: string;
  uf: string;
  tipo: string;
  data_evento: string;
  data_evento_fim: string;
  observacoes: string;
  situacao: string;
};

/** Campos básicos do cadastro de evento, reutilizados no calendário e no Jurídico. */
export function EventoFormFields<T extends EventoFormBase>({
  f, setF,
}: {
  f: T;
  setF: (updater: (prev: T) => T) => void;
}) {
  const set = (k: keyof T, v: any) => setF((p) => ({ ...p, [k]: v }));

  const { data: estados = [] } = useQuery({
    queryKey: ["ibge-estados"],
    queryFn: fetchEstados,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const { data: municipios = [] } = useQuery({
    queryKey: ["ibge-municipios"],
    queryFn: fetchMunicipios,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const ufOptions = estados.map((e) => ({ value: e.sigla, label: `${e.sigla} — ${e.nome}` }));
  const cidadeOptions = f.uf
    ? municipios.filter((m) => m.uf === f.uf).map((m) => ({ value: m.nome, label: m.nome }))
    : municipios.map((m) => ({ value: `${m.nome}|${m.uf}`, label: `${m.nome} - ${m.uf}` }));

  const cidadeValue = f.uf ? f.cidade : (f.cidade ? `${f.cidade}|${f.uf}` : "");

  const handleCidadeChange = (v: string) => {
    if (f.uf) {
      set("cidade" as keyof T, v);
    } else {
      const [nome, uf] = v.split("|");
      setF((p) => ({ ...p, cidade: nome, uf: uf ?? "" }));
    }
  };

  const handleUfChange = (v: string) => {
    setF((p) => {
      const cidadePertence = municipios.some((m) => m.uf === v && m.nome === p.cidade);
      return { ...p, uf: v, cidade: cidadePertence ? p.cidade : "" };
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Label>Nome do evento *</Label>
        <Input value={f.nome} onChange={(e) => set("nome" as keyof T, e.target.value)} placeholder="Ex: Casamento Ana & João" />
      </div>
      <div>
        <Label>Local</Label>
        <Input value={f.local} onChange={(e) => set("local" as keyof T, e.target.value)} />
      </div>
      <div>
        <Label>Estado (UF)</Label>
        <SearchableSelect
          value={f.uf}
          onChange={handleUfChange}
          options={ufOptions}
          placeholder="Selecione o estado…"
          searchPlaceholder="Buscar estado…"
        />
      </div>
      <div>
        <Label>Cidade</Label>
        <SearchableSelect
          value={cidadeValue}
          onChange={handleCidadeChange}
          options={cidadeOptions}
          placeholder={f.uf ? "Selecione a cidade…" : "Selecione a cidade (auto UF)…"}
          searchPlaceholder="Buscar cidade…"
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <select
          value={f.tipo}
          onChange={(e) => set("tipo" as keyof T, e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <Label>Situação</Label>
        <select
          value={f.situacao}
          onChange={(e) => set("situacao" as keyof T, e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {SITUACOES_EVENTO.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <Label>Data inicial do evento *</Label>
        <Input type="date" value={f.data_evento} onChange={(e) => set("data_evento" as keyof T, e.target.value)} />
      </div>
      <div>
        <Label>Data final do evento *</Label>
        <Input type="date" value={f.data_evento_fim} onChange={(e) => set("data_evento_fim" as keyof T, e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label>Observações</Label>
        <Textarea value={f.observacoes} onChange={(e) => set("observacoes" as keyof T, e.target.value)} />
      </div>
    </div>
  );
}
