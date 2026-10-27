import type { Conversa } from '../mock-data';
import type { ReservaCalendar } from './calendar-booking';
import { gerarHorarios } from './schedule-rules';
import type { ReplyCalendarData } from './quick-reply-calendar';

export async function resolveReplyCalendar(c: Conversa, atalho: string, deps: {
  busy: (now: Date, dias: number) => Promise<{ start: string; end: string }[] | null>;
  read: (id: string, reserva: ReservaCalendar) => Promise<ReservaCalendar | undefined>;
}, now = new Date()): Promise<ReplyCalendarData> {
  if (atalho === 'consulta' || atalho === 'reagendar') {
    const tipo = c.tipoClienteAgenda ?? c.agenteAna?.tipoCliente;
    if (!tipo) return { aviso: 'Confirme a carteira de agendamento do cliente em Consulta e histórico. Preencha os horários manualmente.' };
    const busy = await deps.busy(now, 14);
    if (!busy) return { aviso: 'Não foi possível consultar o Google Calendar. Nenhum horário verificado; preencha manualmente ou tente novamente.' };
    // /consulta começa amanhã, como na mensagem oficial. /reagendar também considera o restante de hoje.
    const base = atalho === 'reagendar' ? new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)}T00:00:00-03:00`) : now;
    if (atalho === 'reagendar') base.setUTCDate(base.getUTCDate() - 1);
    const horarios = gerarHorarios(busy, base, tipo, 1000, atalho === 'reagendar' ? 15 : 14)
      .filter(h => Date.parse(h) > now.getTime() && Date.parse(h) + 30 * 60000 <= now.getTime() + 14 * 86400000).slice(0, 2);
    if (!horarios.length) return { aviso: 'Nenhum horário livre dentro das regras nos próximos 14 dias. Mensagem não preenchida; não ofereça disponibilidade sem conferir a agenda.' };
    return { horarios, ...(horarios.length === 1 ? { aviso: 'Somente um horário disponível foi encontrado.' } : {}) };
  }
  if (atalho === 'confirmar' || atalho === 'lembreteconsulta') {
    const receipt = c.agenteAna?.reservaCalendar;
    if (!receipt || receipt.inicio !== c.consultaAgendada || !Number.isFinite(Date.parse(receipt.inicio)) || Date.parse(receipt.inicio) <= now.getTime()) return { aviso: 'Nenhuma consulta futura com recibo identificada para este cliente. Selecione ou confira o compromisso antes de preencher manualmente.' };
    const reserva = await deps.read(c.id, receipt);
    if (!reserva) return { aviso: 'Consulta não confirmada na agenda conectada. Confira o compromisso; o horário ficou para preenchimento manual.' };
    return { reserva };
  }
  return {};
}