import type { ResultadoAnalise } from './documentos-rules';

// Mantém também o teto jurídico existente (10.000 KB), mais restritivo que 10 MB.
export const MAX_PDF_START_BYTES = 10_000 * 1024;
export function nomePdfIdentificado(tipo: string, hash: string) {
  const base = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 78).replace(/_+$/g, '');
  if (!base || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Identificação ou integridade indisponível.');
  return `${base}_${hash.slice(0, 12)}.pdf`;
}
export function tipoEspecifico(resultado: ResultadoAnalise) {
  const tipo = resultado.tipoDocumento.trim();
  const limpo = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!tipo || /^(documentos?( diversos)?|anexos?|arquivo|imagem|foto|desconhecido|nao identificado|outros|pdf)$/.test(limpo)) return undefined;
  return tipo;
}