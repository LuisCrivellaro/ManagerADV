import { describe, expect, it } from 'vitest';
import { groupClients, matchesClient, type ClientCase } from '@/lib/clients';
const base: ClientCase = { id:'a',owner:'o',responsible:'Equipe',mine:true,name:'João Teste',cpf:'123.456.789-00',rg:'45.678.901-X',phone:'(11) 99999-1234',stage:'ativo',attendance:'AT-001',petitionNumber:'PET-2026-15',work:{recibo:'PROT-2026-77'},processes:[{cnj:'1234567-89.2026.8.26.0100',vara:'Vara',status:'Ativo',homologado:false}],checklist:[] };
describe('Busca rápida e clientes', () => {
  for (const [label, query] of [['nome','joao'],['CPF','12345678900'],['RG','45678901x'],['celular','11999991234'],['petição','pet202615'],['protocolo','prot202677'],['processo','12345678920268260100']]) it(`busca por ${label}`, () => { const client=groupClients([base])[0]; if(!client)throw new Error('Fixture ausente'); expect(matchesClient(client, query??'')).toBe(true); expect(matchesClient(client, 'inexistente')).toBe(false); });
  it('agrupa processos apenas por CPF completo, não por nome', () => { expect(groupClients([base,{...base,id:'b'}])).toHaveLength(1); expect(groupClients([{...base,cpf:''},{...base,id:'b',cpf:''}])).toHaveLength(2); });
  it('marca ativo quando há caso ativo', () => { expect(groupClients([base])[0]?.active).toBe(true); expect(groupClients([{...base,stage:'inicial'}])[0]?.active).toBe(false); });
});