// Adaptador UltraMsg (WhatsApp). Token e instância vêm só do servidor e nunca aparecem em logs ou erros.
import type { AdaptadorCanal, ResultadoEnvio } from './tipos';
import { numeroUltraMsgPermitido } from '../production-channel';

const TIMEOUT_MS = 15000;

/** Converte "5511999999999@c.us" ou "+55 (11) 99999-9999" em só dígitos. */
export function numeroWhatsApp(valor: string): string {
  return valor.replace(/@.*$/, '').replace(/\D/g, '');
}

/** Botões não existem no UltraMsg: os horários viram lista numerada para o cliente responder. */
export function textoComOpcoes(texto: string, botoes?: { texto: string }[]): string {
  if (!botoes?.length) return texto;
  return `${texto}\n\n${botoes.map((b, i) => `${i + 1}. ${b.texto}`).join('\n')}\n\nResponda com o número do horário escolhido.`;
}

export async function enviarTextoUltramsg(numero: string, texto: string, cred: { instancia: string; token: string }): Promise<ResultadoEnvio> {
  if (!numeroUltraMsgPermitido(numero)) return { ok: false, erro: 'Número não autorizado nesta fase de produção.' };
  if (!cred.instancia || !cred.token) return { ok: false, erro: 'WhatsApp não configurado.' };
  const ctrl = new AbortController();
  const limite = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`https://api.ultramsg.com/${encodeURIComponent(cred.instancia)}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: cred.token, to: `+${numeroWhatsApp(numero)}`, body: texto }).toString(),
      signal: ctrl.signal,
    });
    const corpo = (await r.json().catch(() => undefined)) as { sent?: string | boolean; id?: string | number; error?: unknown } | undefined;
    if (!r.ok || !(corpo?.sent === 'true' || corpo?.sent === true)) return { ok: false, erro: `UltraMsg recusou o envio (HTTP ${r.status}).` };
    return { ok: true, idExterno: String(corpo.id ?? '') };
  } catch {
    return { ok: false, erro: 'Falha de comunicação com o UltraMsg.' };
  } finally {
    clearTimeout(limite);
  }
}

export const ultramsgAdapter: AdaptadorCanal = {
  nome: 'ultramsg',
  enviarTexto: (contato, texto, ref) => enviarTextoUltramsg(contato, textoComOpcoes(texto, ref?.botoes), {
    instancia: process.env['ULTRAMSG_INSTANCE_ID'] ?? '',
    token: ref?.token ?? process.env['ULTRAMSG_TOKEN'] ?? '',
  }),
};
