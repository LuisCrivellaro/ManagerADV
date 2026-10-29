import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Enquanto o fluxo de consulta não estiver ligado ao servidor real, consulta_processo vira passagem para a equipe.
describe('Servidor real · consulta_processo ainda desligada', () => {
  it('ana.server.ts converte consulta_processo em passagem para a equipe', () => {
    const fonte = readFileSync('src/lib/atendimento/ana.server.ts', 'utf8');
    expect(fonte).toMatch(/if\(raw\.intencao==='consulta_processo'\)\{raw\.intencao='outro';raw\.encaminhar_humano=true;\}/);
  });
});
