import { describe, expect, it, vi, afterEach } from 'vitest';
import { numeroUltraMsgPermitido, numerosUltraMsgPermitidos } from '@/lib/atendimento/production-channel';
import { enviarTextoUltramsg } from '@/lib/atendimento/canais/ultramsg';

afterEach(() => vi.unstubAllGlobals());
describe('UltraMsg restrito até segunda ordem', () => {
  it('libera exatamente os dois números informados', () => {
    expect(numerosUltraMsgPermitidos).toEqual(['5511999600306', '5511942074361']);
    expect(numeroUltraMsgPermitido('11999600306')).toBe(true);
    expect(numeroUltraMsgPermitido('+55 (11) 94207-4361')).toBe(true);
    expect(numeroUltraMsgPermitido('5511999600306@c.us')).toBe(true);
    expect(numeroUltraMsgPermitido('551199600306')).toBe(false);
    expect(numeroUltraMsgPermitido('5511999600306@g.us')).toBe(false);
    expect(numeroUltraMsgPermitido('5566999844549')).toBe(false);
  });
  it('adaptador não chama o provedor para destino fora da lista', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await enviarTextoUltramsg('5566999844549', 'oi', { instancia: 'test', token: 'test' })).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});