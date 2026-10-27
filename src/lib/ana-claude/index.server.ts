// Ana no servidor do Manager ADV: uma chamada por mensagem recebida do cliente.
//
//   const ana = anaDoAmbiente();                       // lê as chaves dos segredos do Lovable Cloud
//   const conversa = estadoSalvo ?? conversaNova();     // estado da Ana guardado por conversa no banco
//   const r = await ana.responder(conversa, textoDoCliente, { modo: 'Automática' });
//   salvar(r.conversa);                                 // guardar o novo estado
//   for (const balao of r.blocos) enviarAoCliente(balao);
//   if (r.avisouEquipe) marcarParaEquipe();             // pedido de pessoa ou falha da agenda
//
import type { AIMode } from './base';
import { claudeComoSample } from './claude.server';
import { googleCalendarComoMcp } from './google.server';
import { conversaNova, responder, type Conversa, type Resposta } from './motor';

export { conversaNova };
export type { Conversa, Resposta };
export type { Decisao, EstadoAna, Consulta } from './motor';
export { INSTRUCOES_ANA } from './prompt';

export interface ConfigAna {
  anthropicApiKey: string;
  /** claude-haiku-5-5 (padrão, mais barato) ou claude-sonnet-5-5 (mais forte). */
  modelo?: string;
  google: { clientId: string; clientSecret: string; refreshToken: string; calendarId?: string };
  /** Enviar o convite do Google Meet por e-mail ao cliente. Padrão: sim. */
  convite?: boolean;
  log?: (texto: string, tipo?: 'ok' | 'aviso' | 'erro') => void;
}

export function criarAna(cfg: ConfigAna) {
  const sample = claudeComoSample({ apiKey: cfg.anthropicApiKey, ...(cfg.modelo ? { modelo: cfg.modelo } : {}) });
  const mcp = googleCalendarComoMcp(cfg.google);
  return {
    /** Responde uma mensagem do cliente. Nunca lança erro de agenda: a Ana avisa o cliente e a equipe. Erros da API do Claude são lançados com .code. */
    async responder(conversa: Conversa, texto: string, opcoes: { modo?: AIMode; agora?: Date; signal?: AbortSignal } = {}): Promise<Resposta> {
      return responder({
        sample, mcp, ferramentasOk: true,
        modo: opcoes.modo ?? 'Automática', nivel: 'quick', convite: cfg.convite ?? true,
        agora: () => opcoes.agora ?? new Date(),
        ...(cfg.log ? { log: cfg.log } : {}),
      }, conversa, texto, opcoes.signal);
    },
  };
}

/** Lê a configuração dos segredos do Lovable Cloud. Falha com mensagem clara se faltar algum. */
export function anaDoAmbiente(log?: ConfigAna['log']) {
  const e = (nome: string) => process.env[nome] ?? '';
  const faltando = ['ANTHROPIC_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].filter(n => !e(n));
  if (faltando.length) throw new Error(`Segredos faltando no Lovable Cloud: ${faltando.join(', ')}`);
  return criarAna({
    anthropicApiKey: e('ANTHROPIC_API_KEY'),
    ...(e('ANA_MODELO') ? { modelo: e('ANA_MODELO') } : {}),
    google: { clientId: e('GOOGLE_CLIENT_ID'), clientSecret: e('GOOGLE_CLIENT_SECRET'), refreshToken: e('GOOGLE_REFRESH_TOKEN'), ...(e('GOOGLE_CALENDAR_ID') ? { calendarId: e('GOOGLE_CALENDAR_ID') } : {}) },
    convite: e('ANA_CONVITE_EMAIL') !== 'nao',
    ...(log ? { log } : {}),
  });
}
