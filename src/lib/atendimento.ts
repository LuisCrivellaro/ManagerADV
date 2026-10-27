import type { Conversa, Mensagem } from './mock-data';
import { gerarHorarios, horarioPermitido } from './atendimento/schedule-rules';
export type AIMode = 'Desligada' | 'Sugerir' | 'Automática';
export interface AutomationSettings { identificarDocumentos:boolean; criarPasta:boolean; pedirDocumentos:boolean; lembreteContrato:boolean; lembreteFaltantes:boolean; lembreteConsulta:boolean; foraHorario:boolean; vendedor:boolean; modoIA:AIMode }
export const defaultAutomations:AutomationSettings={identificarDocumentos:true,criarPasta:true,pedirDocumentos:true,lembreteContrato:true,lembreteFaltantes:true,lembreteConsulta:true,foraHorario:false,vendedor:false,modoIA:'Sugerir'};
export function normalized(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
export function needsReply(c:Pick<Conversa,'mensagens'>){const m=c.mensagens.at(-1);return Boolean(m?.de==='cliente'&&(m.arquivo||!['ok','obrigado','obrigada','recebi','beleza','certo','perfeito','combinado'].includes(normalized(m.texto))));}
export function unread(c:Pick<Conversa,'mensagens'|'lidoAte'>){return c.mensagens.filter(m=>m.de==='cliente'&&m.dataHora&&(!c.lidoAte||m.dataHora>c.lidoAte)).length;}
export function waitingMinutes(c:Pick<Conversa,'mensagens'>,now=new Date()){const t=c.mensagens.at(-1)?.dataHora;return t?Math.max(0,(now.getTime()-Date.parse(t))/60000):null;}
export function waitTone(minutes:number|null){return minutes===null?'muted':minutes<=60?'primary':minutes<=240?'pending':'destructive';}
export function replyQueue(cases:Conversa[]){return cases.filter(needsReply).sort((a,b)=>(a.mensagens.at(-1)?.dataHora??'').localeCompare(b.mensagens.at(-1)?.dataHora??''));}
export function matchesConversation(c:Conversa,s:string){return [c.nome,c.telefone,c.cpf].some(v=>normalized(v).includes(normalized(s)));}
export function forbiddenTopics(text:string,topics:string[]){return topics.filter(t=>t.trim()&&normalized(text).includes(normalized(t)));}
export type StepAction='revisar'|'confirmar'|'lembrete'|'contrato'|'registrarContrato'|'projuris'|'video'|'horarios'|'faltantes'|'producao'|'ia';
export function nextStep(c:Conversa,ultimoAndamento?:string):{title:string;reason:string;action?:StepAction}{
 if(c.iaRetida)return {title:'Revisar IA',reason:'Resposta automática retida por tema proibido.',action:'revisar'};
 const m=c.mensagens.at(-1);const chosen=m?.de==='cliente'?chosenSlot(c.horariosOfertados??[],m.texto):undefined;
  if(chosen&&!c.consultaAgendada)return {title:'Confirmar consulta',reason:`Cliente escolheu ${formatarHorarioCliente(chosen)}.`,action:'confirmar'};
  if(c.etapa==='ativo')return needsReply(c)?{title:'Sugerir resposta',reason:'Cliente ativo aguarda atendimento.',action:'ia'}:{title:'Acompanhar processo',reason:ultimoAndamento||(c.processos.length?c.timeline.at(-1)?.evento||c.processos[0]?.status:undefined)||'Nenhum processo vinculado ainda',action:'projuris'};
  if(c.contrato==='enviado'||c.contrato==='visualizado')return c.contratoLink?{title:'Lembrar assinatura',reason:'Contrato ainda não assinado.',action:'lembrete'}:{title:'Registrar link do contrato',reason:'Contrato enviado sem link registrado.',action:'registrarContrato'};
 if(c.consulta&&!c.contrato)return {title:'Gerar contrato',reason:'Consulta realizada, contrato não gerado.',action:'contrato'};
  if(c.consultaAgendada&&!c.consulta)return {title:'Iniciar videochamada',reason:`Consulta marcada para ${formatarHorarioCliente(c.consultaAgendada)}.`,action:'video'};
 if(c.horariosOfertados?.length&&!c.consultaAgendada)return {title:'Aguardar escolha de horário',reason:'Horários enviados ao cliente.'};
 if(!c.consulta&&!c.consultaAgendada)return {title:'Enviar horários',reason:'Consulta ainda não marcada.',action:'horarios'};
 if(c.documentos.some(d=>!d.recebido))return {title:'Pedir documentos faltantes',reason:'Há itens pendentes no checklist.',action:'faltantes'};
 if(c.documentos.length&&c.documentos.every(d=>d.recebido))return {title:'Pode seguir para a Produção',reason:'Checklist completo; aprovação jurídica continua obrigatória.',action:'producao'};
 return {title:'Nada pendente',reason:'Nenhuma ação operacional imediata.'};
}
export interface FreeSlot {iso:string; label:string; ocupado:boolean}
function horarioParts(iso:string){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return undefined;return Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'2-digit',hour:'numeric',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));}
export function formatarHorarioCliente(iso:string){const p=horarioParts(iso);if(!p)return '';const weekday=p['weekday']??'';return `${weekday.charAt(0).toUpperCase()+weekday.slice(1)}, ${p['day']}/${p['month']}, às ${Number(p['hour'])}h${p['minute']==='00'?'':p['minute']}`;}
/** Horário curto de uma mensagem para a equipe (Brasília): "14:05" no mesmo dia, "18/10 · 14:05" em outro dia; sem segundos. */
export function horaMensagem(m:{dataHora?:string|undefined;hora?:string|undefined},agora:Date=new Date()){if(!m.dataHora)return m.hora??'';const d=new Date(m.dataHora);if(!Number.isFinite(d.getTime()))return m.hora??'';const f=(x:Date)=>Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(x).map(p=>[p.type,p.value]));const a=f(d),b=f(agora);const hm=`${a['hour']}:${a['minute']}`;if(a['day']===b['day']&&a['month']===b['month']&&a['year']===b['year'])return hm;return a['year']===b['year']?`${a['day']}/${a['month']} · ${hm}`:`${a['day']}/${a['month']}/${a['year']} · ${hm}`;}
/** Data e hora completas para registros e agenda (Brasília), sem segundos: "10/11/2026 · 21:00". */
export function dataHoraCurta(iso:string|undefined){if(!iso)return '';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p['day']}/${p['month']}/${p['year']} · ${p['hour']}:${p['minute']}`;}
function diaSP(d:Date){const p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(d).map(x=>[x.type,x.value]));return {key:`${p['year']}-${p['month']}-${p['day']}`,label:`${p['day']}/${p['month']}/${p['year']}`};}
/** Rótulo do separador de dia da conversa (Brasília): Hoje, Ontem, dia da semana até 6 dias, depois a data. */
export function rotuloDia(iso:string,agora:Date=new Date()){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const a=diaSP(d),h=diaSP(agora);const dias=Math.round((Date.parse(h.key+'T12:00:00Z')-Date.parse(a.key+'T12:00:00Z'))/864e5);if(dias===0)return 'Hoje';if(dias===1)return 'Ontem';if(dias>1&&dias<7){const w=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long'}).format(d);return w.charAt(0).toUpperCase()+w.slice(1);}return a.label;}
/** Organiza a conversa como no WhatsApp: separador quando o dia muda (só com data real) e início de bloco quando muda o remetente. */
export function agruparMensagens<T extends {de:string;dataHora?:string|undefined}>(mensagens:T[],agora:Date=new Date()){let dia='';let anterior='';return mensagens.map(m=>{let separador:string|undefined;if(m.dataHora){const d=new Date(m.dataHora);if(Number.isFinite(d.getTime())){const k=diaSP(d).key;if(k!==dia){dia=k;separador=rotuloDia(m.dataHora,agora);anterior='';}}}const inicio=m.de!==anterior||m.de==='sistema';anterior=m.de;return {m,separador,inicio};});}
const ORDEM_STATUS={simulada:0,enviada:1,entregue:2,lida:3} as const;
/** Status inicial a partir do resultado do canal: simulado (nada saiu) ou enviado (canal confirmou). */
export function statusDoEnvio(r:{simulado?:boolean}|undefined):'simulada'|'enviada'{return r&&r.simulado===false?'enviada':'simulada';}
/** Aplica a confirmação do canal sem voltar atrás (lida não volta a entregue) e sem promover mensagem simulada. */
export function avancarStatus(atual:keyof typeof ORDEM_STATUS|undefined,novo:keyof typeof ORDEM_STATUS){if(atual==='simulada'||novo==='simulada')return atual??novo;if(!atual)return novo;return ORDEM_STATUS[novo]>ORDEM_STATUS[atual]?novo:atual;}
export const rotuloStatus={simulada:'Simulada: canal desligado, não saiu do sistema',enviada:'Enviada',entregue:'Entregue',lida:'Vista'} as const;
export function mensagemHorariosCliente(slots:FreeSlot[]){return slots.map(s=>`• ${formatarHorarioCliente(s.iso)}`).join('\n');}
export function validContractLink(link:string){try{return new URL(link).protocol==='https:';}catch{return false;}}
export function registrarContratoEnviado(c:Conversa,link:string,now=new Date().toISOString()):Conversa{if(!validContractLink(link))throw new Error('Informe um link de contrato com https://.');return {...c,contrato:'enviado',contratoLink:link.trim(),contratoEnviadoEm:now,timeline:[...c.timeline,{data:now,evento:'Registrar contrato enviado'}]};}
export function mensagemPermitida(text:string){return !/link\s+nao\s+registrado/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g,''));}
export function freeSlots(now=new Date(),friday=false):FreeSlot[]{return gerarHorarios([],now,friday?'cadastrado':'novo',12,28).map(iso=>({iso,label:formatarHorarioCliente(iso),ocupado:false}));}
export function validOffer(slots:FreeSlot[],cadastrado=false){return slots.length>=2&&slots.length<=3&&slots.every(s=>!s.ocupado&&horarioPermitido(s.iso,cadastrado?'cadastrado':'novo'));}
export function validReturn(iso:string,duration:number){return duration===30&&horarioPermitido(iso,'cadastrado');}
export function programmed(c:Conversa,a:AutomationSettings){const jobs:{key:string;when:string;title:string}[]=[];const append=(key:string,start:string|undefined,hours:number,title:string)=>{if(start)jobs.push({key,when:new Date(Date.parse(start)+hours*3600000).toISOString(),title});};if(a.lembreteContrato&&['enviado','visualizado'].includes(c.contrato??''))append('contrato',c.contratoEnviadoEm,24,'Lembrete do contrato');if(a.lembreteFaltantes&&c.etapa==='documentos'&&c.documentos.some(d=>!d.recebido))append('faltantes',c.ultimoPedidoDocumentos,48,'Lembrete dos documentos faltantes');if(a.lembreteConsulta)append('consulta',c.consultaAgendada,-1,'Lembrete da consulta');return jobs;}
export function newMessage(text:string,extra:Partial<Mensagem>={}):Mensagem{const now=new Date();return {id:crypto.randomUUID(),de:'escritorio',texto:text,hora:now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),dataHora:now.toISOString(),...extra};}

export function validCharge(value:string,description:string,due:string){return Number.isFinite(Number(value))&&Number(value)>0&&Boolean(description.trim())&&/^\d{4}-\d{2}-\d{2}$/.test(due);}
export function chosenSlot(offered:string[],text:string){
 const unique=[...new Set(offered)];const exact=unique.filter(h=>text.includes(h));if(exact.length)return exact.length===1?exact[0]:undefined;
 const folded=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const times=[...folded.matchAll(/\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/g)].map(m=>({hour:Number(m[1]),minute:Number(m[2]??m[3]??0)}));
 if(times.length!==1||times[0]?.hour===undefined||times[0].hour>23||times[0].minute>59)return undefined;
 const dates=[...folded.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{4})?\b/g)];const days=[...folded.matchAll(/\bdia\s+(\d{1,2})\b/g)];const weekdays=[...folded.matchAll(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/g)];
 const matches=unique.filter(iso=>{const p=horarioParts(iso);return p&&Number(p['hour'])===times[0]?.hour&&Number(p['minute'])===times[0]?.minute&&dates.every(m=>Number(p['day'])===Number(m[1])&&Number(p['month'])===Number(m[2]))&&days.every(m=>Number(p['day'])===Number(m[1]))&&weekdays.every(m=>normalized(p['weekday']??'').startsWith(m[1]??''));});
 return matches.length===1?matches[0]:undefined;
}
