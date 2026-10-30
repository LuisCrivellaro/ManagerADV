import { describe, it, expect, vi } from 'vitest';
import { resolveReplyCalendar } from '@/lib/atendimento/quick-reply-calendar.server';
import { fillCalendarReply, calendarShortcut, diaSP } from '@/lib/atendimento/quick-reply-calendar';
import { conversas } from '@/lib/mock-data';
import { gerarHorarios } from '@/lib/atendimento/schedule-rules';

const now = new Date('2026-10-27T17:54:00Z');
const base = conversas[0];
if (!base) throw new Error('Missing fixture');
const c = { ...base, tipoClienteAgenda: 'novo' as const };
const deps = () => ({ busy: vi.fn().mockResolvedValue([]), read: vi.fn().mockResolvedValue(undefined) });
const receipt = { id: 'event', inicio: '2026-10-28T12:00:00Z', fim: '2026-10-28T12:30:00Z' };

describe('Dados reais para mensagens prontas', () => {
  it('retorna duas opções de 30 minutos dentro da regra', async () => {
    const d = deps();
    expect((await resolveReplyCalendar(c, 'consulta', d, now)).horarios).toEqual(['2026-10-28T12:00:00.000Z', '2026-10-28T12:30:00.000Z']);
    expect(d.busy).toHaveBeenCalledWith(now, 14);
    expect(d.read).not.toHaveBeenCalled();
  });
  it('retorna somente a opção realmente livre', async () => {
    const d = deps();
    d.busy.mockResolvedValue([{ start: '2026-10-28T12:30:00Z', end: '2026-11-11T23:00:00Z' }]);
    expect((await resolveReplyCalendar(c, 'consulta', d, now)).horarios).toEqual(['2026-10-28T12:00:00.000Z']);
  });
  it('não inventa horários quando todos estão ocupados', async () => {
    const d = deps(); d.busy.mockResolvedValue([{ start: now.toISOString(), end: '2026-11-11T23:00:00Z' }]);
    const r = await resolveReplyCalendar(c, 'consulta', d, now);
    expect(r.horarios).toBeUndefined(); expect(r.aviso).toBeDefined();
  });
  it('falha de conexão nunca reaproveita ofertas antigas', async () => {
    const d = deps(); d.busy.mockResolvedValue(null);
    const r = await resolveReplyCalendar({ ...c, horariosOfertados: [receipt.inicio] }, 'consulta', d, now);
    expect(r.horarios).toBeUndefined(); expect(r.aviso).toBeDefined();
  });
  it('exclui interseção parcial de um compromisso', async () => {
    const d = deps(); d.busy.mockResolvedValue([{ start: '2026-10-28T12:10:00Z', end: '2026-10-28T12:40:00Z' }]);
    expect((await resolveReplyCalendar(c, 'consulta', d, now)).horarios).toEqual(['2026-10-28T13:00:00.000Z', '2026-10-28T13:30:00.000Z']);
  });
  it('reagendar considera hoje sem incluir horários passados', async () => {
    const r = await resolveReplyCalendar(c, 'reagendar', deps(), now);
    expect(r.horarios).toEqual(['2026-10-27T18:00:00.000Z', '2026-10-27T18:30:00.000Z']);
  });
  it('cadastrados têm opções na sexta, desde 13h30', async () => {
    const r = await resolveReplyCalendar({ ...c, tipoClienteAgenda: 'cadastrado' }, 'consulta', deps(), now);
    expect(r.horarios).toEqual(['2026-10-30T16:30:00.000Z', '2026-10-30T17:00:00.000Z']);
  });
  it('carteira não identificada não assume regras', async () => {
    const d = deps(); const { tipoClienteAgenda: _tipo, agenteAna: _ana, ...semCarteira } = c;
    const r = await resolveReplyCalendar(semCarteira, 'consulta', d, now);
    expect(r.horarios).toBeUndefined(); expect(d.busy).not.toHaveBeenCalled();
  });
  it('sem recibo não usa nome ou consulta local para confirmar', async () => {
    const d = deps(); const semRecibo = { ...c, consultaAgendada: receipt.inicio }; delete semRecibo.agenteAna;
    const r = await resolveReplyCalendar(semRecibo, 'confirmar', d, now);
    expect(r.reserva).toBeUndefined(); expect(d.read).not.toHaveBeenCalled();
  });
  it('consulta passada não é confirmada nem consultada', async () => {
    const d = deps(); const r = await resolveReplyCalendar({ ...c, consultaAgendada: receipt.inicio, agenteAna: { reservaCalendar: receipt } }, 'lembreteconsulta', d, new Date('2026-10-29T12:00:00Z'));
    expect(r.reserva).toBeUndefined(); expect(d.read).not.toHaveBeenCalled();
  });
  it('confirma somente o recibo verificado da conversa', async () => {
    const d = deps(); d.read.mockResolvedValue(receipt);
    const r = await resolveReplyCalendar({ ...c, consultaAgendada: receipt.inicio, agenteAna: { reservaCalendar: receipt } }, 'confirmar', d, now);
    expect(r.reserva).toEqual(receipt); expect(d.read).toHaveBeenCalledWith(c.id, receipt); expect(d.busy).not.toHaveBeenCalled();
  });
  it('evento ausente ou de outro atendimento não fornece hora', async () => {
    const r = await resolveReplyCalendar({ ...c, consultaAgendada: receipt.inicio, agenteAna: { reservaCalendar: receipt } }, 'confirmar', deps(), now);
    expect(r.reserva).toBeUndefined();
  });
  it('outras mensagens não consultam Calendar', async () => {
    const d = deps();
    for (const atalho of ['boasvindas', 'orcamento', 'contrato', 'docsiniciais', 'docstrabalhista', 'audiencia', 'pericia', 'ata']) {
      expect(await resolveReplyCalendar(c, atalho, d, now)).toEqual({});
      expect(calendarShortcut({ atalho, texto: '{horario}' })).toBe(false);
    }
    expect(d.busy).not.toHaveBeenCalled(); expect(d.read).not.toHaveBeenCalled();
  });
  it('offsets diferentes representam o mesmo instante e bloqueiam intervalo', () => {
    expect(diaSP('2026-10-28T01:00:00Z')).toBe('2026-10-27');
    expect(gerarHorarios([{ start: '2026-10-28T08:10:00-04:00', end: '2026-10-28T08:40:00-04:00' }], now, 'novo', 2)).toEqual(['2026-10-28T13:00:00.000Z', '2026-10-28T13:30:00.000Z']);
  });
  it('não substitui variáveis com instantes inválidos ou passados', () => {
    const texto = '{horario1} / {horario2} / {vara}';
    expect(fillCalendarReply(texto, { horarios: ['invalid', '2026-10-26T12:00:00Z'] }, now)).toBe(texto);
    expect(fillCalendarReply('{horario} {data}', { reserva: receipt }, new Date('2026-10-29T12:00:00Z'))).toBe('{horario} {data}');
  });
});