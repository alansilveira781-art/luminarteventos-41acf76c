import { PDFDocument } from "pdf-lib";

function base64ParaBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

const A4 = { largura: 595.28, altura: 841.89 };

/**
 * Junta o PDF do contrato com o arquivo da proposta (PDF ou imagem),
 * devolvendo um único PDF em base64.
 */
export async function mesclarContratoComProposta(
  contratoPdfBase64: string,
  proposta: { bytes: Uint8Array; mimeType?: string | null; nome?: string | null },
): Promise<string> {
  const doc = await PDFDocument.load(base64ParaBytes(contratoPdfBase64));

  const nome = (proposta.nome ?? "").toLowerCase();
  const mime = (proposta.mimeType ?? "").toLowerCase();
  const ehPdf = mime.includes("pdf") || nome.endsWith(".pdf");
  const ehPng = mime.includes("png") || nome.endsWith(".png");
  const ehJpg = mime.includes("jpeg") || mime.includes("jpg") || /\.jpe?g$/.test(nome);

  if (ehPdf) {
    const src = await PDFDocument.load(proposta.bytes);
    const paginas = await doc.copyPages(src, src.getPageIndices());
    for (const p of paginas) doc.addPage(p);
  } else if (ehPng || ehJpg) {
    const img = ehPng ? await doc.embedPng(proposta.bytes) : await doc.embedJpg(proposta.bytes);
    const page = doc.addPage([A4.largura, A4.altura]);
    const margem = 28;
    const escala = Math.min(
      (A4.largura - margem * 2) / img.width,
      (A4.altura - margem * 2) / img.height,
    );
    const w = img.width * escala;
    const h = img.height * escala;
    page.drawImage(img, {
      x: (A4.largura - w) / 2,
      y: (A4.altura - h) / 2,
      width: w,
      height: h,
    });
  } else {
    throw new Error(
      "A proposta anexada precisa ser um PDF ou uma imagem (JPG/PNG) para ser unida ao contrato.",
    );
  }

  return bytesParaBase64(await doc.save());
}
