import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Search, ArrowUpRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { clientsQuery } from '@/lib/clients-query';
import { matchesClient } from '@/lib/clients';

export function QuickSearch() {
  const [open, setOpen] = useState(false); const [term, setTerm] = useState('');
  const query = useQuery({ ...clientsQuery(), enabled: open });
  const results = (query.data?.clients ?? []).filter(c => matchesClient(c, term));
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="size-9 shrink-0 justify-center px-0 text-muted-foreground md:h-9 md:w-auto md:min-w-0 md:flex-1 md:justify-start md:px-3 md:max-w-80" aria-label="Abrir busca rápida"><Search/><span className="hidden truncate md:inline">Buscar cliente, CPF, processo…</span></Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Busca rápida</DialogTitle></DialogHeader><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input autoFocus aria-label="Busca rápida" placeholder="Nome, CPF, RG, celular, petição ou protocolo" value={term} onChange={e => setTerm(e.target.value)} className="pl-9"/></div><div className="max-h-[55vh] overflow-y-auto">{query.isPending ? <Loader2 className="mx-auto animate-spin"/> : query.isError ? <p role="alert" className="text-destructive">Busca indisponível. Tente novamente.</p> : !results.length ? <p className="py-6 text-center text-muted-foreground">Nenhum cliente encontrado.</p> : results.slice(0,30).map(c => <Button key={c.id} asChild variant="ghost" className="h-auto w-full justify-between gap-3 border-b py-4 text-left"><Link to="/clientes" search={{clientId:c.id}} onClick={() => setOpen(false)}><span className="min-w-0"><span className="block truncate font-medium">{c.name}</span><span className="block truncate text-xs text-muted-foreground">{c.cpf || 'CPF não informado'} · {c.phone || 'Celular não informado'} · {c.cases.length} caso(s)</span></span><ArrowUpRight className="shrink-0"/></Link></Button>)}</div></DialogContent></Dialog>;
}