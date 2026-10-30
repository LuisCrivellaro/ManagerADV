import { describe, it, expect } from 'vitest';
import { rascunhoPadrao, validarRascunho, type FatoProcesso } from '@/lib/atendimento/consulta-processo';

const fato = (o: Partial<FatoProcesso>): FatoProcesso => ({ codigo: 1, identificacao: 'x', segredo: false, andamentos: [], ...o });
const FECHO = 'Atenciosamente,\nEquipe CS Advocacia\nwww.carolinasantos.com.br';

describe('mensagem de andamento no modelo oficial', () => {
  it('um processo: última movimentação, data e simplificação do ProJuris', () => {
    const t = rascunhoPadrao('Maria Souza', [fato({ numero: '1', andamentos: [{ data: '20/10/2026', descricao: 'Juntada de petição', simplificacao: 'Um documento foi anexado.' }, { data: '01/10/2026', descricao: 'Antiga' }] })]);
    expect(t.startsWith('Olá, Maria! 😊\n\nConsultei seu processo em nosso sistema e trouxe uma atualização para você.')).toBe(true);
    expect(t).toContain('📄 Andamento do processo:\nJuntada de petição\n\n📅 Última movimentação:\n20/10/2026\n\nO que isso significa?\nUm documento foi anexado.');
    expect(t).not.toContain('Antiga');
    expect(t.endsWith(FECHO)).toBe(true);
    expect(validarRascunho(t, [fato({ andamentos: [{ data: '20/10/2026', descricao: 'Juntada de petição' }] })]).ok).toBe(true);
  });
  it('vários processos: uma saudação, um fechamento e assunto entre parênteses', () => {
    const t = rascunhoPadrao('Ana', [fato({ assunto: 'Alimentos', andamentos: [{ data: '02/10/2026', descricao: 'A' }] }), fato({ codigo: 2, assunto: 'Guarda', andamentos: [{ data: '03/10/2026', descricao: 'B' }] })]);
    expect(t.match(/Olá, /g)).toHaveLength(1);
    expect(t.match(/Atenciosamente/g)).toHaveLength(1);
    expect(t).toContain('📄 Andamento do processo (Alimentos):');
    expect(t).toContain('📄 Andamento do processo (Guarda):');
    expect(t.match(/📅/g)).toHaveLength(2);
  });
  it('sem movimentação: frase fixa e sem bloco de data', () => {
    const t = rascunhoPadrao('Ana', [fato({})]);
    expect(t).toContain('📄 Andamento do processo:\nAinda não há movimentação registrada.');
    expect(t).not.toContain('📅');
  });
  it('segredo de justiça: nenhum bloco, só o aviso', () => {
    const t = rascunhoPadrao('Ana', [fato({ segredo: true })]);
    expect(t).toContain('Sobre um dos seus processos, nossa equipe vai entrar em contato com você.');
    expect(t).not.toContain('📄');
  });
});
