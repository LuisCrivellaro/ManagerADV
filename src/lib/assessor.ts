import { needsReply } from './atendimento';
import type { Mensagem } from './mock-data';
import type { Movement } from './office';
export interface AssessorCase {id:string;nome:string;pipeline:number;mine:boolean;prazos:{data:string;texto:string;fatal?:boolean}[];mensagens?:Mensagem[];movements?:Movement[];consultaAgendada?:string|undefined;retornoAgendado?:string|undefined}
export function daysUntil(date:string,today:string){return Math.round((Date.parse(date.slice(0,10)+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);}
export function buildAssessor(cases:AssessorCase[],today:string){
 const deadlines=cases.flatMap(c=>c.prazos.filter(p=>p.fatal).map(p=>({...p,caseId:c.id,client:c.nome,days:daysUntil(p.data,today)}))).sort((a,b)=>a.data.localeCompare(b.data));
 const events=cases.flatMap(c=>(c.movements??[]).filter(m=>m.tipo&&m.eventoData&&!m.concluido).map(m=>({...m,client:c.nome,caseId:c.id})));
 const consultations=cases.filter(c=>c.consultaAgendada?.slice(0,10)===today);const returns=cases.filter(c=>c.retornoAgendado&&c.retornoAgendado.slice(0,10)>=today);
 const waiting=cases.filter(c=>needsReply({mensagens:c.mensagens??[]})).length;const protocols=cases.filter(c=>c.pipeline===6||c.pipeline===7).length;
 const tasks:{id:string;label:string;to:'/andamentos'|'/atendimento'|'/protocolo';urgent:boolean;caseId?:string}[]=[];
 for(const p of deadlines.filter(p=>p.days<=2))tasks.push({id:'fatal-'+p.caseId+p.data,label:`Prazo fatal: ${p.client} · ${p.texto}`,to:'/andamentos',urgent:true,caseId:p.caseId});
 for(const c of cases)for(const p of c.prazos.filter(p=>!p.fatal&&p.data===today))tasks.push({id:c.id+p.texto,label:`Vence hoje: ${c.nome} · ${p.texto}`,to:'/andamentos',urgent:false,caseId:c.id});
 for(const c of consultations)tasks.push({id:'consulta-'+c.id,label:`Consulta: ${c.nome} · ${new Date(c.consultaAgendada??'').toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})}`,to:'/atendimento',urgent:false});
 if(waiting)tasks.push({id:'waiting',label:`${waiting} mensagens aguardando resposta`,to:'/atendimento',urgent:false});
 if(protocols)tasks.push({id:'protocol',label:`${protocols} casos aguardando autuação ou protocolo`,to:'/protocolo',urgent:false});
 return {deadlines,events,returns,tasks,metrics:{fatal:deadlines.filter(p=>p.days<=2).length,events:events.length,protocols,audits:cases.filter(c=>c.pipeline===4||c.pipeline===5).length,attendances:consultations.length,returns:returns.length},badges:{'/':deadlines.filter(p=>p.days<=7).length,'/atendimento':waiting,'/producao':cases.filter(c=>c.pipeline===2||c.pipeline===3).length,'/auditoria':cases.filter(c=>c.pipeline===4||c.pipeline===5).length,'/protocolo':protocols,'/andamentos':cases.reduce((n,c)=>n+(c.movements??[]).filter(m=>m.nova).length,0)}};
}
