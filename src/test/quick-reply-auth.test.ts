import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/lib/atendimento/quick-reply-calendar.server', () => ({ resolveReplyCalendar: mocks.resolve }));
import { consultarDadosMensagem } from '@/lib/atendimento/quick-reply-calendar.functions';
describe('Leitura segura das mensagens', () => {
  it('recusa caso de outro proprietário antes de consultar a agenda', async () => {
    mocks.resolve.mockClear();
    const eq = vi.fn();
    const q = { select: () => q, eq: (...args: unknown[]) => { eq(...args); return q; }, single: async () => ({ error: { message: 'denied' }, data: null }) };
    const handler = consultarDadosMensagem as unknown as (arg: unknown) => Promise<unknown>;
    await expect(handler({ data: { casoId: 'case', atalho: 'consulta' }, context: { userId: 'owner', supabase: { from: () => q } } })).rejects.toThrow('indisponível');
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner'); expect(mocks.resolve).not.toHaveBeenCalled();
  });
});