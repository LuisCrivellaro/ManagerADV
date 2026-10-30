export type TelegramBot = 'principal' | 'segundo';

export function destinoTelegram(bot: TelegramBot, chatId: string): string {
  if (!/^-?\d+$/.test(chatId)) throw new Error('Informe um chat_id numérico.');
  return bot === 'segundo' ? `bot2:${chatId}` : chatId;
}

export function lerDestinoTelegram(destino: string): { bot: TelegramBot; chatId: string } {
  const bot = destino.startsWith('bot2:') ? 'segundo' : 'principal';
  const chatId = bot === 'segundo' ? destino.slice(5) : destino;
  destinoTelegram(bot, chatId);
  return { bot, chatId };
}