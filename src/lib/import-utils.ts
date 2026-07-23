export type ImportRow = Record<string, any>;

export async function parseSpreadsheet(file: File): Promise<ImportRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "", raw: false });
}

export async function downloadTemplate(filename: string, headers: string[], example: Record<string, any>) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, filename);
}

export const ITEM_TEMPLATE = {
  headers: ["codigo", "codigo_proprio", "nome", "categoria", "subcategoria", "unidade", "valor_unitario", "quantidade_atual", "quantidade_minima", "localizacao", "descricao", "observacoes", "foto_url"],
  example: {
    codigo: "ITM-001",
    codigo_proprio: "4825/1010",
    nome: "Refletor LED 100W",
    categoria: "Iluminação",
    subcategoria: "",
    unidade: "Unidade",
    valor_unitario: 89.9,
    quantidade_atual: 10,
    quantidade_minima: 2,
    localizacao: "Prateleira A-1",
    descricao: "Refletor branco frio",
    observacoes: "",
    foto_url: "",
  },
};

export const SOLICITANTE_TEMPLATE = {
  headers: ["nome", "apelido", "setor", "cargo", "telefone", "email", "observacoes"],
  example: { nome: "João Silva", apelido: "Joãozinho", setor: "Operações", cargo: "Técnico", telefone: "(11) 99999-9999", email: "joao@empresa.com", observacoes: "" },
};

export const FORNECEDOR_TEMPLATE = {
  headers: ["nome", "nome_fantasia", "documento", "tipo_fornecimento", "contato_nome", "telefone", "email", "endereco", "observacoes"],
  example: { nome: "Distribuidora ABC Ltda", nome_fantasia: "ABC Distribuidora", documento: "12.345.678/0001-99", tipo_fornecimento: "Iluminação", contato_nome: "Carlos", telefone: "(11) 3333-4444", email: "vendas@abc.com", endereco: "Rua X, 100", observacoes: "" },
};

export const ENTRADA_TEMPLATE = {
  headers: ["codigo_item", "quantidade", "valor_unitario", "empresa", "fornecedor_nome", "nota_fiscal", "data_movimento", "observacoes"],
  example: { codigo_item: "ITM-001", quantidade: 5, valor_unitario: 89.9, empresa: "Luminart Eventos", fornecedor_nome: "Distribuidora ABC", nota_fiscal: "NF 12345", data_movimento: "2026-05-06", observacoes: "" },
};

export const SAIDA_TEMPLATE = {
  headers: ["codigo_item", "quantidade", "empresa", "solicitante_nome", "evento_projeto", "finalidade", "data_movimento", "observacoes"],
  example: { codigo_item: "ITM-001", quantidade: 2, empresa: "Luminart Tecnologia", solicitante_nome: "João Silva", evento_projeto: "Evento XYZ", finalidade: "Montagem palco", data_movimento: "2026-05-06", observacoes: "" },
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
