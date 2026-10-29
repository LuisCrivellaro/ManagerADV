// Treinamento usado pela bateria: o mesmo padrão de produção do simulador (main.ts, TREINO_PRODUCAO).
import type { Treino } from '../engine';

export const TREINO_BATERIA: Treino = {
  instrucoes: 'Responda com clareza e acolhimento. Não prometa resultados. Encaminhe questões jurídicas à advogada responsável.',
  proibidos: ['garantia de resultado', 'prazo de pagamento', 'valor da causa', 'honorários', 'ganhar'],
  exemplos: [],
};
