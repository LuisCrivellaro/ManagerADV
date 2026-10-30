import { describe, it, expect } from 'vitest';
import { iniciarConsultaProcesso, type PortasConsulta } from '@/lib/atendimento/consulta-processo';
import { confirmarVinculo, cpfNoTexto, mascararCpf, pessoaPorCpf, TEXTOS_VINCULO, type VinculoProjuris } from '@/lib/projuris/vinculo';
import type { Identificacao } from '@/lib/projuris/identificacao';

const CPF = '52998224725';
const agora = new Date('2026-10-28T15:00:00Z');
function portas(id: Identificacao, porCpf: { codigo: number; nome: string; cpf?: string }[] = [], log: string[] = []): PortasConsulta {
  return {
    agora: () => agora, identificar: async () => id,
    processosAtivos: async () => [{ codigo: 7, numero: '1234567-89.2026.8.26.0100', assunto: 'Alimentos', segredoJustica: false, envolvidos: [{ codigoPessoa: 1, cliente: true }] }],
    ultimosAndamentos: async () => [{ data: '20/10/2026', descricao: 'Juntada' }],
    redigir: async () => '', codigosExistentes: async () => [], avisarCliente: async () => undefined, enviarRevisora: async () => undefined,
    registrar: async (ev, d) => { log.push(`${ev} ${d ?? ''}`); }, buscarPorCpf: async () => porCpf,
  };
}
const base = { conversaId: 'c1', telefone: '5511999990000', nomeContato: 'Maria', textoCliente: 'como está meu processo?', assuntoJaPerguntado: false };

describe('identificação do cliente para consulta de processo', () => {
  it('encontrado pelo telefone: gera pedido e grava vínculo confirmado', async () => {
    const r = await iniciarConsultaProcesso(base, portas({ tipo: 'unico', pessoa: { codigo: 1, nome: 'Maria Souza' } }));
    expect(r.tipo).toBe('pedido');
    expect(r.tipo === 'pedido' && r.vinculo).toMatchObject({ codigoPessoa: 1, status: 'confirmado', origem: 'telefone' });
  });
  it('vínculo gravado é usado sem consultar o telefone de novo', async () => {
    const p = portas({ tipo: 'nao_encontrado' });
    const v: VinculoProjuris = { codigoPessoa: 1, nome: 'Maria Souza', status: 'confirmado', origem: 'telefone', desde: agora.toISOString() };
    expect((await iniciarConsultaProcesso({ ...base, vinculo: v }, p)).tipo).toBe('pedido');
  });
  it('não encontrado: pede o CPF', async () => {
    expect(await iniciarConsultaProcesso(base, portas({ tipo: 'nao_encontrado' }))).toEqual({ tipo: 'pedir_cpf', mensagem: TEXTOS_VINCULO.pedirCpf });
  });
  it('duplicado: pede o CPF e não revela o outro cadastro', async () => {
    const r = await iniciarConsultaProcesso(base, portas({ tipo: 'duplicado', codigos: [1, 2] }));
    expect(r).toEqual({ tipo: 'pedir_cpf', mensagem: TEXTOS_VINCULO.pedirCpf });
  });
  it('CPF informado: vínculo pendente, CPF mascarado e nada de processo', async () => {
    const log: string[] = [];
    const r = await iniciarConsultaProcesso({ ...base, aguardandoCpf: true, textoCliente: '529.982.247-25' }, portas({ tipo: 'nao_encontrado' }, [{ codigo: 1, nome: 'Maria Souza', cpf: '529.982.247-25' }], log));
    expect(r).toMatchObject({ tipo: 'vinculo_pendente', mensagem: 'Obrigada! Vou confirmar seu cadastro com a equipe e te retorno em seguida.', vinculo: { status: 'pendente', cpfMascarado: '***.982.247-**' } });
    expect(log.join(' ')).not.toContain(CPF);
  });
  it('vínculo pendente segura qualquer informação de processo', async () => {
    const v: VinculoProjuris = { codigoPessoa: 1, nome: 'Maria', status: 'pendente', origem: 'cpf', cpfMascarado: '***', desde: agora.toISOString() };
    expect((await iniciarConsultaProcesso({ ...base, vinculo: v }, portas({ tipo: 'unico', pessoa: { codigo: 1, nome: 'Maria' } }))).tipo).toBe('vinculo_pendente');
  });
  it('confirmação libera o vínculo; sem pendente, falha', () => {
    const v: VinculoProjuris = { codigoPessoa: 1, nome: 'Maria', status: 'pendente', origem: 'cpf', desde: agora.toISOString() };
    expect(confirmarVinculo(v, 'u1', agora)).toMatchObject({ status: 'confirmado', confirmadoPor: 'u1' });
    expect(() => confirmarVinculo(undefined, 'u1', agora)).toThrow();
  });
  it('CPF: valida dígitos, exige pessoa única e mascara', () => {
    expect(cpfNoTexto('meu cpf é 529.982.247-25')).toBe(CPF);
    expect(cpfNoTexto('111.111.111-11')).toBeUndefined();
    expect(pessoaPorCpf(CPF, [{ codigo: 1, nome: 'A', cpf: CPF }, { codigo: 2, nome: 'B', cpf: CPF }])).toBeUndefined();
    expect(mascararCpf(CPF)).toBe('***.982.247-**');
  });
});
