// Claude pela API da Anthropic, no formato que o motor da Ana espera (o mesmo que a página do claude.ai fornecia).
// Só no servidor: a chave ANTHROPIC_API_KEY nunca vai para o navegador.
import type { SampleFn } from './motor';

export interface ConfigClaude {
  apiKey: string;
  /** Modelo da Ana. Padrão: claude-haiku-5-5. Alternativa mais forte: claude-sonnet-5-5. */
  modelo?: string;
  maxTokens?: number;
  /** Para testes: substitui o fetch global. */
  fetch?: typeof fetch;
}

type Bloco = { type: string; text?: string; id?: string; name?: string; input?: unknown; [k: string]: unknown };
type Ferramenta = { name: string; description: string; inputSchema: unknown; execute: (input: Record<string, unknown>) => Promise<unknown> };
type Turno = { role: 'user' | 'assistant'; content: string | Bloco[] };

/** Erro com código, como o motor e a tela esperam. */
function erro(code: string, message: string, retryable = false) { return Object.assign(new Error(message), { code, retryable }); }

function lerJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/g, '').trim();
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw erro('invalid_json', 'Resposta sem JSON.');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

export function claudeComoSample(cfg: ConfigClaude): SampleFn {
  const f = cfg.fetch ?? fetch;
  const modelo = cfg.modelo || 'claude-haiku-5-5';

  async function chamar(corpo: Record<string, unknown>, signal?: AbortSignal): Promise<{ content: Bloco[]; stop_reason: string }> {
    let res: Response;
    try {
      res = await f('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
        ...(signal ? { signal } : {}),
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw erro('cancelled', 'Interrompido.');
      throw erro('server_unavailable', 'Não foi possível falar com a API do Claude.', true);
    }
    if (res.ok) return (await res.json()) as { content: Bloco[]; stop_reason: string };
    // Nunca repassa o corpo do erro inteiro: pode trazer detalhes da conta.
    if (res.status === 401 || res.status === 403) throw erro('chave_invalida', 'A chave da API do Claude foi recusada. Confira ANTHROPIC_API_KEY.');
    if (res.status === 429) throw erro('rate_limited', 'Limite de uso da API do Claude atingido. Tente de novo em instantes.', true);
    if (res.status === 400) { const b = await res.json().catch(() => ({})) as { error?: { message?: string } }; throw erro('pedido_invalido', `A API do Claude recusou o pedido: ${(b.error?.message ?? '').slice(0, 200)}`); }
    throw erro('server_unavailable', `A API do Claude respondeu ${res.status}.`, res.status >= 500);
  }

  /** Conversa com ferramentas até o Claude dar a resposta final (no máximo 8 rodadas). */
  async function conversar(input: unknown, opts: { tools?: Ferramenta[]; signal?: AbortSignal } = {}) {
    let system: string | undefined;
    let mensagens: Turno[];
    if (typeof input === 'string') mensagens = [{ role: 'user', content: input }];
    else {
      const turnos = input as { role: 'user' | 'assistant'; content: string }[];
      // O motor manda as instruções da Ana no primeiro turno: aqui elas viram o system prompt, com cache.
      system = turnos[0]?.content;
      mensagens = turnos.slice(1).map(t => ({ role: t.role, content: t.content }));
    }
    const ferramentas = opts.tools ?? [];
    const base: Record<string, unknown> = {
      model: modelo,
      max_tokens: cfg.maxTokens ?? 4096,
      ...(system ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] } : {}),
      ...(ferramentas.length ? { tools: ferramentas.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) } : {}),
    };
    for (let rodada = 0; rodada < 8; rodada++) {
      const r = await chamar({ ...base, messages: mensagens }, opts.signal);
      if (r.stop_reason !== 'tool_use') return r.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
      // O Claude pediu ferramentas: executa cada uma e devolve os resultados.
      const resultados: Bloco[] = [];
      for (const b of r.content.filter(x => x.type === 'tool_use')) {
        const ferramenta = ferramentas.find(t => t.name === b.name);
        try {
          if (!ferramenta) throw new Error(`Ferramenta desconhecida: ${b.name}`);
          const saida = await ferramenta.execute((b.input ?? {}) as Record<string, unknown>);
          resultados.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(saida ?? null) });
        } catch (e) {
          resultados.push({ type: 'tool_result', tool_use_id: b.id, content: (e as Error).message || 'Erro na ferramenta.', is_error: true });
        }
      }
      // A resposta do Claude volta inteira (inclusive blocos de raciocínio), como a API exige.
      mensagens = [...mensagens, { role: 'assistant', content: r.content }, { role: 'user', content: resultados }];
    }
    throw erro('empty_completion', 'O Claude não concluiu a resposta em 8 rodadas de ferramentas.');
  }

  const sample = (async (input: unknown, opts?: unknown) => ({ text: await conversar(input, (opts ?? {}) as { tools?: Ferramenta[]; signal?: AbortSignal }) })) as SampleFn;
  sample.json = async (input: unknown, opts?: unknown) => {
    const o = (opts ?? {}) as { tools?: Ferramenta[]; signal?: AbortSignal };
    const texto = await conversar(input, o);
    try { return lerJson(texto); }
    catch {
      // Uma nova tentativa, pedindo só o JSON (sem ferramentas, para não repetir ações na agenda).
      const turnos = typeof input === 'string' ? input : [...(input as Turno[]), { role: 'assistant', content: texto || '(vazio)' }, { role: 'user', content: 'Responda de novo, só com o objeto JSON pedido, sem texto antes ou depois.' }];
      const de_novo = await conversar(turnos, { ...(o.signal ? { signal: o.signal } : {}) });
      try { return lerJson(de_novo); } catch { throw erro('invalid_json', 'O Claude respondeu fora do formato JSON.'); }
    }
  };
  sample.limits = async () => ({ tools: { maxCount: 10 } });
  return sample;
}
