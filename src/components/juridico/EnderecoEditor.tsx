import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarCep } from "@/lib/juridico/contrato-form";

export type EnderecoValores = {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

/** Editor de endereço com busca automática por CEP (ViaCEP). */
export function EnderecoEditor({
  titulo,
  valor,
  onChange,
}: {
  titulo: string;
  valor: EnderecoValores;
  onChange: (patch: EnderecoValores) => void;
}) {
  const [buscando, setBuscando] = useState(false);

  async function handleCep(cep: string) {
    onChange({ cep });
    if (cep.replace(/\D/g, "").length !== 8) return;
    setBuscando(true);
    const found = await buscarCep(cep);
    setBuscando(false);
    if (!found) return;
    onChange({
      cep,
      logradouro: found.logradouro || valor.logradouro || "",
      bairro: found.bairro || valor.bairro || "",
      cidade: found.localidade || valor.cidade || "",
      uf: found.uf || valor.uf || "",
    });
  }

  return (
    <div className="col-span-2 rounded-md border p-3 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">{titulo}</div>
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">CEP</Label>
          <Input
            value={valor.cep ?? ""}
            onChange={(e) => handleCep(e.target.value)}
            placeholder="00000-000"
          />
          {buscando && <p className="text-[11px] text-muted-foreground">Buscando…</p>}
        </div>
        <div className="col-span-3">
          <Label className="text-xs">Logradouro</Label>
          <Input
            value={valor.logradouro ?? ""}
            onChange={(e) => onChange({ logradouro: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Número</Label>
          <Input value={valor.numero ?? ""} onChange={(e) => onChange({ numero: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Complemento</Label>
          <Input
            value={valor.complemento ?? ""}
            onChange={(e) => onChange({ complemento: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Bairro</Label>
          <Input value={valor.bairro ?? ""} onChange={(e) => onChange({ bairro: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Cidade</Label>
          <Input value={valor.cidade ?? ""} onChange={(e) => onChange({ cidade: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">UF</Label>
          <Input
            maxLength={2}
            value={valor.uf ?? ""}
            onChange={(e) => onChange({ uf: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
    </div>
  );
}
