// Liga a Ana (pacote src/lib/ana-claude, inalterado) ao Google Calendar já conectado no projeto.
// O adaptador do pacote fala com a API do Google; aqui só trocamos o transporte para o conector,
// que guarda as credenciais. Nenhuma credencial própria do Google é necessária.
import { googleCalendarComoMcp } from '@/lib/ana-claude/google.server';
import { claudeComoSample } from '@/lib/ana-claude/claude.server';
import { responder, type Conversa, type Resposta } from '@/lib/ana-claude/motor';
import type { AIMode } from '@/lib/ana-claude/base';

const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';

export function fetchPeloConector(lovableKey: string, calendarKey: string): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // O token OAuth fica no conector: devolve um token local só para o adaptador seguir.
    if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'conector', expires_in: 3600 });
    if (!url.startsWith(GOOGLE_API)) throw new Error('Destino de agenda não permitido.');
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${lovableKey}`);
    headers.set('X-Connection-Api-Key', calendarKey);
    return fetch(GATEWAY + url.slice(GOOGLE_API.length), { ...init, headers });
  }) as typeof fetch;
}

/** Mesma interface do anaDoAmbiente do pacote: Claude pela chave da Anthropic, agenda pelo conector. */
export function anaDoProjeto(log?: (texto: string, tipo?: 'ok' | 'aviso' | 'erro') => void) {
  const e = (n: string) => process.env[n] ?? '';
  const faltando = ['ANTHROPIC_API_KEY', 'LOVABLE_API_KEY', 'GOOGLE_CALENDAR_API_KEY'].filter(n => !e(n));
  if (faltando.length) throw new Error(`Configuração ausente: ${faltando.join(', ')}`);
  const sample = claudeComoSample({ apiKey: e('ANTHROPIC_API_KEY'), ...(e('ANA_MODELO') ? { modelo: e('ANA_MODELO') } : {}) });
  const mcp = googleCalendarComoMcp({ clientId: '', clientSecret: '', refreshToken: '', fetch: fetchPeloConector(e('LOVABLE_API_KEY'), e('GOOGLE_CALENDAR_API_KEY')) });
  return {
    responder(conversa: Conversa, texto: string, opcoes: { modo?: AIMode; agora?: Date } = {}): Promise<Resposta> {
      return responder({
        sample, mcp, ferramentasOk: true,
        modo: opcoes.modo ?? 'Automática', nivel: 'quick', convite: e('ANA_CONVITE_EMAIL') !== 'nao',
        agora: () => opcoes.agora ?? new Date(),
        ...(log ? { log } : {}),
      }, conversa, texto);
    },
  };
}
