// Bateria de regressão da Ana (sem modelo): roda todos os cenários a cada alteração.
// A classificação e a redação da Ana são simuladas; o que se testa é o servidor, as regras, as ferramentas,
// as aprovações e a privacidade. A bateria com a Ana real fica na tela "Bateria de testes da Ana".
import { describe, it, expect } from 'vitest';
import { CENARIOS } from '../../tools/simulador-ana/bateria/cenarios';
import { executarCenario } from '../../tools/simulador-ana/bateria/executor';
import { TREINO_BATERIA as treino } from '../../tools/simulador-ana/bateria/treino';


describe('Bateria da Ana · regressão (sem modelo)', () => {
  it('ids de cenário são únicos', () => { expect(new Set(CENARIOS.map(c => c.id)).size).toBe(CENARIOS.length); });
  it.each(CENARIOS.map(c => [`${c.id} · ${c.titulo}`, c] as const))('%s', async (_nome, c) => {
    const r = await executarCenario(c, { tipo: 'regressao', treino });
    expect(r.status, `${r.motivo}\nAna: ${r.respostasAna.join(' | ')}\nFerramentas: ${r.ferramentas.join(', ')}`).toBe('PASSOU');
  });
});
