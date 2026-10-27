import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/services/integracoes';
import { lerAuditLog } from '@/lib/atendimento/envio.functions';
import { Section } from './shared';
import { dataHoraCurta } from '@/lib/atendimento';

export function N8nSettings({ allowed }: { allowed: boolean }) {
  const read = useServerFn(lerAuditLog);
  const log = useQuery({ queryKey: ['audit-log'], queryFn: () => read(), enabled: allowed, refetchInterval: 30000 });
  return <>
    <Section title="Conexão n8n">
      <p className="mb-4 text-sm text-muted-foreground">Integração n8n ainda não conectada · ações externas simuladas</p>
      <h3 className="mb-2 text-sm font-semibold">Endpoints por ação</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead><tr className="border-b"><th className="p-2">Ação</th><th className="p-2">Caminho</th></tr></thead>
        <tbody>{Object.entries(endpoints).map(([action, path]) => <tr key={action} className="border-b"><td className="p-2">{action}</td><td className="break-all p-2 font-mono">{path}</td></tr>)}</tbody>
      </table></div>
    </Section>
    <Section title="Log de auditoria">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Registros do escritório · ações mais recentes primeiro</p>
        <Button size="icon" variant="outline" aria-label="Atualizar log" disabled={!allowed} onClick={() => void log.refetch()}><RefreshCw /></Button>
      </div>
      {allowed ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs">
        <thead className="border-b"><tr>{['Data e hora', 'Usuário / perfil', 'Ação', 'Resumo', 'Resultado'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{(log.data ?? []).map(row => <tr key={row.id} className="border-b">
          <td className="p-2">{dataHoraCurta(row.criado_em)}</td>
          <td className="p-2">{row.ator}<p className="text-muted-foreground">{row.perfil}</p></td>
          <td className="p-2">{row.acao}</td>
          <td className="p-2">{row.resumo || row.erro}</td>
          <td className={`p-2 ${row.status === 'sucesso' ? 'text-success' : 'text-destructive'}`}>{row.status}</td>
        </tr>)}</tbody>
      </table>{log.data && !log.data.length && <p className="py-5 text-sm text-muted-foreground">Nenhuma ação registrada.</p>}{log.isLoading && <p className="py-5 text-sm text-muted-foreground">Carregando log…</p>}</div> : <p className="text-sm text-muted-foreground">Seu perfil não permite esta ação.</p>}
    </Section>
  </>;
}
