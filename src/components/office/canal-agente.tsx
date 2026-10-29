import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Loader2, Plus, RefreshCw, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { executar } from '@/lib/executar';
import { etiquetaAcao, type CanalConfig } from '@/lib/atendimento/canal-envio';
import { actionLabels, type AttendanceAction } from './attendance-actions';
import {
  lerConfigCanal, salvarConfigCanal, listarContatosTeste, salvarContatoTeste,
  registrarWebhookUltramsg, verificarUltramsg,
  lerEntradaWhatsApp, salvarEntradaWhatsApp,
} from '@/lib/atendimento/envio.functions';
import type { Conversa } from '@/lib/mock-data';

type ContatoLista = Awaited<ReturnType<typeof listarContatosTeste>>[number];

function Cartao({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-md border bg-card p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3>{children}</section>;
}

export function CanalAgente({ open, onOpenChange, conversas, onConfig }: {
  open: boolean; onOpenChange: (v: boolean) => void; conversas: Conversa[]; onConfig?: (c: CanalConfig) => void;
}) {
  const qc = useQueryClient();
  const read = useServerFn(lerConfigCanal);
  const saveConfig = useServerFn(salvarConfigCanal);
  const readContatos = useServerFn(listarContatosTeste);
  const saveContato = useServerFn(salvarContatoTeste);
  const registrarWa = useServerFn(registrarWebhookUltramsg);
  const verificarWa = useServerFn(verificarUltramsg);
  const lerEntrada = useServerFn(lerEntradaWhatsApp);
  const salvarEntrada = useServerFn(salvarEntradaWhatsApp);
  const [webhookInfo, setWebhookInfo] = useState<string>('');
  const [form, setForm] = useState({ nome: '', chatId: '', telefone: '' });

  const config = useQuery({ queryKey: ['canal-config'], queryFn: () => read(), enabled: open });
  const contatos = useQuery({ queryKey: ['contatos-teste'], queryFn: () => readContatos(), enabled: open });
  const entrada = useQuery({ queryKey: ['entrada-whatsapp'], queryFn: () => lerEntrada(), enabled: open });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['canal-config'] }), qc.invalidateQueries({ queryKey: ['contatos-teste'] })]);

  const cfg = config.data?.config;
  const mudarCanal = (canal: string) => void executar('Salvar canal', async () => {
    const salvo = await saveConfig({ data: { canal_ativo: canal as 'desligado' | 'ultramsg' | 'telegram', fonte_sugestoes: cfg?.fonte_sugestoes ?? 'ia_manager' } });
    onConfig?.(salvo); await refresh();
  });
  const mudarFonte = (fonte: string) => void executar('Salvar fonte das sugestões', async () => {
    const salvo = await saveConfig({ data: { canal_ativo: cfg?.canal_ativo ?? 'desligado', fonte_sugestoes: fonte as 'ia_manager' | 'agente' } });
    onConfig?.(salvo); await refresh();
  });
  const canalContato = 'ultramsg' as const;
  const adicionar = () => void executar('Adicionar contato', async () => {
    await saveContato({ data: { canal: canalContato, contatoExterno: form.chatId, nome: form.nome, telefoneFicticio: form.telefone, status: 'aguardando_liberacao' } });
    setForm({ nome: '', chatId: '', telefone: '' }); await refresh();
  });
  const atualizar = (c: ContatoLista, patch: { status?: 'aguardando_liberacao' | 'liberado' | 'bloqueado'; conversaId?: string | null }) =>
    void executar('Atualizar contato de teste', async () => {
      await saveContato({ data: { id: c.id, canal: 'ultramsg', nome: c.nome, telefoneFicticio: c.telefone_ficticio, status: (patch.status ?? c.status) as 'aguardando_liberacao' | 'liberado' | 'bloqueado', conversaId: patch.conversaId === undefined ? c.conversa_id : patch.conversaId } });
      await refresh();
    });

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Canal e Agente</DialogTitle></DialogHeader>
    {config.isLoading ? <p className="text-sm text-muted-foreground"><Loader2 className="inline animate-spin" /> Carregando…</p> : <div className="space-y-4">
      <Cartao title="Canal">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm">Canal de mensagens
            <Select value={cfg?.canal_ativo ?? 'desligado'} onValueChange={mudarCanal}>
              <SelectTrigger aria-label="Canal de mensagens" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desligado">Desligado (demonstração)</SelectItem>
                <SelectItem value="ultramsg" disabled={!config.data?.segredos.ultramsg}>WhatsApp (UltraMsg)</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <p className="text-xs text-muted-foreground">Restrito a (11) 99960-0306 e (11) 94207-4361.</p>
        </div>
        <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">WhatsApp · UltraMsg</p>
          <p>Credenciais: {config.data?.segredos.ultramsg ? 'configuradas' : 'não configuradas'}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!config.data?.segredos.ultramsg}
            onClick={() => void executar('Registrar recebimento do WhatsApp', async () => { const r = await registrarWa(); setWebhookInfo(r.descricao); })}>
            <Webhook />Registrar recebimento do WhatsApp</Button>
          <Button variant="outline" size="sm" disabled={!config.data?.segredos.ultramsg}
            onClick={() => void executar('Verificar WhatsApp', async () => { const r = await verificarWa(); setWebhookInfo(`WhatsApp: ${r.status}${r.substatus ? ` · ${r.substatus}` : ''}`); })}>
            <RefreshCw />Verificar WhatsApp</Button>
        </div>
        {webhookInfo && <p className="mt-2 text-xs text-muted-foreground">{webhookInfo}</p>}
      </Cartao>

      <Cartao title="WhatsApp do escritório">
        <label className="flex items-center justify-between gap-4 text-sm">Atender todo mundo que escrever
          <Switch checked={entrada.data?.ativa ?? false} disabled aria-label="Atender todo mundo que escrever no WhatsApp do escritório"
            onCheckedChange={ativa => void executar(ativa ? 'Abrir entrada do WhatsApp' : 'Fechar entrada do WhatsApp', async () => { await salvarEntrada({ data: { ativa } }); await qc.invalidateQueries({ queryKey: ['entrada-whatsapp'] }); })} />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">{entrada.data?.ativa
          ? 'Ligado: quem escrever no número do escritório ganha uma conversa na sua conta e é atendido pela Ana. Para a Ana não responder alguém, use Bloquear na lista de contatos.'
          : 'Desligado: a Ana responde só os contatos liberados na lista abaixo.'}</p>
        <p className="mt-1 text-xs text-muted-foreground">Se a equipe responder pelo celular do escritório, a Ana para naquela conversa até alguém tocar em “Retomar Ana”. Para isso funcionar, toque em “Registrar recebimento do WhatsApp” uma vez depois de publicar.</p>
      </Cartao>

      <Cartao title="Contatos">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input aria-label="Nome do contato" placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <Input aria-label="Número de WhatsApp" placeholder="WhatsApp com DDD" value={form.chatId} onChange={e => setForm({ ...form, chatId: e.target.value })} />
          <Input aria-label="Telefone fictício" placeholder="Telefone fictício com DDD" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
          <Button size="icon" aria-label="Adicionar contato" disabled={!form.chatId.trim() || !form.telefone.trim()} onClick={adicionar}><Plus /></Button>
        </div>
        <div className="divide-y">{(contatos.data ?? []).filter(c => c.canal === canalContato).map(c => <div key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
          <span className="min-w-28 font-medium">{c.nome || 'Sem nome'}</span>
          <span className="text-muted-foreground">{c.contato_externo} · {c.telefone_ficticio}</span>
          <span className={c.status === 'liberado' ? 'text-success' : c.status === 'bloqueado' ? 'text-destructive' : 'text-pending-foreground'}>
            {c.status === 'liberado' ? 'Liberado' : c.status === 'bloqueado' ? 'Bloqueado' : 'Aguardando liberação'}</span>
          <span className="ml-auto flex flex-wrap items-center gap-1">
            <Select value={c.conversa_id ?? 'nenhuma'} onValueChange={v => atualizar(c, { conversaId: v === 'nenhuma' ? null : v })}>
              <SelectTrigger aria-label={`Conversa vinculada de ${c.nome || 'contato'}`} className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem conversa</SelectItem>
                {conversas.map(cv => <SelectItem key={cv.id} value={cv.id}>{cv.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {c.status !== 'liberado' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => atualizar(c, { status: 'liberado' })}>Liberar</Button>}
            {c.status !== 'bloqueado' && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => atualizar(c, { status: 'bloqueado' })}>Bloquear</Button>}
          </span>
        </div>)}
        {contatos.data && !contatos.data.length && <p className="py-3 text-xs text-muted-foreground">Nenhum contato de teste cadastrado.</p>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">O telefone fictício é o que o sistema enxerga: fila e agente funcionam como se fosse WhatsApp.</p>
      </Cartao>

      <Cartao title="Agente">
        <label className="flex items-center justify-between gap-4 border-b pb-3 text-sm">Agente de IA
          <Switch checked={cfg?.agente_ativo??false} disabled={!cfg||cfg.canal_ativo==='desligado'} aria-label="Agente de IA" onCheckedChange={ativo=>void executar('Salvar agente Ana',async()=>{const salvo=await saveConfig({data:{canal_ativo:'ultramsg',fonte_sugestoes:'agente',agente_ativo:ativo}});onConfig?.(salvo);await refresh();})} />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">Ana · assistente virtual CS Lawyers</p>
        <label className="mt-3 block text-sm">Fonte das sugestões
          <Select value={cfg?.fonte_sugestoes ?? 'ia_manager'} onValueChange={mudarFonte}>
            <SelectTrigger aria-label="Fonte das sugestões" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ia_manager">IA do Manager ADV</SelectItem>
              <SelectItem value="agente">Agente</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </Cartao>

      <Cartao title="Ações do Atendimento">
        <div className="grid gap-1 text-xs sm:grid-cols-2">{(Object.keys(actionLabels) as AttendanceAction[]).map(k => (
          <p key={k} className="flex items-center justify-between gap-2 border-b py-1.5">
            <span>{actionLabels[k]}</span>
            <span className={cfg && etiquetaAcao(k === 'retorno' || k === 'confirmar' || k === 'video' || k === 'contrato' || k === 'cobranca' || k === 'registrarContrato' ? 'enviarMensagem' : k, cfg) .startsWith('Real') ? 'text-success' : 'text-muted-foreground'}>
              {etiquetaAcao(k === 'retorno' || k === 'confirmar' || k === 'video' || k === 'contrato' || k === 'cobranca' || k === 'registrarContrato' ? 'enviarMensagem' : k, cfg ?? { canal_ativo: 'desligado', modo_teste: true, agente_ativo: false, fonte_sugestoes: 'ia_manager' })}
            </span>
          </p>))}
        </div>
      </Cartao>
    </div>}
  </DialogContent></Dialog>;
}
