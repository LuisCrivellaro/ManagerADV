import { describe, expect, it, vi } from 'vitest';
import { pendentesDoCliente } from '@/lib/atendimento/ana-claude.server';
import { fetchPeloConector } from '@/lib/atendimento/ana-claude-agenda.server';

const m = (id: string, de: 'cliente' | 'escritorio', texto: string, extra = {}) => ({ id, de, texto, hora: '', canal: 'telegram', ...extra });

describe('Ana Claude no Atendimento', () => {
  it('junta as mensagens seguidas do cliente ainda sem resposta', () => {
    const c = { mensagens: [m('1', 'cliente', 'antiga', { iaProcessada: true }), m('2', 'escritorio', 'oi'), m('3', 'cliente', 'quero'), m('4', 'cliente', 'agendar')] };
    expect(pendentesDoCliente(c as never, 'telegram').map(x => x.texto).join('\n')).toBe('quero\nagendar');
  });
  it('a agenda usa o conector e nunca outro destino', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const f = fetchPeloConector('lk', 'ck');
    await f('https://www.googleapis.com/calendar/v3/calendars/primary/events?x=1');
    expect(spy.mock.calls[0]![0]).toBe('https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events?x=1');
    await expect(f('https://exemplo.com/x')).rejects.toThrow();
    spy.mockRestore();
  });
});
