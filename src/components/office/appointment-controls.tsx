import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {CalendarClock,CalendarX} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from '@/components/ui/dialog';
import {alterarConsultaEquipe} from '@/lib/atendimento/appointment.functions';
import {operacaoExpirada} from '@/lib/atendimento/appointment-management';
import type {Conversa} from '@/lib/mock-data';
export function AppointmentControls({c}:{c:Conversa}){
 const [action,setAction]=useState<'cancelar'|'reagendar'|undefined>();
 const [busy,setBusy]=useState(false);
 const run=useServerFn(alterarConsultaEquipe);
 const queryClient=useQueryClient();
 async function confirm(){
  const eventoId=c.agenteAna?.reservaCalendar?.id;
  if(!action||!eventoId)return;
  setBusy(true);
  try{const result=await run({data:{casoId:c.id,eventoId,acao:action}});await queryClient.invalidateQueries();setAction(undefined);result.avisoEnviado?toast.success('Consulta cancelada e cliente avisado pelo WhatsApp.'):toast.warning('Consulta cancelada; aviso não enviado. A mensagem ficou disponível para envio manual.');}
  catch(e){toast.error(e instanceof Error?e.message:'Não foi possível alterar a consulta.');}
  finally{setBusy(false);}
 }
 if(!c.consultaAgendada)return null;
  const emAndamento=!!c.agenteAna?.operacaoConsulta&&!operacaoExpirada(c.agenteAna.operacaoConsulta);
  const enabled=!!c.agenteAna?.reservaCalendar&&!emAndamento;
 return <><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!enabled||busy} onClick={()=>setAction('cancelar')}><CalendarX className="size-4"/>Cancelar consulta</Button><Button size="sm" variant="outline" disabled={!enabled||busy} onClick={()=>setAction('reagendar')}><CalendarClock className="size-4"/>Reagendar consulta</Button></div>{!enabled&&<p className="text-sm text-muted-foreground">{emAndamento?'Alteração em conferência.':'Consulta sem compromisso real verificável na agenda.'}</p>}<Dialog open={!!action} onOpenChange={open=>{if(!open&&!busy)setAction(undefined);}}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{action==='reagendar'?'Cancelar e oferecer novos horários':'Cancelar consulta'}</DialogTitle></DialogHeader><p className="text-sm">Confirma que a reunião precisa ser cancelada por uma diligência de emergência da Dra. Carolina?</p><p className="text-sm text-muted-foreground">O cliente receberá um pedido de desculpas pelo WhatsApp{action==='reagendar'?' e opções livres para escolher um novo horário. O novo agendamento só será confirmado após a escolha.':'.'}</p><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setAction(undefined)}>Voltar</Button><Button disabled={busy} onClick={()=>void confirm()}>{busy?'Aguarde…':'Confirmar e avisar cliente'}</Button></DialogFooter></DialogContent></Dialog></>;
}