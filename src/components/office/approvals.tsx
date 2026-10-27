import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { ClipboardCheck, CalendarClock, CircleAlert, RefreshCw, Search, Eye, Save, Loader2, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { readApprovalQueue, scheduleDraftReview } from '@/lib/approval-queue.functions';
import { draftStatus, reviewPriority, type ApprovalQueueRow } from '@/lib/approval-queue';
import { localDay, deadlineState } from '@/lib/dashboard';
import { Route as AuthRoute } from '@/routes/_authenticated/route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader } from './shared';

export function ApprovalsPage() {
  const { user } = AuthRoute.useRouteContext();
  const read = useServerFn(readApprovalQueue); const schedule = useServerFn(scheduleDraftReview);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['approval-queue', user.id], queryFn: () => read(), refetchInterval: 15000, refetchOnWindowFocus: true });
  const [search, setSearch] = useState(''); const [lawyer, setLawyer] = useState('all');
  const [status, setStatus] = useState('pending'); const [deadline, setDeadline] = useState('all');
  const [selected, setSelected] = useState<ApprovalQueueRow | null>(null);
  const [assigned, setAssigned] = useState('none'); const [dueDate, setDueDate] = useState(''); const [busy, setBusy] = useState(false);
  const today = localDay(); const rows = query.data?.rows ?? []; const lawyers = query.data?.lawyers ?? [];
  const pending = rows.filter(r => !r.draftApproved);
  const visible = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) &&
    (lawyer === 'all' || (r.lawyerId ?? 'none') === lawyer) &&
    (status === 'all' || (status === 'pending' ? !r.draftApproved : draftStatus(r) === status)) &&
    (deadline === 'all' || (deadline === 'none' ? !r.dueDate : !r.draftApproved && !!r.dueDate && r.dueDate <= today)))
    .sort((a, b) => reviewPriority(a, today) - reviewPriority(b, today) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.name.localeCompare(b.name));
  const open = (row: ApprovalQueueRow) => { setSelected(row); setAssigned(row.lawyerId ?? 'none'); setDueDate(row.dueDate ?? ''); };
  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await schedule({ data: { caseId: selected.id, lawyerId: assigned === 'none' ? null : assigned, dueDate: dueDate || null } });
      await qc.invalidateQueries({ queryKey: ['approval-queue', user.id] });
      toast.success('Responsável e prazo salvos.'); setSelected(null);
    } catch (error) { toast.error('Não foi possível salvar.', { description: (error as Error).message }); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-[1500px] p-4 md:p-8">
    <PageHeader title="Aprovações de minutas">
      <span className="text-xs text-muted-foreground">{query.data?.entireOffice ? 'Escritório inteiro' : 'Meus casos'} · {query.data ? new Date(query.data.updatedAt).toLocaleTimeString('pt-BR') : '—'}</span>
      <Button variant="outline" size="icon" aria-label="Atualizar aprovações" title="Atualizar aprovações" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? 'animate-spin' : ''} /></Button>
    </PageHeader>
    {query.isPending ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando aprovações…</p> : query.isError ? <p role="alert" className="text-destructive">Não foi possível carregar as aprovações. Tente atualizar.</p> : <>
      <div className="mb-6 grid gap-6 border-b pb-6 sm:grid-cols-3">
        {[{ icon: ClipboardCheck, label: 'Minutas pendentes', value: pending.length }, { icon: CalendarClock, label: 'Vencidas / hoje', value: pending.filter(r => r.dueDate && r.dueDate <= today).length }, { icon: CircleAlert, label: 'Sem advogado definido', value: pending.filter(r => !r.lawyerId).length }].map(item => <div key={item.label} className="flex items-center gap-4"><item.icon className="size-6 text-primary" /><div><p className="text-3xl font-semibold">{item.value}</p><p className="text-sm text-muted-foreground">{item.label}</p></div></div>)}
      </div>
      <section className="mb-6 border-b pb-5"><h2 className="mb-3 text-lg font-semibold">Pendências por advogado</h2><div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">{[{ id: 'none', name: 'Sem advogado definido' }, ...lawyers].map(l => <div key={l.id}><span className="text-muted-foreground">{l.name}</span><span className="ml-2 font-semibold">{pending.filter(r => (r.lawyerId ?? 'none') === l.id).length}</span></div>)}</div></section>
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar minuta" placeholder="Buscar cliente" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={lawyer} onValueChange={setLawyer}><SelectTrigger className="w-full sm:w-60" aria-label="Filtrar advogado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os advogados</SelectItem><SelectItem value="none">Sem advogado definido</SelectItem>{lawyers.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-60" aria-label="Filtrar aprovação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Todas as pendentes</SelectItem><SelectItem value="all">Todos os status</SelectItem>{['Aguardando aprovação', 'Checklist pendente', 'Nova aprovação necessária', 'Aprovada'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={deadline} onValueChange={setDeadline}><SelectTrigger className="w-full sm:w-48" aria-label="Filtrar prazo de aprovação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os prazos</SelectItem><SelectItem value="due">Vencidas / hoje</SelectItem><SelectItem value="none">Sem prazo</SelectItem></SelectContent></Select>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-y bg-secondary text-muted-foreground"><tr>{['Cliente / origem', 'Advogado revisor', 'Status da minuta', 'Prazo de aprovação', ''].map((h, i) => <th key={i} className="p-3 font-medium" scope="col">{h}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.id} className="border-b"><td className="max-w-64 p-3"><p className="font-medium">{r.name}</p><p className="mt-1 text-xs text-muted-foreground">{r.ownerName}</p></td><td className="max-w-52 p-3">{lawyers.find(l => l.id === r.lawyerId)?.name ?? 'Sem advogado definido'}</td><td className="max-w-56 p-3"><span className={r.draftApproved ? 'text-success' : 'inline-block rounded bg-pending px-1.5 py-0.5 text-pending-foreground'}>{draftStatus(r)}</span></td><td className={`p-3 ${!r.draftApproved && r.dueDate && r.dueDate <= today ? 'font-medium text-destructive' : 'text-foreground'}`}>{r.dueDate ? <>{r.dueDate.split('-').reverse().join('/')}<p className="mt-1 text-xs">{r.draftApproved ? 'Concluída' : deadlineState(r.dueDate, today)}</p></> : 'Sem prazo definido'}</td><td className="p-3"><Button variant="ghost" size="icon" title="Examinar minuta" aria-label={`Examinar minuta de ${r.name}`} onClick={() => open(r)}><Eye /></Button></td></tr>)}</tbody></table></div>
      {!visible.length && <p className="border-b py-10 text-center text-muted-foreground">{rows.length ? 'Nenhuma minuta corresponde aos filtros.' : 'Nenhuma minuta salva para revisão.'}</p>}
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent className="max-h-[90svh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected ? draftStatus(selected) : ''} · {selected?.ownerName}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm">Advogado revisor<Select value={assigned} onValueChange={setAssigned}><SelectTrigger className="mt-2" aria-label="Definir advogado revisor"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem advogado definido</SelectItem>{lawyers.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></label><label className="text-sm">Prazo de aprovação<Input aria-label="Definir prazo de aprovação" className="mt-2" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label></div>
      <div className="max-h-[42svh] overflow-y-auto whitespace-pre-wrap break-words border-y py-4 font-serif text-sm leading-relaxed">{selected?.draft}</div>
      <div className="flex flex-wrap justify-end gap-2">{selected?.mine && <Button variant="outline" asChild><Link to="/producao" search={{ caseId: selected.id }}><ArrowUpRight />Revisão jurídica</Link></Button>}<Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />}Salvar responsável e prazo</Button></div>
    </DialogContent></Dialog>
  </div>;
}