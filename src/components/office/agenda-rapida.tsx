import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatarHorarioCliente } from '@/lib/atendimento';
import { horarioPermitido } from '@/lib/atendimento/schedule-rules';
import type { Conversa } from '@/lib/mock-data';

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const somarDias = (data: string, n: number) => { const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Blocos de 30 min das 08:00 às 18:00 (Brasília) do dia escolhido. */
const horariosDoDia = (data: string) => Array.from({ length: 20 }, (_, i) => { const m = 8 * 60 + i * 30; return new Date(`${data}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00-03:00`).toISOString(); });

/** Agenda livre para o atendente: escolhe o dia e quantos horários quiser. Só cola texto; nada é reservado. */
export function AgendaRapida({ c, onInsert, onOffer, disabled }: { c: Conversa; onInsert: (texto: string) => void; onOffer: () => void; disabled?: boolean }) {
  const tipo = (c.tipoClienteAgenda ?? c.agenteAna?.tipoCliente) === 'cadastrado' ? 'cadastrado' : 'novo';
  const [open, setOpen] = useState(false);
  const [dia, setDia] = useState(() => somarDias(hojeSP(), 1));
  const [sel, setSel] = useState<string[]>([]);
  const slots = useMemo(() => horariosDoDia(dia), [dia]);
  const agora = Date.now();
  const toggle = (iso: string) => setSel(s => s.includes(iso) ? s.filter(x => x !== iso) : [...s, iso].sort());
  const inserir = () => { onInsert(sel.map(s => `• ${formatarHorarioCliente(s)}`).join('\n')); setSel([]); setOpen(false); };
  const label = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${dia}T12:00:00Z`));
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button size="icon" variant="ghost" className="size-9 shrink-0 text-muted-foreground hover:text-foreground" aria-label="Consultar horários da agenda" title="Consultar horários da agenda" disabled={disabled}><CalendarClock /></Button></PopoverTrigger>
    <PopoverContent align="start" side="top" className="w-80 max-w-[92vw] p-0">
      <div className="space-y-2 border-b px-3 py-2">
        <p className="text-sm font-semibold">Escolher horários</p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" aria-label="Dia anterior" onClick={() => setDia(d => somarDias(d, -1))}><ChevronLeft className="size-4" /></Button>
          <Input type="date" aria-label="Dia" value={dia} min={hojeSP()} onChange={e => e.target.value && setDia(e.target.value)} className="h-8 flex-1 text-sm" />
          <Button size="icon" variant="ghost" className="size-8" aria-label="Próximo dia" onClick={() => setDia(d => somarDias(d, 1))}><ChevronRight className="size-4" /></Button>
        </div>
        <p className="text-2xs capitalize text-muted-foreground">{label} · reuniões de 30 min</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {slots.map(iso => { const passado = Date.parse(iso) <= agora; const fora = !horarioPermitido(iso, tipo); const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
          return <label key={iso} className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${passado ? 'cursor-not-allowed text-muted-foreground line-through' : 'cursor-pointer hover:bg-secondary'}`}>
            <Checkbox checked={sel.includes(iso)} disabled={passado} onCheckedChange={() => toggle(iso)} aria-label={`Selecionar ${hora}`} />
            <span className="flex-1">{hora}</span>
            {fora && !passado && <span className="text-2xs text-muted-foreground">fora da regra {tipo === 'cadastrado' ? 'de cadastrados' : 'de novos'}</span>}
          </label>; })}
      </div>
      <div className="flex gap-2 border-t p-2">
        <Button size="sm" className="flex-1 text-xs" disabled={!sel.length} onClick={inserir}>Inserir {sel.length || ''} {sel.length === 1 ? 'horário' : 'horários'}</Button>
        <Button size="sm" variant="outline" className="text-xs" disabled={!sel.length} onClick={() => setSel([])}>Limpar</Button>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { setOpen(false); onOffer(); }}>Proposta</Button>
      </div>
      <p className="px-3 pb-2 text-2xs text-muted-foreground">Marque quantos horários quiser, inclusive de dias diferentes. Nada é reservado por aqui.</p>
    </PopoverContent>
  </Popover>;
}
