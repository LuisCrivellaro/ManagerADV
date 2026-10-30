import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ analisar: vi.fn(), ana: vi.fn(), db: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } }, save: vi.fn() }));
vi.mock('@/lib/atendimento/email.server', () => ({ registrarEmailConversa: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: mocks.db }));
vi.mock('@/lib/documentos.server', () => ({ analisarAnexoDoCaso: mocks.analisar }));
vi.mock('@/lib/atendimento/ana.server', () => ({ atualizarConversa: mocks.save, processarAna: mocks.ana }));
import { Route } from '@/routes/api/public/atendimento/whatsapp';

describe('documentos recebidos pelo WhatsApp', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it('guarda original, aciona análise automaticamente e ignora reentrega', async () => {
    vi.stubEnv('ULTRAMSG_WEBHOOK_SECRET', 'test-secret'); vi.stubEnv('ULTRAMSG_INSTANCE_ID', 'test-instance');
    let conversa: any = { mensagens: [], timeline: [] };
    mocks.db.rpc.mockResolvedValue({ error: null });
    mocks.db.storage.from.mockReturnValue({ upload: vi.fn(async () => ({ error: null })) });
    mocks.db.from.mockImplementation((table: string) => {
      const value = () => ({ error: null, data: table === 'atendimento_canal_config' ? { canal_ativo: 'ultramsg' } : table === 'atendimento_contatos_teste' ? [{ id: 'contato', conversa_id: 'caso', contato_externo: '5511999600306', status: 'liberado' }] : table === 'casos' ? { id: 'caso', owner_id: 'owner', dados: conversa } : null });
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => value(), then: (resolve: any) => Promise.resolve(value()).then(resolve) };
      return q;
    });
    mocks.save.mockImplementation(async (_db: unknown, _id: string, fn: (x: any) => any) => { conversa = fn(conversa); return conversa; });
    mocks.analisar.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1,2,3]), { headers: { 'content-type': 'image/png' } })));
    const post = (Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
    const request = () => new Request('http://localhost:8080/api/public/atendimento/whatsapp?s=test-secret', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event_type: 'message_received', data: { id: 'arquivo-1', from: '5511999600306@c.us', type: 'image', media: 'https://example.test/rg.png', filename: 'rg.png' } }) });
    expect((await post({ request: request() })).status).toBe(200);
    expect(conversa.mensagens[0]?.path).toMatch(/^owner\/caso\//);
    expect(mocks.analisar).toHaveBeenCalledWith(mocks.db, 'caso', 'owner', 'ultramsg:5511999600306:arquivo-1');
    expect((await post({ request: request() })).status).toBe(200);
    expect(mocks.analisar).toHaveBeenCalledOnce(); expect(conversa.mensagens).toHaveLength(1);
  });
});