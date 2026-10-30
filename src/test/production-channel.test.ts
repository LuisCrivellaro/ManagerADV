import { describe, expect, it, vi, afterEach } from 'vitest';
import { numeroUltraMsgPermitido, numeroWhatsAppAtendido, numerosUltraMsgPermitidos } from '@/lib/atendimento/production-channel';
import { enviarTextoUltramsg } from '@/lib/atendimento/canais/ultramsg';

afterEach(() => vi.unstubAllGlobals());
describe('UltraMsg restrito até segunda ordem', () => {
  it('libera exatamente os três números de teste informados', () => {
    expect(numerosUltraMsgPermitidos).toEqual(['5511999600306', '5511942074361', '5566999844549']);
    expect(numeroUltraMsgPermitido('11999600306')).toBe(true);
    expect(numeroUltraMsgPermitido('+55 (11) 94207-4361')).toBe(true);
    expect(numeroUltraMsgPermitido('5511999600306@c.us')).toBe(true);
    // Sem o nono dígito é a mesma linha (chave DDD + 8 dígitos): continua liberado.
    expect(numeroUltraMsgPermitido('551199600306')).toBe(true);
    expect(numeroUltraMsgPermitido('5511999600306@g.us')).toBe(false);
    expect(numeroUltraMsgPermitido('5511900000000')).toBe(false);
  });
  it('adaptador não chama o provedor para destino fora da lista', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await enviarTextoUltramsg('5511900000000', 'oi', { instancia: 'test', token: 'test' })).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('checagem única com a entrada do WhatsApp', () => {
  it('entrada aberta aceita número fora da lista; fechada ou indisponível, só a lista', () => {
    expect(numeroWhatsAppAtendido('5511900000000@c.us', true)).toBe(true);
    expect(numeroWhatsAppAtendido('+55 (11) 90000-0000', true)).toBe(true);
    expect(numeroWhatsAppAtendido('5511900000000@c.us', false)).toBe(false);
    expect(numeroWhatsAppAtendido('5511999600306@c.us', false)).toBe(true);
    expect(numeroWhatsAppAtendido('5511999600306@c.us', true)).toBe(true);
  });
  it('grupos, transmissões e canais são recusados mesmo com a entrada aberta', () => {
    expect(numeroWhatsAppAtendido('1203630@g.us', true)).toBe(false);
    expect(numeroWhatsAppAtendido('5511900000000@broadcast', true)).toBe(false);
    expect(numeroWhatsAppAtendido('5511900000000@newsletter', true)).toBe(false);
  });
  it('envio com a entrada aberta chama o provedor para número fora da lista', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sent: 'true', id: 1 }) });
    vi.stubGlobal('fetch', fetch);
    expect((await enviarTextoUltramsg('5511900000000', 'oi', { instancia: 'test', token: 'test' }, true)).ok).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });
});