// Google Calendar pelo conector do claude.ai (capability "mcp"). Formato conferido com respostas reais em 22/10/2026:
// list_events → { summary, timeZone, events: [{ id, status, summary, start:{dateTime|date}, end:{...}, conferenceUrl }], nextPageToken? }
// create_event → { id, start, end, conferenceUrl, conferenceData:{ videoEntryPoint:{ uri } } }
import { CONFIG_AGENDA, gerarCandidatos, removerOcupados } from './agenda';

export const SERVIDOR = 'Google Calendar';
export interface EventoReal { id: string; inicio: string; fim: string; titulo: string; meet?: string | undefined; diaInteiro: boolean }
export interface Mcp {
  callTool(server: string, tool: string, input?: unknown, options?: unknown): Promise<{ payload?: unknown }>;
}

/** Erro da agenda com código do conector e texto para a equipe. */
export class ErroAgenda extends Error {
  constructor(public codigo: string, mensagem: string, public tentarDeNovo = false) { super(mensagem); }
}

export function traduzirErro(e: unknown): ErroAgenda {
  const x = e as { code?: string; message?: string; retryable?: boolean };
  const m: Record<string, string> = {
    needs_reauth: 'O acesso ao Google Calendar expirou. Reconecte em Configurações → Conectores do claude.ai.',
    server_not_connected: 'O Google Calendar não está conectado. Adicione em Configurações → Conectores do claude.ai.',
    selection_required: 'Há mais de um Google Calendar conectado. Escolha qual usar no aviso do claude.ai.',
    not_in_manifest: 'O acesso à agenda foi recusado para esta página. Libere em Permissões do artefato.',
    approval_required: 'O acesso à agenda precisa da sua aprovação.',
    blocked_by_policy: 'A política da organização bloqueia o acesso à agenda nesta página.',
    server_unavailable: 'O Google Calendar não respondeu agora.',
    tool_error: `O Google Calendar recusou o pedido${x.message ? `: ${x.message.slice(0, 160)}` : '.'}`,
  };
  return new ErroAgenda(x.code ?? 'upstream_error', m[x.code ?? ''] ?? 'Falha ao falar com o Google Calendar.', Boolean(x.retryable));
}

/** Data e hora locais de Brasília, sem fuso, como o conector pede: 2026-10-26T09:00:00. */
export function localSP(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}:${p['second']}`;
}

function normalizar(e: Record<string, any>): EventoReal | undefined {
  if (e['status'] === 'cancelled' || e['transparency'] === 'transparent') return undefined;
  const s = e['start'] ?? {}, f = e['end'] ?? {};
  const diaInteiro = !s.dateTime && Boolean(s.date);
  const ini = s.dateTime ?? (s.date ? `${s.date}T00:00:00-03:00` : undefined);
  const fim = f.dateTime ?? (f.date ? `${f.date}T00:00:00-03:00` : undefined);
  if (!ini || !fim || !Number.isFinite(Date.parse(ini)) || !Number.isFinite(Date.parse(fim))) return undefined;
  return {
    id: String(e['id'] ?? ''), inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(),
    titulo: String(e['summary'] ?? '(sem título)'), meet: e['conferenceUrl'] ?? e['conferenceData']?.videoEntryPoint?.uri, diaInteiro,
  };
}

/** Lê os eventos entre duas datas (até 4 páginas). Leituras com falha temporária são tentadas uma vez. */
export async function lerEventos(mcp: Mcp, de: string, ate: string): Promise<EventoReal[]> {
  const out: EventoReal[] = [];
  let token: string | undefined;
  for (let pagina = 0; pagina < 4; pagina++) {
    const input = { startTime: localSP(de), endTime: localSP(ate), timeZone: 'America/Sao_Paulo', orderBy: 'startTime', pageSize: 250, ...(token ? { pageToken: token } : {}) };
    let r: { payload?: unknown };
    try { r = await mcp.callTool(SERVIDOR, 'list_events', input, { cache: false }); }
    catch (e) {
      const x = e as { retryable?: boolean; retryAfterMs?: number };
      if (!x.retryable) throw traduzirErro(e);
      await new Promise(res => setTimeout(res, Math.min(x.retryAfterMs ?? 800 + Math.random() * 700, 5000)));
      try { r = await mcp.callTool(SERVIDOR, 'list_events', input, { cache: false }); } catch (e2) { throw traduzirErro(e2); }
    }
    const p = (r.payload ?? {}) as { events?: Record<string, unknown>[]; nextPageToken?: string; summary?: string };
    for (const e of p.events ?? []) { const n = normalizar(e); if (n) out.push(n); }
    token = p.nextPageToken;
    if (!token) break;
  }
  return out;
}

export async function horariosLivres(mcp: Mcp, now = new Date()) {
  const cand = gerarCandidatos(now);
  if (!cand.length) return [];
  const fim = new Date(Date.parse(cand.at(-1)!) + CONFIG_AGENDA.duracaoMin * 60_000).toISOString();
  const eventos = await lerEventos(mcp, cand[0]!, fim);
  return removerOcupados(cand, eventos.map(e => ({ start: e.inicio, end: e.fim })));
}

export async function horarioAindaLivre(mcp: Mcp, inicio: string) {
  const fim = new Date(Date.parse(inicio) + CONFIG_AGENDA.duracaoMin * 60_000).toISOString();
  const eventos = await lerEventos(mcp, new Date(Date.parse(inicio) - 12 * 3600_000).toISOString(), new Date(Date.parse(fim) + 12 * 3600_000).toISOString());
  return removerOcupados([inicio], eventos.map(e => ({ start: e.inicio, end: e.fim }))).length === 1;
}

/** Cria a consulta com Google Meet. Escrita: nunca repetida automaticamente. */
export async function criarConsulta(mcp: Mcp, p: { inicio: string; nome: string; email: string; assunto: string; convite: boolean }) {
  const fim = new Date(Date.parse(p.inicio) + CONFIG_AGENDA.duracaoMin * 60_000).toISOString();
  let r: { payload?: unknown };
  try {
    r = await mcp.callTool(SERVIDOR, 'create_event', {
      summary: `Consulta inicial — ${p.nome}`.slice(0, 200),
      startTime: localSP(p.inicio), endTime: localSP(fim), timeZone: 'America/Sao_Paulo',
      addGoogleMeetUrl: true,
      // Sem CPF ou dados sensíveis no evento.
      description: `Agendada pela Ana (assistente virtual) em teste no Manager ADV.\nAssunto informado: ${p.assunto || 'não informado'}\nE-mail do cliente: ${p.email}`,
      attendees: [{ email: p.email, displayName: p.nome }],
      notificationLevel: p.convite ? 'ALL' : 'NONE',
    });
  } catch (e) {
    const x = traduzirErro(e);
    // Resultado ambíguo numa escrita: o evento pode ter sido criado. Confere lendo a agenda.
    if (['server_unavailable', 'upstream_error'].includes(x.codigo)) {
      const ev = (await lerEventos(mcp, p.inicio, fim).catch(() => [])).find(ev => ev.inicio === new Date(p.inicio).toISOString() && ev.titulo.includes(p.nome));
      if (ev) return { id: ev.id, meet: ev.meet ?? '' };
    }
    throw x;
  }
  const ev = (r.payload ?? {}) as { id?: string; conferenceUrl?: string; conferenceData?: { videoEntryPoint?: { uri?: string } } };
  if (!ev.id) throw new ErroAgenda('tool_error', 'O Google não devolveu o evento criado; confira a agenda.');
  return { id: ev.id, meet: ev.conferenceUrl ?? ev.conferenceData?.videoEntryPoint?.uri ?? '' };
}

export async function apagarEvento(mcp: Mcp, id: string) {
  try { await mcp.callTool(SERVIDOR, 'delete_event', { eventId: id, notificationLevel: 'NONE' }); }
  catch (e) { throw traduzirErro(e); }
}
