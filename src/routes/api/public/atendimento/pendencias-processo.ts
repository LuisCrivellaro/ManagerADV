import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/atendimento/pendencias-processo')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const cfg = await supabaseAdmin.from('atendimento_canal_config').select('canal_ativo').eq('id', true).maybeSingle();
    if (cfg.error) return Response.json({ error: 'Configuração indisponível' }, { status: 503 });
    if (cfg.data?.canal_ativo !== 'ultramsg') return Response.json({ processados: 0 });
    try {
      const { executarPendenciasProcesso } = await import('@/lib/atendimento/consulta-processo.server');
      return Response.json(await executarPendenciasProcesso(supabaseAdmin));
    } catch { return Response.json({ error: 'Pendências não concluídas' }, { status: 503 }); }
  } } },
});