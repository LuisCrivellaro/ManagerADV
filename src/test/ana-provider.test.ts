import { afterEach, describe, expect, it, vi } from 'vitest';
import { gerarRespostaAna } from '@/lib/atendimento/ana.functions';

const result = {
  acao: 'enviar', intencao: 'agendamento', mensagem: 'Qual o seu nome completo?',
  motivo_aprovacao: '', urgente: false, encaminhar_humano: false,
  dados_coletados: { nome: '', cpf: '', assunto: '', email: '' }, proximo_passo: 'Aguardar nome',
};

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Provedor da Ana', () => {
  it('usa Anthropic direto sem chave ou chamadas de IA Lovable', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'credential-for-test');
    vi.stubEnv('LOVABLE_API_KEY', '');
    vi.stubEnv('ANA_MODELO', '');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(result) }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await gerarRespostaAna(new Request('https://app.test'), { modo_ia: 'Automática' }, 'Treinamento privado')).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.system[0].text).toContain('Treinamento privado');
    expect(body.tools).toBeUndefined();
  });

  it('não recorre ao gateway quando a Anthropic recusa a chave', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'credential-for-test');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: {} }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(gerarRespostaAna(new Request('https://app.test'), {}, '')).rejects.toMatchObject({ code: 'chave_invalida' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});