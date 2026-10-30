// Adaptador UltraMsg (WhatsApp). Token e instância vêm só do servidor e nunca aparecem em logs ou erros.
import type { AdaptadorCanal, ResultadoEnvio } from './tipos';
import { numeroUltraMsgPermitido } from '../production-channel';
import { chaveTelefone } from '../../projuris/telefone';

const TIMEOUT_MS = 15000;

/** Converte "5511999999999@c.us" ou "+55 (11) 99999-9999" em só dígitos. */
export function numeroWhatsApp(valor: string): string {
  return valor.replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * O horário já aparece no texto? Procura uma linha com a data (dd/mm) cujo primeiro horário (9h, 9h30) é o início,
 * em Brasília. Só o primeiro conta: em "9h30 às 10h", o "10h" é o fim de outro horário, não uma opção.
 */
function horarioNoTexto(texto: string, iso: string): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const data = `${p['day']}/${p['month']}`;
  const inicio = `${Number(p['hour'])}h${p['minute'] === '00' ? '' : p['minute']}`;
  return texto.split('\n').some(linha => linha.includes(data) && /(?<!\d)\d{1,2}h(?:\d{2})?(?!\d)/.exec(linha)?.[0] === inicio);
}

/**
 * Listas interativas e botões não existem no UltraMsg (documentação oficial conferida em 29/10/2026).
 * Os horários vão uma única vez, com marcadores e sem número; o cliente responde com dia, hora ou ordem.
 * Se o texto já traz um horário, ele não é repetido; os que faltarem entram ao final como marcadores.
 */
export function textoComOpcoes(texto: string, botoes?: { texto: string; dados?: string }[]): string {
  if (!botoes?.length) return texto;
  const faltam = botoes.filter(b => {
    const iso = b.dados?.startsWith('slot:') ? b.dados.slice('slot:'.length) : undefined;
    return !iso || !horarioNoTexto(texto, iso);
  });
  if (!faltam.length) return texto;
  return `${texto}\n\n${faltam.map(b => `• ${b.texto.replace(/^🗓️\s*/u, '')}`).join('\n')}`;
}

export async function enviarTextoUltramsg(numero: string, texto: string, cred: { instancia: string; token: string }): Promise<ResultadoEnvio> {
  if (!numeroUltraMsgPermitido(numero)) return { ok: false, erro: 'Número não autorizado nesta fase de produção.' };
  return enviarSemLista(numero, texto, cred);
}

/**
 * Envio à revisora configurada no servidor (REVISORA_WHATSAPP): a única exceção à lista de números liberados.
 * Só aceita o número do segredo; clientes continuam passando por enviarTextoUltramsg.
 */
export async function enviarTextoRevisora(texto: string, env: Record<string, string | undefined> = process.env): Promise<ResultadoEnvio> {
  const revisora = env['REVISORA_WHATSAPP']?.trim() ?? '';
  if (!chaveTelefone(revisora)) return { ok: false, erro: 'Revisora não configurada.' };
  return enviarSemLista(revisora, texto, { instancia: env['ULTRAMSG_INSTANCE_ID']?.trim() ?? '', token: env['ULTRAMSG_TOKEN']?.trim() ?? '' });
}

async function enviarSemLista(numero: string, texto: string, cred: { instancia: string; token: string }): Promise<ResultadoEnvio> {
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
