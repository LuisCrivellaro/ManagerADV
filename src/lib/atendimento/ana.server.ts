import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Conversa } from '../mock-data';
import { defaultState, type OfficeState } from '../office';
import { defaultAutomations, newMessage, chosenSlot, formatarHorarioCliente } from '../atendimento';
import { escolherReservaAna } from './calendar-booking';
import { aplicarRegrasAna, expedienteAna, mensagemSemResposta, aceitarRespostaAna, respostaAgendaTeste, priorizarAgendamentoAna } from './ana-rules';
import { etiquetaConversa, identificarTipoCliente } from './intake-rules';
import { telefoneRemetenteAna } from './telegram-intake';
import { horarioPermitido } from './schedule-rules';
import { decidirAlteracaoConsulta, decidirCancelamentoAna, operacaoExpirada } from './appointment-management';
import { solicitarEmailPendente } from './email-rules';
import { bloqueiaAgenda, pedidoHumano, escolherHorarioAna, pedidoHorarioEspecifico, horarioEspecificoLivre, selecionarOpcoesAna, linhaHorarioAna, listaHorariosAna, pedidoOutrasOpcoesAna, frustracaoHorariosAna, temPreferenciaAna, horizonteAgendaAna, limitarNomeAna } from './ana-scheduling';
type Db=SupabaseClient<Database>;

async function assumirAlteracao(db:Db,id:string,messageId:string,eventoId:string,tipo:'cancelar'|'remarcar') {
  let claimed=false;
  await atualizarConversa(db,id,x=>{
    claimed=false;
    if((x.agenteAna?.operacaoConsulta&&!operacaoExpirada(x.agenteAna.operacaoConsulta))||x.agenteAna?.reservaCalendar?.id!==eventoId||x.mensagens.at(-1)?.id!==messageId||x.agenteAna?.humano||x.agenteAna?.pausa)return x;
    claimed=true;
    return {...x,agenteAna:{...x.agenteAna,operacaoConsulta:{mensagemId:messageId,eventoId,tipo,desde:new Date().toISOString()}}};
  });
  if(!claimed)throw new Error('Alteração já em andamento ou consulta alterada; conferir antes de repetir.');
}

/** CAS: não substitui mensagens ou edições recebidas durante a geração. */
export async function atualizarConversa(db:Db,id:string,fn:(c:Conversa)=>Conversa) {
  for(let attempt=0;attempt<5;attempt++) {
    const row=await db.from('casos').select('dados,updated_at').eq('id',id).single();
    if(row.error)throw new Error('Conversa indisponível.');
    const next=fn(row.data.dados as unknown as Conversa);
    const result=await db.from('casos').update({dados:JSON.parse(JSON.stringify(next)) as Json,updated_at:new Date().toISOString()}).eq('id',id).eq('updated_at',row.data.updated_at).select('id');
    if(result.error)throw new Error('Não foi possível salvar o atendimento.');
    if(result.data?.length)return next;
  }
  throw new Error('Conversa alterada simultaneamente; confira o atendimento.');
}

export async function processarAna(db:Db,id:string,messageId:string,request:Request) {
  const canal = messageId.startsWith('telegram:') ? 'telegram' as const : 'ultramsg' as const;
  const [row,config,remetente]=await Promise.all([db.from('casos').select('owner_id,dados').eq('id',id).single(),db.from('atendimento_canal_config').select('*').eq('id',true).single(),db.from('atendimento_contatos_teste').select('contato_externo,telefone_ficticio').eq('conversa_id',id).eq('canal',canal).eq('status','liberado').maybeSingle()]);
  if(row.error||config.error||!config.data.agente_ativo||config.data.canal_ativo!==canal)return;
  const telefone=telefoneRemetenteAna(canal,remetente.data??undefined,messageId);
  if(remetente.error||!telefone)return;
  const c=row.data.dados as unknown as Conversa;
  const ws=await db.from('office_workspace').select('dados').eq('owner_id',row.data.owner_id).maybeSingle();
  if(ws.error)throw new Error('Treinamento indisponível.');
  const state=(ws.data?.dados as unknown as OfficeState)??defaultState;
  const mode=c.modoIA??state.automations?.modoIA??defaultAutomations.modoIA;
  const m=c.mensagens.find(m=>m.id===messageId);
  if(!m||m.iaProcessada||c.agenteAna?.humano||c.agenteAna?.pausa||state.anaPausa?.ativa)return;
  let claimed=false;
  await atualizarConversa(db,id,current=>{
    claimed=false;
    const target=current.mensagens.find(m=>m.id===messageId);
    if(!target||target.iaProcessada||current.mensagens.at(-1)?.id!==messageId||current.agenteAna?.humano||current.agenteAna?.pausa)return current;
    claimed=true;
    return {...current,mensagens:current.mensagens.map(m=>m.id===messageId?{...m,iaProcessada:true}:m)};
  });
  if(!claimed||mensagemSemResposta(m.texto,!!m.arquivo))return;
  try {
    const {gerarRespostaAna}=await import('./ana.functions');
    // Histórico exclusivamente deste contato/canal; nunca material jurídico do caso demonstrativo.
    const history=c.mensagens.filter(m=>m.canal===canal).slice(-24).map(m=>({de:m.de,texto:m.texto,arquivo:m.arquivo??'',autor:m.autor??''}));
    const tipoCliente=c.tipoClienteAgenda??identificarTipoCliente(m.texto)??c.agenteAna?.tipoCliente??(c.etapa==='inicial'?'novo':undefined);
    const etiqueta=etiquetaConversa(c);
    const lista=await db.from('checklist_itens').select('nome,recebido').eq('caso_id',id).eq('owner_id',row.data.owner_id);
    if(lista.error)throw new Error('Checklist indisponível.');
    const email=c.email||c.agenteAna?.dados?.email||'';
    const gerada=await gerarRespostaAna(request,{checklist:lista.data,email_cadastrado:email,solicitar_email:c.etapa==='documentos'&&solicitarEmailPendente(lista.data,email),data_hora_atual:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),dentro_expediente:expedienteAna(),tipo_cliente_agenda:tipoCliente??'desconhecido; perguntar',area_origem:etiqueta,telefone_informado:telefone??'',regras_agenda:'30 minutos; novo segunda a quinta 09:00–17:30; cadastrado sexta 13:30–17:30; sem feriados; sem CPF',modo_ia:mode,vendedor_ativo:state.automations?.vendedor??false,cliente:c.agenteAna?.dados??null,apresentado:c.agenteAna?.apresentado??false,consulta_info:c.agenteAna?.reservaCalendar?{online:true,gratuita:true,duracao_minutos:30,reserva_confirmada:c.agenteAna.reservaCalendar.inicio}:{online:true,gratuita:true,duracao_minutos:30},horarios_oferecidos:c.agenteAna?.horariosTeste??[],temas_proibidos_extra:state.training.proibidos,historico:history,ultima_mensagem:{texto:m.texto,arquivo:m.arquivo??''},exemplos:state.training.exemplos},state.training.instrucoes);
    const raw=priorizarAgendamentoAna(gerada,m.texto,c.agenteAna?.resultado?.intencao==='agendamento'&&!c.consultaAgendada);
    // Cadastro do e-mail só usa texto validado do cliente, nunca suposição do modelo.
    raw.dados_coletados.email=email;
    const consentCancel=c.agenteAna?.confirmacaoCancelamento;
    const pendenteCancel=!!consentCancel&&consentCancel.eventoId===c.agenteAna?.reservaCalendar?.id&&consentCancel.inicio===c.consultaAgendada&&consentCancel.contato===telefone&&Date.parse(consentCancel.expira)>Date.now();
    const decisaoCancel=decidirCancelamentoAna(m.texto,pendenteCancel);
    const alteracao=decisaoCancel==='confirmar'?'cancelar':decisaoCancel==='remarcar'?'remarcar':decisaoCancel==='pedir'||decisaoCancel==='manter'?'perguntar':decidirAlteracaoConsulta(m.texto,!!c.consultaAgendada,c.agenteAna?.alteracaoConsulta);
    const semConsulta=decisaoCancel==='pedir'&&!c.consultaAgendada;
    if(decisaoCancel&&!pedidoHumano(m.texto)){raw.intencao='agendamento';raw.encaminhar_humano=false;}
    if(alteracao||c.agenteAna?.alteracaoConsulta==='remarcar')raw.intencao='agendamento';
    const bloqueada=bloqueiaAgenda(m.texto,raw.intencao)||pedidoHumano(m.texto);
    if(!bloqueada&&(escolherHorarioAna(c.agenteAna?.horariosTeste??[],m.texto)??chosenSlot(c.agenteAna?.horariosTeste??[],m.texto)))raw.intencao='agendamento';
    const teste=config.data.modo_teste===true;
    const previous=c.mensagens.filter(m=>m.canal===canal&&m.de==='escritorio').at(-1)?.texto??'';
    const nome=raw.dados_coletados.nome.trim()||c.agenteAna?.dados?.nome||'';
    let horarios=(c.agenteAna?.horariosTeste??[]).filter(s=>tipoCliente&&horarioPermitido(s,tipoCliente)&&Date.parse(s)>Date.now());
    let agendaReal=c.agenteAna?.agendaReal===true&&horarios.length>0;
    const oferecidos=c.agenteAna?.horariosTeste??[];
    // Só horários da agenda real contam como já oferecidos; fictícios salvos antes da correção nunca foram mostrados.
    const historicoHorarios=[...new Set([...(c.agenteAna?.horariosApresentados??[]),...(c.agenteAna?.agendaReal===true?oferecidos:[]),...(c.horariosOfertados??[]),...(c.consultaAgendada?[c.consultaAgendada]:[])])];
    const outras=pedidoOutrasOpcoesAna(m.texto)||decisaoCancel==='remarcar';
    const repetida=(c.agenteAna?.listasHorarios??0)>0||historicoHorarios.length>0;
    const pedidosOutras=(c.agenteAna?.pedidosOutrasOpcoes??0)+(outras&&!temPreferenciaAna(m.texto)?1:0);
    const aceitouPendente=!!c.agenteAna?.horarioPendente&&!!c.agenteAna.horarioPendenteDesde&&Date.now()-Date.parse(c.agenteAna.horarioPendenteDesde)<30*60000&&/^(?:sim|pode|pode marcar|sim pode|sim por favor|confirmo|confirmar)[.!\s]*$/i.test(m.texto.trim());
    const especifico=!bloqueada?pedidoHorarioEspecifico(m.texto):undefined;
    // Uma pergunta de disponibilidade nunca autoriza uma reserva, mesmo em horário já oferecido.
    const consultaEspecifica=!!especifico&&(/\?|\b(?:tem|livre|disponivel|disponível|pode ser)\b/i.test(m.texto)||!oferecidos.includes(especifico));
    const selecionado=!bloqueada&&!consultaEspecifica?(aceitouPendente?c.agenteAna?.horarioPendente:escolherHorarioAna(oferecidos,m.texto)??chosenSlot([...(c.agenteAna?.horariosTeste??[]),...(c.horariosOfertados??[])],m.texto)):undefined;
    if(!bloqueada&&(especifico||selecionado||aceitouPendente))raw.intencao='agendamento';
    const gerenciarExistente=!!c.consultaAgendada&&alteracao!=='remarcar'&&c.agenteAna?.alteracaoConsulta!=='remarcar';
    let horarioPendente:string|undefined;
    let semPeriodo=false;
    let indisponivel=false;
    if(teste&&tipoCliente&&telefone&&raw.intencao==='agendamento'&&!bloqueada&&!selecionado&&!gerenciarExistente&&!semConsulta&&(nome||consultaEspecifica||/horarios|horários/.test(m.texto))){
      const {ocupadosGoogleCalendar}=await import('./google-calendar.server');
      const busy=await ocupadosGoogleCalendar(new Date(),horizonteAgendaAna());
      if(!busy)throw new Error('Agenda indisponível; nenhum horário oferecido.');
      agendaReal=true;
      if(consultaEspecifica&&especifico&&horarioEspecificoLivre(especifico,busy,tipoCliente)){
        horarioPendente=especifico;horarios=[especifico];
      }else{
        indisponivel=consultaEspecifica;
        const opcoes=selecionarOpcoesAna(busy,new Date(),tipoCliente,m.texto,historicoHorarios,true);
        horarios=opcoes.slots;semPeriodo=opcoes.semPeriodo;
      }
    }
    const r=aplicarRegrasAna(raw,mode,m.texto,state.training.proibidos,{teste,horarios,ultimaResposta:previous,agendaReal,tipoCliente,nome,telefone,emailPendente:c.etapa==='documentos'&&solicitarEmailPendente(lista.data,email)});
    if(agendaReal&&!selecionado&&!horarioPendente&&!gerenciarExistente&&r.acao==='enviar'&&r.intencao==='agendamento'&&!r.motivo_aprovacao){
      r.mensagem=listaHorariosAna(horarios,new Date(),repetida);
      if(frustracaoHorariosAna(m.texto)&&horarios.length)r.mensagem=r.mensagem.replace(/^[^\n]+/,'Desculpe! Aqui vão opções diferentes:');
      if(outras&&pedidosOutras>=2&&!temPreferenciaAna(m.texto)&&horarios.length)r.mensagem=r.mensagem.replace('Qual fica melhor para você? Se preferir, me diga outro dia ou horário.','Prefere algum dia da semana ou período, manhã ou tarde?');
    }
    if(horarioPendente&&mode==='Automática'&&!r.encaminhar_humano&&!r.motivo_aprovacao){r.acao='enviar';r.mensagem=`${linhaHorarioAna(horarioPendente)} está livre. Posso marcar para você?`;r.proximo_passo='Aguardar aceite explícito e nome completo para reservar o horário consultado.';}
    if(indisponivel&&r.acao==='enviar')r.mensagem=`Esse horário não está disponível.\n\n${r.mensagem}`;
    if(semPeriodo&&r.acao==='enviar')r.mensagem='Não encontrei novas opções livres nesse período nos próximos 15 dias úteis. Quer que a equipe entre em contato com você?';
    const gerenciar=teste&&mode==='Automática'&&!r.encaminhar_humano&&!r.motivo_aprovacao&&!!c.consultaAgendada;
    const cancelar=gerenciar&&decisaoCancel==='confirmar'&&pendenteCancel;
    const perguntar=gerenciar&&!cancelar&&alteracao!=='remarcar'&&c.agenteAna?.alteracaoConsulta!=='remarcar'&&r.intencao==='agendamento';
    if(perguntar){r.mensagem=`Você já tem uma consulta marcada para ${formatarHorarioCliente(c.consultaAgendada??'')}. Deseja remarcar ou cancelar esse agendamento?`;r.proximo_passo='Aguardar autorização do cliente para cancelar ou remarcar.';}
    if(gerenciar&&decisaoCancel==='pedir'){r.mensagem=`Quer mesmo cancelar a sua consulta de ${formatarHorarioCliente(c.consultaAgendada??'').toLowerCase()}? Se preferir, posso remarcar para outro dia.`;r.proximo_passo='Aguardar confirmação explícita posterior para cancelar esta consulta.';}
    if(gerenciar&&decisaoCancel==='manter'){r.mensagem=`Combinado, sua consulta continua marcada para ${formatarHorarioCliente(c.consultaAgendada??'').toLowerCase()}.`;r.proximo_passo='Consulta mantida por escolha do cliente.';}
    if(semConsulta&&mode==='Automática'&&!pedidoHumano(m.texto)){r.acao='enviar';r.motivo_aprovacao='';r.encaminhar_humano=false;r.mensagem='Não encontrei consulta marcada por aqui. Quer marcar uma?';r.proximo_passo='Aguardar interesse em novo agendamento.';}
    if(cancelar){r.mensagem='';r.proximo_passo='Cancelar consulta somente após validar o recibo do atendimento.';}
    const agenda=!horarioPendente&&!bloqueada&&!perguntar&&!cancelar&&!semConsulta&&teste&&tipoCliente&&telefone&&r.intencao==='agendamento'&&r.acao==='enviar'?respostaAgendaTeste(m.texto,horarios,new Date(),agendaReal,tipoCliente,repetida):undefined;
    let accepted=false;
    await atualizarConversa(db,id,current=>{
      accepted=false;
      if(!aceitarRespostaAna(messageId,current.mensagens.at(-1)?.id,current.agenteAna))return current;
      accepted=true;
      return {...current,...(current.etiquetaAcao||etiqueta==='sem'?{}:{etiquetaAcao:etiqueta}),agenteAna:{...current.agenteAna,...(gerenciar&&alteracao==='remarcar'&&current.agenteAna?.reservaCalendar?{alteracaoConsulta:'remarcar' as const,autorizacaoRemarcacao:{eventoId:current.agenteAna.reservaCalendar.id,inicio:current.agenteAna.reservaCalendar.inicio,contato:telefone,expira:new Date(Date.now()+30*60000).toISOString()}}:{}),tipoCliente,telefone,horarioPendente:horarioPendente??(aceitouPendente?c.agenteAna?.horarioPendente:undefined),horarioPendenteDesde:horarioPendente?new Date().toISOString():aceitouPendente?c.agenteAna?.horarioPendenteDesde:undefined,...(horarioPendente?{horariosTeste:[horarioPendente],agendaReal:true}:{}),...(agenda&&agendaReal?{horariosTeste:agenda.slots,agendaReal}:{}),resultado:r,dados:{...(current.agenteAna?.dados??{nome:'',cpf:'',assunto:'',email:''}),...Object.fromEntries(Object.entries(r.dados_coletados).filter(([,v])=>v))},humano:r.encaminhar_humano,urgente:r.urgente||current.agenteAna?.urgente||false,motivo:r.motivo_aprovacao,proximoPasso:r.proximo_passo,erro:undefined},iaRetida:r.acao==='rascunho'?r.mensagem:current.iaRetida};
    });
    if(!accepted)return;
    if(decisaoCancel==='manter'||decisaoCancel==='remarcar')await atualizarConversa(db,id,x=>({...x,agenteAna:{...x.agenteAna,confirmacaoCancelamento:undefined,...(decisaoCancel==='manter'?{alteracaoConsulta:undefined,autorizacaoRemarcacao:undefined,horarioPendente:undefined,horarioPendenteDesde:undefined}:{})}}));
    if(r.acao==='enviar'&&(r.mensagem.trim()||cancelar)) {
      // Relê bloqueios imediatamente antes de enviar; alteração de modo/canal vence a geração.
      const [fresh,cfg,contact,freshWorkspace]=await Promise.all([db.from('casos').select('dados').eq('id',id).single(),db.from('atendimento_canal_config').select('canal_ativo,agente_ativo,modo_teste').eq('id',true).single(),db.from('atendimento_contatos_teste').select('contato_externo,status').eq('conversa_id',id).eq('canal',canal).eq('status','liberado').maybeSingle(),db.from('office_workspace').select('dados').eq('owner_id',row.data.owner_id).maybeSingle()]);
      const current=fresh.data?.dados as unknown as Conversa|undefined;
      const currentState=(freshWorkspace.data?.dados as unknown as OfficeState)??defaultState;
      if(fresh.error||cfg.error||contact.error||freshWorkspace.error||!contact.data||!current||cfg.data?.canal_ativo!==canal||!cfg.data.agente_ativo||(current.modoIA??currentState.automations?.modoIA??defaultAutomations.modoIA)!=='Automática'||current.mensagens.at(-1)?.id!==messageId||current.agenteAna?.pausa||currentState.anaPausa?.ativa||current.agenteAna?.humano&&!r.encaminhar_humano||current.mensagens.some(x=>x.respostaAnaDe===messageId))return;
      if(!messageId.startsWith(`${canal}:${contact.data.contato_externo}:`))return;
      if(cancelar){
        try {
        const reserva=current.agenteAna?.reservaCalendar;
        if(!reserva||reserva.inicio!==current.consultaAgendada)throw new Error('Consulta sem recibo verificável; equipe deve conferir antes de cancelar.');
        const consent=current.agenteAna?.confirmacaoCancelamento;
        if(!consent||consent.eventoId!==reserva.id||consent.inicio!==reserva.inicio||consent.contato!==telefone||Date.parse(consent.expira)<=Date.now())throw new Error('Confirmação de cancelamento inválida ou vencida.');
        const {cancelarGoogleCalendar}=await import('./google-calendar.server');
        await assumirAlteracao(db,id,messageId,reserva.id,'cancelar');
        const resultado=await cancelarGoogleCalendar(id,reserva,true);
        r.mensagem=`Pronto, sua consulta de ${formatarHorarioCliente(reserva.inicio).toLowerCase()} foi cancelada. Se quiser marcar outro dia, é só me chamar.`;
        r.proximo_passo=resultado==='ausente'?'Consulta retirada do atendimento; o compromisso já não estava na agenda conectada. Equipe: conferir outras agendas.':'Consulta cancelada com autorização do cliente.';
        await atualizarConversa(db,id,x=>({...x,consultaAgendada:undefined,horariosOfertados:[],agenteAna:{...x.agenteAna,confirmacaoCancelamento:undefined,operacaoConsulta:undefined,reservaCalendar:undefined,alteracaoConsulta:undefined,autorizacaoRemarcacao:undefined,horarioPendente:undefined,horarioPendenteDesde:undefined,horariosTeste:[],agendaReal:false,resultado:r,proximoPasso:r.proximo_passo},timeline:[...x.timeline,{data:new Date().toISOString(),evento:r.proximo_passo}]}));
        await db.rpc('registrar_audit_log',{p_ator:'Ana',p_perfil:'sistema',p_acao:'cancelarCalendar',p_resumo:r.proximo_passo,p_status:'sucesso'});
        }catch(error){
          console.error('Cancelamento Google Calendar não concluído',error);
          r.mensagem='Não consegui cancelar agora. Deixei registrado e a equipe vai confirmar com você.';r.encaminhar_humano=true;r.proximo_passo='Equipe: conferir falha de cancelamento; consulta não confirmada como cancelada.';
          await atualizarConversa(db,id,x=>({...x,agenteAna:{...x.agenteAna,operacaoConsulta:undefined,humano:true,resultado:r,erro:'Falha ao cancelar; conferir agenda.',proximoPasso:r.proximo_passo},timeline:[...x.timeline,{data:new Date().toISOString(),evento:r.proximo_passo}]}));
          await db.rpc('registrar_audit_log',{p_ator:'Ana',p_perfil:'sistema',p_acao:'cancelarCalendar',p_resumo:r.proximo_passo,p_status:'erro',p_erro:'Cancelamento não confirmado; conferir registros do servidor.'});
        }
      }
      const ofertasEquipe=(current.horariosOfertados??[]).filter(s=>tipoCliente&&horarioPermitido(s,tipoCliente)&&Date.parse(s)>Date.now());
      const escolhido=escolherReservaAna({texto:m.texto,selecionado,horarios:agendaReal?[...(c.agenteAna?.horariosTeste??[]),...ofertasEquipe]:ofertasEquipe,real:agendaReal||ofertasEquipe.length>0,tipoCliente,teste:cfg.data.modo_teste===true,modo:current.modoIA??currentState.automations?.modoIA??defaultAutomations.modoIA,bloqueado:bloqueada||consultaEspecifica||cancelar||perguntar||!tipoCliente||!nome||!telefone||r.intencao!=='agendamento'||r.encaminhar_humano||!!r.motivo_aprovacao});
      if(escolhido){
        if(current.consultaAgendada&&current.agenteAna?.alteracaoConsulta!=='remarcar'){
          r.mensagem=`Você já tem uma consulta marcada para ${formatarHorarioCliente(current.consultaAgendada)}. Deseja remarcar ou cancelar esse agendamento?`;
          r.proximo_passo='Aguardar autorização para alteração da consulta.';
        }else{
          try{
            const {reservarGoogleCalendar,remarcarGoogleCalendar}=await import('./google-calendar.server');
            const cliente={nome,telefone:telefone??'',tipo:tipoCliente??'novo'};
            if(current.consultaAgendada){
              const consent=current.agenteAna?.autorizacaoRemarcacao;
              if(!current.agenteAna?.reservaCalendar||!consent||consent.eventoId!==current.agenteAna.reservaCalendar.id||consent.inicio!==current.consultaAgendada||consent.contato!==telefone||Date.parse(consent.expira)<=Date.now())throw new Error('Remarcação sem autorização vigente para esta consulta.');
              await assumirAlteracao(db,id,messageId,current.agenteAna.reservaCalendar.id,'remarcar');
            }
            const reserva=current.consultaAgendada&&current.agenteAna?.reservaCalendar?await remarcarGoogleCalendar(id,current.agenteAna.reservaCalendar,escolhido,true,new Date(),cliente):await reservarGoogleCalendar(id,escolhido,new Date(),cliente);
            r.mensagem=`Sua consulta está confirmada para ${formatarHorarioCliente(reserva.inicio)}.${reserva.meetUrl?`\nAcesse a reunião: ${reserva.meetUrl}`:''}`;
            r.proximo_passo='Consulta reservada automaticamente no Google Calendar.';
            // Mesmo se chegar nova mensagem, preservar o recibo da operação já concluída.
            await atualizarConversa(db,id,x=>({...x,consultaAgendada:reserva.inicio,horariosOfertados:[],agenteAna:{...x.agenteAna,operacaoConsulta:undefined,reservaCalendar:reserva,alteracaoConsulta:undefined,autorizacaoRemarcacao:undefined,horariosTeste:[],horarioPendente:undefined,horarioPendenteDesde:undefined,consultaTeste:undefined,resultado:r,proximoPasso:r.proximo_passo},timeline:x.agenteAna?.reservaCalendar?.id===reserva.id?x.timeline:[...x.timeline,{data:new Date().toISOString(),evento:`Consulta confirmada no Google Calendar · ${formatarHorarioCliente(reserva.inicio)}`}]}));
            const audit=await db.rpc('registrar_audit_log',{p_ator:'Ana',p_perfil:'sistema',p_acao:'reservaCalendar',p_resumo:`Compromisso confirmado · ${reserva.inicio}`,p_status:'sucesso'});
            if(audit.error)throw new Error('Reserva criada; falha de auditoria. Confira a Agenda.');
          }catch(error){
            console.error('Reserva Google Calendar não concluída',error);
            // Nunca prometer reserva após falha, nem criar uma segunda tentativa automática.
            r.mensagem='Não consegui concluir a reserva na agenda. Deixei a situação registrada para a equipe verificar; não considere o horário confirmado por esta mensagem.';
            r.proximo_passo='Equipe: conferir a agenda e a falha de reserva antes de retomar.';
            await atualizarConversa(db,id,x=>({...x,agenteAna:{...x.agenteAna,humano:true,erro:'Falha ao concluir a reserva; conferir Google Calendar.',resultado:{...r,encaminhar_humano:true},proximoPasso:r.proximo_passo}}));
            await db.rpc('registrar_audit_log',{p_ator:'Ana',p_perfil:'sistema',p_acao:'reservaCalendar',p_resumo:'Reserva não confirmada · revisão humana',p_status:'erro',p_erro:'Falha na reserva Google Calendar; conferir registros do servidor.'});
          }
        }
        const latest=await db.from('casos').select('dados').eq('id',id).single();
        const x=latest.data?.dados as unknown as Conversa|undefined;
        if(latest.error||!x||x.mensagens.at(-1)?.id!==messageId||x.agenteAna?.pausa)return;
      }else if(!cancelar&&!perguntar&&agendaReal&&agenda?.selected){
        // Seleção vencida ou fora da autorização nunca vira confirmação.
        r.mensagem='Não posso reservar esse horário agora. Peça novos horários disponíveis para continuar.';
        r.proximo_passo='Consultar novos horários disponíveis.';
      }
      // Claim persistente antes do envio impede replay em falha de rede; nunca reenvia automaticamente.
      const {enviarMensagemSistema}=await import('./envio.functions');
      r.mensagem=limitarNomeAna(r.mensagem,nome,c.mensagens.filter(x=>x.canal===canal&&x.de==='escritorio').slice(-2).map(x=>x.texto));
      const novosOferecidos=!escolhido&&!cancelar&&!perguntar&&!semConsulta&&agendaReal&&!agenda?.selected?(horarioPendente?[horarioPendente]:agenda?.slots??[]):[];
      const sent=await enviarMensagemSistema({supabase:db,conversaId:id,texto:r.mensagem,motivo:'ana',contatoEsperado:contact.data.contato_externo,...(novosOferecidos.length&&!horarioPendente?{horarios:novosOferecidos}:{})});
      if(sent.simulado)throw new Error('Canal desligado; resposta não enviada.');
      await atualizarConversa(db,id,current=>({...current,iaRetida:undefined,agenteAna:{...current.agenteAna,apresentado:true,...(gerenciar&&decisaoCancel==='pedir'&&current.agenteAna?.reservaCalendar?.id===c.agenteAna?.reservaCalendar?.id&&current.agenteAna?.reservaCalendar?{confirmacaoCancelamento:{eventoId:current.agenteAna.reservaCalendar.id,inicio:current.agenteAna.reservaCalendar.inicio,contato:telefone,expira:new Date(Date.now()+30*60000).toISOString()}}:{}),...(novosOferecidos.length?{horariosApresentados:[...new Set([...(current.agenteAna?.horariosApresentados??[]),...historicoHorarios,...novosOferecidos])],listasHorarios:(current.agenteAna?.listasHorarios??0)+1,pedidosOutrasOpcoes:pedidosOutras}:{})},mensagens:[...current.mensagens,newMessage(r.mensagem,{autor:'Ana · assistente virtual',canal,idExterno:sent.idExterno,respostaAnaDe:messageId,status:'enviada'})]}));
    }
    const audit=await db.rpc('registrar_audit_log',{p_ator:'Ana',p_perfil:'sistema',p_acao:'agenteAna',p_resumo:`${mode} · ${r.acao} · ${r.intencao}${r.urgente?' · urgente':''}`,p_status:'sucesso'});
    if(audit.error)throw new Error('Falha ao registrar auditoria.');
  } catch(error) {
    const e=error as {statusCode?:number;responseBody?:string;message?:string};
    console.error('Ana interrompida',error);
    let safe='Não foi possível concluir a resposta da Ana; atendimento encaminhado para a equipe.';
    // Mensagens internas curtas (sem corpo de provedor) ajudam a equipe a saber o motivo real.
    if(e.message&&!e.responseBody&&!/\[\d{3}\]/.test(e.message))safe=`${safe} Motivo: ${e.message}`;
    try {const body=JSON.parse(e.responseBody??'{}');safe=body.message??body.error?.message??safe;}catch {/* Não exibir corpo bruto. */}
    safe=safe.slice(0,400);
    const pause=e.statusCode===402||e.statusCode===403||e.statusCode===404||e.statusCode===401;
    // Libera a operação de agenda travada pela falha; sem isso a conversa ficaria impedida de cancelar/remarcar para sempre.
    await atualizarConversa(db,id,current=>({...current,agenteAna:{...current.agenteAna,humano:true,pausa:pause,erro:safe,operacaoConsulta:undefined,proximoPasso:'Equipe: conferir falha da Ana antes de retomar.'}}));
    if(pause) {
      // Pausa durável para todos os atendimentos do proprietário. Sem probes/retries.
      for(let attempt=0;attempt<5;attempt++){
      const latest=await db.from('office_workspace').select('dados,updated_at').eq('owner_id',row.data.owner_id).maybeSingle();
      if(latest.error)throw new Error('Não foi possível salvar a pausa da IA.');
      const next={...((latest.data?.dados as unknown as OfficeState)??defaultState),anaPausa:{ativa:true,motivo:safe}};
      const save=latest.data?await db.from('office_workspace').update({dados:next as unknown as Json,updated_at:new Date().toISOString()}).eq('owner_id',row.data.owner_id).eq('updated_at',latest.data.updated_at).select('owner_id'):await db.from('office_workspace').insert({owner_id:row.data.owner_id,dados:next as unknown as Json}).select('owner_id');
      if(save.error)throw new Error('Não foi possível salvar a pausa da IA.');
      if(save.data?.length)break;
      if(attempt===4)throw new Error('Não foi possível salvar a pausa da IA.');
      }
    }
    await db.rpc('registrar_audit_log',{p_ator:'Ana',p_perfil:'sistema',p_acao:'agenteAna',p_resumo:'Resposta interrompida · atendimento humano',p_status:'erro',p_erro:safe});
  }
}