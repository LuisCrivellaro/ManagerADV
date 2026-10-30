import { describe, it, expect, beforeEach } from 'vitest';
import { carregarIndiceProjuris, identificarClienteProjuris, limparIndiceProjuris } from '@/lib/projuris/indice.server';
import type { PessoaComTelefones } from '@/lib/projuris/identificacao';

const p = (codigo: number, ...tel: [string, boolean][]): PessoaComTelefones => ({ codigo, nome: `Pessoa ${codigo}`, telefones: tel.map(([numero, principal]) => ({ numero, principal })) });
function consultas(paginas: PessoaComTelefones[][], total: number) {
  const pedidas: number[] = [];
  return { pedidas, c: { pessoasCompletas: async (pagina: number) => { pedidas.push(pagina); return { pessoas: paginas[pagina] ?? [], total }; } } };
}

describe('Índice de telefones principais (servidor)', () => {
  beforeEach(() => limparIndiceProjuris());
  it('lê todas as páginas e guarda só telefones principais', async () => {
    const pag0 = Array.from({ length: 100 }, (_, i) => p(i + 1, [`11 3000-${String(i).padStart(4, '0')}`, true]));
    const { pedidas, c } = consultas([pag0, [p(500, ['11 99000-0500', true], ['11 98888-0000', false]), p(501, ['11 97777-0000', false])]], 102);
    const indice = await carregarIndiceProjuris(c);
    expect(pedidas).toEqual([0, 1]);
    expect(indice.find(x => x.codigo === 500)?.telefones).toEqual([{ numero: '11 99000-0500', principal: true }]);
    expect(indice.some(x => x.codigo === 501)).toBe(false);
  });
  it('identifica pelo índice em cache, sem reler a cada mensagem', async () => {
    const { pedidas, c } = consultas([[p(7, ['(11) 99000-0007', true])]], 1);
    expect(await identificarClienteProjuris('5511990000007', c)).toEqual({ tipo: 'unico', pessoa: { codigo: 7, nome: 'Pessoa 7' } });
    expect(await identificarClienteProjuris('551190000007', c)).toMatchObject({ tipo: 'unico' });
    expect(pedidas).toEqual([0]);
  });
});
