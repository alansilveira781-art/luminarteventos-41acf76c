import * as XLSX from "xlsx";

export type ImportRow = Record<string, any>;

export async function parseSpreadsheet(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "", raw: false });
}

export function downloadTemplate(filename: string, headers: string[], example: Record<string, any>) {
  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, filename);
}

export const ITEM_TEMPLATE = {
  headers: ["codigo", "nome", "categoria", "subcategoria", "unidade", "quantidade_atual", "quantidade_minima", "localizacao", "descricao", "observacoes", "foto_url"],
  example: {
    codigo: "ITM-001",
    nome: "Refletor LED 100W",
    categoria: "Iluminação",
    subcategoria: "LED",
    unidade: "un",
    quantidade_atual: 10,
    quantidade_minima: 2,
    localizacao: "Prateleira A-1",
    descricao: "Refletor branco frio",
    observacoes: "",
    foto_url: "",
  },
};

export const SOLICITANTE_TEMPLATE = {
  headers: ["nome", "setor", "cargo", "telefone", "email", "observacoes"],
  example: { nome: "João Silva", setor: "Operações", cargo: "Técnico", telefone: "(11) 99999-9999", email: "joao@luminart.com", observacoes: "" },
};

export const FORNECEDOR_TEMPLATE = {
  headers: ["nome", "documento", "tipo_fornecimento", "contato_nome", "telefone", "email", "endereco", "observacoes"],
  example: { nome: "Distribuidora ABC", documento: "12.345.678/0001-99", tipo_fornecimento: "Iluminação", contato_nome: "Carlos", telefone: "(11) 3333-4444", email: "vendas@abc.com", endereco: "Rua X, 100", observacoes: "" },
};

export const ENTRADA_TEMPLATE = {
  headers: ["codigo_item", "quantidade", "valor_unitario", "fornecedor_nome", "nota_fiscal", "data_movimento", "responsavel_lancamento", "observacoes"],
  example: { codigo_item: "ITM-001", quantidade: 5, valor_unitario: 89.9, fornecedor_nome: "Distribuidora ABC", nota_fiscal: "NF 12345", data_movimento: "2026-04-30", responsavel_lancamento: "Operador", observacoes: "" },
};

export function normalizeKey(s: string) {
  return String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

export function pickRow(row: ImportRow, keys: string[]): ImportRow {
  const out: ImportRow = {};
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[normalizeKey(k)] = row[k];
  for (const k of keys) out[k] = map[normalizeKey(k)] ?? "";
  return out;
}
