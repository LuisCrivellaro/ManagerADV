import { describe, expect, it } from 'vitest';
import { clienteDiretorioDe, filtrarDiretorio } from './diretorio';

const a = clienteDiretorioDe({ codigoPessoa: 1, nome: 'Maria Souza', cpfOuCnpj: '123.456.789-00', telefonePrincipal: '(11) 99999-0000', habilitado: true })!;
const b = clienteDiretorioDe({ codigoPessoa: 2, nome: 'Ana Lima', cidadePrincipal: 'São Paulo', habilitado: false })!;

describe('diretório ProJuris', () => {
  it('ignora registro sem código ou nome', () => {
    expect(clienteDiretorioDe({ nome: 'X' })).toBeUndefined();
    expect(clienteDiretorioDe({ codigoPessoa: 3 })).toBeUndefined();
  });
  it('busca pelos dígitos do CPF', () => {
    expect(filtrarDiretorio([a, b], '12345678900', 0, 50).itens.map(c => c.codigo)).toEqual([1]);
  });
  it('busca sem acento e ordena por nome', () => {
    expect(filtrarDiretorio([a, b], 'sao paulo', 0, 50).itens.map(c => c.codigo)).toEqual([2]);
    expect(filtrarDiretorio([a, b], '', 0, 50).itens.map(c => c.nome)).toEqual(['Ana Lima', 'Maria Souza']);
  });
  it('pagina o resultado', () => {
    const r = filtrarDiretorio([a, b], '', 1, 1);
    expect(r).toEqual({ total: 2, itens: [a] });
  });
});
