import { afterEach, describe, expect, it, vi } from 'vitest';
import { decidirEntradaWhatsApp, destinoIgnoradoWhatsApp, mensagemDoSistema, novaConversaWhatsApp } from '@/lib/atendimento/entrada-whatsapp';

describe('regras da entrada do WhatsApp do escritório', () => {
  it('bloqueado nunca é atendido; entrada fechada só atende liberados', () => {
    expect(decidirEntradaWhatsApp({ status: 'bloqueado', conversa_id: 'c' }, true)).toBe('bloqueado');
    expect(decidirEntradaWhatsApp({ status: 'liberado', conversa_id: 'c' }, false)).toBe('atender');
    expect(decidirEntradaWhatsApp(undefined, false)).toBe('ignorar');
    expect(decidirEntradaWhatsApp(undefined, true)).toBe('criar');
    expect(decidirEntradaWhatsApp({ status: 'aguardando_liberacao', conversa_id: null }, true)).toBe('liberar');
    expect(decidirEntradaWhatsApp({ status: 'liberado', conversa_id: null }, true)).toBe('liberar');
  });
  it('grupos, transmissões e status são ignorados', () => {
    expect(destinoIgnoradoWhatsApp('1203630@g.us')).toBe(true);
    expect(destinoIgnoradoWhatsApp('status@broadcast')).toBe(true);
    expect(destinoIgnoradoWhatsApp('5511999600306@c.us')).toBe(false);
  });
  it('nova conversa usa o nome do perfil só como rótulo e começa na etapa inicial', () => {
    const n = novaConversaWhatsApp('12345678-aaaa-bbbb-cccc-000000000000', '5511999600306', 'Maria\u0007', new Date('2026-10-27T21:00:00Z'));
    expect(n.nome).toBe('Maria');
    expect(n.dados).toMatchObject({ modoIA: 'Automática', telefone: '5511999600306', etapa: 'inicial', etapaPipeline: 0, mensagens: [], origem: 'whatsapp' });
    expect(novaConversaWhatsApp('12345678-x', '11999990001', '').nome).toMatch(/^WhatsApp /);
  });
  it('reconhece mensagens do sistema, inclusive com a lista numerada do UltraMsg, e não confunde resposta curta', () => {
    const agora = new Date('2026-10-27T21:00:00Z');
    const conversa = { mensagens: [{ de: 'escritorio' as const, texto: 'Claro! Seguem os horários livres para a sua consulta online e gratuita:\n\n🗓️ Consulta online', dataHora: '2026-10-27T20:59:00Z' }] };
    expect(mensagemDoSistema('Claro! Seguem os horários livres para a sua consulta online e gratuita:\n\n🗓️ Consulta online\n\n1. Qua\n\nResponda com o número do horário escolhido.', conversa, agora)).toBe(true);
    expect(mensagemDoSistema('Claro', conversa, agora)).toBe(false);
    expect(mensagemDoSistema('Oi Maria, aqui é a Dra. Carolina. Posso te ligar?', conversa, agora)).toBe(false);
    expect(mensagemDoSistema('Resposta em preparo', { mensagens: [], agenteAna: { resultado: { mensagem: 'Resposta em preparo' } } }, agora)).toBe(true);
    expect(mensagemDoSistema('Claro! Seguem os horários livres para a sua consulta online e gratuita:\n\n🗓️ Consulta online', conversa, new Date('2026-10-27T22:00:00Z'))).toBe(false);
  });
});

const mocks = vi.hoisted(() => ({ ana: vi.fn(), save: vi.fn(), dona: vi.fn(), abrir: vi.fn(), erroContatos: false, contatos: [] as Record<string, unknown>[], conversa: { mensagens: [] as Record<string, unknown>[], timeline: [] as unknown[], agenteAna: {} as Record<string, unknown> }, rpc: vi.fn() }));
vi.mock('@/lib/atendimento/email.server', () => ({ registrarEmailConversa: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/lib/atendimento/ana.server', () => ({ atualizarConversa: mocks.save, processarAna: mocks.ana }));
vi.mock('@/lib/atendimento/entrada-whatsapp.server', () => ({ donaEntradaWhatsApp: mocks.dona, abrirConversaWhatsApp: mocks.abrir }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  rpc: mocks.rpc,
  from: (table: string) => {
    const value = () => ({ error: table === 'atendimento_contatos_teste' && mocks.erroContatos ? { message: 'unavailable' } : null, data: table === 'atendimento_canal_config' ? { canal_ativo: 'ultramsg' } : table === 'atendimento_contatos_teste' ? mocks.contatos : table === 'casos' ? { id: 'caso', owner_id: 'dona', dados: mocks.conversa } : null });
    const q: Record<string, unknown> = { select: () => q, eq: () => q, maybeSingle: async () => value(), then: (resolve: (v: unknown) => unknown) => Promise.resolve(value()).then(resolve) };
    return q;
  },
} }));
import { Route } from '@/routes/api/public/atendimento/whatsapp';

const post = (Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
const enviar = (corpo: unknown) => post({ request: new Request('http://localhost:8080/api/public/atendimento/whatsapp?s=segredo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }) });

describe('webhook do WhatsApp do escritório', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); mocks.erroContatos = false; mocks.contatos = []; mocks.conversa = { mensagens: [], timeline: [], agenteAna: {} }; });
  const preparar = () => {
    vi.stubEnv('ULTRAMSG_WEBHOOK_SECRET', 'segredo'); vi.stubEnv('ULTRAMSG_INSTANCE_ID', 'inst'); vi.stubEnv('WHATSAPP_ESPERA_MANUAL_MS', '0');
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.save.mockImplementation(async (_db: unknown, _id: string, fn: (x: unknown) => typeof mocks.conversa) => { mocks.conversa = fn(mocks.conversa); return mocks.conversa; });
  };

  it('falha ao ler bloqueios não cria nem libera contatos ou aciona Ana', async () => {
    preparar();
    mocks.erroContatos = true;
    const r = await enviar({ event_type: 'message_received', data: { id: 'falha', from: '5511942074361@c.us', body: 'oi' } });
    expect(r.status).toBe(503);
    expect(mocks.abrir).not.toHaveBeenCalled();
    expect(mocks.ana).not.toHaveBeenCalled();
  });

  it('número novo com a entrada aberta ganha conversa e a Ana responde', async () => {
    preparar();
    mocks.dona.mockResolvedValue({ ownerId: 'dona' });
    mocks.abrir.mockImplementation(async () => { mocks.contatos = [{ id: 'novo', conversa_id: 'caso', contato_externo: '5511942074361', status: 'liberado' }]; return { conversaId: 'caso' }; });
    expect((await enviar({ event_type: 'message_received', data: { id: 'm1', from: '5511942074361@c.us', body: 'Olá Dra. Carolina, gostaria de agendar uma consulta gratuita.', pushname: 'Joana' } })).status).toBe(200);
    expect(mocks.abrir).toHaveBeenCalledWith(expect.anything(), 'dona', '5511942074361', 'Joana', undefined, true);
    expect(mocks.ana).toHaveBeenCalledWith(expect.anything(), 'caso', 'ultramsg:5511942074361:m1', expect.anything());
  });

  it('entrada aberta: número fora da lista ganha conversa e a Ana responde', async () => {
    preparar(); mocks.dona.mockResolvedValue({ ownerId: 'dona' });
    mocks.abrir.mockImplementation(async () => { mocks.contatos = [{ id: 'novo', conversa_id: 'caso', contato_externo: '5511900000000', status: 'liberado' }]; return { conversaId: 'caso' }; });
    expect((await enviar({ event_type: 'message_received', data: { id: 'fora', from: '5511900000000@c.us', body: 'oi', pushname: 'Cliente Novo' } })).status).toBe(200);
    expect(mocks.abrir).toHaveBeenCalledWith(expect.anything(), 'dona', '5511900000000', 'Cliente Novo', undefined, true);
    expect(mocks.ana).toHaveBeenCalledWith(expect.anything(), 'caso', 'ultramsg:5511900000000:fora', expect.anything());
  });

  it('entrada fechada ou configuração indisponível: número fora da lista é ignorado', async () => {
    preparar(); mocks.dona.mockResolvedValue({ motivo: 'Entrada de novos contatos fechada' });
    await enviar({ event_type: 'message_received', data: { id: 'fora1', from: '5511900000000@c.us', body: 'oi' } });
    mocks.dona.mockRejectedValue(new Error('Configuração de entrada indisponível'));
    await enviar({ event_type: 'message_received', data: { id: 'fora2', from: '5511900000000@c.us', body: 'oi' } });
    expect(mocks.abrir).not.toHaveBeenCalled(); expect(mocks.ana).not.toHaveBeenCalled();
  });

  it('entrada fechada ou contato bloqueado: nada é criado e a Ana não responde', async () => {
    preparar();
    mocks.dona.mockResolvedValue({ motivo: 'Entrada de novos contatos fechada' });
    await enviar({ event_type: 'message_received', data: { id: 'm2', from: '5511999990003@c.us', body: 'oi' } });
    mocks.contatos = [{ id: 'b', conversa_id: 'caso', contato_externo: '5511999990004', status: 'bloqueado' }];
    mocks.dona.mockResolvedValue({ ownerId: 'dona' });
    await enviar({ event_type: 'message_received', data: { id: 'm3', from: '5511999990004@c.us', body: 'oi' } });
    expect(mocks.abrir).not.toHaveBeenCalled();
    expect(mocks.ana).not.toHaveBeenCalled();
  });

  it('resposta da equipe pelo celular pausa a Ana só naquela conversa', async () => {
    preparar();
    mocks.contatos = [{ id: 'c', conversa_id: 'caso', contato_externo: '5511999600306', status: 'liberado' }];
    const r = await enviar({ event_type: 'message_create', data: { id: 'eu1', from: '5511900000000@c.us', to: '5511999600306@c.us', fromMe: true, body: 'Oi, aqui é a Dra. Carolina. Te ligo em 5 minutos.' } });
    expect(await r.json()).toMatchObject({ pausada: true });
    expect(mocks.conversa.agenteAna).toMatchObject({ humano: true });
    expect(mocks.conversa.mensagens.at(-1)).toMatchObject({ de: 'escritorio', autor: 'Equipe · celular do escritório', id: 'ultramsg:5511999600306:eu1' });
    expect(mocks.ana).not.toHaveBeenCalled();
  });

  it('mensagem enviada pela própria Ana não pausa nada', async () => {
    preparar();
    mocks.contatos = [{ id: 'c', conversa_id: 'caso', contato_externo: '5511999600306', status: 'liberado' }];
    mocks.conversa = { mensagens: [{ de: 'escritorio', texto: 'Qual é seu nome completo?', dataHora: new Date().toISOString() }], timeline: [], agenteAna: {} };
    const r = await enviar({ event_type: 'message_create', data: { id: 'eu2', from: '5511900000000@c.us', to: '5511999600306@c.us', fromMe: true, body: 'Qual é seu nome completo?' } });
    expect(await r.json()).toMatchObject({ sistema: true });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('mensagem do escritório para número fora do Manager é ignorada sem registro', async () => {
    preparar();
    const r = await enviar({ event_type: 'message_create', data: { id: 'eu3', from: '5511900000000@c.us', to: '5511988887777@c.us', fromMe: true, body: 'Oi!' } });
    expect(await r.json()).toMatchObject({ ignorado: true });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
