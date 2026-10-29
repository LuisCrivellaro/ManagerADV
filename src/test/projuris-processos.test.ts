import { describe, it, expect } from 'vitest';
import { processosAtivosDoCliente, podeDetalhar, ultimosAndamentosPublicos, dataLegivel, horaLegivel, identificacaoProcesso, type ProcessoPJ, type AndamentoPJ } from '@/lib/projuris/processos';
import { andamentoDe, codigoSituacaoAtiva, pessoaDe, processoDe, registros, totalRegistros } from '@/lib/projuris/mapeamento';

const ATIVO = 7, ARQUIVADO = 9;
const proc = (codigo: number, situacao: number, envolvidos: [number, boolean][], extra: Partial<ProcessoPJ> = {}): ProcessoPJ =>
  ({ codigo, codigoSituacao: situacao, segredoJustica: false, envolvidos: envolvidos.map(([codigoPessoa, cliente]) => ({ codigoPessoa, cliente })), ...extra });

describe('ProJuris · processos do cliente', () => {
  it('vários processos: só os ativos em que a pessoa é cliente (flagCliente)', () => {
    const lista = [
      proc(1, ATIVO, [[10, true]]),
      proc(2, ATIVO, [[10, true], [99, false]]),
      proc(3, ARQUIVADO, [[10, true]]),
      proc(4, ATIVO, [[10, false]]),
      proc(5, ATIVO, [[11, true]]),
    ];
    expect(processosAtivosDoCliente(lista, 10, ATIVO).map(p => p.codigo)).toEqual([1, 2]);
  });
  it('processo arquivado nunca entra', () => {
    expect(processosAtivosDoCliente([proc(3, ARQUIVADO, [[10, true]])], 10, ATIVO)).toEqual([]);
  });
  it('segredo de justiça não é detalhado', () => {
    expect(podeDetalhar(proc(1, ATIVO, [[10, true]], { segredoJustica: true }))).toBe(false);
    expect(podeDetalhar(proc(1, ATIVO, [[10, true]]))).toBe(true);
  });
  it('identificação para o pedido de aprovação', () => {
    expect(identificacaoProcesso(proc(1, ATIVO, [], { numero: '0001234-56.2026.5.02.0001', orgao: 'TRT-2', vara: '1ª Vara do Trabalho', assunto: 'Horas extras' })))
      .toBe('nº 0001234-56.2026.5.02.0001 · TRT-2 / 1ª Vara do Trabalho · Horas extras');
  });
});

describe('ProJuris · andamentos', () => {
  const a = (codigo: number, data: string, privado: boolean, hora?: string): AndamentoPJ => ({ codigo, data, privado, descricao: `Andamento ${codigo}`, tipo: 'Despacho', ...(hora ? { hora } : {}) });
  it('três últimas movimentações não privadas, da mais recente para a mais antiga', () => {
    const lista = [a(1, '2026-09-01', false), a(2, '2026-10-20', true), a(3, '2026-10-15', false), a(4, '2026-10-01', false), a(5, '2026-08-01', false), a(6, '2026-10-15', false, '16:30:00')];
    const r = ultimosAndamentosPublicos(lista);
    expect(r.map(x => x.descricao)).toEqual(['Andamento 6', 'Andamento 3', 'Andamento 4']);
    expect(r[0]).toEqual({ data: '15/10/2026', hora: '16h30', tipo: 'Despacho', descricao: 'Andamento 6' });
  });
  it('andamento privado nunca aparece', () => {
    expect(ultimosAndamentosPublicos([a(2, '2026-10-20', true)])).toEqual([]);
  });
  it('datas legíveis no horário de Brasília', () => {
    expect(dataLegivel('2026-10-20')).toBe('20/10/2026');
    expect(dataLegivel('2026-10-21T01:30:00Z')).toBe('20/10/2026');
    expect(dataLegivel(String(Date.parse('2026-10-21T01:30:00Z')))).toBe('20/10/2026');
    expect(horaLegivel('09:00:00')).toBe('9h');
    expect(dataLegivel('sem data')).toBeUndefined();
  });
});

describe('ProJuris · leitura das respostas da API', () => {
  it('pessoa com telefones (PessoaTelefoneWs) e telefone principal', () => {
    const p = pessoaDe({ codigoPessoa: 10, nomePessoa: 'Maria Fictícia', telefones: [{ principal: true, telefone: { numeroTelefone: '11999990001' } }, { principal: false, telefone: { numeroTelefone: '1133334444' } }] });
    expect(p).toEqual({ codigo: 10, nome: 'Maria Fictícia', telefones: [{ numero: '11999990001', principal: true }, { numero: '1133334444', principal: false }] });
    expect(pessoaDe({ nomePessoa: 'Sem código' })).toBeUndefined();
  });
  it('processo com número, órgão, vara, assunto, situação e envolvidos', () => {
    const p = processoDe({
      codigoProcesso: 1, processoNumeroWs: [{ numeroProcesso: '000', principal: false }, { numeroProcesso: '0001234-56.2026.5.02.0001', principal: true }],
      orgaoJudicial: { chave: 3, valor: 'TRT-2' }, vara: '1ª Vara', assunto: { valor: 'Horas extras' }, situacaoProcesso: { chave: 7, valor: 'Ativo' },
      segredoJustica: false, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 10, flagCliente: true }, { pessoa: { chave: 99 }, flagCliente: false }],
    });
    expect(p).toEqual({ codigo: 1, numero: '0001234-56.2026.5.02.0001', orgao: 'TRT-2', vara: '1ª Vara', assunto: 'Horas extras', codigoSituacao: 7, situacao: 'Ativo', segredoJustica: false, envolvidos: [{ codigoPessoa: 10, cliente: true }, { codigoPessoa: 99, cliente: false }] });
  });
  it('na dúvida protege: sem segredoJustica explícito é segredo; sem privado explícito é privado; flagCliente ausente não é cliente', () => {
    expect(processoDe({ codigoProcesso: 2, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 10 }] })).toMatchObject({ segredoJustica: true, envolvidos: [{ codigoPessoa: 10, cliente: false }] });
    expect(andamentoDe({ codigoAndamento: 5, descricaoAndamento: 'Juntada', dataAndamento: '2026-10-20' })).toMatchObject({ privado: true });
    expect(andamentoDe({ codigoAndamento: 5, descricaoAndamento: 'Juntada', dataAndamento: '2026-10-20', privado: false, nomeTipoAndamento: 'Juntada', horaAndamento: '10:15:00' }))
      .toEqual({ codigo: 5, descricao: 'Juntada', privado: false, data: '2026-10-20', hora: '10:15:00', tipo: 'Juntada' });
  });
  it('situação "Ativo" vem da consulta tipo e não é adivinhada', () => {
    expect(codigoSituacaoAtiva({ consultaTipoRetorno: [{ chaveTipo: 'processo-situacao', registros: [{ chave: 7, valor: 'Ativo' }, { chave: 9, valor: 'Arquivado' }] }] })).toBe(7);
    expect(codigoSituacaoAtiva({ consultaTipoRetorno: [{ registros: [{ chave: 9, valor: 'Arquivado' }] }] })).toBeUndefined();
    expect(codigoSituacaoAtiva([{ chave: 7, valor: 'Ativo' }, { chave: 8, valor: 'ATIVO' }])).toBeUndefined();
  });
  it('listas e totais em formatos diferentes', () => {
    expect(registros({ totalRegistros: 2, pessoaConsulta: [{ a: 1 }, { a: 2 }] }, ['pessoaConsulta'])).toHaveLength(2);
    expect(registros({ outra: [{ a: 1 }] })).toHaveLength(1);
    expect(registros({ x: [{ a: 1 }], y: [{ b: 1 }] })).toEqual([]);
    expect(totalRegistros({ totalRegistros: 40, lista: [] })).toBe(40);
  });
});
