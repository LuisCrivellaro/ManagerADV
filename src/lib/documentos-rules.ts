import { z } from 'zod';
import type { DocItem } from './mock-data';

export const resultadoSchema = z.object({
  tipoDocumento: z.string(), itemChecklist: z.string().nullable(),
  confianca: z.enum(['alta', 'media', 'baixa']), nomeTitular: z.string().nullable(), cpf: z.string().nullable(),
  datas: z.array(z.object({ descricao: z.string(), data: z.string() })),
  detalhesCaso: z.array(z.string()), observacoes: z.string().nullable(),
});
export type ResultadoAnalise = z.infer<typeof resultadoSchema>;
export function itemIdentificado(resultado: ResultadoAnalise, documentos: DocItem[]) {
  // Recebimento de comprovante reconhecido não significa validar endereço/grafia.
  const comprovante = resultado.confianca === 'media' && /^(?:Comprovante de endere[cç]o|Comprovante de resid[eê]ncia)$/i.test(resultado.itemChecklist ?? '') && /fatura|conta|comprovante|endere[cç]o|resid[eê]ncia/i.test(resultado.tipoDocumento);
  if ((resultado.confianca !== 'alta' && !comprovante) || !resultado.itemChecklist) return undefined;
  return documentos.find(d => d.nome === resultado.itemChecklist);
}