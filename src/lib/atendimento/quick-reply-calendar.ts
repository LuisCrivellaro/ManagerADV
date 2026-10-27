import type { QuickReply } from '../respostas-prontas';
import type { ReservaCalendar } from './calendar-booking';

export type ReplyCalendarData = { horarios?: string[]; reserva?: ReservaCalendar; aviso?: string };
export const calendarShortcut = (r: Pick<QuickReply, 'atalho' | 'texto'>) =>
  ['consulta', 'reagendar', 'confirmar', 'lembreteconsulta'].includes(r.atalho) && /\{horario(?:1|2)?\}/.test(r.texto);

export const diaSP = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const horaSP = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(':', 'h');
const dataSP = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(iso));

/** Altera apenas campos e referências temporais comprovadas, sem mudar a biblioteca oficial. */
export function fillCalendarReply(texto: string, data: ReplyCalendarData, now = new Date()): string {
  const horarios = (data.horarios ?? []).filter(h => Number.isFinite(Date.parse(h)) && Date.parse(h) > now.getTime()).slice(0, 2);
  if (horarios.length) {
    const first = horarios[0];
    if (!first) return texto;
    const tomorrow = new Date(`${diaSP(now.toISOString())}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const sameDay = horarios.every(h => diaSP(h) === diaSP(first));
    const allTomorrow = sameDay && diaSP(first) === tomorrow.toISOString().slice(0, 10);
    const allToday = sameDay && diaSP(first) === diaSP(now.toISOString());
    let result = texto;
    if (!allTomorrow) result = result.replace('Temos horários amanhã,', 'Temos horários disponíveis,');
    if (!allToday) result = result.replace('Hoje temos disponibilidade', 'Temos disponibilidade');
    const includeDate = !sameDay || (!allTomorrow && texto.includes('amanhã')) || (!allToday && texto.includes('Hoje temos'));
    horarios.forEach((h, i) => { result = result.replaceAll(`{horario${i + 1}}`, includeDate ? `${horaSP(h)} (${dataSP(h)})` : horaSP(h)); });
    if (horarios.length === 1) result = result.replace(/ ou às \{horario2\}/g, '').replace('Qual desses horários fica melhor para você?', 'Esse horário fica melhor para você?');
    return result;
  }
  const inicio = data.reserva?.inicio;
  if (!inicio || !Number.isFinite(Date.parse(inicio)) || Date.parse(inicio) <= now.getTime()) return texto;
  let result = texto.replaceAll('{horario}', horaSP(inicio));
  if (diaSP(inicio) !== diaSP(now.toISOString())) {
    result = result.replace('hoje às', `no dia ${dataSP(inicio)} às`).replace('hoje, às', `o dia ${dataSP(inicio)}, às`);
  }
  return result;
}