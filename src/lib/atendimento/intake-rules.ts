import type { Conversa } from '../mock-data';

export type EtiquetaAcao = 'AC' | 'RT' | 'sem';
export type TipoCliente = 'novo' | 'cadastrado';
export const etiquetasAcao = { AC: 'AC · Ação Civil / Família', RT: 'RT · Relação trabalhista', sem: 'Sem etiqueta' };
function normalizar(texto: string) { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function detectarOrigem(texto: string): Exclude<EtiquetaAcao, 'sem'> | undefined {
  const n = normalizar(texto);
  const ac = n.includes(normalizar('Olá Dra. Carolina, gostaria de agendar uma consulta gratuita.'));
  const rt = n.includes(normalizar('Olá Dra. Carolina! Gostaria de mais informações.'));
  return ac === rt ? undefined : ac ? 'AC' : 'RT';
}
/** Uma escolha manual, inclusive “sem”, tem prioridade sobre a origem da campanha. */
export function etiquetaConversa(c: Pick<Conversa, 'mensagens' | 'etiquetaAcao'>): EtiquetaAcao {
  if (c.etiquetaAcao) return c.etiquetaAcao;
  // O Telegram de teste não herda a classificação das mensagens fictícias do caso vinculado.
  const mensagens = c.mensagens.some(m => m.canal === 'telegram') ? c.mensagens.filter(m => m.canal === 'telegram') : c.mensagens;
  return detectarOrigem(mensagens.find(m => m.de === 'cliente' && m.texto.trim())?.texto ?? '') ?? 'sem';
}
export function classificarEntrada(c: Conversa): Conversa {
  const etiqueta = etiquetaConversa(c);
  return c.etiquetaAcao || etiqueta === 'sem' ? c : { ...c, etiquetaAcao: etiqueta };
}
/** Autodeclaração só define a carteira de agenda, nunca comprova identidade ou acesso jurídico. */
export function identificarTipoCliente(texto: string): TipoCliente | undefined {
  const n = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/nao sou cliente|ainda nao sou cliente|primeir[oa] (?:contato|consulta|vez)|sou nov[oa] cliente/.test(n) || detectarOrigem(texto)) return 'novo';
  if (/ja sou cliente|sou cliente (?:do escritorio|da dra|da doutora)|ja (?:tenho|possuo) (?:cadastro|processo)|ja estou cadastrad[oa]/.test(n)) return 'cadastrado';
  return undefined;
}
export function telefoneAgenda(telefone: string | undefined) {
  const digits = (telefone ?? '').replace(/\D/g, '');
  return /^\d{10,13}$/.test(digits) ? digits : undefined;
}

/** Usa apenas o remetente liberado desta mensagem, nunca o cadastro do caso vinculado. */
export function telefoneCanalAgenda(contato: string | undefined, messageId: string) {
  if (!contato || !messageId.startsWith(`ultramsg:${contato}:`)) return undefined;
  return telefoneAgenda(contato.replace(/@.*$/, ''));
}