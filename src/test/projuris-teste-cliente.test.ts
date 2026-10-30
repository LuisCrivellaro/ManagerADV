import { describe, it, expect } from 'vitest';
import { testarCliente } from '../../tools/projuris-teste-conexao/teste-cliente';
import { criarClienteProjuris, URL_AUTENTICACAO_PROJURIS } from '@/lib/projuris/cliente.server';

function api(pessoas: unknown[]) {
  const f = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url);
    const json = (c: unknown) => new Response(JSON.stringify(c), { status: 200 });
    if (u === URL_AUTENTICACAO_PROJURIS) return json({ access_token: 't', expires_in: 900, token_type: 'Bearer' });
    if (u.includes('/pessoa/consulta?')) return json({ totalRegistros: pessoas.length, pessoaConsulta: pessoas });
    if (/\/pessoa\/\d+$/.test(u)) return json({ codigoPessoa: 500, nomePessoa: '[TESTE] Maria Ensaio', telefones: [{ principal: true, telefone: { numeroTelefone: '11 99111-2222' } }] });
    if (u.includes('/tipo?')) return json({ consultaTipoRetorno: [{ registros: [{ chave: 7, valor: 'Ativo' }] }] });
    if (u.includes('/processo/consulta-completa')) { expect(JSON.parse(String(init.body))).toMatchObject({ codigoPessoaEnvolvido: 500 }); return json({ totalRegistros: 1, processoConsultaCompleta: [{ codigoProcesso: 9, processoNumeroWs: { numeroProcesso: '0000001-00.2026.5.02.0001' }, assunto: 'TESTE', situacaoProcesso: { chave: 7 }, segredoJustica: false, processoEnvolvidoSimplificadoWs: [{ codigoPessoa: 500, flagCliente: true }] }] }); }
    if (u.includes('/andamento/consulta')) return json({ totalRegistros: 2, andamentoProcessoWs: [{ codigoAndamento: 1, dataAndamento: '2026-10-20', descricaoAndamento: 'Andamento público de teste', privado: false }, { codigoAndamento: 2, dataAndamento: '2026-10-25', descricaoAndamento: 'Nota privada de teste', privado: true }] });
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return criarClienteProjuris({ credenciais: () => ({ clientId: 'x', clientSecret: 'y' }), fetch: f });
}

describe('Script de teste com o cliente [TESTE]', () => {
  it('encontra o cliente de teste pelo telefone, lista o processo e só andamentos públicos; ignora pessoa real', async () => {
    const linhas: string[] = [];
    const ok = await testarCliente('+55 11 99111-2222', api([{ codigoPessoa: 500, nomePessoa: '[TESTE] Maria Ensaio' }, { codigoPessoa: 600, nomePessoa: 'Fulana Real da Silva', telefones: [{ principal: true, telefone: { numeroTelefone: '11 99111-2222' } }] }]), l => linhas.push(l));
    const saida = linhas.join('\n');
    expect(ok).toBe(true);
    expect(saida).toContain('OK → [TESTE] Maria Ensaio');
    expect(saida).toContain('0000001-00.2026.5.02.0001');
    expect(saida).toContain('Andamento público de teste');
    expect(saida).not.toContain('Nota privada');
    expect(saida).not.toContain('Fulana');
  });
  it('sem pessoa [TESTE], não mostra ninguém', async () => {
    const linhas: string[] = [];
    expect(await testarCliente('11 99111-2222', api([{ codigoPessoa: 600, nomePessoa: 'Fulana Real da Silva' }]), l => linhas.push(l))).toBe(false);
    expect(linhas.join('\n')).not.toContain('Fulana');
  });
  it('telefone sem DDD é recusado antes de chamar a API', async () => {
    const linhas: string[] = [];
    expect(await testarCliente('99111-2222', api([]), l => linhas.push(l))).toBe(false);
    expect(linhas[0]).toMatch(/Telefone inválido/);
  });
});

describe('Script de teste · descoberta da agenda (só leitura)', () => {
  it('lê grupos com tarefaConsultaWs e mostra contagens, situações, responsáveis e formatos, nunca títulos ou descrições', async () => {
    const { descobrirAgenda } = await import('../../tools/projuris-teste-conexao/teste-cliente');
    const { criarClienteProjuris, URL_AUTENTICACAO_PROJURIS } = await import('@/lib/projuris/cliente.server');
    const grupos = [
      { data: 1793300000000, tarefaConsultaWs: [
        { flagTarefaCompromisso: true, titulo: 'Reunião com Cliente Secreto', descricao: 'Assunto sigiloso', situacao: 'Pendente', codigoSituacao: 1, nomeTarefaTipo: 'Reunião', dataInicioCompromisso: 1793300000000, horaInicioCompromisso: 50400000, usuarioResponsaveis: [{ chave: 7, valor: 'Carolina Teste' }], nomePessoa: 'Fulano Cliente' },
        { flagTarefaCompromisso: false, descricao: 'Prazo contestação Fulano', situacao: 'Cancelada', codigoSituacao: 4, nomeTarefaTipo: 'Prazo', dataLimite: 1793400000000, usuarioResponsaveis: [{ chave: 7, valor: 'Carolina Teste' }] },
      ] },
    ];
    const f = (async (url: string | URL | Request) => {
      if (String(url) === URL_AUTENTICACAO_PROJURIS) return new Response(JSON.stringify({ access_token: 't', expires_in: 900, token_type: 'Bearer' }), { status: 200 });
      return new Response(JSON.stringify(grupos), { status: 200 });
    }) as typeof fetch;
    const linhas: string[] = [];
    expect(await descobrirAgenda(criarClienteProjuris({ credenciais: () => ({ clientId: 'x', clientSecret: 'y' }), fetch: f, esperar: async () => {} }), l => linhas.push(l))).toBe(true);
    const saida = linhas.join('\n');
    expect(saida).toContain('compromissos: 1');
    expect(saida).toContain('Cancelada (código 4): 1');
    expect(saida).toContain('usuarioResponsaveis: Carolina Teste (código 7) → 2');
    expect(saida).toContain('horaInicioCompromisso: número (milissegundos do dia?)');
    expect(saida).not.toMatch(/Secreto|sigiloso|Fulano/);
  });
});
