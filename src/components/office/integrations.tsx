import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Plug, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { integrationCatalog } from '@/lib/integration-readiness';
import { readIntegrationReadiness } from '@/lib/integrations.functions';
import { Section } from './shared';

export function Integrations({ userId }: { userId: string }) {
  const read = useServerFn(readIntegrationReadiness);
  const query = useQuery({ queryKey: ['integration-readiness', userId], queryFn: () => read() });
  return <Section title="Integrações preparadas">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0"/>Envios, cobranças e assinaturas reais: bloqueados</p>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? 'animate-spin' : ''}/>Atualizar situação</Button>
    </div>
    {query.isError && <p role="alert" className="mb-4 text-sm text-destructive">Não foi possível conferir as credenciais. Nenhuma integração foi ativada.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {integrationCatalog.map(service => {
        const status = query.data?.find(item => item.id === service.id);
        return <article key={service.id} className="flex flex-col rounded-md border bg-card p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-xl">{service.name}</h3><Plug className="size-4 text-muted-foreground"/></div>
          <p className="mt-2 text-sm">{service.purpose}</p>
          <p className="mt-4 self-start rounded bg-pending px-1.5 py-0.5 text-xs font-medium text-pending-foreground">{!status ? 'Situação não conferida' : status.credentialsPresent ? 'Credencial presente · ativação pendente' : 'Aguardando credenciais'}</p>
          {status?.missing.map(label => <p key={label} className="mt-2 text-xs text-muted-foreground">Pendente: {label}</p>)}
          {service.id === 'claude' && <p className="mt-2 text-xs text-muted-foreground">Claude Sonnet 5 · IA atual mantida</p>}
          <div className="mt-auto pt-5"><Button asChild variant="outline" size="sm"><a href={service.documentation} target="_blank" rel="noopener noreferrer"><ExternalLink/>Documentação</a></Button></div>
        </article>;
      })}
    </div>
  </Section>;
}