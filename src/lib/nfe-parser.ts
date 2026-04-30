import { XMLParser } from "fast-xml-parser";

export type NfeItem = {
  codigo: string;
  nome: string;
  ncm?: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
};

export type NfeData = {
  numero?: string;
  emissao?: string;
  fornecedor: { nome: string; cnpj?: string };
  itens: NfeItem[];
};

export async function parseNfeXml(file: File): Promise<NfeData> {
  const text = await file.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const json: any = parser.parse(text);

  // NF-e padrão SEFAZ: nfeProc.NFe.infNFe ou diretamente NFe.infNFe
  const inf = json?.nfeProc?.NFe?.infNFe ?? json?.NFe?.infNFe ?? json?.infNFe;
  if (!inf) throw new Error("XML inválido: estrutura NF-e não encontrada");

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const detRaw = inf.det;
  const dets = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const itens: NfeItem[] = dets.map((d: any) => {
    const prod = d.prod ?? {};
    return {
      codigo: String(prod.cProd ?? "").trim() || `NFE-${prod.cEAN ?? Math.random().toString(36).slice(2, 8)}`,
      nome: String(prod.xProd ?? "Item sem descrição").trim(),
      ncm: prod.NCM ? String(prod.NCM) : undefined,
      unidade: String(prod.uCom ?? "un").toLowerCase(),
      quantidade: Number(prod.qCom ?? 0),
      valor_unitario: Number(prod.vUnCom ?? 0),
    };
  });

  return {
    numero: ide.nNF ? String(ide.nNF) : undefined,
    emissao: ide.dhEmi ?? ide.dEmi,
    fornecedor: {
      nome: String(emit.xNome ?? "Fornecedor não identificado"),
      cnpj: emit.CNPJ ? String(emit.CNPJ) : undefined,
    },
    itens,
  };
}
