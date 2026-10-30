import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

/** Reprocessa dado já recebido na conversa do proprietário; não cria mensagem ou anexo. */
export const atualizarEmailRecebido = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ casoId: z.string().uuid(), mensagemId: z.string().min(1).max(500) }))
  .handler(async ({ data, context }) => {
    const { registrarEmailConversa } = await import('./email.server');
    return registrarEmailConversa(context.supabase, data.casoId, context.userId, data.mensagemId);
  });