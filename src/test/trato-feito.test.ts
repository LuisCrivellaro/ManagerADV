import { describe, expect, it } from 'vitest';
import { avisoProducao, comDocumentosBase, faseTrato, pastaCliente } from '@/lib/atendimento/trato-feito';

const base = (r: boolean) => ['RG ou CNH', 'CPF', 'Comprovante de endereço', 'E-mail'].map(nome => ({ nome, recebido: r }));
describe('Trato feito', () => {
  it('pasta segue a categoria RT', () => { expect(pastaCliente({ nome: 'Ana', atendimento: 'AT-1', etiquetaAcao: 'RT', mensagens: [] })).toBe('RT - Trabalhista/Ana – AT-1'); });
  it('não duplica documentos já existentes', () => { expect(comDocumentosBase([{ nome: 'CPF', recebido: true }]).filter(d => d.nome === 'CPF')).toHaveLength(1); });
  it('pede base antes do contrato', () => { expect(faseTrato({ documentos: base(false), contrato: 'enviado' })).toBe('documentos_base'); });
  it('sem contrato assinado não avisa Produção', () => { expect(avisoProducao({ nome: 'A', atendimento: 'X', documentos: base(true), contrato: 'enviado' })).toBeUndefined(); });
  it('com tudo juntado avisa a Dra.', () => { expect(avisoProducao({ nome: 'A', atendimento: 'X', documentos: base(true), contrato: 'assinado' })).toContain('Produção'); });
});
