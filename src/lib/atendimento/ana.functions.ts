import type { AnaResult } from './ana-rules';
import { anaSchema } from './ana-rules';

/** Invocado somente no servidor após autenticação do webhook e validação do contato. */
export async function gerarRespostaAna(request:Request, contexto:unknown, instrucoes:string):Promise<AnaResult> {
  const key = process.env['ANTHROPIC_API_KEY'];
  if (!key) throw new Error('Claude não configurado. Confira ANTHROPIC_API_KEY.');
  const [{claudeComoSample},{default:identidade}] = await Promise.all([import('@/lib/ana-claude/claude.server'),import('./ana-prompt.txt?raw')]);
  const sample = claudeComoSample({apiKey:key, ...(process.env['ANA_MODELO'] ? {modelo:process.env['ANA_MODELO']} : {})});
  const { default: restricoes } = await import('./ana-restrictions.txt?raw');
  const identidadeCompleta = `${identidade}\n\n${restricoes}\n${instrucoes}`;
  const contrato = `Responda somente com um objeto JSON válido neste schema: ${JSON.stringify(anaSchema.toJSONSchema())}. Não execute ferramentas; as operações são validadas pelo servidor.`;
  return anaSchema.parse(await sample.json([{role:'user',content:`${identidadeCompleta}\n\n${contrato}`},{role:'user',content:JSON.stringify(contexto)}]));
}