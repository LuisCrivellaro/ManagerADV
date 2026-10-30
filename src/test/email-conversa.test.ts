import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Conversa } from '@/lib/mock-data';
import { emailDaMensagem, solicitarEmailPendente } from '@/lib/atendimento/email-rules';
import { registrarEmailConversa } from '@/lib/atendimento/email.server';
import { aplicarRegrasAna, type AnaResult } from '@/lib/atendimento/ana-rules';

function fixture(aprovado = false) {
  let caso = { mensagens: [{ id: 'email-1', de: 'cliente', texto: 'Meu e-mail é Cliente@Example.com', hora: '10:00' }], timeline: [] } as unknown as Conversa;
  const item = { id: 'email-item', nome: 'E-mail', recebido: false };
  const updates: Record<string, unknown>[] = [];
  const scopes: unknown[][] = [];
  const db = { rpc: async () => ({ error: null, data: { checklist: aprovado } }), from(table: string) {
    let patch: any;
    const result = () => {
      if (table === 'casos') { if (patch) { caso = patch.dados; return { error: null, data: [{ id: 'caso' }] }; } return { error: null, data: { dados: caso, updated_at: 'revision' } }; }
      if (patch) { item.recebido = patch.recebido; updates.push(patch); }
      return { error: null, data: [{ ...item }] };
    };
    const q: any = { select: () => q, eq: (...args: unknown[]) => { scopes.push([table, ...args]); return q; }, update: (p: any) => { patch = p; return q; }, single: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve) };
    return q;
  } };
  return { db: db as unknown as SupabaseClient<Database>, get caso() { return caso; }, item, updates, scopes };
}

describe('e-mail informado na conversa', () => {
  afterEach(() => vi.restoreAllMocks());
  it('reconhece endereço válido escrito pelo cliente sem exigir anexo', () => {
    expect(emailDaMensagem({ de: 'cliente', texto: 'Meu email: Cliente@Example.com' })).toBe('cliente@example.com');
    expect(emailDaMensagem({ de: 'cliente', texto: 'cliente@' })).toBeUndefined();
  });
  it('não usa e-mail do escritório, ambíguo, negado ou de outra pessoa', () => {
    expect(emailDaMensagem({ de: 'escritorio', texto: 'contato@example.com' })).toBeUndefined();
    expect(emailDaMensagem({ de: 'cliente', texto: 'a@example.com ou b@example.com' })).toBeUndefined();
    expect(emailDaMensagem({ de: 'cliente', texto: 'Não use a@example.com' })).toBeUndefined();
    expect(emailDaMensagem({ de: 'cliente', texto: 'email do meu marido: a@example.com' })).toBeUndefined();
  });
  it('salva cadastro e dados da Ana, marca item real do proprietário e não duplica', async () => {
    const f = fixture();
    await registrarEmailConversa(f.db, 'caso', 'owner', 'email-1');
    await registrarEmailConversa(f.db, 'caso', 'owner', 'email-1');
    expect(f.caso.email).toBe('cliente@example.com');
    expect(f.caso.agenteAna?.dados?.email).toBe('cliente@example.com');
    expect(f.item.recebido).toBe(true); expect(f.updates).toHaveLength(1);
    expect(f.scopes).toContainEqual(['checklist_itens', 'owner_id', 'owner']);
    expect(f.scopes).toContainEqual(['casos', 'owner_id', 'owner']);
    expect(f.caso.timeline).toHaveLength(1);
  });
  it('checklist aprovado mantém item pendente para confirmação, sem perder cadastro', async () => {
    const f = fixture(true);
    const r = await registrarEmailConversa(f.db, 'caso', 'owner', 'email-1');
    expect(f.caso.email).toBe('cliente@example.com');
    expect(f.item.recebido).toBe(false); expect(f.updates).toHaveLength(0);
    expect(r.pendencia).toContain('confirmação');
  });
  it('Ana solicita e-mail faltante, mas não cobra novamente o já cadastrado', () => {
    expect(solicitarEmailPendente([{ nome: 'E-mail', recebido: false }])).toBe(true);
    expect(solicitarEmailPendente([{ nome: 'E-mail', recebido: false }], 'cliente@example.com')).toBe(false);
    expect(solicitarEmailPendente([{ nome: 'E-mail', recebido: true }])).toBe(false);
    expect(solicitarEmailPendente([{ nome: 'Provas (e-mails)', recebido: false }])).toBe(false);
  });
  it('solicita dado sem anexo em Automática; Sugerir/Desligada e pergunta recente continuam protegidos', () => {
    const r: AnaResult = { acao: 'enviar', mensagem: 'Obrigada pelo documento.', motivo_aprovacao: '', intencao: 'documento', urgente: false, encaminhar_humano: false, dados_coletados: { nome: '', cpf: '', assunto: '', email: '' }, proximo_passo: '' };
    expect(aplicarRegrasAna(r, 'Automática', 'enviei', [], { emailPendente: true }).mensagem).toContain('qual é o seu e-mail?');
    expect(aplicarRegrasAna(r, 'Sugerir', 'enviei', [], { emailPendente: true }).acao).toBe('rascunho');
    expect(aplicarRegrasAna(r, 'Desligada', 'enviei', [], { emailPendente: true }).acao).toBe('nenhuma');
    expect(aplicarRegrasAna(r, 'Automática', 'enviei', [], { emailPendente: true, ultimaResposta: 'Qual é seu e-mail?' }).mensagem).not.toContain('qual é o seu e-mail?');
    expect(aplicarRegrasAna(r, 'Automática', 'Quero falar com uma pessoa', [], { emailPendente: true }).encaminhar_humano).toBe(true);
  });
});