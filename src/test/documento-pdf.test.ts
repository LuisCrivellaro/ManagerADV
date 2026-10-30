import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { converterOriginalPdf } from '@/lib/documento-pdf.server';
import { MAX_PDF_START_BYTES, nomePdfIdentificado, tipoEspecifico } from '@/lib/documento-pdf-rules';
import type { ResultadoAnalise } from '@/lib/documentos-rules';

const hash = 'a'.repeat(64);
const png = () => new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
describe('PDFs específicos de Start', () => {
  it('remove acentos, cedilha, espaços e caracteres especiais', () => {
    expect(nomePdfIdentificado('Procuração assinada / ç @#$%:*?', hash)).toBe('Procuracao_assinada_c_aaaaaaaaaaaa.pdf');
  });
  it('mantém nome abaixo de 100 caracteres, incluindo extensão e identificador', () => {
    const nome = nomePdfIdentificado('Comprovante_Residência'.repeat(20), hash);
    expect(nome.length).toBeLessThan(100); expect(nome).toMatch(/^[A-Za-z0-9_-]+\.pdf$/);
  });
  it('não confunde conteúdos diferentes do mesmo tipo', () => {
    expect(nomePdfIdentificado('RG', hash)).not.toBe(nomePdfIdentificado('RG', 'b'.repeat(64)));
  });
  it.each(['Documentos Diversos', 'Anexos', 'Imagem'])('recusa o tipo genérico %s', tipoDocumento => {
    expect(tipoEspecifico({ tipoDocumento } as ResultadoAnalise)).toBeUndefined();
  });
  it('converte PNG inteiro em um PDF sem modificar bytes originais', async () => {
    const bytes = png(); const antes = bytes.slice();
    const pdf = await converterOriginalPdf(bytes, 'image/png');
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1); expect(bytes).toEqual(antes);
    expect(pdf.length).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
  it('não regrava PDF original nem suas assinaturas', async () => {
    const doc = await PDFDocument.create(); doc.addPage(); const bytes = await doc.save();
    expect(await converterOriginalPdf(bytes, 'application/pdf')).toEqual(bytes);
  });
  it('bloqueia PDF acima do teto existente de 10.000 KB e portanto abaixo de 10 MB', async () => {
    expect(MAX_PDF_START_BYTES).toBe(10_000 * 1024);
    const doc = await PDFDocument.create(); doc.addPage(); const valid = await doc.save();
    const bytes = new Uint8Array(MAX_PDF_START_BYTES + 1); bytes.set(valid);
    await expect(converterOriginalPdf(bytes, 'application/pdf')).rejects.toThrow('10.000 KB');
  });
  it('não disfarça WEBP ou arquivo ilegível de PDF', async () => {
    await expect(converterOriginalPdf(new Uint8Array([1, 2, 3]), 'image/webp')).rejects.toThrow('WEBP');
    await expect(converterOriginalPdf(new Uint8Array([1, 2, 3]), 'application/pdf')).rejects.toThrow();
  });
});