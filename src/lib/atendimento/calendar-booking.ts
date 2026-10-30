import { chosenSlot } from '../atendimento';
import { horarioPermitido } from './schedule-rules';
import type { TipoCliente } from './intake-rules';

/** A escolha vem do texto do cliente, nunca da interpretação livre da IA. */
export function escolherReservaAna(input: { texto: string; horarios: string[]; real: boolean; teste: boolean; modo: string; bloqueado: boolean; tipoCliente?: TipoCliente | undefined; now?: Date; selecionado?:string | undefined }) {
  if (!input.real || !input.teste || input.modo !== 'Automática' || input.bloqueado) return undefined;
  const slot = input.selecionado&&input.horarios.includes(input.selecionado)?input.selecionado:chosenSlot(input.horarios, input.texto);
  return slot && horarioPermitido(slot, input.tipoCliente ?? 'novo') && Date.parse(slot) > (input.now ?? new Date()).getTime() ? slot : undefined;
}

export interface ReservaCalendar { id: string; inicio: string; fim: string; url?: string; meetUrl?:string; }

export function linkMeet(event:{hangoutLink?:string;conferenceData?:{entryPoints?:{entryPointType?:string;uri?:string}[]}}) {
 const url=event.hangoutLink??event.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video')?.uri;
 if(!url)return undefined;
 try{const parsed=new URL(url);return parsed.protocol==='https:'&&parsed.hostname==='meet.google.com'?url:undefined;}catch{return undefined;}
}

/** ID por horário na agenda compartilhada impede duplicações entre mensagens e contatos. */
export async function idReservaCalendar(inicio: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ana:primary:${new Date(inicio).toISOString()}`));
  return `ana${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function intervaloLivre(ocupados: { start: string; end: string }[], inicio: string, fim: string) {
  const s = Date.parse(inicio), e = Date.parse(fim);
  return Number.isFinite(s) && Number.isFinite(e) && s < e && ocupados.every(b => {
    const bs = Date.parse(b.start), be = Date.parse(b.end);
    return Number.isFinite(bs) && Number.isFinite(be) && !(s < be && e > bs);
  });
}