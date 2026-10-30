import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { attendanceProcesses, savedDate } from '@/lib/attendance-projuris';
import type { Conversa } from '@/lib/mock-data';
import type { OfficeCase } from '@/lib/office';

export function AttendanceProjuris({ c, work, loading, error, refresh }: {
  c: Conversa; work: OfficeCase; loading: boolean; error: boolean; refresh: () => Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const processes = attendanceProcesses(c, work);
  const movements = work.movements ?? [];
  const reload = async () => {
    setRefreshing(true); setRefreshError(false);
    try { await refresh(); } catch { setRefreshError(true); } finally { setRefreshing(false); }
  };
  return <div className="space-y-5 p-4 text-xs">
    <section className="space-y-2 border-b pb-4">
      <div className="flex items-center justify-between gap-2"><h3 className="font-sans text-sm font-semibold">ProJuris</h3><Button variant="ghost" size="icon" className="size-7" aria-label="Atualizar registros do cliente" title="Atualizar registros locais" disabled={loading || refreshing} onClick={reload}><RefreshCw className={refreshing ? 'size-3.5 animate-spin' : 'size-3.5'}/></Button></div>
      <p className="font-medium">{c.nome}</p>
      <p className="text-muted-foreground">{c.cpf} · {c.atendimento}</p>
      <p className="text-muted-foreground">Integração não ativada · registros locais, inclusive de demonstração. Nenhuma consulta ao ProJuris realizada.</p>
      <Button asChild variant="link" className="h-auto p-0 text-xs"><Link to="/integracoes">Ver conexão<ArrowUpRight className="size-3"/></Link></Button>
    </section>
    {loading ? <p className="text-muted-foreground">Carregando registros do cliente…</p> : error || refreshError ? <p role="alert" className="text-destructive">Não foi possível atualizar todos os registros. Tente novamente.</p> : <>
      <dl className="grid grid-cols-3 gap-2 border-b pb-4"><div><dt className="text-muted-foreground">Processos</dt><dd className="mt-1 text-lg font-semibold">{processes.length}</dd></div><div><dt className="text-muted-foreground">Andamentos</dt><dd className="mt-1 text-lg font-semibold">{movements.length}</dd></div><div><dt className="text-muted-foreground">Prazos abertos</dt><dd className="mt-1 text-lg font-semibold">{movements.filter(m => m.prazo && !m.concluido).length}</dd></div></dl>
      <section className="space-y-3"><h3 className="font-sans text-xs font-semibold">Processos e andamentos</h3>{!processes.length && <p className="text-muted-foreground">Nenhum processo registrado para esta conversa.</p>}{processes.map(p => <details key={p.cnj} open className="border-b pb-3"><summary className="cursor-pointer font-mono leading-relaxed">{p.cnj}</summary><div className="space-y-2 pt-2"><p className="text-muted-foreground">{p.vara || 'Vara não informada'}</p><p>{p.status || 'Status não informado'}</p>{p.homologado !== undefined && <p className={p.homologado ? 'text-success' : 'text-muted-foreground'}>{p.homologado ? 'Homologado' : 'Não homologado'}</p>}{!p.movements.length && <p className="text-muted-foreground">Nenhum andamento registrado.</p>}<ol className="space-y-3">{p.movements.map(m => <li key={m.id} className="space-y-1 border-l pl-3"><p className="text-muted-foreground">{savedDate(m.data)}{m.tipo ? ` · ${m.tipo}` : ''}</p><p className="whitespace-pre-wrap leading-relaxed">{m.texto}</p>{m.eventoData && <p>Evento: {savedDate(m.eventoData)} · {new Date(m.eventoData).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}{m.prazo && <p className={m.concluido ? 'text-success' : 'text-pending-foreground'}>Prazo: {savedDate(m.prazo)}{m.fatal ? ' · fatal' : ''}</p>}<p className={m.concluido ? 'text-success' : 'text-muted-foreground'}>{m.concluido ? 'Providência concluída' : 'Providência pendente'}</p></li>)}</ol></div></details>)}</section>
      <section className="space-y-3"><h3 className="font-sans text-xs font-semibold">Informações do caso</h3><dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2"><dt className="text-muted-foreground">Área</dt><dd>{work.area || 'Não informada'}</dd><dt className="text-muted-foreground">Tribunal</dt><dd>{work.tribunal || 'Não informado'}</dd><dt className="text-muted-foreground">Classe</dt><dd>{work.classe || 'Não informada'}</dd><dt className="text-muted-foreground">Protocolo</dt><dd>{work.recibo || 'Não registrado'}</dd><dt className="text-muted-foreground">Data</dt><dd>{savedDate(work.protocoloData)}</dd></dl></section>
      <section className="space-y-2 border-t pt-4"><h3 className="font-sans text-xs font-semibold">Arquivos locais ({work.arquivos?.length ?? 0})</h3>{work.arquivos?.length ? work.arquivos.map(f => <p key={f.id} className="flex items-start gap-2"><FileText className="size-3.5 shrink-0 text-muted-foreground"/><span>{f.nome}</span></p>) : <p className="text-muted-foreground">Nenhum arquivo salvo neste caso.</p>}</section>
      <Button asChild variant="outline" className="w-full text-xs"><Link to="/andamentos">Abrir Andamentos<ArrowUpRight className="size-3"/></Link></Button>
    </>}
  </div>;
}