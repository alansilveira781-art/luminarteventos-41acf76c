// Parser do CSV exportado da Uber Business.
// Formato do arquivo:
//   - separador ";" (ponto e vírgula)
//   - primeiras linhas são cabeçalho da organização (Empresa, Administrador, Data do relatório, etc)
//   - a linha real de colunas contém "Data da solicitação (UTC)"
//   - linhas com "Tipo de transação" = "Payment" são agregados de fatura (ignorar)
//   - datas vêm em MM/DD/YYYY (formato US, NÃO inverter)
//   - valor está em "Valor da transação: BRL" com ponto decimal

export type UberCsvRow = {
  data_solicitacao: string; // yyyy-mm-dd
  hora_solicitacao: string | null;
  nome: string | null;
  sobrenome: string | null;
  servico: string | null;
  cidade: string | null;
  endereco_partida: string | null;
  endereco_destino: string | null;
  valor: number;
  projeto: string | null;
  detalhamento: string | null;
  hash_dedup: string;
};

export type UberParseResult = {
  rows: UberCsvRow[];
  ignoredPayments: number;
  ignoredInvalid: number;
};

/** CSV com separador ; e aspas duplas opcionais. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ";") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** MM/DD/YYYY -> yyyy-mm-dd (formato US, sem inverter). */
function parseUsDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function parseNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function findHeaderIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.some((c) => /Data da solicita/i.test(c) && /UTC/i.test(c))) {
      return i;
    }
  }
  return -1;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function findColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const idx = norm.findIndex((h) => h === cn);
    if (idx >= 0) return idx;
  }
  // fallback: contains
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const idx = norm.findIndex((h) => h.includes(cn));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseUberCsv(text: string): UberParseResult {
  // Remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rawLines = text.split(/\r?\n/);

  const headerIdx = findHeaderIndex(rawLines);
  if (headerIdx < 0) {
    return { rows: [], ignoredPayments: 0, ignoredInvalid: 0 };
  }

  const headers = splitCsvLine(rawLines[headerIdx]);
  const col = {
    tipo: findColumn(headers, ["Tipo de transação"]),
    data: findColumn(headers, ["Data da solicitação (UTC)"]),
    hora: findColumn(headers, ["Hora da solicitação (UTC)"]),
    nome: findColumn(headers, ["Nome"]),
    sobrenome: findColumn(headers, ["Sobrenome"]),
    servico: findColumn(headers, ["Serviço", "Servico"]),
    cidade: findColumn(headers, ["Cidade"]),
    partida: findColumn(headers, ["Endereço de partida", "Endereco de partida"]),
    destino: findColumn(headers, ["Endereço de destino", "Endereco de destino"]),
    valor: findColumn(headers, ["Valor da transação: BRL", "Valor da transacao: BRL"]),
    projeto: findColumn(headers, ["Programa"]),
    detalhamento: findColumn(headers, ["Detalhamento da despesa"]),
  };

  const rows: UberCsvRow[] = [];
  let ignoredPayments = 0;
  let ignoredInvalid = 0;

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line || !line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.length < 3) continue;

    const tipo = (col.tipo >= 0 ? cells[col.tipo] : "").trim();
    if (/^payment$/i.test(tipo)) {
      ignoredPayments++;
      continue;
    }
    if (tipo && !/^fare$/i.test(tipo)) {
      // qualquer coisa que não seja Fare (ex.: Refund, Adjustment) — ignoramos
      ignoredInvalid++;
      continue;
    }

    const dataRaw = col.data >= 0 ? cells[col.data] : "";
    const data = parseUsDate(dataRaw);
    if (!data) { ignoredInvalid++; continue; }

    const hora = col.hora >= 0 ? cells[col.hora] || null : null;
    const nome = col.nome >= 0 ? cells[col.nome] || null : null;
    const sobrenome = col.sobrenome >= 0 ? cells[col.sobrenome] || null : null;
    const servico = col.servico >= 0 ? cells[col.servico] || null : null;
    const cidade = col.cidade >= 0 ? cells[col.cidade] || null : null;
    const partida = col.partida >= 0 ? cells[col.partida] || null : null;
    const destino = col.destino >= 0 ? cells[col.destino] || null : null;
    const valor = col.valor >= 0 ? parseNumber(cells[col.valor]) : 0;
    const projetoRaw = col.projeto >= 0 ? (cells[col.projeto] || "").trim() : "";
    const projeto = projetoRaw || null;

    const hash_dedup = [
      data,
      hora ?? "",
      nome ?? "",
      sobrenome ?? "",
      valor.toFixed(2),
      partida ?? "",
    ].join("|");

    rows.push({
      data_solicitacao: data,
      hora_solicitacao: hora,
      nome,
      sobrenome,
      servico,
      cidade,
      endereco_partida: partida,
      endereco_destino: destino,
      valor,
      projeto,
      hash_dedup,
    });
  }

  return { rows, ignoredPayments, ignoredInvalid };
}
