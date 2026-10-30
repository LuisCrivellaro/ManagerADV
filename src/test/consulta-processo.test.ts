import { describe, it, expect } from 'vitest';
import {
  iniciarConsultaProcesso, interpretarRespostaRevisora, aplicarDecisao, pendencias, prazoRetorno, frasePrazo, validarRascunho, rascunhoPadrao,
  respostaAutorizada, respostaDuranteEspera, pedidoNoticiaProcesso, escolherProcessos, hashTexto, TEXTOS_CONSULTA, CONFIG_CONSULTA_PADRAO,
  type PortasConsulta, type PedidoProcesso, type FatoProcesso, type EntradaRedacao,
} from '@/lib/atendimento/consulta-processo';
import { criarProjurisFicticio, projurisFicticioPadrao, TELEFONES_FICTICIOS as T, type FalhaFicticia } from '@/lib/projuris/ficticio';

const AGORA = new Date('2026-10-29T13:00:00Z'); // quinta, 10h em Brasília

/** Redação simulada que segue as regras: só fatos, uma linha por movimentação. */
function redacaoFiel(e: EntradaRedacao): string {
  const partes = e.processos.map(p => 'segredo_de_justica' in p
    ? 'Sobre um dos seus processos, nossa equipe vai entrar em contato com você.'
    : p.movimentacoes.length ? `No processo ${p.numero}:\n${p.movimentacoes.map(m => `• ${m.data}: ${m.descricao}`).join('\n')}` : `No processo ${p.numero}, não há movimentação nova registrada até o momento.`);
  return `${e.primeiro_nome}, ${partes.join('\n\n')}\nSe quiser entender alguma movimentação, a equipe explica.`;
}

function portas(o: { redigir?: (e: EntradaRedacao) => Promise<string>; falha?: () => FalhaFicticia | undefined; falhaAndamentos?: FalhaFicticia; codigos?: string[]; agora?: Date } = {}) {
  const pj = criarProjurisFicticio(projurisFicticioPadrao(), o.falha ? { falha: o.falha } : {});
  const reg = { avisos: [] as string[], revisora: [] as string[], registros: [] as string[], redacoes: [] as EntradaRedacao[] };
  const p: PortasConsulta = {
    agora: () => o.agora ?? AGORA,
    identificar: pj.identificar,
    processosAtivos: pj.processosAtivos,
    ultimosAndamentos: async c => { if (o.falhaAndamentos) { const { ErroProjuris } = await import('@/lib/projuris/erros'); throw new ErroProjuris(o.falhaAndamentos.tipo, 'falha', o.falhaAndamentos.status); } return pj.ultimosAndamentos(c); },
    redigir: async e => { reg.redacoes.push(e); return (o.redigir ?? (async x => redacaoFiel(x)))(e); },
    codigosExistentes: async () => o.codigos ?? [],
    avisarCliente: async t => { reg.avisos.push(t); },
    enviarRevisora: async t => { reg.revisora.push(t); },
    registrar: async (ev, d) => { reg.registros.push(`${ev}${d ? `: ${d}` : ''}`); },
  };
  return { p, reg };
}

const consulta = (telefone: string, texto: string, extra: Partial<{ assuntoJaPerguntado: boolean; conversaId: string }> = {}, ports = portas()) =>
  iniciarConsultaProcesso({ conversaId: extra.conversaId ?? 'conv-1', telefone, nomeContato: 'Contato', textoCliente: texto, assuntoJaPerguntado: extra.assuntoJaPerguntado ?? false }, ports.p);

describe('A. Identificação', () => {
  it('1. cliente com telefone principal e 1 processo ativo: um aviso, pedido à revisora completo', async () => {
    const pt = portas();
    const r = await consulta(T.umProcesso, 'oi, como tá meu processo?', {}, pt);
    expect(r.tipo).toBe('pedido');
    if (r.tipo !== 'pedido') return;
    expect(pt.reg.avisos).toEqual([TEXTOS_CONSULTA.aviso]);
    expect(r.pedido.codigo).toBe('AND-0001');
    expect(r.pedido.processos.map(f => f.codigo)).toEqual([1001]);
    const msg = pt.reg.revisora[0]!;
    for (const trecho of ['AND-0001', 'Marina Fictícia Souza', T.umProcesso, 'telefone principal', '1000001-11.2026.5.02.0001', 'TRT-2', 'Despacho', 'Juntada de contestação', r.pedido.textoProposto]) expect(msg).toContain(trecho);
    expect(r.pedido.hash).toBe(await hashTexto(r.pedido.textoProposto));
  });
  it('2. mesmo cliente com 55, sem 55, com e sem o nono dígito', async () => {
    for (const tel of ['5511990000001', '11990000001', '551190000001', '1190000001', '+55 (11) 99000-0001']) {
      const r = await consulta(tel, 'novidade do meu processo?');
      expect(r.tipo, tel).toBe('pedido');
      if (r.tipo === 'pedido') expect(r.pedido.contato.nome).toBe('Marina Fictícia Souza');
    }
  });
  it('3. telefone não cadastrado: não cliente, sem aviso e sem nada à revisora', async () => {
    const pt = portas();
    expect(await consulta(T.desconhecido, 'e meu processo?', {}, pt)).toEqual({ tipo: 'nao_cliente' });
    expect(pt.reg.avisos).toEqual([]);
    expect(pt.reg.revisora).toEqual([]);
  });
  it('4. telefone em duas pessoas: equipe, sem mencionar duplicidade ao contato', async () => {
    const pt = portas();
    const r = await consulta(T.duplicado, 'como está meu processo', {}, pt);
    expect(r.tipo).toBe('equipe');
    if (r.tipo !== 'equipe') return;
    expect(r.mensagem).not.toMatch(/duplic|duas pessoas|mais de uma|cadastro/i);
    expect(pt.reg.registros.join('|')).toMatch(/telefone principal em 2 pessoas/);
  });
  it('5. telefone cadastrado mas não principal: não identifica', async () => {
    expect(await consulta(T.naoPrincipal, 'meu processo andou?')).toEqual({ tipo: 'nao_cliente' });
  });
});

describe('B. Processos e conteúdo', () => {
  it('6. três processos e o cliente diz o assunto', async () => {
    const trab = await consulta(T.tresProcessos, 'e o trabalhista, teve alguma coisa?');
    expect(trab.tipo === 'pedido' && trab.pedido.processos.map(f => f.codigo)).toEqual([2001]);
    const danos = await consulta(T.tresProcessos, 'queria saber da ação de danos morais');
    expect(danos.tipo === 'pedido' && danos.pedido.processos.map(f => f.codigo)).toEqual([2003]);
    const pensao = await consulta(T.tresProcessos, 'e o da pensão?');
    expect(pensao).toMatchObject({ tipo: 'equipe', motivo: 'segredo de justiça' });
  });
  it('7. vários processos sem assunto: pergunta em linguagem natural, sem listar; se não souber, cobre todos', async () => {
    const pt = portas();
    const r1 = await consulta(T.tresProcessos, 'e aí, como tá meu caso?', {}, pt);
    expect(r1).toMatchObject({ tipo: 'perguntar_assunto', mensagem: TEXTOS_CONSULTA.perguntaAssunto });
    expect(TEXTOS_CONSULTA.perguntaAssunto).not.toMatch(/\d|process/i);
    expect(pt.reg.avisos).toEqual([]);
    const r2 = await consulta(T.tresProcessos, 'não sei, quero saber de tudo', { assuntoJaPerguntado: true }, pt);
    expect(r2.tipo).toBe('pedido');
    if (r2.tipo !== 'pedido') return;
    expect(r2.pedido.processos.map(f => [f.codigo, f.segredo])).toEqual([[2001, false], [2002, true], [2003, false]]);
    const sigilo = r2.pedido.processos[1]!;
    expect(sigilo.andamentos).toEqual([]);
    expect(r2.pedido.textoProposto).not.toContain('1000003-33.2025.8.26.0100');
    expect(JSON.stringify(pt.reg.redacoes.at(-1))).not.toMatch(/1000003|Alimentos|provisórios/);
  });
  it('8. só processos arquivados: nenhum detalhe; equipe confirma', async () => {
    expect(await consulta(T.soArquivados, 'meu processo acabou?')).toMatchObject({ tipo: 'equipe', motivo: 'nenhum processo ativo como cliente' });
  });
  it('9. andamento privado nunca aparece no rascunho nem na mensagem à revisora', async () => {
    const pt = portas();
    const r = await consulta(T.umProcesso, 'novidades do processo?', {}, pt);
    expect(r.tipo === 'pedido' && r.pedido.textoProposto).not.toMatch(/Estratégia|acordo/);
    expect(pt.reg.revisora.join()).not.toMatch(/Estratégia|acordo/);
    expect(JSON.stringify(pt.reg.redacoes)).not.toMatch(/Estratégia/);
  });
  it('10. segredo de justiça: não detalha; equipe entra em contato', async () => {
    const pt = portas();
    expect(await consulta(T.segredo, 'como está o processo da guarda?', {}, pt)).toMatchObject({ tipo: 'equipe', motivo: 'segredo de justiça' });
    expect(pt.reg.avisos).toEqual([]);
  });
  it('11. processo ativo sem andamento', async () => {
    const pt = portas();
    const r = await consulta(T.semAndamento, 'teve andamento no meu processo?', {}, pt);
    expect(r.tipo === 'pedido' && r.pedido.textoProposto).toMatch(/não há movimentação nova/);
    expect(pt.reg.revisora[0]).toContain('sem movimentação registrada');
  });
  it('12. pessoa que aparece no processo mas não como cliente: não mostra', async () => {
    expect(await consulta(T.naoCliente, 'como está o processo?')).toMatchObject({ tipo: 'equipe', motivo: 'nenhum processo ativo como cliente' });
  });
  it('escolha por assunto também reconhece a Justiça do Trabalho pelo número', () => {
    const procs = projurisFicticioPadrao().processos.filter(p => p.envolvidos.some(e => e.codigoPessoa === 102));
    expect(escolherProcessos(procs, 'da reclamação contra o patrão').escolhidos.map(p => p.codigo)).toEqual([2001]);
    expect(escolherProcessos(procs, 'oi').criterio).toBe('indefinido');
  });
});

describe('Rascunho: só fatos', () => {
  const fatos: FatoProcesso[] = [{ codigo: 1, identificacao: 'x', numero: '1000001-11.2026.5.02.0001', segredo: false, andamentos: [{ data: '21/10/2026', descricao: 'Designada audiência para 10/12/2026, às 14h.' }] }];
  it('aceita número e datas presentes nos fatos, inclusive dentro da descrição', () => {
    expect(validarRascunho('Processo 1000001-11.2026.5.02.0001: em 21/10/2026 foi designada audiência para 10/12/2026.', fatos)).toEqual({ ok: true, problemas: [] });
  });
  it('recusa data ou número inventado e lista numerada', () => {
    expect(validarRascunho('A sentença sai em 15/01/2027.', fatos).ok).toBe(false);
    expect(validarRascunho('Processo 9999999-99.2026.8.26.0100 andou.', fatos).ok).toBe(false);
    expect(validarRascunho('1. Juntada\n2. Despacho', fatos).ok).toBe(false);
  });
  it('rascunho inválido da Ana é trocado pelo padrão e registrado', async () => {
    const pt = portas({ redigir: async () => 'Fique tranquila, a sentença sai em 15/01/2027 e você vai ganhar.' });
    const r = await consulta(T.umProcesso, 'como está meu processo?', {}, pt);
    expect(r.tipo === 'pedido' && r.pedido.rascunhoPadrao).toBe(true);
    expect(r.tipo === 'pedido' && r.pedido.textoProposto).not.toMatch(/ganhar|15\/01/);
    expect(pt.reg.registros.join('|')).toMatch(/rascunho_substituido/);
    expect(pt.reg.revisora[0]).toContain('(rascunho padrão)');
  });
  it('falha na redação também usa o rascunho padrão', async () => {
    const r = await consulta(T.umProcesso, 'como está meu processo?', {}, portas({ redigir: async () => { throw new Error('modelo indisponível'); } }));
    expect(r.tipo === 'pedido' && r.pedido.textoProposto).toContain('📄 Andamento do processo:');
  });
  it('campos ausentes não quebram o rascunho padrão', () => {
    expect(rascunhoPadrao('', [{ codigo: 9, identificacao: 'código 9', segredo: false, andamentos: [] }])).toMatch(/^Olá, cliente! 😊[\s\S]*Ainda não há movimentação registrada\./);
  });
});

async function pedidoDe(telefone: string, conversaId: string, codigos: string[] = []): Promise<PedidoProcesso> {
  const r = await consulta(telefone, 'como está meu processo trabalhista?', { conversaId }, portas({ codigos }));
  if (r.tipo !== 'pedido') throw new Error('esperava pedido');
  return r.pedido;
}

describe('C. Aprovação pela revisora', () => {
  it('13. aviso de espera é único e não traz nenhum dado do processo', () => {
    expect(TEXTOS_CONSULTA.aviso).not.toMatch(/\d|TRT|vara|assunto|andamento|movimenta/i);
  });
  it('14. "ok" envia exatamente o texto aprovado, conferido pelo hash; texto adulterado não sai', async () => {
    const p = await pedidoDe(T.umProcesso, 'conv-A');
    const c = interpretarRespostaRevisora('ok', [p.codigo]);
    expect(c).toEqual({ acao: 'aprovar', codigo: 'AND-0001' });
    const d = await aplicarDecisao(p, c as Extract<typeof c, { acao: 'aprovar' }>, 'revisora', 'revisora', AGORA);
    expect(d.enviarCliente).toBe(p.textoProposto);
    expect(d.pedido.decisao?.hashEnviado).toBe(p.hash);
    await expect(aplicarDecisao({ ...p, textoProposto: `${p.textoProposto} (alterado)` }, { acao: 'aprovar', codigo: p.codigo }, 'revisora', 'revisora', AGORA)).rejects.toThrow('hash');
    await expect(aplicarDecisao(d.pedido, { acao: 'aprovar', codigo: p.codigo }, 'revisora', 'revisora', AGORA)).rejects.toThrow('não está pendente');
  });
  it('15. dois pedidos de clientes diferentes: "ok CÓDIGO" só libera aquele; "ok" sozinho pede o código', async () => {
    const a = await pedidoDe(T.umProcesso, 'conv-A');
    const b = await pedidoDe(T.tresProcessos, 'conv-B', [a.codigo]);
    expect(b.codigo).toBe('AND-0002');
    const pendentes = [a.codigo, b.codigo];
    expect(interpretarRespostaRevisora('ok', pendentes)).toMatchObject({ acao: 'ambiguo', motivo: expect.stringContaining('AND-0001, AND-0002') });
    const c = interpretarRespostaRevisora('OK and-0002', pendentes);
    expect(c).toEqual({ acao: 'aprovar', codigo: 'AND-0002' });
    const alvo = [a, b].find(p => p.codigo === (c as { codigo: string }).codigo)!;
    const d = await aplicarDecisao(alvo, { acao: 'aprovar', codigo: alvo.codigo }, 'revisora', 'revisora', AGORA);
    expect(d.pedido.conversaId).toBe('conv-B');
    expect(d.enviarCliente).toBe(b.textoProposto);
    expect(d.enviarCliente).not.toContain('Marina');
    await expect(aplicarDecisao(a, { acao: 'aprovar', codigo: 'AND-0002' }, 'revisora', 'revisora', AGORA)).rejects.toThrow('não está pendente');
  });
  it('16. "corrigir CÓDIGO:" envia exatamente o texto da revisora', async () => {
    const p = await pedidoDe(T.umProcesso, 'conv-A');
    const texto = 'Marina, a audiência de instrução foi marcada para 10/12/2026, às 14h.\nVamos conversar antes dela.';
    const c = interpretarRespostaRevisora(`corrigir ${p.codigo}: ${texto}`, [p.codigo]);
    expect(c).toEqual({ acao: 'corrigir', codigo: p.codigo, texto });
    const d = await aplicarDecisao(p, c as Extract<typeof c, { acao: 'corrigir' }>, 'revisora', 'revisora', AGORA);
    expect(d.enviarCliente).toBe(texto);
    expect(d.pedido.status).toBe('corrigido');
    expect(interpretarRespostaRevisora(`corrigir ${p.codigo}:`, [p.codigo]).acao).toBe('ambiguo');
  });
  it('17. "não" recusa: nada vai ao cliente e a Ana pausa', async () => {
    const p = await pedidoDe(T.umProcesso, 'conv-A');
    for (const r of ['não', 'Não AND-0001', 'recusar']) expect(interpretarRespostaRevisora(r, [p.codigo])).toEqual({ acao: 'recusar', codigo: p.codigo });
    const d = await aplicarDecisao(p, { acao: 'recusar', codigo: p.codigo }, 'gestora@manager', 'manager', AGORA);
    expect(d.enviarCliente).toBeUndefined();
    expect(d.pausarAna).toBe(true);
    expect(d.pedido.decisao).toMatchObject({ por: 'gestora@manager', canal: 'manager' });
  });
  it('18. resposta de conta não autorizada é ignorada', () => {
    expect(respostaAutorizada({ canal: 'whatsapp', contato: '5511912345678' }, '5511987654321')).toBe(false);
    expect(respostaAutorizada({ canal: 'whatsapp', contato: '551187654321' }, '+55 11 98765-4321')).toBe(true);
    expect(respostaAutorizada({ canal: 'whatsapp', contato: '5511987654321' }, undefined)).toBe(false);
    expect(respostaAutorizada({ canal: 'manager', papeis: ['advogada'] }, '5511987654321')).toBe(false);
    expect(respostaAutorizada({ canal: 'manager', papeis: ['advogada_senior'] }, undefined)).toBe(true);
    expect(interpretarRespostaRevisora('pode mandar sim, obrigada', ['AND-0001'])).toEqual({ acao: 'desconhecido' });
  });
  it('19. sem resposta: lembretes à revisora e aviso de retorno ao cliente conforme o horário', async () => {
    const p = { ...(await pedidoDe(T.umProcesso, 'conv-A')), criadoEm: AGORA.toISOString() };
    const em = (min: number) => new Date(AGORA.getTime() + min * 60000);
    expect(pendencias(p, em(29))).toEqual({ lembrete: false });
    expect(pendencias(p, em(30)).lembrete).toBe(true);
    expect(pendencias({ ...p, lembretesEm: [em(30).toISOString()] }, em(45)).lembrete).toBe(false);
    expect(pendencias({ ...p, lembretesEm: [1, 2, 3].map(i => em(i * 30).toISOString()) }, em(200)).lembrete).toBe(false);
    expect(pendencias(p, em(60)).avisoCliente).toContain('ainda hoje');
    expect(pendencias({ ...p, avisoRetornoEm: em(60).toISOString() }, em(90)).avisoCliente).toBeUndefined();
    expect(pendencias({ ...p, status: 'aprovado' }, em(90))).toEqual({ lembrete: false });
  });
  it('19. prazos: dia útil 10h, 17h30, sexta 19h, sábado e feriado nacional', () => {
    const brt = (iso: string) => new Date(`${iso}-03:00`);
    expect(prazoRetorno(brt('2026-10-29T10:00:00'))).toBe('hoje');
    expect(prazoRetorno(brt('2026-10-29T16:59:00'))).toBe('hoje');
    expect(prazoRetorno(brt('2026-10-29T17:30:00'))).toBe('proximo_dia_util');
    expect(prazoRetorno(brt('2026-10-30T19:00:00'))).toBe('proximo_dia_util');
    expect(prazoRetorno(brt('2026-10-31T10:00:00'))).toBe('proximo_dia_util');
    expect(prazoRetorno(brt('2026-12-25T10:00:00'))).toBe('proximo_dia_util');
    expect(frasePrazo(brt('2026-12-25T10:00:00'))).toBe('Alguém responsável te responde no próximo dia útil, a partir das 8h.');
    expect(frasePrazo(brt('2026-10-29T10:00:00'))).toBe('Alguém responsável te responde por aqui ainda hoje.');
  });
  it('20. cliente insiste enquanto espera: "em conferência", sem nova consulta e sem prazo', () => {
    for (const t of ['e aí??', '??', '?!', 'oi?', 'alô?', 'já faz meses e ninguém me fala nada', 'alguma novidade do processo?', 'cadê a resposta']) {
      const r = respostaDuranteEspera(t, 'outro', true);
      expect(r, t).toBe(TEXTOS_CONSULTA.emConferencia);
    }
    expect(TEXTOS_CONSULTA.emConferencia).not.toMatch(/hoje|amanhã|dia útil|\d/);
    expect(respostaDuranteEspera('e aí??', 'outro', false)).toBeUndefined();
    for (const t of ['ok', 'obrigada', 'oi', 'beleza']) expect(respostaDuranteEspera(t, 'outro', true), t).toBeUndefined();
  });
  it('21. cliente muda de assunto e pede para agendar: segue o fluxo normal', () => {
    expect(respostaDuranteEspera('quero marcar uma consulta pra semana que vem', 'agendamento', true)).toBeUndefined();
    expect(respostaDuranteEspera('dá pra agendar uma consulta?', 'outro', true)).toBeUndefined();
  });
});

describe('D. Limites da Ana (reforço do servidor)', () => {
  it('22. significado e chance não viram consulta de processo', () => {
    for (const t of ['o que significa esse andamento?', 'vou ganhar?', 'quais as chances do meu processo?', 'quanto vou receber do processo?']) expect(pedidoNoticiaProcesso(t), t).toBe(false);
    for (const t of ['como tá meu processo?', 'alguma novidade do meu caso', 'e o andamento da minha ação?', 'tem audiência marcada?', 'noticias do processo']) expect(pedidoNoticiaProcesso(t), t).toBe(true);
  });
});

describe('E. Falhas técnicas', () => {
  it('31. 403, 429, tempo esgotado e API fora do ar: nada inventado; equipe com aviso de retorno', async () => {
    for (const falha of [{ tipo: 'sem_permissao', status: 403 }, { tipo: 'limite', status: 429 }, { tipo: 'tempo' }, { tipo: 'indisponivel', status: 503 }] as FalhaFicticia[]) {
      const pt = portas({ falha: () => falha });
      const r = await consulta(T.umProcesso, 'como está meu processo?', {}, pt);
      expect(r).toMatchObject({ tipo: 'equipe', motivo: `falha na consulta ao ProJuris (${falha.tipo})` });
      if (r.tipo === 'equipe') expect(r.mensagem).toBe(TEXTOS_CONSULTA.equipe(AGORA));
      expect(pt.reg.revisora).toEqual([]);
      expect(pt.reg.avisos).toEqual([]);
    }
  });
  it('31. falha depois do aviso: o cliente recebe o aviso e depois a passagem para a equipe', async () => {
    const pt = portas({ falhaAndamentos: { tipo: 'sem_permissao', status: 403 } });
    const r = await consulta(T.umProcesso, 'como está meu processo?', {}, pt);
    expect(pt.reg.avisos).toEqual([TEXTOS_CONSULTA.aviso]);
    expect(r).toMatchObject({ tipo: 'equipe', motivo: 'falha na consulta ao ProJuris (sem_permissao)' });
  });
  it('configuração: aprovação desligada ou verificação extra ligada não liberam envio automático', async () => {
    const pt = portas();
    const base = { conversaId: 'c', telefone: T.umProcesso, nomeContato: 'x', textoCliente: 'meu processo?', assuntoJaPerguntado: false };
    expect(await iniciarConsultaProcesso(base, pt.p, { ...CONFIG_CONSULTA_PADRAO, aprovacao_processo: false })).toMatchObject({ tipo: 'equipe' });
    expect(await iniciarConsultaProcesso(base, pt.p, { ...CONFIG_CONSULTA_PADRAO, verificacao_processo: true })).toMatchObject({ tipo: 'equipe' });
    expect(pt.reg.revisora).toEqual([]);
  });
});
