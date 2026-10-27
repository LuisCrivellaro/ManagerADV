import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  configPadrao, decidirEnvio, validarTextoEnvio, podeGerenciarCanal,
  sanitizarConfig, mascararContato, etiquetaAcao, type CanalConfig,
} from '@/lib/atendimento/canal-envio';
import { enviarTextoTelegram } from '@/lib/atendimento/canais/telegram';

const telegram: CanalConfig = { ...configPadrao, canal_ativo: 'telegram' };
const liberado = { status: 'liberado' as const };

describe('decisão de envio', () => {
  it('canal desligado não faz chamada externa (simulado)', () => {
    expect(decidirEnvio(configPadrao, null)).toEqual({ permitido: true, simulado: true });
  });
  it('Telegram envia só para contato liberado', () => {
    expect(decidirEnvio(telegram, liberado)).toEqual({ permitido: true, simulado: false });
    expect(decidirEnvio(telegram, null).permitido).toBe(false);
  });
  it('WhatsApp envia só para contato liberado', () => {
    expect(decidirEnvio({ ...configPadrao, canal_ativo: 'ultramsg' }, liberado).permitido).toBe(true);
    expect(decidirEnvio({ ...configPadrao, canal_ativo: 'ultramsg' }, null).permitido).toBe(false);
  });
});

describe('validação do texto no servidor', () => {
  it('bloqueia texto vazio', () => {
    expect(validarTextoEnvio('   ')).toBe('A mensagem está vazia.');
  });
  it('bloqueia campos {entre_chaves} não preenchidos', () => {
    expect(validarTextoEnvio('Olá, sua consulta é {data}')).toBe('Preencha todos os campos entre chaves antes de enviar.');
  });
  it('bloqueia "Link não registrado" em qualquer forma', () => {
    expect(validarTextoEnvio('link NÃO registrado')).toBe('Registre o link do contrato antes de enviar.');
  });
  it('aceita mensagem pronta', () => {
    expect(validarTextoEnvio('Olá, tudo bem?')).toBeNull();
  });
});

describe('permissões e configuração', () => {
  it('perfil sem permissão não altera a configuração', () => {
    expect(podeGerenciarCanal(['atendente'])).toBe(false);
    expect(podeGerenciarCanal(['operacoes'])).toBe(false);
    expect(podeGerenciarCanal(['advogada_senior'])).toBe(true);
    expect(podeGerenciarCanal(['admin'])).toBe(true);
  });
  it('Telegram reativado como canal de teste, sempre em modo teste', () => {
    const c = sanitizarConfig({ canal_ativo: 'telegram', modo_teste: false, agente_ativo: true, fonte_sugestoes: 'agente' });
    expect(c).toEqual({ canal_ativo: 'telegram', modo_teste: true, agente_ativo: true, fonte_sugestoes: 'agente' });
    expect(sanitizarConfig({canal_ativo:'desligado',agente_ativo:true}).agente_ativo).toBe(false);
    expect(sanitizarConfig({ canal_ativo: 'ultramsg' }).canal_ativo).toBe('ultramsg');
  });
  it('etiquetas das ações: real no WhatsApp e no Telegram', () => {
    expect(etiquetaAcao('enviarMensagem', telegram)).toBe('Real (Telegram)');
    expect(etiquetaAcao('enviarMensagem', { ...configPadrao, canal_ativo: 'ultramsg' })).toBe('Real (WhatsApp)');
    expect(etiquetaAcao('gerarCobranca', telegram)).toBe('Simulado');
    expect(etiquetaAcao('enviarMensagem', configPadrao)).toBe('Simulado');
  });
  it('mascara o chat_id', () => {
    expect(mascararContato('123456789')).toBe('••••6789');
  });
});

describe('adaptador Telegram', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sucesso só com ok:true e guarda o message_id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 })));
    const r = await enviarTextoTelegram('123456', 'olá', 'token-secreto');
    expect(r).toEqual({ ok: true, idExterno: '42' });
  });
  it('o token nunca aparece nas mensagens de erro', async () => {
    const token = '999:TOKEN-SUPER-SECRETO';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, description: `Bad Request: token ${token} inválido` }), { status: 400 })));
    const erro = await enviarTextoTelegram('123456', 'olá', token);
    expect(erro.ok).toBe(false);
    expect(erro.erro).not.toContain(token);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`network failed for ${token}`)));
    const falha = await enviarTextoTelegram('123456', 'olá', token);
    expect(falha.ok).toBe(false);
    expect(falha.erro).not.toContain(token);
  });
  it('falha no envio devolve ok:false (quem chama não grava a mensagem)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    // ok:true sem message_id ainda é sucesso; HTTP 200 com ok:false não é.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 200 })));
    const r = await enviarTextoTelegram('123456', 'olá', 'token');
    expect(r.ok).toBe(false);
  });
});
