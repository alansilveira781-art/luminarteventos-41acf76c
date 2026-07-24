// Geração da Ficha de Controle Individual EPI/EPC (PDF).
// jspdf é carregado sob demanda para não pesar no bundle.

export type FichaColaborador = {
  nome: string;
  funcao: string | null;
  matricula: string | null;
  documento: string;
  tipo_documento: "cpf" | "cnpj";
};

export type FichaEmpresa = {
  razao_social: string;
  cnpj?: string;
};

export type FichaEntrega = {
  data: string; // ISO
  epi_descricao: string;
  quantidade: number;
  ca: string | null;
  motivo: string;
};

const MOTIVO_LABEL: Record<string, string> = {
  entrega: "1 - Entrega",
  devolucao_desgaste_normal: "2.1 - Devolução (desgaste normal)",
  devolucao_desgaste_anormal: "2.2 - Devolução (desgaste anormal)",
  perda: "3 - Perda",
  desligamento: "4 - Desligamento",
};

function fmtDoc(doc: string, tipo: "cpf" | "cnpj") {
  const d = doc.replace(/\D/g, "");
  if (tipo === "cpf" && d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (tipo === "cnpj" && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return doc;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function gerarFichaEpiPdf(params: {
  empresa: FichaEmpresa;
  colaborador: FichaColaborador;
  entregas: FichaEntrega[];
  local?: string;
}) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 15;
  let y = 15;

  // Cabeçalho da empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(params.empresa.razao_social.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 5;
  if (params.empresa.cnpj) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`CNPJ: ${params.empresa.cnpj}`, pageW / 2, y, { align: "center" });
    y += 6;
  } else {
    y += 2;
  }

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FICHA DE CONTROLE INDIVIDUAL EPI / EPC", pageW / 2, y, { align: "center" });
  y += 8;

  // Identificação
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const c = params.colaborador;
  const idLines = [
    `Nome: ${c.nome}`,
    `Matrícula: ${c.matricula ?? "—"}`,
    `Função: ${c.funcao ?? "—"}`,
    `${c.tipo_documento.toUpperCase()}: ${fmtDoc(c.documento, c.tipo_documento)}`,
  ];
  idLines.forEach((line) => {
    doc.text(line, marginX, y);
    y += 5;
  });
  y += 2;

  // Termo de responsabilidade
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TERMO DE RESPONSABILIDADE", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const termo =
    `Declaro, para os devidos fins, ter recebido de ${params.empresa.razao_social.toUpperCase()} os Equipamentos de ` +
    `Proteção Individual (EPI) e/ou Coletiva (EPC) discriminados nesta ficha, gratuitamente, comprometendo-me a: ` +
    `(a) usá-los apenas para a finalidade a que se destinam; (b) responsabilizar-me pela guarda e conservação; ` +
    `(c) comunicar ao empregador qualquer alteração que os torne impróprios para uso; (d) devolvê-los ao ` +
    `empregador quando do desligamento ou substituição, sob pena de descontos previstos em lei. Estou ciente das ` +
    `obrigações constantes na Norma Regulamentadora NR-06, aprovada pela Portaria n.º 3.214/78 do Ministério do ` +
    `Trabalho, bem como do disposto no artigo 482 da CLT, que caracteriza como falta grave o descumprimento das ` +
    `normas de segurança do trabalho.`;
  const termoLines = doc.splitTextToSize(termo, pageW - marginX * 2);
  doc.text(termoLines, marginX, y);
  y += termoLines.length * 4 + 4;

  // Tabela de EPIs
  autoTable(doc, {
    startY: y,
    head: [["Data", "EPI", "CA", "Qtde", "Motivo"]],
    body: params.entregas.map((e) => [
      fmtDate(e.data),
      e.epi_descricao,
      e.ca ?? "—",
      String(e.quantidade),
      MOTIVO_LABEL[e.motivo] ?? e.motivo,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40] },
    theme: "grid",
    margin: { left: marginX, right: marginX },
  });

  // Data + assinatura
  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 15;
  const hoje = new Date();
  const dataStr = `${params.local ?? "____________________"}, ${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  doc.setFontSize(10);
  doc.text(dataStr, marginX, finalY);
  const sigY = finalY + 20;
  doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
  doc.text("Assinatura do colaborador", pageW / 2, sigY + 5, { align: "center" });

  doc.save(`ficha-epi-${c.nome.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}
