import { describe, it, expect, beforeEach, vi } from 'vitest';
import { criarAna, conversaNova, type Conversa } from '@/lib/ana-claude/index.server';

// Quarta-feira, 28/10/2026, 10h em Brasília.
const AGORA = new Date('2026-10-28T13:00:00Z');
type Req = { url: string; init: RequestInit & { body?: string } };
let pedidos: Req[] = [];
let eventos: { id: string; summary: string; start: { dateTime: string }; end: { dateTime: string }; hangoutLink?: string }[] = [];

const resposta = (corpo: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
const json = (o: unknown) => ({ type: 'text', text: JSON.stringify({ acao: 'enviar', motivo_aprovacao: '', urgente: false, encaminhar_humano: false, dados_coletados: { nome: '', cpf: '', assunto: '', email: '' }, proximo_passo: '', ...(o as object) }) });

/** Claude simulado: responde no formato real da API (tool_use / text) conforme a mensagem do cliente. */
function claudeSimulado(body: { messages: { role: string; content: unknown }[] }) {
  const ultima = body.messages.at(-1)!;
  if (Array.isArray(ultima.content)) {
    // Voltou o resultado de uma ferramenta.
    const r = JSON.parse(String((ultima.content as { content: string }[])[0]!.content));
    if (r.linhas) return { stop_reason: 'end_turn', content: [json({ intencao: 'agendamento', mensagem: `Tenho estes livres:\n${r.linhas.join('\n')}\nQual fica melhor?` })] };
    if (r.ok) return { stop_reason: 'end_turn', content: [json({ intencao: 'agendamento', mensagem: 'Marcado!' })] }; // incompleta de propósito
    return { stop_reason: 'end_turn', content: [json({ intencao: 'outro', mensagem: 'Erro: ' + String(r) })] };
  }
  const texto = String(ultima.content);
  const msg = texto.split('MENSAGEM DO CLIENTE: ')[1] ?? '';
  const ctx = JSON.parse(texto.split('CONTEXTO ATUAL: ')[1]!.split('\n\nMENSAGEM')[0]!);
  if (/quais horários/.test(msg)) return { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '...', signature: 'x' }, { type: 'tool_use', id: 't1', name: 'buscar_horarios_livres', input: {} }] };
  if (/a primeira/.test(msg)) return { stop_reason: 'end_turn', content: [json({ intencao: 'agendamento', mensagem: 'Ótimo! Me passa seu nome completo e o e-mail?' })] };
  if (/Beatriz/.test(msg)) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'marcar_consulta', input: { inicio: ctx.horario_escolhido.inicio, nome: 'Beatriz Lima Souza', email: 'bia.souza@email.com', assunto: 'Demissão' } }] };
  return { stop_reason: 'end_turn', content: [json({ intencao: 'duvida_geral', mensagem: 'Oi! Como posso ajudar?' })] };
}

const fetchSimulado = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
  const u = String(url);
  pedidos.push({ url: u, init: init as Req['init'] });
  if (u.startsWith('https://api.anthropic.com')) return resposta(claudeSimulado(JSON.parse(String(init.body))));
  if (u.startsWith('https://oauth2.googleapis.com')) return resposta({ access_token: 'tok', expires_in: 3600 });
  if (u.includes('/events') && (init.method ?? 'GET') === 'GET') return resposta({ items: eventos });
  if (u.includes('/events') && init.method === 'POST') {
    const b = JSON.parse(String(init.body));
    const ev = { id: 'ev1', summary: b.summary, start: b.start, end: b.end, hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc' };
    eventos.push(ev);
    return resposta(ev);
  }
  if (init.method === 'DELETE') return resposta(null, 204);
  return resposta({}, 404);
});

const ana = () => criarAna({ anthropicApiKey: 'sk-teste', google: { clientId: 'id', clientSecret: 's', refreshToken: 'r' } });
beforeEach(() => { pedidos = []; eventos = [{ id: 'fixo', summary: 'Audiência', start: { dateTime: '2026-10-28T13:00:00-03:00' }, end: { dateTime: '2026-10-28T15:00:00-03:00' } }]; vi.stubGlobal('fetch', fetchSimulado); });

describe('pacote da Ana no servidor', () => {
  it('conversa completa: horários, escolha, dados e consulta marcada com Meet', async () => {
    const a = ana();
    let c: Conversa = conversaNova();
    let r = await a.responder(c, 'quais horários?', { agora: AGORA }); c = r.conversa;
    expect(r.blocos.join('\n')).toMatch(/hoje \(qua, 28\/10\) às/);
    expect(c.estado.ultimasOpcoes).toHaveLength(3);
    r = await a.responder(c, 'a primeira', { agora: AGORA }); c = r.conversa;
    expect(c.estado.escolhido).toBe(c.estado.ultimasOpcoes[0]);
    r = await a.responder(c, 'Beatriz Lima Souza, bia.souza@email.com', { agora: AGORA }); c = r.conversa;
    expect(c.estado.consulta?.meet).toBe('https://meet.google.com/aaa-bbbb-ccc');
    const confirmacao = r.blocos.join('\n');
    expect(confirmacao).toContain('Pronto, está confirmado');
    expect(confirmacao).toContain('bia.souza@email.com');
    expect(confirmacao).toContain('remarcar');
    expect(r.decisao?.ajustes).toContain('Confirmação completada pela página');
  });

  it('chama a API da Anthropic do jeito certo (modelo, chave, cache e ferramentas)', async () => {
    await ana().responder(conversaNova(), 'quais horários?', { agora: AGORA });
    const p = pedidos.find(x => x.url.startsWith('https://api.anthropic.com'))!;
    const h = p.init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-teste');
    expect(h['anthropic-version']).toBe('2023-06-01');
    const b = JSON.parse(String(p.init.body));
    expect(b.model).toBe('claude-haiku-5-5');
    expect(b.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(b.system[0].text).toContain('Você é a Ana');
    expect(b.tools.map((t: { name: string }) => t.name)).toEqual(['buscar_horarios_livres', 'horarios_do_dia', 'marcar_consulta', 'remarcar_consulta', 'cancelar_consulta']);
    expect(b.tools[0].input_schema.type).toBe('object');
    expect(b.messages[0].role).toBe('user');
    // Rodada seguinte devolve a resposta do Claude inteira (com o bloco de raciocínio) e o resultado da ferramenta.
    const segunda = JSON.parse(String(pedidos.filter(x => x.url.startsWith('https://api.anthropic.com'))[1]!.init.body));
    expect(segunda.messages.at(-2).content[0].type).toBe('thinking');
    expect(segunda.messages.at(-1).content[0].type).toBe('tool_result');
  });

  it('cria o evento no Google com Meet, convite e horário de Brasília', async () => {
    const a = ana();
    let c = conversaNova();
    for (const m of ['quais horários?', 'a primeira', 'Beatriz Lima Souza, bia.souza@email.com']) c = (await a.responder(c, m, { agora: AGORA })).conversa;
    const post = pedidos.find(x => x.init.method === 'POST' && x.url.includes('/events'))!;
    expect(post.url).toContain('conferenceDataVersion=1');
    expect(post.url).toContain('sendUpdates=all');
    const b = JSON.parse(String(post.init.body));
    expect(b.start.dateTime).toMatch(/-03:00$/);
    expect(b.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
    expect(b.attendees[0].email).toBe('bia.souza@email.com');
    expect(b.description).not.toMatch(/\d{3}\.\d{3}\.\d{3}/);
  });

  it('chave inválida vira erro claro, sem vazar detalhes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).startsWith('https://api.anthropic.com') ? resposta({ error: { message: 'segredo da conta' } }, 401) : resposta({ access_token: 't' })));
    await expect(ana().responder(conversaNova(), 'oi', { agora: AGORA })).rejects.toMatchObject({ code: 'chave_invalida' });
  });

  it('agenda fora do ar: a Ana avisa o cliente e a equipe, sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const u = String(url);
      if (u.startsWith('https://api.anthropic.com')) {
        const b = JSON.parse(String(init.body));
        const ult = b.messages.at(-1);
        if (Array.isArray(ult.content)) return resposta({ stop_reason: 'end_turn', content: [json({ intencao: 'agendamento', encaminhar_humano: true, mensagem: 'Não consegui ver a agenda agora. Deixei registrado e a equipe vai te chamar para marcar.' })] });
        return resposta({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'buscar_horarios_livres', input: {} }] });
      }
      if (u.startsWith('https://oauth2.googleapis.com')) return resposta({ access_token: 'tok' });
      return resposta({}, 503);
    }));
    const r = await ana().responder(conversaNova(), 'quais horários?', { agora: AGORA });
    expect(r.blocos.join(' ')).toContain('equipe');
    expect(r.avisouEquipe).toBe(true);
  });
});
