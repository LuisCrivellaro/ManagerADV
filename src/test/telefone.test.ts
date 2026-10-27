import { describe, it, expect } from 'vitest';
import { normalizarTelefone, chaveTelefone, mascararTelefone } from '@/lib/atendimento/telefone';

describe('telefone', () => {
  it('normaliza: só dígitos, com 55 para 10 ou 11 dígitos', () => {
    expect(normalizarTelefone('(11) 98765-0001')).toBe('5511987650001');
    expect(normalizarTelefone('11 3456-0001')).toBe('551134560001');
    expect(normalizarTelefone('+55 11 98765-0001')).toBe('5511987650001');
    expect(normalizarTelefone('abc')).toBe('');
  });
  it('chave: DDD + últimos 8 dígitos, com ou sem 55 e sem o 9 extra', () => {
    expect(chaveTelefone('(11) 98765-0001')).toBe('1187650001');
    expect(chaveTelefone('5511987650001')).toBe('1187650001');
    expect(chaveTelefone('11987650001')).toBe('1187650001');
  });
  it('mascara no formato (11) •••••-0001', () => {
    expect(mascararTelefone('(11) 98765-0001')).toBe('(11) •••••-0001');
    expect(mascararTelefone('5511987650001')).toBe('(11) •••••-0001');
  });
});
