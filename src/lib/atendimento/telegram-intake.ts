import { z } from 'zod';
import { telefoneAgenda, telefoneCanalAgenda } from './intake-rules';

export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z.object({
    message_id: z.number().int().nonnegative(),
    from: z.object({ id: z.number().int(), is_bot: z.boolean().optional() }).optional(),
    chat: z.object({ id: z.number().int(), type: z.string() }),
    text: z.string().max(16000).optional(),
    caption: z.string().max(16000).optional(),
    photo: z.array(z.object({ file_id: z.string() })).optional(),
    document: z.object({ file_name: z.string().max(300).optional() }).optional(),
    voice: z.object({ file_id: z.string() }).optional(),
  }).optional(),
});

/** Telegram test phone is the explicitly released contact, never the linked case's identity. */
export function telefoneRemetenteAna(canal: 'telegram' | 'ultramsg', contato: { contato_externo: string; telefone_ficticio?: string } | undefined, messageId: string) {
  if (!contato || !messageId.startsWith(`${canal}:${contato.contato_externo}:`)) return undefined;
  return canal === 'ultramsg' ? telefoneCanalAgenda(contato.contato_externo, messageId) : telefoneAgenda(contato.telefone_ficticio);
}

export function mensagemTelegram(update: unknown) {
  const parsed = telegramUpdateSchema.safeParse(update);
  if (!parsed.success) return undefined;
  const m = parsed.data.message;
  if (!m || m.chat.type !== 'private' || m.from?.is_bot || m.from?.id !== m.chat.id) return undefined;
  const arquivo = m.photo?.length ? '[imagem recebida pelo Telegram; conteúdo não analisado]' : m.document ? '[documento recebido pelo Telegram; conteúdo não analisado]' : m.voice ? '[áudio recebido pelo Telegram; sem transcrição]' : undefined;
  if (!m.text?.trim() && !m.caption?.trim() && !arquivo) return undefined;
  return { chatId: String(m.chat.id), idExterno: String(m.message_id), texto: m.text ?? m.caption ?? '', arquivo };
}