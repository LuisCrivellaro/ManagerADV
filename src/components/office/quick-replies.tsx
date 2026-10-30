// Mensagens prontas do Atendimento: sugestões da etapa, painel com busca, lista do atalho "/" e editor.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MessageSquareText, Pencil, Plus, Search, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Conversa } from '@/lib/mock-data';
import { REPLY_CATEGORIES, VARIABLES, DEFAULT_REPLIES, cleanShortcut, fillReply, pendingFields, searchReplies, validateReply, type QuickReply, type ReplyCategory } from '@/lib/respostas-prontas';
import { Hint } from './attendance-presentation';

type C = Pick<Conversa, 'nome' | 'atendimento' | 'documentos'>;

/** Linha de sugestões acima da caixa de mensagem (aparece com a caixa vazia). */
export function QuickReplyBar({ replies, c, onPick, onOpenAll }: { replies: QuickReply[]; c: C; onPick: (r: QuickReply) => void; onOpenAll: () => void }) {
  if (!replies.length) return null;
  return (
    <div aria-label="Respostas sugeridas" className="flex items-center gap-1.5 overflow-x-auto px-2 pt-2 [scrollbar-width:none]">
      {replies.map((r) => (
        <Hint key={r.id} label={fillReply(r.texto, c)}>
          <button type="button" onClick={() => onPick(r)} className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {r.titulo}
          </button>
        </Hint>
      ))}
      <button type="button" onClick={onOpenAll} className="flex shrink-0 items-center gap-1 px-1.5 py-1 text-xs text-primary hover:underline">
        <MessageSquareText className="size-3.5" />Todas as mensagens<ChevronRight className="size-3" />
      </button>
    </div>
  );
}

/** Lista que aparece ao digitar "/" na caixa de mensagem, sem tirar o foco do texto. */
export interface SlashItem { kind: 'reply' | 'action'; key: string; title: string; detail: string; disabled?: string | undefined }
export function SlashList({ items, index, onPick, onHover }: { items: SlashItem[]; index: number; onPick: (i: SlashItem) => void; onHover: (i: number) => void }) {
  return (
    <div role="listbox" aria-label="Atalhos" className="absolute inset-x-2 bottom-full z-20 mb-1 overflow-hidden rounded-md border bg-popover shadow-lg">
      {items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma mensagem com esse atalho. Apague a barra para escrever normalmente.</p>}
      {items.map((it, i) => (
        <button key={it.kind + it.key} type="button" role="option" aria-selected={i === index} disabled={!!it.disabled}
          onMouseDown={(e) => { e.preventDefault(); onPick(it); }} onMouseEnter={() => onHover(i)}
          className={cn('flex w-full items-start gap-2 px-3 py-1.5 text-left disabled:opacity-50', i === index && 'bg-secondary')}>
          <span className={cn('mt-0.5 shrink-0 rounded px-1 text-2xs font-medium', it.kind === 'reply' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground')}>{it.kind === 'reply' ? `/${it.key}` : 'Ação'}</span>
          <span className="min-w-0">
            <span className="block text-xs font-medium">{it.title}</span>
            <span className="block truncate text-2xs text-muted-foreground">{it.disabled ?? it.detail}</span>
          </span>
        </button>
      ))}
      <p className="border-t px-3 py-1 text-2xs text-muted-foreground">↑ ↓ para escolher · Enter para usar · Esc para fechar</p>
    </div>
  );
}

/** Botão "Mensagens prontas" + painel com busca, categorias, prévia com os dados do cliente e edição. */
export function QuickReplyPanel({ open, onOpenChange, replies, c, onPick, onEdit, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void; replies: QuickReply[]; c: C;
  onPick: (r: QuickReply) => void; onEdit: (r: QuickReply) => void; onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ReplyCategory | 'Todas'>('Todas');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);
  const visible = useMemo(() => searchReplies(replies, query).filter((r) => cat === 'Todas' || r.categoria === cat), [replies, query, cat]);
  useEffect(() => setActive(0), [query, cat]);
  useEffect(() => { listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const counts = (k: ReplyCategory) => replies.filter((r) => r.categoria === k).length;
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, visible.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && visible[active]) { e.preventDefault(); onPick(visible[active]); }
  };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Hint label="Mensagens prontas (ou digite /)">
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Mensagens prontas">
            <MessageSquareText />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent side="top" align="start" className="w-[400px] max-w-[95vw] p-0" onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus(); }}>
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar mensagem pronta" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={keys} placeholder="Buscar por nome, texto ou atalho" className="h-8 pl-8 text-xs" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(['Todas', ...REPLY_CATEGORIES] as const).map((k) => {
              const n = k === 'Todas' ? replies.length : counts(k);
              if (!n && k !== 'Todas') return null;
              return <button key={k} type="button" onClick={() => setCat(k)} className={cn('shrink-0 rounded-full px-2 py-0.5 text-2xs', cat === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>{k} <span className="opacity-70">{n}</span></button>;
            })}
          </div>
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {!visible.length && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma mensagem encontrada.<br />Crie uma nova abaixo.</p>}
          {visible.map((r, i) => (
            <div key={r.id} data-index={i} onMouseEnter={() => setActive(i)} className={cn('group flex items-start gap-1 px-1', i === active && 'bg-secondary')}>
              <button type="button" onClick={() => onPick(r)} className="min-w-0 flex-1 px-2 py-2 text-left focus-visible:outline-none">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-medium">{r.titulo}</span>
                  <span className="shrink-0 font-mono text-2xs text-muted-foreground">/{r.atalho}</span>
                  {cat === 'Todas' && !query && <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{r.categoria}</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-2xs leading-snug text-muted-foreground">{fillReply(r.texto, c)}</span>
              </button>
              <Hint label="Editar mensagem">
                <Button size="icon" variant="ghost" className="mt-1.5 size-7 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Editar ${r.titulo}`} onClick={() => onEdit(r)}><Pencil className="size-3.5" /></Button>
              </Hint>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <p className="text-2xs text-muted-foreground">Dica: digite <kbd className="rounded border px-1 font-mono">/</kbd> na caixa de mensagem</p>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary" onClick={onCreate}><Plus className="size-3.5" />Nova mensagem</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Criar ou editar uma mensagem pronta, com prévia usando o cliente aberto. */
export function QuickReplyEditor({ reply, all, c, open, onOpenChange, onSave, onRemove, onRestore, busy }: {
  reply: QuickReply | null; all: QuickReply[]; c: C; open: boolean; onOpenChange: (v: boolean) => void; busy: boolean;
  onSave: (r: QuickReply) => Promise<unknown>; onRemove: (id: string) => Promise<unknown>; onRestore: (id: string) => Promise<unknown>;
}) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [atalho, setAtalho] = useState('');
  const [categoria, setCategoria] = useState<ReplyCategory>('Geral');
  const [touched, setTouched] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    setTitulo(reply?.titulo ?? ''); setTexto(reply?.texto ?? ''); setAtalho(reply?.atalho ?? ''); setCategoria(reply?.categoria ?? 'Geral'); setTouched(false); setConfirmRemove(false);
  }, [open, reply]);
  const id = reply?.id ?? `minha-${Date.now().toString(36)}`;
  const draft: QuickReply = { ...(reply ?? {}), id, titulo: titulo.trim(), texto: texto.trim(), atalho, categoria, padrao: reply?.padrao };
  const errors = validateReply(draft, all);
  const original = DEFAULT_REPLIES.find((d) => d.id === reply?.id);
  const changedDefault = Boolean(original && (original.texto !== reply?.texto || original.titulo !== reply?.titulo || original.atalho !== reply?.atalho || original.categoria !== reply?.categoria));
  const free = pendingFields(fillReply(texto, c));
  const insert = (token: string) => {
    const el = area.current; const start = el?.selectionStart ?? texto.length; const end = el?.selectionEnd ?? texto.length;
    const next = texto.slice(0, start) + token + texto.slice(end); setTexto(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };
  const save = async () => { setTouched(true); if (errors.length) return; await onSave(draft); };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reply ? 'Editar mensagem pronta' : 'Nova mensagem pronta'}</DialogTitle>
          <DialogDescription>Fica salva no seu perfil e aparece em todas as conversas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
          <label className="text-xs font-medium">Nome da mensagem<Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Confirmar perícia" className="mt-1" maxLength={60} /></label>
          <label className="text-xs font-medium">Categoria
            <Select value={categoria} onValueChange={(v) => setCategoria(v as ReplyCategory)}>
              <SelectTrigger className="mt-1" aria-label="Categoria"><SelectValue /></SelectTrigger>
              <SelectContent>{REPLY_CATEGORIES.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <label className="text-xs font-medium">Atalho
          <div className="mt-1 flex items-center rounded-md border border-input pl-3 focus-within:ring-1 focus-within:ring-ring">
            <span className="font-mono text-sm text-muted-foreground">/</span>
            <input aria-label="Atalho" value={atalho} onChange={(e) => setAtalho(cleanShortcut(e.target.value))} placeholder="pericia" className="h-9 w-full bg-transparent px-1 font-mono text-sm outline-none" />
          </div>
          <span className="mt-1 block font-normal text-muted-foreground">Digite /{atalho || 'atalho'} na conversa para usar esta mensagem.</span>
        </label>
        <div>
          <label className="text-xs font-medium" htmlFor="quick-reply-text">Texto</label>
          <Textarea id="quick-reply-text" ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} className="mt-1 min-h-28 text-sm" placeholder="Olá, {nome}! …" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-2xs text-muted-foreground">Inserir:</span>
            {VARIABLES.map((v) => <button key={v.key} type="button" onClick={() => insert(`{${v.key}}`)} className="rounded-full border px-2 py-0.5 text-2xs hover:border-primary hover:bg-secondary">{v.label}</button>)}
            <Hint label="Um campo como {data} precisa ser preenchido pela atendente antes de enviar.">
              <button type="button" onClick={() => insert('{data}')} className="rounded-full border border-dashed px-2 py-0.5 text-2xs hover:border-primary hover:bg-secondary">Campo para preencher</button>
            </Hint>
          </div>
        </div>
        <section className="border-l-2 border-primary bg-secondary p-3">
          <h3 className="mb-1 font-sans text-2xs font-semibold text-muted-foreground">Prévia com {c.nome.split(' ')[0]}</h3>
          <p className="whitespace-pre-wrap text-sm">{fillReply(texto, c) || <span className="text-muted-foreground">O texto aparece aqui.</span>}</p>
          {free.length > 0 && <p className="mt-2 text-2xs text-muted-foreground">A atendente vai preencher: {free.map((f) => `{${f}}`).join(', ')}</p>}
        </section>
        {touched && errors.length > 0 && <ul className="space-y-0.5 text-xs text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <DialogFooter className="flex-row flex-wrap items-center gap-2 sm:justify-between">
          <div className="flex gap-1">
            {reply && changedDefault && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void onRestore(reply.id)}><RotateCcw />Voltar ao texto original</Button>}
            {reply && (confirmRemove
              ? <><Button variant="destructive" size="sm" disabled={busy} onClick={() => void onRemove(reply.id)}>Confirmar exclusão</Button><Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>Cancelar</Button></>
              : <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmRemove(true)}><Trash2 />Excluir</Button>)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>Salvar mensagem</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
