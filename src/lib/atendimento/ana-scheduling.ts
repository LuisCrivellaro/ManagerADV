import { gerarHorarios, horarioPermitido, feriadoNacional } from './schedule-rules';
import { intervaloLivre } from './calendar-booking';
import type { TipoCliente } from './intake-rules';

const fold = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function partesAgenda(iso:string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
}
const dias = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
export function pedidoHumano(texto:string) {
  const t=fold(texto);
  return /pessoa de verdade|(?:falar|conversar|passa\w*|atendimento).{0,65}(?:alguem|pessoa|humano|equipe|advogad|carolina|doutora|\bdra\b|responsavel|atendente)|(?:quero|preciso).{0,20}(?:atendente|responsavel|pessoa de verdade)|(?:pessoa|humano).{0,25}(?:falar|atender)/.test(t);
}
export function bloqueiaAgenda(texto:string,intencao:string) {
  const t=fold(texto).trim();
  return pedidoHumano(texto)||/\bnao\s+(?:quero|desejo|vou|preciso)\s+(?:mais\s+)?(?:agendar|marcar)\b/.test(t)||/^(?:ola|oi|bom dia|boa tarde|boa noite|tudo bem)[!?.,\s]*$/.test(t)||(['reclamacao','processo','documento','novo_caso'].includes(intencao)&&!pedidoOutrasOpcoesAna(texto));
}
export function escolherHorarioAna(slots:string[],texto:string) {
  const t=fold(texto).trim();
  if(pedidoOutrasOpcoesAna(texto)||/\?|\b(?:tem|livre|disponivel)\b/.test(t))return undefined;
  const ordem=t.match(/\b(primeir[ao]|segund[ao]|terceir[ao]|ultim[ao])\b/);
  if(ordem){const pos=ordem[1]?.startsWith('primeir')?0:ordem[1]?.startsWith('segund')?1:ordem[1]?.startsWith('terceir')?2:slots.length-1;return slots[pos];}
  const numero=t.match(/^(?:(?:a|o|opcao|numero|escolho|quero)(?:\s+(?:a|o|opcao))?\s*)?([1-9])\s*[.!]?$/);
  if(numero)return slots[Number(numero[1])-1];
  const dia=dias.findIndex(d=>new RegExp(`\\b${d}(?:-feira)?\\b`).test(t));
  const time=t.match(/\b(?:as\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/);
  const dm=t.match(/\b(\d{1,2})\/(\d{1,2})\b/),day=t.match(/\bdia\s+(\d{1,2})\b/);
  if(dia>=0||dm||day||time) {
    const matches=slots.filter(s=>{const p=partesAgenda(s);return (dia<0||new Date(`${dataAgenda(s)}T12:00:00Z`).getUTCDay()===dia)&&(!dm||Number(p['day'])===Number(dm[1])&&Number(p['month'])===Number(dm[2]))&&(!day||Number(p['day'])===Number(day[1]))&&(!time||Number(p['hour'])===Number(time[1])&&Number(p['minute'])===Number(time[2]??time[3]??0));});
    return matches.length===1?matches[0]:undefined;
  }
  return undefined;
}
export function dataAgenda(iso:string) {const p=partesAgenda(iso);return `${p['year']}-${p['month']}-${p['day']}`;}
const hora=(iso:string)=>{const p=partesAgenda(iso);return `${Number(p['hour'])}h${p['minute']==='00'?'':p['minute']}`;};
export function linhaHorarioAna(iso:string,now=new Date()) {
  const p=partesAgenda(iso), data=dataAgenda(iso);
  const today=dataAgenda(now.toISOString());
  const tomorrow=dataAgenda(new Date(now.getTime()+86400000).toISOString());
  const day=new Date(`${data}T12:00:00Z`).getUTCDay();
  const short=['dom','seg','ter','qua','qui','sex','sáb'][day]??'';
  const date=`${p['day']}/${p['month']}`;
  const label=data===today?`Hoje (${short}, ${date})`:data===tomorrow?`Amanhã (${short}, ${date})`:`${short.charAt(0).toUpperCase()+short.slice(1)}, ${date}`;
  return `${label} · ${hora(iso)} às ${hora(new Date(Date.parse(iso)+30*60000).toISOString())}`;
}
export function listaHorariosAna(slots:string[],now=new Date(),repetida=false) {
  if(!slots.length)return 'Não encontrei novas opções livres nos próximos 15 dias úteis. Quer que a equipe entre em contato com você?';
  return `${repetida?'Tenho estas outras opções:':'Claro! Seguem os horários livres para a sua consulta online e gratuita:'}\n\n${repetida?'🗓️ Outras opções':'🗓️ Consulta online'} (30 min, horário de Brasília):\n${slots.map((s,i)=>`${i+1}. ${linhaHorarioAna(s,now)}`).join('\n')}\n\nQual fica melhor para você? Se preferir, me diga outro dia ou horário.`;
}
export function frustracaoHorariosAna(texto:string){return /(?:mesmos?\s+horarios?|de novo esses|esses.{0,15}nao servem|nao.{0,15}servem esses)/.test(fold(texto));}
export function pedidoOutrasOpcoesAna(texto:string){return frustracaoHorariosAna(texto)||/(?:outr[oa]s?.{0,25}(?:horario|opco|dia)|nenhum.{0,20}serve|nao posso nesses|mais tarde|mais cedo|\b(?:a|de|pela)\s+(?:tarde|manha)\b)/.test(fold(texto));}
export function temPreferenciaAna(texto:string){return /manha|tarde|mais cedo|mais tarde|\bdia\s+\d|\d{1,2}\/\d{1,2}/.test(fold(texto))||dias.some(d=>new RegExp(`\\b${d}(?:-feira)?\\b`).test(fold(texto)));}
/** Horizonte comum à leitura Calendar e à geração; datas locais, sem confundir feriados com dias úteis. */
export function horizonteAgendaAna(now=new Date()) {
  const today=dataAgenda(now.toISOString()),day=new Date(`${today}T12:00:00Z`);
  let uteis=0;
  while(uteis<15){day.setUTCDate(day.getUTCDate()+1);const data=day.toISOString().slice(0,10);if(day.getUTCDay()>0&&day.getUTCDay()<6&&!feriadoNacional(data))uteis++;}
  return Math.round((day.getTime()-new Date(`${today}T12:00:00Z`).getTime())/86400000)+1;
}
export function limitarNomeAna(texto:string,nome:string,recentes:string[]) {
  const primeiro=nome.trim().split(/\s+/)[0];
  if(!primeiro)return texto;
  const escaped=primeiro.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(`\\b${escaped}\\b`,'i');
  if(!recentes.slice(-2).some(t=>pattern.test(t)))return texto;
  return texto.replace(new RegExp(`(?:,\\s*)?\\b${nome.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b(?:,\\s*)?`,'gi'),' ').replace(new RegExp(`(?:,\\s*)?\\b${escaped}\\b(?:,\\s*)?`,'gi'),' ').replace(/ +([!?.,])/g,'$1').replace(/ {2,}/g,' ').trim();
}
export function pedidoHorarioEspecifico(texto:string,now=new Date()) {
  const t=fold(texto);
  const time=t.match(/\b(?:as\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/);
  if(!time)return undefined;
  const h=Number(time[1]),min=Number(time[2]??time[3]??0);
  if(h>23||min>59)return undefined;
  let date=dataAgenda(now.toISOString());
  const dm=t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/),day=t.match(/\bdia\s+(\d{1,2})\b/);
  if(dm){const p=partesAgenda(now.toISOString());date=`${dm[3]??p['year']}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`;}
  else if(day){const p=partesAgenda(now.toISOString());date=`${p['year']}-${p['month']}-${String(day[1]).padStart(2,'0')}`;}
  else if(t.includes('amanha'))date=dataAgenda(new Date(now.getTime()+86400000).toISOString());
  else if(!t.includes('hoje')){
    const weekday=dias.findIndex(d=>new RegExp(`\\b${d}(?:-feira)?\\b`).test(t));
    if(weekday<0)return undefined;
    const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+(weekday-d.getUTCDay()+7)%7);date=d.toISOString().slice(0,10);
  }
  const iso=`${date}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00-03:00`;
  const parsed=new Date(iso);
  if(!Number.isFinite(parsed.getTime())||dataAgenda(parsed.toISOString())!==date)return undefined;
  return parsed.toISOString();
}
export function horarioEspecificoLivre(iso:string,busy:{start:string;end:string}[],tipo:TipoCliente,now=new Date()) {
  return Date.parse(iso)>now.getTime()&&Date.parse(iso)<now.getTime()+horizonteAgendaAna(now)*86400000&&horarioPermitido(iso,tipo)&&intervaloLivre(busy,iso,new Date(Date.parse(iso)+30*60000).toISOString());
}
export function selecionarOpcoesAna(busy:{start:string;end:string}[],now:Date,tipo:TipoCliente,texto='',anteriores:string[]=[],evitarRepeticao=false) {
  // Inclui o restante de hoje, sem mudar as regras compartilhadas dos atalhos manuais.
  const horizonte=horizonteAgendaAna(now);
  const all=gerarHorarios(busy,new Date(now.getTime()-86400000),tipo,1000,horizonte+1).filter(s=>Date.parse(s)>now.getTime()&&Date.parse(s)<=now.getTime()+horizonte*86400000);
  const t=fold(texto),specific=pedidoHorarioEspecifico(texto,now);
  const periodo=/tarde|mais tarde/.test(t)?'tarde':/manha|mais cedo/.test(t)?'manha':undefined;
  const weekday=dias.findIndex(d=>new RegExp(`\\b${d}(?:-feira)?\\b`).test(t));
  const day=t.match(/\bdia\s+(\d{1,2})\b/),dm=t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  let available=all.filter(s=>(!evitarRepeticao||!anteriores.some(a=>Date.parse(a)===Date.parse(s)))&&(!periodo||(periodo==='tarde'?Number(partesAgenda(s)['hour'])>=13:Number(partesAgenda(s)['hour'])<12))&&(weekday<0||new Date(`${dataAgenda(s)}T12:00:00Z`).getUTCDay()===weekday)&&(!day||Number(partesAgenda(s)['day'])===Number(day[1]))&&(!dm||Number(partesAgenda(s)['day'])===Number(dm[1])&&Number(partesAgenda(s)['month'])===Number(dm[2])));
  const semPeriodo=!!periodo&&!available.length;
  if(specific)available.sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(specific))-Math.abs(Date.parse(b)-Date.parse(specific)));
  const oldDates=new Set(anteriores.map(dataAgenda));
  if(evitarRepeticao)available.sort((a,b)=>Number(oldDates.has(dataAgenda(a)))-Number(oldDates.has(dataAgenda(b))));
  const distinct:string[]=[],dates=new Set<string>();
  for(const s of available){
    if(dates.has(dataAgenda(s)))continue;
    const preferAfternoon=!periodo&&distinct.some(x=>Number(partesAgenda(x)['hour'])<12)&&!distinct.some(x=>Number(partesAgenda(x)['hour'])>=13);
    const chosen=preferAfternoon?available.find(x=>dataAgenda(x)===dataAgenda(s)&&Number(partesAgenda(x)['hour'])>=13)??s:s;
    distinct.push(chosen);dates.add(dataAgenda(chosen));if(distinct.length===3)break;
  }
  if(!periodo&&!distinct.some(s=>Number(partesAgenda(s)['hour'])>=13)){const afternoon=available.find(s=>Number(partesAgenda(s)['hour'])>=13&&!distinct.includes(s));if(afternoon){if(distinct.length===3)distinct.pop();distinct.push(afternoon);}}
  for(const s of available){if(distinct.length===3)break;if(!distinct.includes(s))distinct.push(s);}
  return {slots:distinct,semPeriodo};
}