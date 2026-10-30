// Adaptador Telegram: envio direto à API do bot. O token nunca aparece em logs, erros ou URLs registradas.
import type { AdaptadorCanal, ResultadoEnvio } from './tipos';

const TIMEOUT_MS = 15000;

interface RespostaTelegram {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
}

export async function enviarTextoTelegram(contatoExterno: string, texto: string, token: string, botoes?: { texto: string; dados: string }[]): Promise<ResultadoEnvio> {
  if (!token) return { ok: false, erro: 'Telegram não configurado.' };
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: contatoExterno, text: texto, ...(botoes?.length ? { reply_markup: { inline_keyboard: botoes.map(b => [{ text: b.texto, callback_data: b.dados }]) } } : {}) }),
      signal: controlador.signal,
    });
    const corpo = (await resposta.json().catch(() => undefined)) as RespostaTelegram | undefined;
    // Sucesso somente com "ok": true; guarda o message_id como idExterno.
    if (!resposta.ok || corpo?.ok !== true) {
      return { ok: false, erro: `Telegram recusou o envio (HTTP ${resposta.status}).` };
    }
    return { ok: true, idExterno: String(corpo.result?.message_id ?? '') };
  } catch {
    return { ok: false, erro: 'Falha de comunicação com o Telegram (tempo esgotado ou rede).' };
  } finally {
    clearTimeout(limite);
  }
}

export const telegramAdapter: AdaptadorCanal = {
  nome: 'telegram',
  enviarTexto: (contatoExterno, texto, referencia) => enviarTextoTelegram(contatoExterno, texto, referencia?.token ?? '', referencia?.botoes),
};
