import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listarClientesProjuris } from '@/lib/projuris-clientes.functions';
import type { ClienteProjurisDiretorio } from '@/lib/projuris/diretorio';
import { Empty } from './shared';
import { dataHoraCurta } from '@/lib/atendimento';

const dataBR = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v);

export function ProjurisClientes() {
  const listar = useServerFn(listarClientesProjuris);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<ClienteProjurisDiretorio | null>(null);
  useEffect(() => { const t = setTimeout(() => { setBusca(texto); setPagina(0); }, 300); return () => clearTimeout(t); }, [texto]);
  const q = useQuery({ queryKey: ['projuris-clientes', busca, pagina], queryFn: () => listar({ data: { busca, pagina, atualizar: false } }), placeholderData: keepPreviousData, staleTime: 60000 });
  const [atualizando, setAtualizando] = useState(false);
  const atualizar = async () => { setAtualizando(true); try { await listar({ data: { busca, pagina: 0, atualizar: true } }); setPagina(0); await q.refetch(); } finally { setAtualizando(false); } };
  const d = q.data;
  const paginas = d?.ok ? Math.max(1, Math.ceil(d.total / 50)) : 1;
  return <div>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label="Buscar no ProJuris" className="pl-9" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nome, CPF/CNPJ, telefone, e-mail ou cidade…"/></div>
      <Button variant="outline" onClick={() => void atualizar()} disabled={atualizando || q.isFetching}><RefreshCw className={atualizando ? 'animate-spin' : ''}/>Atualizar do ProJuris</Button>
    </div>
    {q.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Consultando o ProJuris… (a primeira busca leva alguns segundos)</p>
      : !d || !d.ok ? <p role="alert" className="text-sm text-destructive">{d && !d.ok ? d.erro : 'Não foi possível consultar o ProJuris.'}</p>
      : <>
        <p className="mb-3 text-sm text-muted-foreground">{d.totalProjuris} pessoas no ProJuris · {d.total} encontradas · consultado {dataHoraCurta(d.atualizadoEm)} · somente leitura</p>
        {!d.itens.length ? <Empty text="Nenhuma pessoa encontrada no ProJuris."/> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted text-xs text-muted-foreground"><tr>{['Nome', 'CPF / CNPJ', 'Telefone / E-mail', 'Cidade', 'Situação', ''].map((h, i) => <th key={i} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{d.itens.map(c => <tr key={c.codigo} className="border-b"><td className="p-3 font-medium">{c.nome}<p className="text-xs font-normal text-muted-foreground">{c.tipo === 'JURIDICA' ? 'Pessoa jurídica' : c.tipo === 'FISICA' ? 'Pessoa física' : c.tipo}</p></td><td className="whitespace-nowrap p-3">{c.cpfCnpj ?? 'Não informado'}</td><td className="p-3"><p className="whitespace-nowrap">{c.telefone ?? 'Não informado'}</p><p className="text-xs text-muted-foreground">{c.email ?? ''}</p></td><td className="p-3">{[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}</td><td className="p-3"><span className={c.habilitado ? 'text-success' : 'text-muted-foreground'}>{c.habilitado ? 'Habilitado' : 'Desabilitado'}</span></td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setAberto(c)}>Ver dados</Button></td></tr>)}</tbody></table></div>}
        <div className="mt-4 flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" aria-label="Página anterior" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}><ChevronLeft/></Button><span>Página {pagina + 1} de {paginas}</span><Button size="sm" variant="outline" aria-label="Próxima página" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}><ChevronRight/></Button></div>
      </>}
    <Dialog open={!!aberto} onOpenChange={v => { if (!v) setAberto(null); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{aberto?.nome}</DialogTitle></DialogHeader>{aberto && <dl className="grid gap-3 text-sm sm:grid-cols-2">{([['Código ProJuris', String(aberto.codigo)], ['CPF / CNPJ', aberto.cpfCnpj], ['Telefone principal', aberto.telefone], ['E-mail principal', aberto.email], ['Nascimento / fundação', dataBR(aberto.nascimento)], ['Classificação', aberto.classificacoes], ['Endereço', aberto.endereco], ['Cidade / UF', [aberto.cidade, aberto.estado].filter(Boolean).join(' / ') || null], ['Situação', aberto.habilitado ? 'Habilitado' : 'Desabilitado'], ['Cadastrado em', dataBR(aberto.incluidoEm)]] as const).map(([k, v]) => <div key={k} className={k === 'Endereço' ? 'sm:col-span-2' : ''}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v || 'Não informado'}</dd></div>)}</dl>}<p className="text-xs text-muted-foreground">Dados lidos do ProJuris agora; alterações devem ser feitas no próprio ProJuris.</p></DialogContent></Dialog>
  </div>;
}
