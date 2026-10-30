import { z } from 'zod';
import type { AIMode } from '../atendimento';
import { forbiddenTopics, normalized, chosenSlot, formatarHorarioCliente } from '../atendimento';
import { gerarHorarios } from './schedule-rules';
import type { TipoCliente } from './intake-rules';
import { validarTextoEnvio } from './canal-envio';
import { bloqueiaAgenda, pedidoHumano, escolherHorarioAna, listaHorariosAna, pedidoOutrasOpcoesAna } from './ana-scheduling';

export const anaSchema = z.object({
  acao: z.enum(['enviar', 'rascunho', 'nenhuma']), mensagem: z.string(), motivo_aprovacao: z.string(),
  intencao: z.enum(['duvida_geral','novo_caso','agendamento','processo','consulta_processo','documento','reclamacao','outro']),
  urgente: z.boolean(), encaminhar_humano: z.boolean(),
  dados_coletados: z.object({ nome:z.string(), cpf:z.string(), assunto:z.string(), email:z.string() }),
  proximo_passo: z.string(),
});
export type AnaResult = z.infer<typeof anaSchema>;
export interface AnaState {
  tipoCliente?: TipoCliente | undefined; telefone?: string | undefined;
  apresentado?: boolean; humano?: boolean; urgente?: boolean; motivo?: string; proximoPasso?: string;
  dados?: AnaResult['dados_coletados']; resultado?: AnaResult; erro?: string | undefined; pausa?: boolean;
  horariosTeste?: string[]; consultaTeste?: string | undefined; agendaReal?: boolean;
  horariosApresentados?: string[]; listasHorarios?: number; pedidosOutrasOpcoes?: number;
  confirmacaoCancelamento?: {eventoId:string;inicio:string;contato:string;expira:string} | undefined;
  horarioPendente?: string | undefined; horarioPendenteDesde?: string | undefined;
   reservaCalendar?: import('./calendar-booking').ReservaCalendar | undefined;
  alteracaoConsulta?: import('./appointment-management').AlteracaoConsulta | undefined;
  autorizacaoRemarcacao?: {eventoId:string;inicio:string;contato:string;expira:string} | undefined;
  operacaoConsulta?: {mensagemId:string;eventoId:string;tipo:'cancelar'|'remarcar';desde:string} | undefined;
}
export function horariosTesteAna(now = new Date(), tipo: TipoCliente = 'novo') {
 return gerarHorarios([], now, tipo, 3);
}
export function horariosLivresAna(ocupados: {start:string;end:string}[], now = new Date(), tipo: TipoCliente = 'novo', quantidade = 3) {
 return gerarHorarios(ocupados, now, tipo, quantidade);
}
export function respostaAgendaTeste(texto:string,offered:string[],now=new Date(),real=false,tipo:TipoCliente='novo',repetida=false){
 const selected=escolherHorarioAna(offered,texto)??chosenSlot(offered,texto);
 const slots=real?offered:offered.length?offered:horariosTesteAna(now,tipo);
 if(real&&!slots.length)return {slots,selected:undefined,mensagem:listaHorariosAna([],now,repetida)};
  if(real)return {slots,selected,mensagem:selected?`Vou verificar e reservar ${formatarHorarioCliente(selected)} na agenda.`:listaHorariosAna(slots,now,repetida)};
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
 let question=false;
 const sentences=texto.match(/[^.!?\n]+[.!?]?/g)??[];
 const kept=sentences.map(s=>s.trim()).filter(Boolean).filter(s=>{
  if(!s.endsWith('?'))return true;
  if(question||previous.includes(perguntaKey(s)))return false;
  question=true;return true;
 });
 const result:string[]=[];let length=0;
 for(const s of kept){if(length+s.length>420)break;result.push(s);length+=s.length+1;}
 return result.join('\n').trim();
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
  return !arquivo && ['', 'ok','obrigado','obrigada','recebi','beleza','certo','perfeito','combinado'].includes(normalized(texto));
}
/** A disponibilidade da Ana não depende do expediente da equipe. */
export function priorizarAgendamentoAna(r:AnaResult,texto:string,emAgendamento=false):AnaResult {
  const folded=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(pedidoOutrasOpcoesAna(texto)&&!pedidoHumano(texto))return {...r,intencao:'agendamento',encaminhar_humano:false};
  if(bloqueiaAgenda(texto,r.intencao))return {...r,intencao:pedidoHumano(texto)?'outro':r.intencao==='agendamento'?'duvida_geral':r.intencao};
  const pedido=/\b(?:quero|gostaria|preciso|podemos|vamos)\b.{0,35}\b(?:agendar|marcar|consulta)\b|\b(?:quais|tem|outros?)\b.{0,25}\bhorarios?\b|\b(?:remarcar|cancelar|reagendar)\b/.test(folded);
  const continuidade=emAgendamento&&!!r.dados_coletados.nome.trim();
  return pedido||continuidade?{...r,intencao:'agendamento'}:r;
}
/** Saudação oficial ao cliente novo (decisão da Dra. em 30/10/2026). Texto exato, sem pedir dados. */
export const SAUDACAO_CLIENTE_NOVO = 'Olá!\n\nSeja bem-vindo(a)! 😊\n\nEquipe CS Advocacia\nwww.carolinasantos.com.br\n\nVou te ajudar!\n\nNossa primeira consulta é on-line e gratuita.\n\nComo podemos te ajudar?';

/** Mensagem só de cumprimento ("oi", "boa tarde, tudo bem?"), sem pedido. */
export function apenasCumprimentoAna(texto:string):boolean {
  const t=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
  return t.length>0&&/^(?:(?:ola|oi|oie|opa|alo|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem|e ai|eai|como vai|hello|hey|ei)\s*)+$/.test(t);
}

/** Primeiro contato de cliente novo que só cumprimentou: o servidor envia a saudação oficial exata. */
export function saudacaoClienteNovo(r:AnaResult,texto:string,o:{apresentado:boolean;tipoCliente?:TipoCliente | undefined}):AnaResult {
  if(o.apresentado||o.tipoCliente==='cadastrado'||r.acao!=='enviar'||r.encaminhar_humano||!apenasCumprimentoAna(texto))return r;
  return {...r,mensagem:SAUDACAO_CLIENTE_NOVO,intencao:'duvida_geral'};
}

export function aplicarRegrasAna(r:AnaResult, mode:AIMode, texto:string, proibidos:string[],options:{teste?:boolean;horarios?:string[];ultimaResposta?:string;now?:Date;agendaReal?:boolean;tipoCliente?:TipoCliente | undefined;nome?:string;telefone?:string | undefined;emailPendente?:boolean}={}):AnaResult {
  let result = { ...r, dados_coletados:{...r.dados_coletados} };
  const folded = texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const humano = pedidoHumano(texto)||(r.encaminhar_humano&&r.intencao==='outro'&&!/agendar|marcar|consulta/.test(folded));
  const etico = /honorari|ganhar|chance|vitoria|tenho direito|prescri|recorrer|estrategia|desistir|parte contraria|devo assinar/.test(folded);
  const urgent = /(?:risco.{0,15}vida|suicid|me matar|violencia|ameaca|perigo|citacao|oficial de justica|carta do forum|prazo.{0,25}(?:venc|amanha|hoje)|demitid.{0,30}(?:hoje|ontem|semana)|audiencia.{0,35}(?:hoje|amanha|semana))/.test(folded);
  const prohibited = etico || forbiddenTopics(texto,proibidos).length > 0 || forbiddenTopics(r.mensagem,proibidos).length > 0;
  // Tema delicado pede revisão, não uma tomada humana completa da conversa.
  if(prohibited||r.intencao==='reclamacao')result={...result,acao:'enviar',mensagem:r.intencao==='reclamacao'&&!prohibited?'Sinto muito por isso. Deixei registrado para a equipe olhar com cuidado.':'Entendo. Essa pergunta precisa da avaliação da Dra. Carolina, e deixei registrado para a equipe. Por aqui eu cuido só dos agendamentos: se quiser, marco uma consulta online e gratuita para você conversar com ela.',encaminhar_humano:false,motivo_aprovacao:'Questão delicada registrada para avaliação humana; nenhuma orientação jurídica enviada.',proximo_passo:'Equipe: revisar a questão delicada registrada; Ana continua apenas acolhimento e coleta.'};
  else if(!humano)result.encaminhar_humano=false;
  if(humano){const now=options.now??new Date();const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'numeric',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));const dentro=expedienteAna(now)&&Number(p['hour'])<17;result={...result,acao:'enviar',intencao:'outro',mensagem:`${pedidoHumano(texto)?'Claro! Já passei sua conversa para a equipe.':'Por aqui eu cuido só dos agendamentos, então passei sua conversa para a equipe.'}\n${dentro?'Alguém responsável te responde por aqui ainda hoje.':'Alguém responsável te responde no próximo dia útil, a partir das 8h.'}`,encaminhar_humano:true,motivo_aprovacao:'',proximo_passo:'Equipe assume a conversa; Ana pausada até devolução.'};}
  result.urgente ||= urgent;
  const perigo=/risco.{0,15}vida|suicid|me matar|violencia|ameaca|perigo/.test(folded);
  const testAgenda=options.teste&&r.intencao==='agendamento'&&!prohibited&&!humano&&!bloqueiaAgenda(texto,r.intencao);
  const dadosAgenda = testAgenda && (options.tipoCliente === undefined || !options.nome?.trim()&&!/quais\s+hor[aá]rios|hor[aá]rios\s+(?:livres|dispon[ií]veis)/i.test(texto) || !options.telefone);
  if(testAgenda&&!dadosAgenda){const ag=respostaAgendaTeste(texto,options.horarios??[],options.now,options.agendaReal,options.tipoCliente,/🗓️ (?:Horários livres|Consulta online|Outras opções)/.test(options.ultimaResposta??''));result={...result,acao:'enviar',mensagem:ag.mensagem,encaminhar_humano:false,motivo_aprovacao:'',proximo_passo:options.agendaReal?(ag.selected?'Equipe: confirmar reserva do horário escolhido no Google Calendar.':'Horários livres reais oferecidos pelo Google Calendar.'):'Agenda fictícia de teste; nenhuma reserva real.'};}
  if(dadosAgenda)result={...result,acao:'enviar',mensagem:options.tipoCliente===undefined?'É seu primeiro contato ou você já é cliente do escritório?':!options.nome?.trim()?'Qual é seu nome completo?':'Não consegui identificar o contato da conversa para o agendamento. Deixei a situação registrada para a equipe verificar.',encaminhar_humano:!!options.tipoCliente&&!!options.nome?.trim()&&!options.telefone,motivo_aprovacao:'',proximo_passo:'Coletar carteira, nome e telefone do canal antes de oferecer ou reservar horários.'};
  if(/cpf/i.test(result.mensagem)&&/\?/.test(result.mensagem)){result.mensagem='Para o agendamento não precisamos de CPF. Qual é seu nome completo?';}
  const sensitive = !prohibited&&!humano&&r.intencao!=='reclamacao'&&(['processo'].includes(r.intencao)||r.intencao==='agendamento'&&!testAgenda||/documentos? (?:faltantes|pendentes)/i.test(result.mensagem));
  if (sensitive || validarTextoEnvio(result.mensagem) && result.mensagem.trim()) result = {...result, acao:'rascunho',motivo_aprovacao:r.motivo_aprovacao || 'Revisão da equipe obrigatória; agenda real indisponível.'};
  if(options.emailPendente&&!humano&&!prohibited&&!urgent&&['documento','outro','duvida_geral'].includes(r.intencao)&&!perguntaKey(options.ultimaResposta??'').includes('email'))result={...result,acao:'enviar',mensagem:'Para completar seu cadastro, qual é o seu e-mail? Pode escrevê-lo aqui, sem anexar documento.',motivo_aprovacao:'',intencao:'documento',proximo_passo:'Aguardar e-mail do cliente para cadastro e checklist.'};
  if (mode==='Sugerir' && result.mensagem.trim()) result.acao='rascunho';
  if (mode==='Desligada') result = {...result,acao:'nenhuma',mensagem:''};
  if(!testAgenda&&!humano)result.mensagem=mensagemBreveAna(result.mensagem,options.ultimaResposta);
  if(perigo&&mode!=='Desligada'&&!result.mensagem.includes('190'))result.mensagem=mensagemBreveAna(`Se houver perigo imediato, ligue 190. ${result.mensagem}`,options.ultimaResposta);
  if(!result.mensagem.trim())result.acao='nenhuma';
  // Nunca exibir CPF completo, inclusive um CPF recém-coletado.
  result.mensagem = result.mensagem.replace(/📅/g,'🗓️').replace(/\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g, cpf=>`••••••••${cpf.replace(/\D/g,'').slice(-3)}`);
  result.dados_coletados.cpf = '';
  if (result.dados_coletados.cpf && !/^\d{11}$/.test(result.dados_coletados.cpf.replace(/\D/g,''))) result.dados_coletados.cpf='';
  return result;
}