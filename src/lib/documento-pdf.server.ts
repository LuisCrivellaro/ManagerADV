import { PDFDocument } from 'pdf-lib';
import { MAX_PDF_START_BYTES } from './documento-pdf-rules';

/** Uma imagem inteira por PDF; sem OCR destrutivo, cortes, compressão com perda ou união de documentos. */
export async function converterOriginalPdf(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Original vazio ou acima de 10 MB.');
  let pdf: Uint8Array;
  if (mime === 'application/pdf') {
    const original = await PDFDocument.load(bytes);
    if (!original.getPageCount()) throw new Error('PDF sem páginas.');
    pdf = bytes.slice(); // Não regrava PDFs existentes: preserva texto, páginas e assinaturas.
  } else {
    const doc = await PDFDocument.create();
    const image = mime === 'image/jpeg' ? await doc.embedJpg(bytes) : mime === 'image/png' ? await doc.embedPng(bytes) : undefined;
    if (!image) throw new Error('WEBP requer conversão conferida para PNG/JPG ou PDF; original preservado.');
    const scale = Math.min(1, 14400 / Math.max(image.width, image.height));
    const page = doc.addPage([image.width * scale, image.height * scale]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    pdf = await doc.save();
  }
  if (pdf.length > MAX_PDF_START_BYTES) throw new Error('PDF acima de 10.000 KB; tratamento e revisão necessários. Original preservado.');
  return pdf;
}