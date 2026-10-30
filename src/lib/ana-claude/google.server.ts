// Google Calendar pelas credenciais OAuth do escritório, no MESMO formato do conector do claude.ai
// (list_events, create_event, delete_event), para o motor da Ana funcionar igual no servidor.
// Só no servidor: GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN nunca vão para o navegador.
import type { Mcp } from './agenda-mcp';

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Agenda das consultas. Padrão: a agenda principal da conta autorizada. */
  calendarId?: string;
  fetch?: typeof fetch;
}

const API = 'https://www.googleapis.com/calendar/v3';
function erro(code: string, message: string, retryable = false) { return Object.assign(new Error(message), { code, retryable }); }
/** "2026-10-26T09:00:00" (horário de Brasília, sem fuso) → RFC 3339 com -03:00. Brasil sem horário de verão desde 2019. */
const comFuso = (local: string) => (/[zZ]|[+-]\d{2}:\d{2}$/.test(local) ? local : `${local}-03:00`);

export function googleCalendarComoMcp(cfg: ConfigGoogle): Mcp {
  const f = cfg.fetch ?? fetch;
  const agenda = encodeURIComponent(cfg.calendarId || 'primary');
  let acesso: { token: string; expira: number } | undefined;

  async function token() {
    if (acesso && acesso.expira > Date.now() + 60_000) return acesso.token;
    const res = await f('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: 'refresh_token' }),
    });
    if (!res.ok) throw erro('needs_reauth', 'O Google recusou as credenciais da agenda. Gere um novo refresh token.');
    const b = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!b.access_token) throw erro('needs_reauth', 'O Google não devolveu acesso à agenda.');
    acesso = { token: b.access_token, expira: Date.now() + (b.expires_in ?? 3600) * 1000 };
    return acesso.token;
  }

  async function google(caminho: string, init: RequestInit = {}) {
    const res = await f(`${API}${caminho}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' } });
    if (res.status === 401) { acesso = undefined; throw erro('needs_reauth', 'O acesso à agenda expirou.'); }
    if (res.status === 404 || res.status === 410) return { naoEncontrado: true } as Record<string, unknown>;
    if (res.status === 429 || res.status >= 500) throw erro('server_unavailable', `Google Calendar respondeu ${res.status}.`, true);
    if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: { message?: string } }; throw erro('tool_error', b.error?.message ?? `Google Calendar respondeu ${res.status}.`); }
    return res.status === 204 ? {} : ((await res.json()) as Record<string, unknown>);
  }

  type Evento = { id?: string; status?: string; summary?: string; transparency?: string; start?: unknown; end?: unknown; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } };
  const meet = (e: Evento) => e.hangoutLink ?? e.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri;
  const normalizar = (e: Evento) => ({ id: e.id, status: e.status, summary: e.summary, transparency: e.transparency, start: e.start, end: e.end, conferenceUrl: meet(e) });

  return {
    async callTool(_servidor: string, ferramenta: string, input?: unknown) {
      const i = (input ?? {}) as Record<string, unknown>;
      if (ferramenta === 'list_events') {
        const q = new URLSearchParams({
          timeMin: comFuso(String(i['startTime'])), timeMax: comFuso(String(i['endTime'])),
          singleEvents: 'true', orderBy: 'startTime', maxResults: String(i['pageSize'] ?? 250), timeZone: 'America/Sao_Paulo',
          ...(i['pageToken'] ? { pageToken: String(i['pageToken']) } : {}),
        });
        const r = await google(`/calendars/${agenda}/events?${q}`) as { items?: Evento[]; nextPageToken?: string };
        return { payload: { events: (r.items ?? []).map(normalizar), ...(r.nextPageToken ? { nextPageToken: r.nextPageToken } : {}) } };
      }
      if (ferramenta === 'create_event') {
        const convite = i['notificationLevel'] === 'ALL' ? 'all' : 'none';
        const corpo = {
          summary: i['summary'], description: i['description'],
          start: { dateTime: comFuso(String(i['startTime'])), timeZone: 'America/Sao_Paulo' },
          end: { dateTime: comFuso(String(i['endTime'])), timeZone: 'America/Sao_Paulo' },
          attendees: i['attendees'] ?? [],
          ...(i['addGoogleMeetUrl'] ? { conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
          reminders: { useDefault: true },
        };
        const e = await google(`/calendars/${agenda}/events?conferenceDataVersion=1&sendUpdates=${convite}`, { method: 'POST', body: JSON.stringify(corpo) }) as Evento;
        return { payload: normalizar(e) };
      }
      if (ferramenta === 'delete_event') {
        const avisar = i['notificationLevel'] === 'ALL' ? 'all' : 'none';
        await google(`/calendars/${agenda}/events/${encodeURIComponent(String(i['eventId']))}?sendUpdates=${avisar}`, { method: 'DELETE' });
        return { payload: { id: i['eventId'], status: 'cancelled' } };
      }
      throw erro('not_in_manifest', `Ferramenta de agenda não suportada: ${ferramenta}`);
    },
  };
}
