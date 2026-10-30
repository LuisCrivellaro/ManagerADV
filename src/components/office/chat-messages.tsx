import { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { agruparMensagens, horaMensagem, rotuloStatus } from '@/lib/atendimento';
import { readFile } from '@/lib/office-store';
import type { CaseFile } from '@/lib/office';
import type { Conversa, Mensagem, StatusMensagem } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Conversa no padrão visual do WhatsApp: balões com "rabinho" no início de cada bloco, horário e status dentro do
// balão, separador de dia, foto (ou iniciais) do cliente ao lado das mensagens dele, imagens como foto e documentos
// que abrem em prévia. O status só mostra o que o canal confirmou (ver statusDoEnvio/avancarStatus).

const CORES = ['#2A7F62', '#6B5CA5', '#B5523B', '#2D6A9F', '#9A6B1F', '#7A4E7E', '#3F7F8C', '#8C4B5A'];
const corDoNome = (nome: string) => CORES[[...nome].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % CORES.length]!;
const iniciais = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export function ClienteAvatar({ nome, foto, className }: { nome: string; foto?: string | undefined; className?: string }) {
  if (foto) return <img src={foto} alt="" className={cn('size-8 shrink-0 rounded-full object-cover', className)} />;
  return <span aria-hidden="true" style={{ backgroundColor: corDoNome(nome) }} className={cn('flex size-8 shrink-0 select-none items-center justify-center rounded-full text-2xs font-semibold text-white', className)}>{iniciais(nome)}</span>;
}

/** Tiques do WhatsApp: relógio (simulada), um tique cinza (enviada), dois cinza (entregue), dois azuis (vista). */
export function StatusTique({ status }: { status: StatusMensagem }) {
  const label = rotuloStatus[status];
  if (status === 'simulada') return <svg role="img" aria-label={label} viewBox="0 0 16 16" className="inline size-3.5 shrink-0 text-[#8696A0]"><title>{label}</title><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.6V8l2.3 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  const duplo = status !== 'enviada';
  return <svg role="img" aria-label={label} viewBox="0 0 18 11" className={cn('inline h-[11px] w-[18px] shrink-0', status === 'lida' ? 'text-[#53BDEB]' : 'text-[#8696A0]')}><title>{label}</title>
    <path d="M1 6l3.2 3.2L11 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    {duplo && <path d="M7.6 8.6l.6.6L15 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}

function extensao(nome: string) { const e = /\.([a-z0-9]{2,5})$/i.exec(nome)?.[1]; return e ? e.toUpperCase() : 'ARQ'; }
const tamanho = (bytes?: number) => !bytes ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Lê o arquivo guardado (armazenamento privado do caso) só para exibir; nunca altera o original. */
function useArquivo(path: string | undefined) {
  const [estado, setEstado] = useState<{ url?: string; blob?: Blob; erro?: boolean }>({});
  useEffect(() => {
    if (!path) return;
    let vivo = true; let url = '';
    readFile(path).then(blob => { if (!vivo) return; url = URL.createObjectURL(blob); setEstado({ url, blob }); }).catch(() => { if (vivo) setEstado({ erro: true }); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return estado;
}

function baixar(url: string, nome: string) { const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); }

function Audio({ m }: { m: Mensagem }) {
  const dur = /(\d{1,2}:\d{2})/.exec(m.arquivo ?? '')?.[1] ?? '';
  // Ondas fixas por mensagem, só ilustrativas: o arquivo de áudio não está disponível para tocar aqui.
  const seed = [...m.id].reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) >>> 0, 5);
  const barras = Array.from({ length: 28 }, (_, i) => 4 + ((seed >> (i % 24)) + i * 7) % 14);
  return <div className="flex min-w-56 items-center gap-2.5 py-0.5" aria-label={`Mensagem de voz${dur ? ` de ${dur}` : ''}`} title="Mensagem de voz recebida">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--zap-meta)]/15 text-[var(--zap-meta)]"><Play className="size-4 translate-x-px fill-current" /></span>
    <span className="flex h-6 flex-1 items-center gap-[2px]" aria-hidden="true">{barras.map((h, i) => <span key={i} className="w-[3px] rounded-full bg-[var(--zap-meta)]/55" style={{ height: h }} />)}</span>
    <span className="flex shrink-0 items-center gap-1 text-2xs text-[var(--zap-meta)]">{dur}</span>
  </div>;
}

function Visualizador({ open, onOpenChange, nome, url, imagem }: { open: boolean; onOpenChange: (v: boolean) => void; nome: string; url: string; imagem: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-4xl gap-3 p-4">
    <DialogHeader><DialogTitle className="truncate pr-8 font-sans text-base">{nome}</DialogTitle></DialogHeader>
    {imagem ? <img src={url} alt={nome} className="mx-auto max-h-[75vh] w-auto rounded-md object-contain" /> : <iframe title={nome} src={url} className="h-[75vh] w-full rounded-md border" />}
    <div className="flex items-center justify-between gap-3">{!imagem ? <p className="text-2xs text-muted-foreground">Se a prévia não aparecer no seu navegador, use Baixar.</p> : <span />}<Button variant="outline" size="sm" onClick={() => baixar(url, nome)}><Download />Baixar</Button></div>
  </DialogContent></Dialog>;
}

function Imagem({ m, arquivo, meta }: { m: Mensagem; arquivo?: CaseFile | undefined; meta: React.ReactNode }) {
  const nome = m.arquivo ?? '';
  const { url, erro } = useArquivo(m.path ?? arquivo?.path);
  const [aberto, setAberto] = useState(false);
  const semTexto = !m.texto;
  if (!url) return <div className="relative flex h-40 w-64 max-w-full flex-col items-center justify-center gap-1.5 rounded-md bg-[#E9EDEF] text-center text-[var(--zap-meta)]">
    <ImageIcon className="size-8 opacity-70" />
    <span className="px-3 text-2xs">{m.path || arquivo ? (erro ? 'Não foi possível abrir a imagem' : 'Carregando imagem…') : 'Pré-visualização indisponível'}</span>
    <span className="max-w-full truncate px-3 text-2xs font-medium" title={nome}>{nome}</span>
  </div>;
  return <>
    <button type="button" onClick={() => setAberto(true)} aria-label={`Abrir imagem ${nome}`} className="relative block overflow-hidden rounded-md focus-visible:outline-2">
      <img src={url} alt={nome} className="block max-h-80 w-full min-w-48 max-w-[300px] object-cover" />
      {semTexto && <span className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/45 to-transparent px-2 pb-1 pt-6 text-2xs text-white">{meta}</span>}
    </button>
    <Visualizador open={aberto} onOpenChange={setAberto} nome={nome} url={url} imagem />
  </>;
}

function Documento({ m, arquivo }: { m: Mensagem; arquivo?: CaseFile | undefined }) {
  const nome = m.arquivo ?? '';
  const ext = extensao(nome);
  const { url, erro } = useArquivo(m.path ?? arquivo?.path);
  const [aberto, setAberto] = useState(false);
  const detalhe = [ext, tamanho(arquivo?.bytes), m.salvoStart ? 'Salvo na pasta Start' : ''].filter(Boolean).join(' · ');
  const corpo = <>
    <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-md text-white', ext === 'PDF' ? 'bg-[#E5534B]' : 'bg-[#7A8C99]')}><FileText className="size-5" /></span>
    <span className="min-w-0 flex-1 text-left"><span className="block truncate font-medium" title={nome}>{nome}</span><span className="block text-2xs text-[var(--zap-meta)]">{detalhe}</span></span>
  </>;
  if (!url) return <div className="flex min-w-56 items-center gap-3 rounded-md bg-black/[0.045] px-2.5 py-2" title={m.path || arquivo ? (erro ? 'Não foi possível abrir o arquivo' : 'Carregando arquivo…') : 'Arquivo sem conteúdo guardado para abrir'}>{corpo}</div>;
  return <>
    <button type="button" onClick={() => setAberto(true)} aria-label={`Abrir ${nome}`} className="flex w-full min-w-56 items-center gap-3 rounded-md bg-black/[0.045] px-2.5 py-2 transition-colors hover:bg-black/[0.07] focus-visible:outline-2">{corpo}</button>
    {m.driveUrl && <a href={m.driveUrl} target="_blank" rel="noreferrer" className="mt-1 block text-2xs text-primary underline">Ver no Google Drive</a>}
    <Visualizador open={aberto} onOpenChange={setAberto} nome={nome} url={url} imagem={false} />
  </>;
}

/** Quem respondeu: mensagens da IA aparecem como ANA; as humanas, com o nome do atendente. */
export function nomeEmissor(autor?: string) {
  if (!autor) return undefined;
  return /^(ana\b|ia\b)/i.test(autor.trim()) ? 'ANA' : autor;
}
export function ChatMessages({ c, arquivos = [] }: { c: Conversa; arquivos?: CaseFile[] | undefined }) {
  const itens = agruparMensagens(c.mensagens);
  const porId = new Map(arquivos.map(a => [a.id, a]));
  return <div className="space-y-0.5">{itens.map(({ m, separador, inicio }) => {
    const sep = separador && <div className="flex justify-center py-2"><span className="zap-pill">{separador}</span></div>;
    if (m.de === 'sistema') return <div key={m.id}>{sep}<div data-message="true" className="flex justify-center py-1.5"><p className="zap-pill max-w-[85%] text-center">{m.texto}{(m.dataHora || m.hora) && <span className="ml-1.5 opacity-80">· {horaMensagem(m)}</span>}</p></div></div>;
    const out = m.de === 'escritorio';
    const audio = m.tipo === 'audio' || /^áudio/i.test(m.arquivo ?? '');
    const imagem = !audio && !!m.arquivo && (m.tipo === 'imagem' || /\.(jpe?g|png|webp|heic|gif)$/i.test(m.arquivo));
    const arquivo = porId.get(m.id);
    const status = out ? m.status : undefined;
    const meta = <span className="inline-flex items-center gap-1"><span>{horaMensagem(m)}</span>{status && <StatusTique status={status} />}</span>;
    const temMeta = !!(m.dataHora || m.hora || status);
    const emissor = out ? nomeEmissor(m.autor) : undefined;
    // Imagem sem legenda: horário vai por cima da foto, como no WhatsApp.
    const metaNaFoto = imagem && !m.texto && !!(m.path ?? arquivo?.path);
    return <div key={m.id}>{sep}<div data-message="true" className={cn('flex items-start gap-2', out ? 'justify-end' : 'justify-start', inicio ? 'pt-2' : 'pt-0.5')}>
      {!out && (inicio ? <ClienteAvatar nome={c.nome} className="mt-0.5" /> : <span className="w-8 shrink-0" aria-hidden="true" />)}
      <div className={cn('zap-bubble relative max-w-[78%] break-words text-sm leading-[1.45] lg:max-w-[65%]', imagem ? 'p-1' : 'px-2.5 pb-1.5 pt-1.5', out ? 'zap-out' : 'zap-in', inicio && 'zap-tail')}>
        {emissor && <p className={cn('px-0.5 text-[13px] font-bold', emissor === 'ANA' ? 'text-primary' : 'text-foreground', imagem && 'px-1.5 pt-0.5')}>{emissor}</p>}
        {audio ? <Audio m={m} /> : imagem ? <Imagem m={m} arquivo={arquivo} meta={meta} /> : m.arquivo && <Documento m={m} arquivo={arquivo} />}
        {m.texto && <p className={cn('whitespace-pre-wrap px-0.5', m.arquivo && 'mt-1.5', imagem && 'px-1.5 pb-1')}>{m.texto}<span aria-hidden="true" className="invisible ml-3 inline-block text-2xs">{meta}</span></p>}
        {m.tipoIdentificado && <p className="mt-1 px-0.5 text-[13px] text-primary">{m.tipoIdentificado}</p>}
        {m.pdfStart && <div className="mt-1 min-w-0 px-0.5 text-2xs"><a href={m.pdfStart.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">PDF em Start · {m.pdfStart.nome}</a><p className="text-muted-foreground">Tipo: {m.pdfStart.tipoDocumento} · Descrição: {m.pdfStart.descricao}</p></div>}
        {m.pendenciaPdf && <p className="mt-1 px-0.5 text-2xs text-pending-foreground">{m.pendenciaPdf}</p>}
        {m.confirmarTipo && <p className="mt-1 inline-block rounded bg-pending px-1.5 text-[13px] text-pending-foreground">Confirmar tipo de documento</p>}
        {temMeta && !metaNaFoto && <span className={cn('text-2xs text-[var(--zap-meta)]', m.texto && !m.tipoIdentificado && !m.confirmarTipo ? 'absolute bottom-1 right-2' : cn('mt-1 flex justify-end', imagem && 'px-1.5 pb-0.5'))}>{meta}</span>}
      </div>
    </div></div>;
  })}</div>;
}
