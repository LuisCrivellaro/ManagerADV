import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

async function exigirRevisor(context: { supabase: Parameters<typeof import('./consulta-processo.server').lerPedidosProcesso>[0]; userId: string }) {
  const r = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
  const { respostaAutorizada } = await import('./consulta-processo');
  if (r.error || !respostaAutorizada({ canal: 'manager', papeis: (r.data ?? []).map(x => x.role) }, undefined)) throw new Error('Revisão reservada à advogada sênior ou administração.');
}

export const listarRevisoesProcesso = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid().optional() }))
  .handler(async ({ context, data }) => {
    await exigirRevisor(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { lerPedidosProcesso } = await import('./consulta-processo.server');
    const rows = await lerPedidosProcesso(supabaseAdmin);
    return rows.filter(x => x.pedido.status === 'pendente' && (!data.conversaId || x.pedido.conversaId === data.conversaId)).map(x => x.pedido);
  });

export const revisarPedidoProcesso = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid(), codigo: z.string().regex(/^AND-\d+$/), hash: z.string().regex(/^[a-f0-9]{64}$/), acao: z.enum(['aprovar', 'corrigir', 'recusar']), texto: z.string().trim().max(16000).optional() }))
  .handler(async ({ context, data }) => {
    await exigirRevisor(context);
    if (data.acao === 'corrigir' && !data.texto) throw new Error('Informe o texto corrigido.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { decidirPedidoProcesso } = await import('./consulta-processo.server');
    const comando = data.acao === 'corrigir' ? { acao: data.acao, codigo: data.codigo, texto: data.texto ?? '' } : { acao: data.acao, codigo: data.codigo };
    return decidirPedidoProcesso(supabaseAdmin, data.conversaId, comando, context.userId, 'manager', data.hash);
  });
export const confirmarVinculoProjuris = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await exigirRevisor(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { confirmarVinculoProcesso } = await import('./consulta-processo.server');
    return confirmarVinculoProcesso(supabaseAdmin, data.conversaId, context.userId);
  });
