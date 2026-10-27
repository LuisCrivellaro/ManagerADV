import type { Conversa } from '../mock-data';

/** O padrão inicial não substitui modo explícito, pausa ou tomada humana. */
export function iniciarAtendimentoAutomatico(c: Conversa): Conversa {
  if (c.modoIA || c.agenteAna?.pausa || c.agenteAna?.humano || c.mensagens.some(m => m.de === 'escritorio')) return c;
  return { ...c, modoIA: 'Automática' };
}