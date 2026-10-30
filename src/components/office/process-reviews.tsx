import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, Pencil, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { confirmarVinculoProjuris, listarRevisoesProcesso, revisarPedidoProcesso } from '@/lib/atendimento/consulta-processo.functions';
import type { PedidoProcesso } from '@/lib/atendimento/consulta-processo';
import { Route as AuthRoute } from '@/routes/_authenticated/route';
import { supabase } from '@/integrations/supabase/client';

export function ProcessReviews({ conversaId }: { conversaId?: string }) {
  const { user } = AuthRoute.useRouteContext();
  const roles = useQuery({ queryKey: ['attendance-roles', user.id], queryFn: async () => {
    const r = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    if (r.error) throw r.error;
    return r.data.map(x => x.role);
  } });
  const autorizado = roles.data?.some(x => x === 'admin' || x === 'advogada_senior') ?? false;
  const read = useServerFn(listarRevisoesProcesso); const decide = useServerFn(revisarPedidoProcesso);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['process-reviews', user.id, conversaId], queryFn: () => read({ data: { conversaId } }), enabled: autorizado, refetchInterval: 15000 });
  const [selected, setSelected] = useState<PedidoProcesso | null>(null);
  const [corrigir, setCorrigir] = useState(false); const [texto, setTexto] = useState(''); const [busy, setBusy] = useState(false);
  async function revisar(acao: 'aprovar' | 'corrigir' | 'recusar') {
    if (!selected) return;
    setBusy(true);
    try {
      await decide({ data: { conversaId: selected.conversaId, codigo: selected.codigo, hash: selected.hash, acao, ...(acao === 'corrigir' ? { texto } : {}) } });
      toast.success(acao === 'recusar' ? 'Pedido recusado. Ana pausada nesta conversa.' : 'Texto aprovado enviado ao cliente.');
      setSelected(null);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); await Promise.all([qc.invalidateQueries({ queryKey: ['process-reviews'] }), qc.invalidateQueries({ queryKey: ['casos'] })]); }
  }
  if (!autorizado) return null;
  return <section aria-label="Revisão de notícias processuais" className="max-h-56 shrink-0 overflow-y-auto border-b bg-card px-4 py-3">
    <h2 className="mb-2 text-base font-semibold">Notícias processuais pendentes {query.data ? `(${query.data.length})` : ''}</h2>
    {query.isPending ? <p className="text-sm text-muted-foreground">Carregando revisões…</p> : query.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar as revisões.</p> : !query.data?.length ? <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p> : query.data.map(p => <div key={p.conversaId + p.codigo} className="flex items-center justify-between gap-3 border-t py-2">
      <div className="min-w-0 text-sm"><p className="truncate font-medium">{p.codigo} · {p.contato.nome}</p><p className="text-xs text-muted-foreground">{new Date(p.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
      <Button variant="outline" size="sm" onClick={() => { setSelected(p); setTexto(p.textoProposto); setCorrigir(false); }}><Pencil className="size-4" />Revisar</Button>
    </div>)}
    <Dialog open={!!selected} onOpenChange={v => { if (!v && !busy) setSelected(null); }}><DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.codigo} · {selected?.contato.nome}</DialogTitle><DialogDescription>Notícia processual aguardando decisão</DialogDescription></DialogHeader>
      {selected?.processos.map(p => <div key={p.codigo} className="border-b pb-3 text-sm"><p className="font-semibold break-words">{p.identificacao}</p>{p.segredo ? <p>Segredo de justiça · sem detalhes ao cliente</p> : p.andamentos.map((a, i) => <p key={i} className="mt-2 whitespace-pre-wrap break-words">{a.data} {a.hora} · {a.tipo}<br />{a.descricao}</p>)}</div>)}
      <h3 className="font-semibold">Texto proposto</h3><p className="whitespace-pre-wrap break-words text-sm">{selected?.textoProposto}</p>
      {corrigir && <label className="text-sm">Texto corrigido<Textarea aria-label="Texto corrigido da notícia processual" className="mt-2 min-h-36" value={texto} onChange={e => setTexto(e.target.value)} /></label>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="destructive" disabled={busy} onClick={() => revisar('recusar')}><X />Recusar</Button><Button variant="outline" disabled={busy} onClick={() => setCorrigir(v => !v)}><Pencil />Corrigir</Button><Button disabled={busy || corrigir && !texto.trim()} onClick={() => revisar(corrigir ? 'corrigir' : 'aprovar')}>{busy ? <Loader2 className="animate-spin" /> : <Check />}{corrigir ? 'Enviar correção' : 'Aprovar e enviar'}</Button></div>
    </DialogContent></Dialog>
  </section>;
}
/** Vínculo por CPF aguardando a equipe: mostra a pessoa encontrada e libera a consulta só depois da confirmação. */
export function VinculoPendente({ conversaId, vinculo }: { conversaId: string; vinculo?: import('@/lib/projuris/vinculo').VinculoProjuris | undefined }) {
  const { user } = AuthRoute.useRouteContext();
  const roles = useQuery({ queryKey: ['attendance-roles', user.id], queryFn: async () => {
    const r = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    if (r.error) throw r.error;
    return r.data.map(x => x.role);
  } });
  const autorizado = roles.data?.some(x => x === 'admin' || x === 'advogada_senior') ?? false;
  const confirmar = useServerFn(confirmarVinculoProjuris);
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false); const [busy, setBusy] = useState(false);
  if (!autorizado || vinculo?.status !== 'pendente') return null;
  async function executar() {
    setBusy(true);
    try {
      const r = await confirmar({ data: { conversaId } });
      toast.success(r.consultaRetomada ? 'Vínculo confirmado. A consulta do processo seguiu para a revisão.' : 'Vínculo confirmado.');
      setAberto(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); await qc.invalidateQueries({ queryKey: ['casos'] }); }
  }
  return <section aria-label="Vínculo pendente com o ProJuris" className="flex shrink-0 items-center justify-between gap-3 border-b bg-pending px-4 py-2 text-[13px] text-pending-foreground">
    <p><b>Vínculo pendente:</b> cliente informou CPF {vinculo.cpfMascarado}. Confira antes de liberar a consulta.</p>
    <Button size="sm" variant="outline" onClick={() => setAberto(true)}>Confirmar vínculo</Button>
    <Dialog open={aberto} onOpenChange={v => { if (!busy) setAberto(v); }}><DialogContent><DialogHeader><DialogTitle>Confirmar vínculo</DialogTitle><DialogDescription>Pessoa encontrada no ProJuris pelo CPF informado na conversa.</DialogDescription></DialogHeader>
      <p className="text-sm"><b>{vinculo.nome}</b><br />Código no ProJuris: {vinculo.codigoPessoa}<br />CPF: {vinculo.cpfMascarado}</p>
      <label className="flex items-start gap-2 text-sm text-muted-foreground"><input type="checkbox" disabled className="mt-1" />Atualizar telefone no ProJuris — ainda não disponível: a alteração de cadastro no ProJuris aguarda liberação. Atualize o telefone principal direto no ProJuris, se necessário.</label>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAberto(false)}>Cancelar</Button><Button disabled={busy} onClick={executar}>{busy ? <Loader2 className="animate-spin" /> : <Check />}Confirmar vínculo</Button></div>
    </DialogContent></Dialog>
  </section>;
}
