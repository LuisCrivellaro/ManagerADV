import { describe, it, expect } from 'vitest';
import { conversas } from '@/lib/mock-data';
import { DEFAULT_REPLIES, emptySaved, fillReply, mergeReplies, pendingFields, removeReply, restoreDefault, searchReplies, suggestedReplies, upsertReply, validateReply, cleanShortcut } from '@/lib/respostas-prontas';

const mariana = conversas[0]!;
const rogerio = conversas[1]!;
const helena = conversas[2]!;

describe('Mensagens prontas', () => {
  it('preenche nome, faltantes e atendimento, mantendo campos livres', () => {
    const t = fillReply('Olá, {nome} ({nome_completo}, {atendimento}). Faltam: {documentos_faltantes}. Data: {data}', mariana);
    expect(t).toBe('Olá, Mariana (Mariana Albuquerque Teixeira, AT-2026-0418). Faltam: Carteira de trabalho (CTPS), Laudos médicos. Data: {data}');
    expect(fillReply('{documentos_faltantes}', helena)).toBe('nenhum documento pendente');
  });

  it('sem nome do cliente, adapta a frase sem deixar {nome}', () => {
    const sem = { ...mariana, nome: '' };
    expect(fillReply('Olá, {nome}! Tudo bem?', sem)).toBe('Olá! Tudo bem?');
    expect(fillReply('{nome}, recebemos sua mensagem.', sem)).toBe('Recebemos sua mensagem.');
    expect(fillReply('Recebemos o seu documento, {nome}.', sem)).toBe('Recebemos o seu documento.');
    expect(fillReply('Pronto, {nome}! Sua consulta', sem)).toBe('Pronto! Sua consulta');
  });

  it('/consulta deixa os horários para a equipe preencher', () => {
    const r = mergeReplies().find((x) => x.atalho === 'consulta')!;
    expect(pendingFields(fillReply(r.texto, mariana))).toEqual(['horario1', 'horario2']);
  });

  it('cadastra exatamente os 12 atalhos oficiais, com texto idêntico', () => {
    const rows = JSON.parse(require('node:fs').readFileSync('src/test/fixtures/mensagens-oficiais.json', 'utf8')) as { atalho: string; texto: string }[];
    const all = mergeReplies();
    expect(all.map((r) => r.atalho).sort()).toEqual(rows.map((r) => r.atalho).sort());
    for (const row of rows) expect(all.find((r) => r.atalho === row.atalho)?.texto).toBe(row.texto);
  });

  it('ajustes salvos de mensagens antigas não voltam a aparecer', () => {
    const antiga = { id: 'ola', titulo: 'Saudação', texto: 'Olá', categoria: 'Geral' as const, atalho: 'oficial-boasvindas' };
    expect(mergeReplies({ itens: [antiga], ocultas: [] }).some((r) => r.id === 'ola')).toBe(false);
  });

  it('aponta campos que ainda precisam ser preenchidos', () => {
    expect(pendingFields('Sua perícia será em {data} às {hora}. {data}')).toEqual(['data', 'hora']);
    expect(pendingFields('Sem campos')).toEqual([]);
  });

  it('sugere por etapa', () => {
    expect(suggestedReplies(rogerio, mergeReplies()).map((r) => r.id)).toEqual(['oficial-boasvindas', 'oficial-docsiniciais', 'oficial-consulta']);
  });

  it('busca por atalho, título e texto, sem acentos', () => {
    const all = mergeReplies();
    expect(searchReplies(all, '/ata')[0]?.id).toBe('oficial-ata');
    expect(searchReplies(all, 'orcamento')[0]?.id).toBe('oficial-orcamento');
    expect(searchReplies(all, 'GOV Assinaturas').map((r) => r.id)).toEqual(['oficial-contrato']);
    expect(searchReplies(all, '')).toHaveLength(all.length);
  });

  it('cria, edita, oculta e restaura mensagens', () => {
    const nova = { id: 'n1', titulo: 'Perícia', texto: '{nome}, sua perícia será em {data}.', categoria: 'Processo' as const, atalho: 'pericia' };
    let saved = upsertReply(emptySaved, nova);
    expect(mergeReplies(saved).some((r) => r.id === 'n1')).toBe(true);
    saved = upsertReply(saved, { ...DEFAULT_REPLIES[0]!, texto: 'Bom dia, {nome}!' });
    expect(mergeReplies(saved).find((r) => r.id === 'oficial-boasvindas')?.texto).toBe('Bom dia, {nome}!');
    saved = restoreDefault(saved, 'oficial-boasvindas');
    expect(mergeReplies(saved).find((r) => r.id === 'oficial-boasvindas')?.texto).toBe(DEFAULT_REPLIES[0]!.texto);
    saved = removeReply(saved, 'oficial-boasvindas');
    expect(mergeReplies(saved).some((r) => r.id === 'oficial-boasvindas')).toBe(false);
    saved = removeReply(saved, 'n1');
    expect(saved.itens).toHaveLength(0);
  });

  it('valida nome, texto e atalho único', () => {
    const all = mergeReplies();
    expect(validateReply({ id: 'x', titulo: '', texto: '', atalho: '' }, all)).toHaveLength(3);
    expect(validateReply({ id: 'x', titulo: 'A', texto: 'B', atalho: 'boasvindas' }, all)).toEqual(['O atalho /boasvindas já está em uso.']);
    expect(validateReply({ id: 'oficial-boasvindas', titulo: 'A', texto: 'B', atalho: 'boasvindas' }, all)).toEqual([]);
    expect(cleanShortcut('/Bom Diá!')).toBe('bomdia');
  });
});
