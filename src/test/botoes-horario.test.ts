import { describe, it, expect } from 'vitest';
import { botoesHorarios, horarioDoClique, textoEscolhaHorario } from '@/lib/atendimento/botoes-horario';
import { chosenSlot } from '@/lib/atendimento';
import { pendingFields } from '@/lib/respostas-prontas';

const agora = new Date('2026-10-22T12:00:00Z');
const a = '2026-10-26T12:00:00.000Z', b = '2026-10-26T17:00:00.000Z';

describe('Botões de horário', () => {
  it('cria um botão por horário com dados curtos para o Telegram', () => {
    const bs = botoesHorarios([a, b, a]);
    expect(bs).toHaveLength(2);
    expect(bs.every(x => new TextEncoder().encode(x.dados).length <= 64)).toBe(true);
  });
  it('aceita só horário ofertado e futuro', () => {
    expect(horarioDoClique(`slot:${a}`, [a, b], agora)).toBe(a);
    expect(horarioDoClique(`slot:2026-10-27T12:00:00.000Z`, [a, b], agora)).toBeUndefined();
    expect(horarioDoClique(`slot:${a}`, [a], new Date('2026-10-27T00:00:00Z'))).toBeUndefined();
    expect(horarioDoClique('outra', [a], agora)).toBeUndefined();
  });
  it('o texto do clique identifica exatamente o horário escolhido', () => {
    expect(chosenSlot([a, b], textoEscolhaHorario(b))).toBe(b);
  });
});

describe('Mensagens do escritório', () => {
  it('orçamento exige preencher valores antes de enviar', () => {
    expect(pendingFields('Valor: {valor_total}; parcela: {valor_parcela}')).toEqual(['valor_total', 'valor_parcela']);
  });
});
