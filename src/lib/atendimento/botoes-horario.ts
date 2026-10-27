// Botões clicáveis de horário no Telegram. Regras puras: o clique só vira um pedido de horário já ofertado.
import { formatarHorarioCliente } from '../atendimento';

const PREFIXO = 'slot:';

export interface BotaoCanal { texto: string; dados: string }

/** Um botão por horário (máx. 8), com o horário de Brasília legível. */
export function botoesHorarios(isos: string[]): BotaoCanal[] {
  return [...new Set(isos)].filter(iso => Number.isFinite(Date.parse(iso))).slice(0, 8)
    .map(iso => ({ texto: `🗓️ ${formatarHorarioCliente(iso)}`, dados: `${PREFIXO}${new Date(iso).toISOString()}` }));
}

/** Lê o horário do clique; só aceita se ainda estiver entre os ofertados e no futuro. */
export function horarioDoClique(dados: string | undefined, ofertados: string[], agora = new Date()): string | undefined {
  if (!dados?.startsWith(PREFIXO)) return undefined;
  const t = Date.parse(dados.slice(PREFIXO.length));
  if (!Number.isFinite(t) || t <= agora.getTime()) return undefined;
  return ofertados.find(o => Date.parse(o) === t);
}

/** Texto registrado na conversa quando o cliente toca no botão. */
export function textoEscolhaHorario(iso: string) {
  return `Quero agendar a consulta para ${formatarHorarioCliente(iso)}.`;
}
