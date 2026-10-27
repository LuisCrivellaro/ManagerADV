import { idReservaCalendar, intervaloLivre, linkMeet, type ReservaCalendar } from './calendar-booking';
import { DURACAO_REUNIAO, horarioPermitido } from './schedule-rules';
import { telefoneAgenda, type TipoCliente } from './intake-rules';
import { reservaDoAtendimento } from './appointment-management';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';

async function calendarRequest(path: string, init: RequestInit = {}) {
  const lovable = process.env['LOVABLE_API_KEY'];
  const key = process.env['GOOGLE_CALENDAR_API_KEY'];
  if (!lovable || !key) throw new Error('Google Calendar não configurado. Nenhuma reserva confirmada.');
  return fetch(`${GATEWAY_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': key, 'Content-Type': 'application/json', ...init.headers } });
}

async function erroCalendar(res: Response): Promise<never> {
  const body = await res.text();
  console.error(`Google Calendar [${res.status}]: ${body}`);
  throw new Error(`Google Calendar [${res.status}]: ${body}`);
}

type CalendarEvent = { id?: string; status?: string; htmlLink?: string; hangoutLink?:string;conferenceData?:{entryPoints?:{entryPointType?:string;uri?:string}[];createRequest?:{status?:{statusCode?:string}}}; start?: { dateTime?: string }; end?: { dateTime?: string }; extendedProperties?: { private?: { conversa?: string } } };
function validarReserva(event: CalendarEvent, conversaId: string, inicio: string, fim: string): ReservaCalendar {
  if (event.status === 'cancelled' || !event.id || event.extendedProperties?.private?.conversa !== conversaId || Date.parse(event.start?.dateTime ?? '') !== Date.parse(inicio) || Date.parse(event.end?.dateTime ?? '') !== Date.parse(fim)) throw new Error('Horário indisponível ou já reservado por outro atendimento.');
  const meetUrl=linkMeet(event);
  return { id: event.id, inicio, fim, ...(event.htmlLink ? { url: event.htmlLink } : {}),...(meetUrl?{meetUrl}:{}) };
}

async function receberReservaMeet(event:CalendarEvent,conversaId:string,inicio:string,fim:string){
 let current=event;
 const reserva=validarReserva(event,conversaId,inicio,fim);
 for(let attempt=0;attempt<3&&!linkMeet(current)&&current.conferenceData?.createRequest?.status?.statusCode==='pending';attempt++){
  await new Promise(resolve=>setTimeout(resolve,500));
  const response=await calendarRequest(`/calendars/primary/events/${encodeURIComponent(reserva.id)}`);
  if(!response.ok){console.error('Meet ainda indisponível',response.status);break;}
  current=await response.json() as CalendarEvent;
 }
 return validarReserva(current,conversaId,inicio,fim);
}

/** Só chamado após validar webhook, contato, modo Automática e escolha inequívoca. Sem CPF, assunto jurídico ou convites. */
export async function reservarGoogleCalendar(conversaId: string, inicio: string, now = new Date(), cliente?: {nome: string; telefone: string; tipo: TipoCliente}): Promise<ReservaCalendar> {
  if (!conversaId || !Number.isFinite(Date.parse(inicio)) || Date.parse(inicio) <= now.getTime()) throw new Error('Escolha um horário futuro disponível.');
  if (!cliente?.nome.trim() || !telefoneAgenda(cliente.telefone)) throw new Error('Informe nome e telefone do cliente antes de reservar.');
  if (!horarioPermitido(inicio, cliente.tipo)) throw new Error('Horário fora da carteira de atendimento permitida.');
  inicio = new Date(inicio).toISOString();
  const fim = new Date(Date.parse(inicio) + DURACAO_REUNIAO * 60000).toISOString();
  const id = await idReservaCalendar(inicio);
  const existing = await calendarRequest(`/calendars/primary/events/${id}`);
  const existingEvent:CalendarEvent|undefined=existing.ok?await existing.json():undefined;
  if (existingEvent&&existingEvent.status!=='cancelled') return validarReserva(existingEvent, conversaId, inicio, fim);
  if (!existing.ok&&existing.status !== 404) return erroCalendar(existing);
  const check = await calendarRequest('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: inicio, timeMax: fim, timeZone: 'America/Sao_Paulo', items: [{ id: 'primary' }] }) });
  if (!check.ok) return erroCalendar(check);
  const availability = await check.json() as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
  const calendar = availability.calendars?.['primary'];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error('Não foi possível verificar disponibilidade; nenhuma reserva confirmada.');
  if (!intervaloLivre(calendar.busy, inicio, fim)) throw new Error('Esse horário acabou de ficar ocupado. Escolha outro horário.');
  const created = await calendarRequest(existingEvent?`/calendars/primary/events/${id}?sendUpdates=none&conferenceDataVersion=1`:'/calendars/primary/events?sendUpdates=none&conferenceDataVersion=1', { method: existingEvent?'PATCH':'POST', body: JSON.stringify({ id, status:'confirmed', summary: `Consulta CS Lawyers · ${cliente.nome.trim()}`, description: `Nome: ${cliente.nome.trim()}\nTelefone: ${telefoneAgenda(cliente.telefone)}\nReunião: 30 minutos`, start: { dateTime: inicio, timeZone: 'America/Sao_Paulo' }, end: { dateTime: fim, timeZone: 'America/Sao_Paulo' },conferenceData:{createRequest:{requestId:crypto.randomUUID(),conferenceSolutionKey:{type:'hangoutsMeet'}}}, extendedProperties: { private: { conversa: conversaId } } }) });
  if (created.status === 409) {
    const concurrent = await calendarRequest(`/calendars/primary/events/${id}`);
    if (!concurrent.ok) return erroCalendar(concurrent);
    return validarReserva(await concurrent.json(), conversaId, inicio, fim);
  }
  if (!created.ok) return erroCalendar(created);
  return receberReservaMeet(await created.json(), conversaId, inicio, fim);
}

/** Períodos ocupados da agenda principal (somente leitura). Retorna null se indisponível. */
export async function ocupadosGoogleCalendar(now = new Date(), dias = 14): Promise<{ start: string; end: string }[] | null> {
  const lovable = process.env['LOVABLE_API_KEY'];
  const key = process.env['GOOGLE_CALENDAR_API_KEY'];
  if (!lovable || !key) return null;
  try {
    const res = await fetch(`${GATEWAY_URL}/freeBusy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: now.toISOString(), timeMax: new Date(now.getTime() + dias * 86400000).toISOString(), timeZone: 'America/Sao_Paulo', items: [{ id: 'primary' }] }),
    });
    if (!res.ok) { console.error(`Google Calendar freeBusy [${res.status}]: ${await res.text()}`); return null; }
    const body = (await res.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
    const cal = body.calendars?.['primary'] ?? Object.values(body.calendars ?? {})[0];
    if (!cal || cal.errors?.length || !Array.isArray(cal.busy)) return null;
    return cal.busy;
  } catch (e) { console.error('Google Calendar indisponível', e); return null; }
}

/** Nenhum ID enviado pelo modelo é aceito; o recibo salvo deve pertencer à conversa. */
export async function lerReservaGoogleCalendar(conversaId: string, reserva: ReservaCalendar): Promise<ReservaCalendar | undefined> {
  const response = await calendarRequest(`/calendars/primary/events/${encodeURIComponent(reserva.id)}`);
  if (response.status === 404 || response.status === 410) return undefined;
  if (!response.ok) return erroCalendar(response);
  const event = await response.json() as CalendarEvent;
  if (event.status === 'cancelled' || !reservaDoAtendimento(event, conversaId, reserva)) return undefined;
  return validarReserva(event, conversaId, reserva.inicio, reserva.fim);
}

/** Nenhum ID enviado pelo modelo é aceito; o recibo salvo deve pertencer à conversa. */
export async function cancelarGoogleCalendar(conversaId:string,reserva:ReservaCalendar,autorizado:boolean) {
  if(!autorizado)throw new Error('Cancelamento exige autorização explícita.');
  const path=`/calendars/primary/events/${encodeURIComponent(reserva.id)}`;
  const response=await calendarRequest(path);
  // 404/410: o compromisso não existe mais na agenda conectada (apagado ou criado em outra conta); nada a cancelar.
  if(response.status===404||response.status===410)return 'ausente' as const;
  if(!response.ok)return erroCalendar(response);
  const event=await response.json() as CalendarEvent;
  if(event.status==='cancelled')return 'ausente' as const;
  if(!reservaDoAtendimento(event,conversaId,reserva))throw new Error('Compromisso não pertence a este atendimento.');
  // Sem If-Match: o ETag repassado pelo gateway não coincide com o do Google e gerava 412 em todo cancelamento.
  // A propriedade do compromisso já foi validada acima pelo recibo da conversa.
  const deleted=await calendarRequest(`${path}?sendUpdates=all`,{method:'DELETE'});
  if(deleted.status===410||deleted.status===404)return 'ausente' as const;
  if(!deleted.ok)return erroCalendar(deleted);
  return 'cancelado' as const;
}

/** Reserva o novo horário antes de remover o anterior; falha mantém o original. */
export async function remarcarGoogleCalendar(conversaId:string,anterior:ReservaCalendar,inicio:string,autorizado:boolean,now=new Date(),cliente?:{nome:string;telefone:string;tipo:TipoCliente}) {
  if(!autorizado)throw new Error('Remarcação exige autorização explícita.');
  const original=await calendarRequest(`/calendars/primary/events/${encodeURIComponent(anterior.id)}`);
  if(!original.ok)return erroCalendar(original);
  const event=await original.json() as CalendarEvent;
  if(event.status==='cancelled'||!reservaDoAtendimento(event,conversaId,anterior))throw new Error('Consulta original indisponível para remarcação.');
  if(Date.parse(anterior.inicio)===Date.parse(inicio))return anterior;
  const nova=await reservarGoogleCalendar(conversaId,inicio,now,cliente);
  try {await cancelarGoogleCalendar(conversaId,anterior,true);}
  catch(error){
    try{await cancelarGoogleCalendar(conversaId,nova,true);}catch(rollback){console.error('Falha ao desfazer nova reserva',rollback);throw new Error('Remarcação incompleta; equipe deve conferir ambos os compromissos.');}
    throw error;
  }
  return nova;
}
