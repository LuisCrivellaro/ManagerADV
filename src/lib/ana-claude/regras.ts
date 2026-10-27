import { z } from 'zod';
import type { AIMode } from './base';
import { forbiddenTopics, normalized, chosenSlot, formatarHorarioCliente } from './base';
import { validarTextoEnvio } from './base';
import type { ConsultaAgendada } from './agenda';
import { proximoDiaUtil } from './agenda';

export const anaSchema = z.object({
  acao: z.enum(['enviar', 'rascunho', 'nenhuma']), mensagem: z.string(), motivo_aprovacao: z.string(),
  intencao: z.enum(['duvida_geral','novo_caso','agendamento','processo','documento','reclamacao','outro']),
  urgente: z.boolean(), encaminhar_humano: z.boolean(),
  dados_coletados: z.object({ nome:z.string(), cpf:z.string(), assunto:z.string(), email:z.string() }),
  proximo_passo: z.string(),
});
export type AnaResult = z.infer<typeof anaSchema>;
export interface AnaState {
  apresentado?: boolean; humano?: boolean; urgente?: boolean; motivo?: string; proximoPasso?: string;
  dados?: AnaResult['dados_coletados']; resultado?: AnaResult; erro?: string | undefined; pausa?: boolean;
  horariosTeste?: string[]; consultaTeste?: string;
  /** Agenda real (Google Calendar): últimos horários oferecidos e consulta reservada. */
  horariosOferecidos?: string[]; consulta?: ConsultaAgendada;
}
export function horariosTesteAna(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(key:string)=>parts.find(p=>p.type===key)?.value??'';
 const day=new Date(`${value('year')}-${value('month')}-${value('day')}T12:00:00Z`);
 const slots:string[]=[];
 while(slots.length<4){
  day.setUTCDate(day.getUTCDate()+1);
  if([0,6].includes(day.getUTCDay()))continue;
  for(const time of ['09:00','10:30'])slots.push(new Date(`${day.toISOString().slice(0,10)}T${time}:00-03:00`).toISOString());
 }
 return slots;
}
export function respostaAgendaTeste(texto:string,offered:string[],now=new Date()){
 const selected=chosenSlot(offered,texto);
 const slots=offered.length?offered:horariosTesteAna(now);
 return {slots,selected,mensagem:selected?`Para este teste, ficou combinado ${formatarHorarioCliente(selected)}. É uma simulação: não há reserva real no Google Calendar.`:`Podemos simular estes horários:\n${slots.map(s=>`• ${formatarHorarioCliente(s)}`).join('\n')}\nQual prefere? São horários fictícios de teste, sem reserva real.`};
}
function perguntaKey(s:string){
 const n=normalized(s);
 if(/(?:qual|informe|diga|pode).*(?:nome)|comosechama/.test(n))return 'nome';
 if(n.includes('cpf'))return 'cpf';
 if(n.includes('email'))return 'email';
 if(/assunto|comopossoajudar|como.*ajudar|oqueaconteceu/.test(n))return 'assunto';
 return n;
}
export function mensagemBreveAna(texto:string,ultimaResposta=''){
 texto=texto.replace(/\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g,cpf=>`••••••••${cpf.replace(/\D/g,'').slice(-3)}`);
 const previous=(ultimaResposta.match(/[^.!?\n]+\?/g)??[]).map(perguntaKey);
 let perguntas=0;let length=0;let cheio=false;
 // Mantém as quebras de linha (mensagens em blocos, como no WhatsApp); no máximo 2 perguntas e 600 caracteres.
 const linhas=texto.split('\n').map(linha=>{
  if(cheio)return null;
  // Quebra só em pontuação seguida de espaço: e-mails e links (nome@provedor.com, meet.google.com) ficam inteiros.
  const sentencas=linha.split(/(?<=[.!?])\s+/).filter(x=>x.trim());
  const kept:string[]=[];
  for(const raw of sentencas){
   const s=raw.trim();if(!s)continue;
   if(s.endsWith('?')){if(perguntas>=2||previous.includes(perguntaKey(s)))continue;perguntas++;}
   if(length+s.length>600){cheio=true;break;}
   kept.push(s);length+=s.length+1;
  }
  return kept.join(' ');
 }).filter((l):l is string=>l!==null);
 return linhas.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function aceitarRespostaAna(messageId:string,lastId:string|undefined,state:AnaState|undefined){
  return lastId===messageId&&!state?.humano&&!state?.pausa;
}
export function expedienteAna(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'America/Sao_Paulo', weekday:'short', hour:'numeric', hourCycle:'h23' }).formatToParts(now);
  const weekday = parts.find(p=>p.type==='weekday')?.value;
  const hour = Number(parts.find(p=>p.type==='hour')?.value);
  return weekday !== 'Sat' && weekday !== 'Sun' && hour >= 8 && hour < 18;
}
export function mensagemSemResposta(texto: string, arquivo = false) {
  if (arquivo) return false;
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[!.,]+/g, ' ').trim();
  return t === '' || /^(?:(?:ok|okay|okk|blz|beleza|certo|perfeito|combinado|obrigad[oa]|muito obrigad[oa]|valeu|show|top|otimo|recebi|entendi|ta bom|ta|joia|👍|🙏|❤️|😊)\s*)+(?:pela ajuda)?$/u.test(t);
}
export function aplicarRegrasAna(r:AnaResult, mode:AIMode, texto:string, proibidos:string[],options:{teste?:boolean;agendaReal?:boolean;horarios?:string[];ultimaResposta?:string;now?:Date}={}):AnaResult {
  let result = { ...r, dados_coletados:{...r.dados_coletados} };
  const folded = texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const humano = /(?:falar|conversar|atendimento|atendid[oa]).{0,35}(?:pessoa|humano|equipe|advogad|carolina|alguem|atendente|gente de verdade)|(?:pessoa|humano|alguem|atendente).{0,25}(?:falar|atender|me responder)|\b(?:quero|preciso de|chama|chame)\s+(?:um |uma |a |o )?(?:atendente|pessoa|humano)/.test(folded);
  const etico = /honorari|ganhar|quanto.{0,20}receb|chance|vitoria|tenho direito|vale a pena (?:processar|entrar)|prescri|recorrer|estrategia|desistir|parte contraria|devo assinar/.test(folded);
  const urgent = /(?:risco.{0,15}vida|suicid|me matar|violencia|ameaca|perigo|citacao|oficial de justica|carta do forum|prazo.{0,25}(?:venc|amanha|hoje)|demitid.{0,30}(?:hoje|ontem|semana)|audiencia.{0,35}(?:hoje|amanha|semana))/.test(folded);
  const prohibited = etico || forbiddenTopics(texto,proibidos).length > 0 || forbiddenTopics(r.mensagem,proibidos).length > 0;
  // Tema delicado pede revisão, não uma tomada humana completa da conversa.
  // Tema delicado: mantém a resposta do modelo só se ela não estimar valor, prometer resultado ou afirmar direito.
  const arriscada=/r\$|\d+\s*(?:mil|reais|%)|tem direito|vai (?:ganhar|receber)|garant|com certeza (?:vai|ganha)|chance (?:alta|grande|boa)/i.test(r.mensagem);
  if(prohibited||r.intencao==='reclamacao')result={...result,acao:'enviar',mensagem:arriscada||!r.mensagem.trim()?'Entendo a dúvida, e ela é importante.\nQuem consegue avaliar isso com segurança é a Dra. Carolina, na consulta, depois de entender o seu caso.':r.mensagem,encaminhar_humano:false,motivo_aprovacao:'Questão delicada registrada para avaliação humana; nenhuma orientação jurídica enviada.',proximo_passo:'Equipe: revisar a questão delicada registrada; Ana continua apenas acolhimento e coleta.'};
  else if(!humano)result.encaminhar_humano=false;
  // Pedido de pessoa: avisa a equipe e diz quando vem a resposta; a Ana pode seguir conversando.
  if(humano){const dentro=expedienteAna(options.now);const horaSP=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'numeric',hourCycle:'h23'}).format(options.now??new Date()));const quando=dentro&&horaSP<17?'alguém te responde por aqui ainda hoje':`alguém te responde no próximo dia útil (${proximoDiaUtil(options.now)}), a partir das 8h`;result={...result,acao:'enviar',mensagem:r.mensagem.trim()&&/equipe/i.test(r.mensagem)?r.mensagem:`Pode sim! Já avisei a equipe e ${quando}.\nSe quiser, me conta o assunto que já deixo anotado para eles.`,encaminhar_humano:true};}
  result.urgente ||= urgent;
  const perigo=/risco.{0,15}vida|suicid|me matar|violencia|ameaca|perigo/.test(folded);
  const testAgenda=options.teste&&!options.agendaReal&&r.intencao==='agendamento'&&!prohibited&&!humano;
  if(testAgenda)result={...result,acao:'enviar',mensagem:respostaAgendaTeste(texto,options.horarios??[],options.now).mensagem,encaminhar_humano:false,motivo_aprovacao:'',proximo_passo:'Agenda fictícia de teste; nenhuma reserva real.'};
  const sensitive = !prohibited&&!humano&&r.intencao!=='reclamacao'&&(['processo'].includes(r.intencao)||r.intencao==='agendamento'&&!testAgenda&&!options.agendaReal||/documentos? (?:faltantes|pendentes)/i.test(result.mensagem));
  if (sensitive || validarTextoEnvio(result.mensagem) && result.mensagem.trim()) result = {...result, acao:'rascunho',motivo_aprovacao:r.motivo_aprovacao || 'Revisão da equipe obrigatória; agenda real indisponível.'};
  if (mode==='Sugerir' && result.mensagem.trim()) result.acao='rascunho';
  if (mode==='Desligada') result = {...result,acao:'nenhuma',mensagem:''};
  if(!testAgenda)result.mensagem=mensagemBreveAna(result.mensagem,options.ultimaResposta);
  if(perigo&&mode!=='Desligada'&&!result.mensagem.includes('190'))result.mensagem=mensagemBreveAna(`Se houver perigo imediato, ligue 190. ${result.mensagem}`,options.ultimaResposta);
  if(!result.mensagem.trim())result.acao='nenhuma';
  // Nunca exibir CPF completo, inclusive um CPF recém-coletado.
  result.mensagem = result.mensagem.replace(/\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g, cpf=>`••••••••${cpf.replace(/\D/g,'').slice(-3)}`);
  if (result.dados_coletados.cpf && !/^\d{11}$/.test(result.dados_coletados.cpf.replace(/\D/g,''))) result.dados_coletados.cpf='';
  return result;
}