import { describe, it, expect } from 'vitest';
import { numeroWhatsApp, textoComOpcoes } from '@/lib/atendimento/canais/ultramsg';
describe('UltraMsg', () => {
  it('extrai o número do remetente', () => { expect(numeroWhatsApp('5511999990001@c.us')).toBe('5511999990001'); });
  it('horários viram lista numerada', () => { expect(textoComOpcoes('Escolha:', [{ texto: 'Seg 10:00' }, { texto: 'Ter 14:00' }])).toContain('2. Ter 14:00'); });
});
