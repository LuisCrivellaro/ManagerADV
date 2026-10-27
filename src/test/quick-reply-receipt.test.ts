import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lerReservaGoogleCalendar } from '@/lib/atendimento/google-calendar.server';
const reserva = { id: 'event', inicio: '2026-10-28T12:00:00Z', fim: '2026-10-28T12:30:00Z' };
beforeEach(() => { vi.stubEnv('LOVABLE_API_KEY', 'test'); vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test'); });
describe('Verificação read-only do compromisso', () => {
  it('só lê o evento da própria conversa, sem criar, alterar ou enviar', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: reserva.id, status: 'confirmed', start: { dateTime: reserva.inicio }, end: { dateTime: reserva.fim }, extendedProperties: { private: { conversa: 'case' } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await lerReservaGoogleCalendar('case', reserva)).toMatchObject(reserva);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it('evento de outra conversa nunca preenche a consulta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: reserva.id, status: 'confirmed', start: { dateTime: reserva.inicio }, end: { dateTime: reserva.fim }, extendedProperties: { private: { conversa: 'other' } } }), { status: 200 })));
    expect(await lerReservaGoogleCalendar('case', reserva)).toBeUndefined();
  });
  it('404 permanece sem compromisso verificado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    expect(await lerReservaGoogleCalendar('case', reserva)).toBeUndefined();
  });
});