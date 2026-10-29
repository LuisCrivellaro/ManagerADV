import { describe, it, expect } from 'vitest';
import { OPERACOES_PROJURIS, caminhoOperacao, type IdOperacaoProjuris } from '@/lib/projuris/operacoes';
import { criarClienteProjuris, ErroProjuris, URL_AUTENTICACAO_PROJURIS } from '@/lib/projuris/cliente.server';
import { criarConsultasProjuris } from '@/lib/projuris/consultas.server';
import * as clienteModulo from '@/lib/projuris/cliente.server';
import * as consultasModulo from '@/lib/projuris/consultas.server';

const CRED = { clientId: 'id-ficticio', clientSecret: 'segredo-ficticio' };
type Resposta = { status: number; corpo?: unknown; headers?: Record<string, string> };
const json = (status: number, corpo?: unknown, headers: Record<string, string> = {}): Resposta => ({ status, corpo, headers });

/** ProJuris simulado: responde por ordem de chamada, por URL; registra tudo. */
function simulado(rotas: (url: string, init: RequestInit) => Resposta) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url);
    chamadas.push({ url: u, init });
    const r = rotas(u, init);
    return new Response(r.corpo === undefined ? null : JSON.stringify(r.corpo), { status: r.status, headers: r.headers ?? {} });
  }) as typeof fetch;
  return { f, chamadas };
}

function relogio() {
  let t = 1_000_000;
  const esperas: number[] = [];
  return { agora: () => t, esperar: async (ms: number) => { esperas.push(ms); t += ms; }, avancar: (ms: number) => { t += ms; }, esperas };
}

const token = (valor = 'tk-1', expires_in = 1500) => json(200, { access_token: valor, expires_in, token_type: 'Bearer' });

describe('ProJuris · lista fechada de operações', () => {
  it('só consultas: nenhuma operação de apagar, arquivos, financeiro, horas, comentários, tarefas, usuários ou configurações', () => {
    const proibido = /remov|exclu|delet|arquivo|financ|receita|pagamento|apontamento|hora|comentario|solicitac|tarefa|atendimento|usuario|perfil|permiss|webhook|notificac|credencia|config/i;
    for (const [id, op] of Object.entries(OPERACOES_PROJURIS)) {
      expect(['GET', 'POST'], id).toContain(op.metodo);
      expect(op.caminho, id).not.toMatch(proibido);
      expect(op.somenteLeitura).toBe(true);
    }
  });
  it('o cliente não expõe função para caminho livre nem para gravar', () => {
    const c = criarClienteProjuris({ credenciais: () => CRED });
    expect(Object.keys(c).sort()).toEqual(['chamar', 'verificarAutenticacao']);
    expect(Object.keys(clienteModulo).filter(k => /remov|exclu|apag|delet|arquivo/i.test(k))).toEqual([]);
    expect(Object.keys(consultasModulo).filter(k => /remov|exclu|apag|delet|arquivo/i.test(k))).toEqual([]);
  });
  it('operação fora da lista e parâmetro não numérico são recusados', () => {
    expect(() => caminhoOperacao('pessoa.remover' as IdOperacaoProjuris)).toThrow('não permitida');
    expect(() => caminhoOperacao('pessoa.obter', { codigo: -1 })).toThrow('Parâmetro inválido');
    expect(() => caminhoOperacao('processo.andamentos', {})).toThrow('Parâmetro inválido');
    expect(caminhoOperacao('processo.andamentos', { codigo: 42 })).toBe('processo/42/andamento/consulta');
  });
});

describe('ProJuris · autenticação e chamadas', () => {
  it('client_credentials no endereço de autenticação, token com "Bearer" e cache até perto do vencimento', async () => {
    const r = relogio();
    const { f, chamadas } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : json(200, { totalRegistros: 3, pessoaConsulta: [] }));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, agora: r.agora, esperar: r.esperar });
    await c.chamar('pessoa.consulta', { consulta: { 'quan-registros': 1 } });
    await c.chamar('pessoa.consulta', { consulta: { 'quan-registros': 1 } });
    const auth = chamadas.filter(x => x.url === URL_AUTENTICACAO_PROJURIS);
    expect(auth).toHaveLength(1);
    const corpo = new URLSearchParams(String(auth[0]!.init.body));
    expect(corpo.get('grant_type')).toBe('client_credentials');
    expect(corpo.get('client_id')).toBe(CRED.clientId);
    const consulta = chamadas.find(x => x.url.includes('/pessoa/consulta'))!;
    expect(consulta.url).toBe('https://api.projurisadv.com.br/adv-service/pessoa/consulta?quan-registros=1');
    expect((consulta.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tk-1');
  });

  it('token expirado: renova pelo expires_in e, se a API recusar com 401, renova uma vez e repete', async () => {
    const r = relogio();
    let emitidos = 0;
    let recusarProxima = false;
    const { f, chamadas } = simulado(url => {
      if (url === URL_AUTENTICACAO_PROJURIS) return token(`tk-${++emitidos}`, 120);
      if (recusarProxima) { recusarProxima = false; return json(401); }
      return json(200, { ok: true });
    });
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, agora: r.agora, esperar: r.esperar });
    await c.chamar('pessoa.obter', { parametros: { codigo: 1 } });
    r.avancar(61_000); // expires_in 120 s − 60 s de folga
    await c.chamar('pessoa.obter', { parametros: { codigo: 1 } });
    expect(emitidos).toBe(2);
    recusarProxima = true;
    await expect(c.chamar('pessoa.obter', { parametros: { codigo: 1 } })).resolves.toEqual({ ok: true });
    expect(emitidos).toBe(3);
    const auths = chamadas.filter(x => x.url !== URL_AUTENTICACAO_PROJURIS).map(x => (x.init.headers as Record<string, string>)['Authorization']);
    expect(auths).toEqual(['Bearer tk-1', 'Bearer tk-2', 'Bearer tk-2', 'Bearer tk-3']);
  });

  it('401 duas vezes seguidas é credencial recusada, sem laço', async () => {
    const { f } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : json(401));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, esperar: async () => {} });
    await expect(c.chamar('pessoa.obter', { parametros: { codigo: 1 } })).rejects.toMatchObject({ tipo: 'autenticacao', status: 401 });
  });

  it('erro 403: sem permissão, registrado como tal e sem nova tentativa', async () => {
    const { f, chamadas } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : json(403, { mensagem: 'dado interno' }));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, esperar: async () => {} });
    const erro = (await c.chamar('processo.consultaCompleta', { corpo: {} }).catch((e: unknown) => e)) as ErroProjuris;
    expect(erro).toBeInstanceOf(ErroProjuris);
    expect(erro).toMatchObject({ tipo: 'sem_permissao', status: 403 });
    expect(String(erro.message)).not.toContain('dado interno');
    expect(chamadas.filter(x => x.url !== URL_AUTENTICACAO_PROJURIS)).toHaveLength(1);
  });

  it('limite de requisições: 429 espera o Retry-After e tenta de novo; persistindo, avisa limite', async () => {
    const r = relogio();
    let n = 0;
    const { f } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : ++n < 3 ? json(429, undefined, { 'Retry-After': '2' }) : json(200, { ok: true }));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, agora: r.agora, esperar: r.esperar });
    await expect(c.chamar('pessoa.obter', { parametros: { codigo: 1 } })).resolves.toEqual({ ok: true });
    expect(r.esperas).toEqual([2000, 2000]);
    const { f: f2 } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : json(429));
    const c2 = criarClienteProjuris({ credenciais: () => CRED, fetch: f2, esperar: async () => {} });
    await expect(c2.chamar('pessoa.obter', { parametros: { codigo: 1 } })).rejects.toMatchObject({ tipo: 'limite', status: 429 });
  });

  it('fila: no máximo N requisições por minuto (o pedido de token também conta); a seguinte espera a janela abrir', async () => {
    const r = relogio();
    const { f, chamadas } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : json(200, {}));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, agora: r.agora, esperar: r.esperar, limitePorMinuto: 3 });
    for (let i = 0; i < 2; i++) await c.chamar('pessoa.obter', { parametros: { codigo: 1 } });
    expect(chamadas).toHaveLength(3);
    expect(r.esperas).toEqual([]);
    await c.chamar('pessoa.obter', { parametros: { codigo: 1 } });
    expect(r.esperas).toEqual([60000]);
    expect(chamadas).toHaveLength(4);
  });

  it('5xx tenta de novo com espera crescente; falha de rede e tempo esgotado viram erros próprios', async () => {
    const r = relogio();
    let n = 0;
    const { f } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : ++n < 3 ? json(503) : json(200, { ok: true }));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f, agora: r.agora, esperar: r.esperar });
    await expect(c.chamar('pessoa.obter', { parametros: { codigo: 1 } })).resolves.toEqual({ ok: true });
    expect(r.esperas).toEqual([500, 1000]);

    const lento = (async (url: string | URL | Request, init: RequestInit = {}) => {
      if (String(url) === URL_AUTENTICACAO_PROJURIS) return new Response(JSON.stringify({ access_token: 't', expires_in: 900 }), { status: 200 });
      return new Promise<Response>((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('abortado'))));
    }) as typeof fetch;
    const c2 = criarClienteProjuris({ credenciais: () => CRED, fetch: lento, esperar: async () => {}, timeoutMs: 5, tentativas: 2 });
    await expect(c2.chamar('pessoa.obter', { parametros: { codigo: 1 } })).rejects.toMatchObject({ tipo: 'tempo' });
  });

  it('sem credenciais não chama a API; verificação de prontidão só autentica', async () => {
    const { f, chamadas } = simulado(() => token());
    const vazio = criarClienteProjuris({ credenciais: () => ({ clientId: '', clientSecret: '' }), fetch: f });
    await expect(vazio.verificarAutenticacao()).rejects.toMatchObject({ tipo: 'configuracao' });
    expect(chamadas).toHaveLength(0);
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f });
    await expect(c.verificarAutenticacao()).resolves.toBe(true);
    expect(chamadas.map(x => x.url)).toEqual([URL_AUTENTICACAO_PROJURIS]);
  });

  it('credencial recusada na autenticação e mensagens sem segredos', async () => {
    const { f } = simulado(() => json(401, { error: 'invalid_client' }));
    const c = criarClienteProjuris({ credenciais: () => CRED, fetch: f });
    const erro = (await c.verificarAutenticacao().catch((e: unknown) => e)) as ErroProjuris;
    expect(erro).toMatchObject({ tipo: 'autenticacao' });
    expect(JSON.stringify({ m: erro.message, s: erro.stack })).not.toMatch(/segredo-ficticio|id-ficticio/);
  });
});

describe('ProJuris · consultas compostas', () => {
  function api(processos: unknown[], andamentos: { total: number; paginas: Record<number, unknown[]> }) {
    return simulado((url, init) => {
      if (url === URL_AUTENTICACAO_PROJURIS) return token();
      if (url.includes('/tipo?')) return json(200, { consultaTipoRetorno: [{ registros: [{ chave: 7, valor: 'Ativo' }, { chave: 9, valor: 'Arquivado' }] }] });
      if (url.includes('/processo/consulta-completa')) {
        const filtro = JSON.parse(String(init.body));
        expect(filtro).toEqual({ codigoPessoaEnvolvido: 10, codigoSituacao: 7 });
        return json(200, { totalRegistros: processos.length, processoConsultaCompleta: processos });
      }
      const m = /\/processo\/(\d+)\/andamento\/consulta\?pagina=(\d+)/.exec(url);
      if (m) return json(200, { totalRegistros: andamentos.total, andamentoProcessoWs: andamentos.paginas[Number(m[2])] ?? [] });
      return json(404);
    });
  }

  it('vários processos: a situação "Ativo" vem da API e o filtro local confere cliente e situação', async () => {
    const { f } = api([
      { codigoProcesso: 1, situacaoProcesso: { chave: 7 }, segredoJustica: false, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 10, flagCliente: true }] },
      { codigoProcesso: 2, situacaoProcesso: { chave: 9 }, segredoJustica: false, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 10, flagCliente: true }] },
      { codigoProcesso: 3, situacaoProcesso: { chave: 7 }, segredoJustica: true, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 10, flagCliente: true }] },
      { codigoProcesso: 4, situacaoProcesso: { chave: 7 }, segredoJustica: false, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 10, flagCliente: false }] },
    ], { total: 0, paginas: {} });
    const q = criarConsultasProjuris(criarClienteProjuris({ credenciais: () => CRED, fetch: f }));
    const lista = await q.processosAtivos(10);
    expect(lista.map(p => [p.codigo, p.segredoJustica])).toEqual([[1, false], [3, true]]);
  });

  it('andamentos: lê a primeira e a última página, ignora privados e devolve os 3 mais recentes', async () => {
    const pagina0 = Array.from({ length: 50 }, (_, i) => ({ codigoAndamento: i + 1, descricaoAndamento: `Antigo ${i + 1}`, dataAndamento: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`, privado: false }));
    const pagina1 = [
      { codigoAndamento: 100, descricaoAndamento: 'Sentença', dataAndamento: '2026-10-20', privado: true },
      { codigoAndamento: 101, descricaoAndamento: 'Conclusos para decisão', dataAndamento: '2026-10-18', privado: false, nomeTipoAndamento: 'Conclusão' },
      { codigoAndamento: 102, descricaoAndamento: 'Juntada de petição', dataAndamento: '2026-10-10', privado: false },
      { codigoAndamento: 103, descricaoAndamento: 'Audiência designada', dataAndamento: '2026-09-30' },
      { codigoAndamento: 104, descricaoAndamento: 'Despacho', dataAndamento: '2026-09-01', privado: false },
    ];
    const { f, chamadas } = api([], { total: 55, paginas: { 0: pagina0, 1: pagina1 } });
    const q = criarConsultasProjuris(criarClienteProjuris({ credenciais: () => CRED, fetch: f }));
    const r = await q.ultimosAndamentos(42);
    expect(r.map(a => a.descricao)).toEqual(['Conclusos para decisão', 'Juntada de petição', 'Despacho']);
    expect(r[0]).toEqual({ data: '18/10/2026', tipo: 'Conclusão', descricao: 'Conclusos para decisão' });
    expect(chamadas.filter(c => c.url.includes('/andamento/consulta')).map(c => new URL(c.url).searchParams.get('pagina'))).toEqual(['0', '1']);
  });

  it('sem situação "Ativo" única, recusa em vez de adivinhar', async () => {
    const { f } = simulado(url => url === URL_AUTENTICACAO_PROJURIS ? token() : json(200, { consultaTipoRetorno: [] }));
    const q = criarConsultasProjuris(criarClienteProjuris({ credenciais: () => CRED, fetch: f }));
    await expect(q.processosAtivos(10)).rejects.toMatchObject({ tipo: 'resposta' });
  });
});
