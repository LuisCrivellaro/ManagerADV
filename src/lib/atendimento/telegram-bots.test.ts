import { describe, expect, it } from 'vitest';
import { destinoTelegram, lerDestinoTelegram } from './telegram-bots';

describe('dois bots no mesmo Telegram de teste', () => {
  it('mantém o destino do primeiro bot inalterado', () => {
    expect(destinoTelegram('principal', '839854097')).toBe('839854097');
  });
  it('isola o segundo bot mesmo com o mesmo chat_id', () => {
    expect(destinoTelegram('segundo', '839854097')).toBe('bot2:839854097');
    expect(lerDestinoTelegram('bot2:839854097')).toEqual({ bot: 'segundo', chatId: '839854097' });
  });
  it('recusa destinos inválidos em vez de trocar o bot', () => {
    expect(() => lerDestinoTelegram('bot3:839854097')).toThrow();
  });
});