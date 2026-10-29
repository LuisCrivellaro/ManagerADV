import { describe, it, expect } from 'vitest';
import { chaveTelefone, mesmoTelefone } from '@/lib/projuris/telefone';
import { identificarPorTelefone, indiceTelefonesPrincipais, type PessoaComTelefones } from '@/lib/projuris/identificacao';

describe('ProJuris · telefone', () => {
  it('normaliza com e sem 55, com e sem nono dígito, com e sem 0 de longa distância', () => {
    const chave = '1199990001';
    for (const v of ['5511999990001', '+55 (11) 99999-0001', '11999990001', '(11) 9999-0001', '551199990001', '011999990001', '5511999990001@c.us']) expect(chaveTelefone(v)).toBe(chave);
  });
  it('DDD é obrigatório e números inválidos não viram chave', () => {
    for (const v of ['999990001', '99990001', '', undefined, null, '0011999990001', '11899990001', '123']) expect(chaveTelefone(v)).toBeUndefined();
  });
  it('DDD 55 (RS) não é confundido com o código do país', () => {
    expect(chaveTelefone('55999990001')).toBe('5599990001');
    expect(chaveTelefone('5555999990001')).toBe('5599990001');
  });
  it('fixo de 8 dígitos e celular são números diferentes', () => {
    expect(mesmoTelefone('1133334444', '11999990001')).toBe(false);
    expect(mesmoTelefone('11 3333-4444', '551133334444')).toBe(true);
  });
});

const pessoa = (codigo: number, nome: string, ...telefones: [string, boolean][]): PessoaComTelefones =>
  ({ codigo, nome, telefones: telefones.map(([numero, principal]) => ({ numero, principal })) });

describe('ProJuris · identificação pelo telefone principal', () => {
  const base = [
    pessoa(10, 'Maria Fictícia', ['(11) 99999-0001', true]),
    pessoa(20, 'João Fictício', ['11 98888-0002', false], ['11 3333-4444', true]),
    pessoa(30, 'Ana Fictícia', ['21 97777-0003', true]),
    pessoa(31, 'Bia Fictícia', ['21 97777-0003', true]),
  ];

  it('cliente encontrado: um único dono do telefone principal', () => {
    expect(identificarPorTelefone('5511999990001', base)).toEqual({ tipo: 'unico', pessoa: { codigo: 10, nome: 'Maria Fictícia' } });
  });
  it('telefone sem o nono dígito encontra o mesmo cliente', () => {
    expect(identificarPorTelefone('551199990001', base)).toMatchObject({ tipo: 'unico', pessoa: { codigo: 10 } });
  });
  it('não encontrado: telefone só como secundário não identifica', () => {
    expect(identificarPorTelefone('5511988880002', base)).toEqual({ tipo: 'nao_encontrado' });
    expect(identificarPorTelefone('5511977770000', base)).toEqual({ tipo: 'nao_encontrado' });
  });
  it('duplicado: mais de uma pessoa com o mesmo telefone principal não identifica ninguém', () => {
    expect(identificarPorTelefone('5521977770003', base)).toEqual({ tipo: 'duplicado', codigos: [30, 31] });
  });
  it('telefone sem DDD é inválido', () => {
    expect(identificarPorTelefone('999990001', base)).toEqual({ tipo: 'telefone_invalido' });
  });
  it('o índice só guarda telefones principais e não repete a mesma pessoa', () => {
    const indice = indiceTelefonesPrincipais([...base, pessoa(10, 'Maria Fictícia', ['11 99999-0001', true])]);
    expect(indice.get('1199990001')).toEqual([10]);
    expect(indice.has('1198880002')).toBe(false);
    expect(indice.get('1133334444')).toEqual([20]);
  });
});
