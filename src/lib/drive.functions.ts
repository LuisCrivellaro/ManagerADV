import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { Conversa } from '@/lib/mock-data';
import { pastaCliente } from '@/lib/atendimento/trato-feito';

/** Cria a pasta real do cliente no Google Drive do escritório (Raiz / AC ou RT / Cliente). */
export const criarPastaDrive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ casoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const caso = await context.supabase.from('casos').select('dados').eq('id', data.casoId).single();
    if (caso.error) throw new Error('Caso indisponível.');
    const { garantirPastaCliente } = await import('@/lib/atendimento/google-drive.server');
    const pasta = await garantirPastaCliente(pastaCliente(caso.data.dados as unknown as Conversa));
    return pasta;
  });

/** Copia um arquivo já guardado no caso (original preservado) para a pasta do cliente no Drive. */
export const enviarArquivoDrive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ casoId: z.string().uuid(), pastaId: z.string().min(5).max(200), path: z.string().max(500), nome: z.string().min(1).max(250), mime: z.string().max(100) }))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/${data.casoId}/`)) throw new Error('Arquivo fora deste caso.');
    const { data: blob, error } = await context.supabase.storage.from('case-documents').download(data.path);
    if (error || !blob) throw new Error('Arquivo inacessível.');
    if (blob.size > 10 * 1024 * 1024) throw new Error('Arquivo acima de 10 MB.');
    const { enviarArquivo } = await import('@/lib/atendimento/google-drive.server');
    return enviarArquivo(data.pastaId, data.nome, data.mime || 'application/octet-stream', new Uint8Array(await blob.arrayBuffer()));
  });
