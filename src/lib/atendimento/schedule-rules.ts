import Holidays from 'date-holidays';
import type { TipoCliente } from './intake-rules';

export const DURACAO_REUNIAO = 30;
function partes(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return undefined;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(p => [p.type, p.value]));
  return { data: `${p['year']}-${p['month']}-${p['day']}`, minutos: Number(p['hour']) * 60 + Number(p['minute']), segundos: Number(p['second']) };
}
/** Feriados nacionais brasileiros; bloqueios locais extras são datas YYYY-MM-DD. */
export function feriadoNacional(data: string) {
  const holidays = new Holidays('BR');
  return holidays.getHolidays(Number(data.slice(0, 4))).some(h => h.type === 'public' && h.date.slice(0, 10) === data);
}
export function horarioPermitido(iso: string, tipo: TipoCliente, bloqueios: string[] = []) {
  const p = partes(iso);
  if (!p || bloqueios.includes(p.data) || feriadoNacional(p.data)) return false;
  const dia = new Date(`${p.data}T12:00:00Z`).getUTCDay();
  const diaValido = tipo === 'cadastrado' ? dia === 5 : dia >= 1 && dia <= 4;
  const inicio = tipo === 'cadastrado' ? 13 * 60 + 30 : 9 * 60;
  return diaValido && p.minutos >= inicio && p.minutos + DURACAO_REUNIAO <= 17 * 60 + 30 && p.minutos % 30 === 0 && p.segundos === 0;
}
export function gerarHorarios(ocupados: { start: string; end: string }[], now: Date, tipo: TipoCliente, quantidade = 3, dias = 14, bloqueios: string[] = []) {
  const p = partes(now.toISOString());
  if (!p) return [];
  const day = new Date(`${p.data}T12:00:00Z`);
  const slots: string[] = [];
  const holidays = new Holidays('BR');
  const anos = new Map<number, Set<string>>();
  for (let i = 0; i < dias && slots.length < quantidade; i++) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (tipo === 'cadastrado' ? weekday !== 5 : weekday < 1 || weekday > 4) continue;
    const data = day.toISOString().slice(0, 10);
    const year = day.getUTCFullYear();
    if (!anos.has(year)) anos.set(year, new Set(holidays.getHolidays(year).filter(h => h.type === 'public').map(h => h.date.slice(0, 10))));
    if (anos.get(year)?.has(data) || bloqueios.includes(data)) continue;
    for (let minutes = tipo === 'cadastrado' ? 810 : 540; minutes <= 1020 && slots.length < quantidade; minutes += 30) {
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const s = Date.parse(`${data}T${time}:00-03:00`), e = s + DURACAO_REUNIAO * 60000;
      if (s > now.getTime() && ocupados.every(b => Number.isFinite(Date.parse(b.start)) && Number.isFinite(Date.parse(b.end)) && !(s < Date.parse(b.end) && e > Date.parse(b.start)))) slots.push(new Date(s).toISOString());
    }
  }
  return slots;
}