// Cliente HTTP do ProJuris ADV. Só no servidor: a Ana e o navegador nunca chamam a API.
// Credenciais (PROJURIS_CLIENT_ID e PROJURIS_CLIENT_SECRET) vêm do ambiente e nunca aparecem em logs, erros ou
// respostas. Só executa operações da lista fechada em operacoes.ts; não aceita caminho livre.
import { OPERACOES_PROJURIS, caminhoOperacao, type IdOperacaoProjuris } from './operacoes';
import { ErroProjuris } from './erros';

export const URL_AUTENTICACAO_PROJURIS = 'https://apigw.projurisadv.com.br/auth/token';
export const URL_SERVICOS_PROJURIS = 'https://api.projurisadv.com.br/adv-service/';

export { ErroProjuris, type TipoErroProjuris } from './erros';

export interface OpcoesClienteProjuris {
  credenciais?: () => { clientId: string; clientSecret: string };
  fetch?: typeof fetch;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  /** Limite da API: 480 requisições por minuto. */
  limitePorMinuto?: number;
  timeoutMs?: number;
  /** Tentativas por chamada em 429, 5xx, falha de rede ou tempo esgotado. */
  tentativas?: number;
}

export interface ChamadaProjuris {
  parametros?: Record<string, number>;
  consulta?: Record<string, string | number>;
  corpo?: unknown;
}

interface Token { valor: string; esquema: string | undefined; expiraEm: number }

export function criarClienteProjuris(o: OpcoesClienteProjuris = {}) {
  const credenciais = o.credenciais ?? (() => ({
    clientId: process.env['PROJURIS_CLIENT_ID']?.trim() ?? '',
    clientSecret: process.env['PROJURIS_CLIENT_SECRET']?.trim() ?? '',
  }));
  const executar: typeof fetch = o.fetch ?? ((...a) => fetch(...a));
  const agora = o.agora ?? Date.now;
  const esperar = o.esperar ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  const limite = Math.max(1, o.limitePorMinuto ?? 480);
  const timeoutMs = o.timeoutMs ?? 15000;
  const tentativas = Math.max(1, o.tentativas ?? 3);

  let token: Token | undefined;
  let pedidoToken: Promise<Token> | undefined;
  const janela: number[] = [];

  /** Fila: no máximo `limite` requisições em qualquer janela de 60 segundos (por instância do servidor). */
  async function vaga() {
    for (;;) {
      const t = agora();
      while (janela.length && t - janela[0]! >= 60000) janela.shift();
      if (janela.length < limite) { janela.push(t); return; }
      await esperar(Math.max(1, 60000 - (t - janela[0]!)));
    }
  }

  function espera(tentativa: number, retryAfter?: string | null) {
    const s = Number(retryAfter);
    if (retryAfter && Number.isFinite(s) && s >= 0) return Math.min(30000, s * 1000);
    return Math.min(8000, 500 * 2 ** (tentativa - 1));
  }

  async function requisitar(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // O servidor publicado não aceita redirect 'error'; 'manual' + recusa de 3xx mantém o mesmo efeito.
      const r = await executar(url, { ...init, signal: ctrl.signal, redirect: 'manual' });
      if (r.status >= 300 && r.status < 400) { await r.body?.cancel().catch(() => undefined); throw new Error('redirecionamento'); }
      return r;
    } catch (e) {
      console.error('ProJuris fetch:', e instanceof Error ? e.message : 'erro');
      throw ctrl.signal.aborted
        ? new ErroProjuris('tempo', 'O ProJuris não respondeu a tempo.')
        : new ErroProjuris('indisponivel', 'Falha de comunicação com o ProJuris.');
    } finally {
      clearTimeout(relogio);
    }
  }

  async function novoToken(): Promise<Token> {
    const { clientId, clientSecret } = credenciais();
    if (!clientId || !clientSecret) throw new ErroProjuris('configuracao', 'Credenciais do ProJuris não configuradas.');
    for (let tentativa = 1; ; tentativa++) {
      await vaga();
      let r: Response;
      try {
        r = await requisitar(URL_AUTENTICACAO_PROJURIS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
        });
      } catch (e) {
        if (tentativa < tentativas) { await esperar(espera(tentativa)); continue; }
        throw e;
      }
      if ((r.status === 429 || r.status >= 500) && tentativa < tentativas) {
        await r.body?.cancel().catch(() => undefined);
        await esperar(espera(tentativa, r.headers.get('Retry-After')));
        continue;
      }
      if (r.status === 429 || r.status >= 500) {
        await r.body?.cancel().catch(() => undefined);
        throw new ErroProjuris(r.status === 429 ? 'limite' : 'indisponivel', 'ProJuris indisponível para autenticação.', r.status);
      }
      const corpo = (await r.json().catch(() => undefined)) as { access_token?: unknown; expires_in?: unknown; token_type?: unknown } | undefined;
      if (!r.ok || typeof corpo?.access_token !== 'string' || !corpo.access_token) throw new ErroProjuris('autenticacao', 'Credencial recusada pelo ProJuris.', r.status);
      const segundos = typeof corpo.expires_in === 'number' && corpo.expires_in > 0 ? corpo.expires_in : 300;
      const esquema = typeof corpo.token_type === 'string' && corpo.token_type.trim() ? corpo.token_type.trim() : undefined;
      // Renova 60 s antes do vencimento informado em expires_in.
      return { valor: corpo.access_token, esquema, expiraEm: agora() + Math.max(10, segundos - 60) * 1000 };
    }
  }

  /** Token em cache até perto do vencimento; pedidos simultâneos compartilham a mesma autenticação. */
  async function tokenValido(renovar = false): Promise<Token> {
    if (renovar) token = undefined;
    if (token && agora() < token.expiraEm) return token;
    pedidoToken ??= novoToken().then(t => (token = t)).finally(() => { pedidoToken = undefined; });
    return pedidoToken;
  }

  /** Executa uma operação da lista fechada e devolve o JSON da resposta (null quando vazia). */
  async function chamar<T = unknown>(id: IdOperacaoProjuris, c: ChamadaProjuris = {}): Promise<T> {
    const op = OPERACOES_PROJURIS[id];
    if (op.metodo === 'GET' && c.corpo !== undefined) throw new ErroProjuris('resposta', 'Consulta inválida para o ProJuris.');
    const url = new URL(caminhoOperacao(id, c.parametros), URL_SERVICOS_PROJURIS);
    for (const [k, v] of Object.entries(c.consulta ?? {})) url.searchParams.set(k, String(v));
    let renovado = false;
    let tentativa = 1;
    for (;;) {
      const t = await tokenValido();
      await vaga();
      let r: Response;
      try {
        r = await requisitar(url.toString(), {
          method: op.metodo,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: t.esquema ? `${t.esquema} ${t.valor}` : t.valor },
          ...(op.metodo === 'POST' ? { body: JSON.stringify(c.corpo ?? {}) } : {}),
        });
      } catch (e) {
        if (tentativa < tentativas) { await esperar(espera(tentativa)); tentativa++; continue; }
        throw e;
      }
      if (r.ok) {
        const texto = await r.text();
        if (!texto.trim()) return null as T;
        try { return JSON.parse(texto) as T; } catch { throw new ErroProjuris('resposta', 'Resposta inválida do ProJuris.', r.status); }
      }
      await r.body?.cancel().catch(() => undefined);
      // Token vencido ou revogado: renova uma única vez, sem contar como tentativa.
      if (r.status === 401 && !renovado) { renovado = true; await tokenValido(true); continue; }
      if (r.status === 401) throw new ErroProjuris('autenticacao', 'Credencial recusada pelo ProJuris.', 401);
      if (r.status === 403) throw new ErroProjuris('sem_permissao', 'O usuário da integração não tem permissão para esta consulta no ProJuris.', 403);
      if ((r.status === 429 || r.status >= 500) && tentativa < tentativas) {
        await esperar(espera(tentativa, r.headers.get('Retry-After')));
        tentativa++;
        continue;
      }
      if (r.status === 429) throw new ErroProjuris('limite', 'Limite de requisições do ProJuris atingido.', 429);
      if (r.status >= 500) throw new ErroProjuris('indisponivel', 'ProJuris indisponível no momento.', r.status);
      throw new ErroProjuris('resposta', 'O ProJuris recusou a consulta.', r.status);
    }
  }

  /** Verificação de prontidão: só obtém um token novo; não consulta nenhum dado. */
  async function verificarAutenticacao(): Promise<true> {
    await tokenValido(true);
    return true;
  }

  return { chamar, verificarAutenticacao };
}

export type ClienteProjuris = ReturnType<typeof criarClienteProjuris>;

/** Instância do servidor; o cache de token e a fila valem por instância. */
export const projuris = criarClienteProjuris();
