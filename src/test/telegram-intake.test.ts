import { describe, expect, it } from 'vitest';
import { mensagemTelegram, telefoneRemetenteAna } from '@/lib/atendimento/telegram-intake';

describe('entrada Telegram de teste', () => {
  const update = { update_id: 42, message: { message_id: 7, from: { id: 839854097 }, chat: { id: 839854097, type: 'private' }, text: 'oi' } };
  it('aceita apenas mensagem privada do próprio remetente', () => {
    expect(mensagemTelegram(update)?.chatId).toBe('839854097');
    expect(mensagemTelegram({ ...update, message: { ...update.message, chat: { ...update.message.chat, type: 'group' } } })).toBeUndefined();
    expect(mensagemTelegram({ ...update, message: { ...update.message, from: { id: 123 } } })).toBeUndefined();
  });
  it('recusa atualização inválida', () => { expect(mensagemTelegram({ message: update.message })).toBeUndefined(); });
  it('não afirma análise ou armazenamento de anexos', () => {
    expect(mensagemTelegram({ ...update, message: { ...update.message, text: undefined, photo: [{ file_id: 'photo' }] } })?.arquivo).toContain('conteúdo não analisado');
  });
  it('usa só telefone explicitamente liberado do teste e identidade da mensagem', () => {
    const contato = { contato_externo: '839854097', telefone_ficticio: '5511999600306' };
    expect(telefoneRemetenteAna('telegram', contato, 'telegram:839854097:7')).toBe('5511999600306');
    expect(telefoneRemetenteAna('telegram', contato, 'telegram:123:7')).toBeUndefined();
    expect(telefoneRemetenteAna('telegram', { contato_externo: '839854097' }, 'telegram:839854097:7')).toBeUndefined();
  });
});