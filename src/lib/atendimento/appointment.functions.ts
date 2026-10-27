import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {operacaoExpirada} from './appointment-management';

export const alterarConsultaEquipe=createServerFn({method:'POST'})
 .middleware([requireSupabaseAuth])
 .inputValidator(z.object({casoId:z.string().uuid(),eventoId:z.string().min(1),acao:z.enum(['cancelar','reagendar'])}))
 .handler(async({data,context})=>{
  const {atualizarConversa}=await import('./ana.server');
  const {cancelarGoogleCalendar,ocupadosGoogleCalendar}=await import('./google-calendar.server');
  const {horariosLivresAna}=await import('./ana-rules');
  const {enviarMensagemSistema}=await import('./envio.functions');
  const {newMessage,formatarHorarioCliente}=await import('../atendimento');
  const row=await context.supabase.from('casos').select('dados').eq('id',data.casoId).eq('owner_id',context.userId).single();
  if(row.error)throw new Error('Atendimento indisponível para seu usuário.');
  const c=row.data.dados as unknown as import('../mock-data').Conversa;
  const reserva=c.agenteAna?.reservaCalendar;
  if(!reserva||reserva.id!==data.eventoId||reserva.inicio!==c.consultaAgendada)throw new Error('Consulta alterada ou sem compromisso real verificável.');
  const [cfg,contact,profile]=await Promise.all([
   context.supabase.from('atendimento_canal_config').select('canal_ativo').eq('id',true).single(),
   context.supabase.from('atendimento_contatos_teste').select('contato_externo').eq('conversa_id',data.casoId).eq('canal','ultramsg').eq('status','liberado').maybeSingle(),
   context.supabase.from('profiles').select('nome').eq('id',context.userId).maybeSingle(),
  ]);
  if(cfg.error||cfg.data.canal_ativo!=='ultramsg'||contact.error||!contact.data)throw new Error('WhatsApp ou contato não liberado; consulta preservada.');
  const tipo=c.tipoClienteAgenda??c.agenteAna?.tipoCliente;
  let horarios:string[]=[];
  if(data.acao==='reagendar'){
   if(!tipo)throw new Error('Confirme a carteira de agendamento do cliente antes de reagendar.');
   const busy=await ocupadosGoogleCalendar();
   if(!busy)throw new Error('Agenda indisponível; consulta preservada.');
   horarios=horariosLivresAna(busy,new Date(),tipo);
   if(!horarios.length)throw new Error('Nenhum horário livre nos próximos 14 dias; consulta preservada.');
  }
  const operationId=crypto.randomUUID();
  let claimed=false;
  await atualizarConversa(context.supabase,data.casoId,x=>{
   claimed=false;
   if((x.agenteAna?.operacaoConsulta&&!operacaoExpirada(x.agenteAna.operacaoConsulta))||x.agenteAna?.reservaCalendar?.id!==data.eventoId)return x;
   claimed=true;
   return {...x,agenteAna:{...x.agenteAna,operacaoConsulta:{mensagemId:operationId,eventoId:data.eventoId,tipo:'cancelar',desde:new Date().toISOString()}}};
  });
  if(!claimed)throw new Error('Consulta alterada ou operação em andamento.');
  try{await cancelarGoogleCalendar(data.casoId,reserva,true);}
  catch(error){await atualizarConversa(context.supabase,data.casoId,x=>({...x,agenteAna:{...x.agenteAna,humano:true,erro:'Cancelamento não confirmado; conferir agenda antes de repetir.'}}));throw error;}
  const texto=`Pedimos desculpas pelo ocorrido. Devido a uma diligência de emergência, a Dra. Carolina precisou cancelar nossa reunião de ${formatarHorarioCliente(reserva.inicio)}.${horarios.length?' Podemos reagendar para um destes horários. Qual você prefere?':' Quando desejar, podemos combinar um novo horário.'}`;
  await atualizarConversa(context.supabase,data.casoId,x=>({...x,consultaAgendada:undefined,horariosOfertados:horarios,agenteAna:{...x.agenteAna,operacaoConsulta:undefined,reservaCalendar:undefined,alteracaoConsulta:undefined,autorizacaoRemarcacao:undefined,consultaTeste:undefined,horariosTeste:horarios,agendaReal:!!horarios.length,proximoPasso:horarios.length?'Aguardar escolha de novo horário pelo cliente.':'Consulta cancelada pela equipe.'},timeline:[...x.timeline,{data:new Date().toISOString(),evento:`Consulta cancelada por ${profile.data?.nome??'atendente'} · diligência de emergência${horarios.length?' · novos horários oferecidos':''}`}]}));
  let avisoEnviado=false;
  try{
   const sent=await enviarMensagemSistema({supabase:context.supabase,conversaId:data.casoId,texto,motivo:'alteracaoConsultaEquipe',contatoEsperado:contact.data.contato_externo,...(horarios.length?{horarios}:{})});
   if(sent.simulado)throw new Error('Aviso não enviado por canal real.');
   await atualizarConversa(context.supabase,data.casoId,x=>({...x,mensagens:[...x.mensagens,newMessage(texto,{autor:profile.data?.nome??'Atendente',canal:'ultramsg',idExterno:sent.idExterno,status:'enviada'})]}));
   avisoEnviado=true;
  }catch(error){console.error('Consulta cancelada, aviso não concluído',error);await atualizarConversa(context.supabase,data.casoId,x=>({...x,iaRetida:texto,agenteAna:{...x.agenteAna,erro:'Consulta cancelada; aviso ao cliente não confirmado. Enviar manualmente.'}}));}
  await context.supabase.rpc('registrar_audit_log',{p_ator:profile.data?.nome??'Atendente',p_perfil:'equipe',p_acao:'alterarConsultaEquipe',p_resumo:`${data.acao} · cancelamento confirmado · aviso ${avisoEnviado?'enviado':'pendente'}`,p_status:avisoEnviado?'sucesso':'erro'});
  return {avisoEnviado};
 });