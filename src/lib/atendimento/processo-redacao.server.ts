// Redação da notícia de processo: mesmo Claude da Ana, com a identidade dela e as instruções de
// ana-redacao-processo.txt. Recebe só os fatos montados pelo servidor; o texto passa pela validação e pela
// aprovação da revisora antes de qualquer envio.
import type { EntradaRedacao } from './consulta-processo';

export async function redigirNoticiaProcesso(fatos: EntradaRedacao): Promise<string> {
  const key = process.env['ANTHROPIC_API_KEY'];
  if (!key) throw new Error('Claude não configurado para a redação.');
  const [{ claudeComoSample }, { default: identidade }, { default: redacao }] = await Promise.all([
    import('@/lib/ana-claude/claude.server'),
    import('./ana-prompt.txt?raw'),
    import('./ana-redacao-processo.txt?raw'),
  ]);
  const sample = claudeComoSample({ apiKey: key, ...(process.env['ANA_MODELO'] ? { modelo: process.env['ANA_MODELO'] } : {}) });
  const r = await sample([{ role: 'user', content: `${identidade}\n\n${redacao}` }, { role: 'user', content: JSON.stringify({ fatos }) }]);
  return r.text.trim();
}
