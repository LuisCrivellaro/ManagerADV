// Regras puras da entrada do WhatsApp do escritório: quem a Ana atende e como reconhecer resposta manual pelo celular.
import type { Mensagem } from '@/lib/mock-data';
import { mascararTelefone, normalizarTelefone } from './telefone';

/** Grupos, listas de transmissão, status e canais nunca entram no Atendimento. */
export function destinoIgnoradoWhatsApp(remetente: string) {
  return /@(?:g\.us|broadcast|newsletter)$/.test(remetente) || remetente.startsWith('status@');
}

export interface EntradaWhatsApp { ativa: boolean; atualizadoEm?: string }

/** Contato bloqueado nunca é atendido; com a entrada aberta, os demais ganham conversa liberada. */
export function decidirEntradaWhatsApp(contato: { status: string; conversa_id: string | null } | undefined, entradaAberta: boolean) {
  if (contato?.status === 'bloqueado') return 'bloqueado' as const;
  if (contato?.status === 'liberado' && contato.conversa_id) return 'atender' as const;
  if (!entradaAberta) return 'ignorar' as const;
  return contato ? 'liberar' as const : 'criar' as const;
}

/** Dados iniciais de uma conversa aberta por quem escreveu no WhatsApp do escritório. O nome do perfil é só rótulo. */
export function novaConversaWhatsApp(id: string, numero: string, nomePerfil: string | undefined, agora = new Date()) {
  const telefone = normalizarTelefone(numero);
  const rotulo = (nomePerfil ?? '').replace(/\p{Cc}/gu, '').trim().slice(0, 80) || `WhatsApp ${mascararTelefone(telefone)}`;
  return {
    nome: rotulo,
    dados: {
      modoIA: 'Automática', nome: rotulo, cpf: '', telefone, origem: 'whatsapp',
      atendimento: `AT-${agora.getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
      etapa: 'inicial', etapaPipeline: 0, naoLidas: 0, syncs: [], processos: [], documentos: [], mensagens: [],
      timeline: [{ data: agora.toISOString(), evento: 'Novo contato pelo WhatsApp do escritório' }],
    },
  };
}

const normalizar = (t: string) => t.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Mensagem enviada pelo próprio número do escritório: é do sistema (Ana ou envio pelo Manager) quando o texto
 * coincide com uma mensagem do escritório registrada nos últimos 30 minutos ou com a resposta que a Ana está enviando.
 * O UltraMsg pode acrescentar ao final, com marcadores, horários que faltavam no texto; por isso o início também vale.
 */
export function mensagemDoSistema(texto: string, conversa: { mensagens: Pick<Mensagem, 'de' | 'texto' | 'dataHora'>[]; agenteAna?: { resultado?: { mensagem?: string } } }, agora = new Date()) {
  const corpo = normalizar(texto);
  if (!corpo) return true;
  const limite = agora.getTime() - 30 * 60000;
  const candidatos = [
    ...conversa.mensagens.filter(m => m.de === 'escritorio' && (!m.dataHora || Date.parse(m.dataHora) >= limite)).map(m => m.texto),
    conversa.agenteAna?.resultado?.mensagem ?? '',
  ].map(normalizar).filter(Boolean);
  // Mensagem manual curta ("Olá", "ok") nunca é confundida com o começo de uma mensagem do sistema.
  return candidatos.some(c => corpo === c || corpo.startsWith(c) || (corpo.length >= 40 && c.startsWith(corpo)));
}
