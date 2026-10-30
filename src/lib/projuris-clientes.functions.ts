import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { ClienteProjurisDiretorio } from './projuris/diretorio';

// Cópia só em memória do servidor por 10 minutos, para não refazer ~11 consultas a cada busca. Nada é gravado.
let cache: { lista: ClienteProjurisDiretorio[]; total: number; em: number } | undefined;
const VALIDADE = 10 * 60000;
const POR_CONSULTA = 100;

/** Clientes do ProJuris ao vivo (sênior/admin). Somente leitura. */
export const listarClientesProjuris = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ busca: z.string().max(120).default(''), pagina: z.number().int().min(0).max(1000).default(0), atualizar: z.boolean().default(false) }))
  .handler(async ({ context, data }) => {
    const roles = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
    if (roles.error || !roles.data.some(r => r.role === 'admin' || r.role === 'advogada_senior'))
      return { ok: false as const, erro: 'Consulta ao ProJuris reservada à advogada sênior ou administração.' };
    const { projuris, ErroProjuris } = await import('./projuris/cliente.server');
    const { registros, totalRegistros } = await import('./projuris/mapeamento');
    const { clienteDiretorioDe, filtrarDiretorio } = await import('./projuris/diretorio');
    try {
      if (!cache || data.atualizar || Date.now() - cache.em > VALIDADE) {
        const lista: ClienteProjurisDiretorio[] = [];
        let total = 0;
        for (let pagina = 0; pagina < 60; pagina++) {
          const raw = await projuris.chamar<unknown>('pessoa.consulta', { consulta: { pagina, 'quan-registros': POR_CONSULTA } });
          const lote = registros(raw, ['pessoaConsulta']);
          total = totalRegistros(raw, ['pessoaConsulta']);
          for (const r of lote) { const c = clienteDiretorioDe(r); if (c) lista.push(c); }
          if (lote.length < POR_CONSULTA || lista.length >= total) break;
        }
        cache = { lista: [...new Map(lista.map(c => [c.codigo, c])).values()], total, em: Date.now() };
      }
      const r = filtrarDiretorio(cache.lista, data.busca, data.pagina, 50);
      return { ok: true as const, ...r, totalProjuris: cache.lista.length, atualizadoEm: new Date(cache.em).toISOString() };
    } catch (e) {
      const tipo = e instanceof ErroProjuris ? e.tipo : 'resposta';
      console.error('ProJuris clientes:', tipo, e instanceof ErroProjuris ? e.status : '');
      return { ok: false as const, erro: tipo === 'sem_permissao' ? 'O ProJuris não liberou a lista de pessoas para este acesso.' : tipo === 'configuracao' ? 'Chaves do ProJuris não salvas.' : 'Não foi possível consultar o ProJuris agora. Tente novamente.' };
    }
  });
