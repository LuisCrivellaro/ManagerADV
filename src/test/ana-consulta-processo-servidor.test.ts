import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { enviarTextoRevisora } from '@/lib/atendimento/canais/ultramsg';

// Servidor real: notícia de processo só pelo fluxo com aprovação; fora dele, vira rascunho e nada sai ao cliente.
describe('Servidor real · consulta de processo', () => {
  const fonte = readFileSync('src/lib/atendimento/ana.server.ts', 'utf8');
  it('WhatsApp em modo automático passa pelo fluxo de consulta com aprovação', () => {
    expect(fonte).toMatch(/if\(canal==='ultramsg'&&mode==='Automática'\)\s*\{\s*const \{ fluxoProcessoReal \}/);
  });
  it('fora do fluxo, consulta_processo vira rascunho (o texto do modelo nunca é enviado)', () => {
    expect(fonte).toMatch(/if\(raw\.intencao==='consulta_processo'&&!r\.encaminhar_humano\)\{r\.acao='rascunho';/);
  });
  it('envio à revisora só com REVISORA_WHATSAPP válido e credenciais da UltraMsg', async () => {
    expect(await enviarTextoRevisora('teste', {})).toEqual({ ok: false, erro: 'Revisora não configurada.' });
    expect(await enviarTextoRevisora('teste', { REVISORA_WHATSAPP: '999' })).toEqual({ ok: false, erro: 'Revisora não configurada.' });
    expect(await enviarTextoRevisora('teste', { REVISORA_WHATSAPP: '5511987654321' })).toEqual({ ok: false, erro: 'WhatsApp não configurado.' });
  });
});
