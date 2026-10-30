import { describe, it, expect } from 'vitest';
import { classificarEntrada, detectarOrigem, etiquetaConversa, identificarTipoCliente, telefoneAgenda, telefoneCanalAgenda } from '@/lib/atendimento/intake-rules';
import { gerarHorarios, horarioPermitido, DURACAO_REUNIAO } from '@/lib/atendimento/schedule-rules';
import { aplicarRegrasAna, type AnaResult } from '@/lib/atendimento/ana-rules';
import { escolherReservaAna } from '@/lib/atendimento/calendar-booking';
import { conversas } from '@/lib/mock-data';
const base=conversas[0];
if(!base)throw new Error('Fixture missing');
const ac='Olá Dra. Carolina, gostaria de agendar uma consulta gratuita.';
const rt='Olá Dra. Carolina! Gostaria de mais informações.';
describe('origem da landing page',()=>{
 it('AC identifica exclusivamente a mensagem cível fornecida',()=>{expect(detectarOrigem(ac)).toBe('AC');expect(detectarOrigem('Gostaria de mais informações sobre meu caso')).toBeUndefined();});
 it('RT identifica a mensagem trabalhista fornecida',()=>expect(detectarOrigem(rt)).toBe('RT'));
 it('classifica a entrada e mantém ajuste manual inclusive sem etiqueta',()=>{const c={...base,etiquetaAcao:undefined,mensagens:[{id:'1',de:'cliente' as const,texto:ac,hora:''}]};expect(classificarEntrada(c).etiquetaAcao).toBe('AC');expect(etiquetaConversa({...c,etiquetaAcao:'RT'})).toBe('RT');expect(etiquetaConversa({...c,etiquetaAcao:'sem'})).toBe('sem');});
 it('não herda a origem de mensagens fictícias do caso Telegram',()=>expect(etiquetaConversa({...base,mensagens:[{id:'1',de:'cliente',texto:ac,hora:''},{id:'2',de:'cliente',texto:'Olá',hora:'',canal:'telegram'}]})).toBe('sem'));
 it('autodeclaração diferencia carteiras sem usar cadastro fictício',()=>{expect(identificarTipoCliente('Já sou cliente do escritório')).toBe('cadastrado');expect(identificarTipoCliente('Não sou cliente')).toBe('novo');expect(identificarTipoCliente(ac)).toBe('novo');expect(identificarTipoCliente('Olá')).toBeUndefined();});
 it('telefone não é inferido do chat_id nem de horário escolhido',()=>{expect(telefoneAgenda('839854097')).toBeUndefined();expect(telefoneAgenda('23/10 às 14h')).toBeUndefined();expect(telefoneAgenda('(11) 98765-4321')).toBe('11987654321');});
 it('agenda usa o telefone fornecido pelo remetente WhatsApp sem coleta na mensagem',()=>expect(telefoneCanalAgenda('5511999600306','ultramsg:5511999600306:mensagem-1')).toBe('5511999600306'));
 it('telefone de outro contato ou canal nunca identifica o remetente desta consulta',()=>{expect(telefoneCanalAgenda('5511999600306','ultramsg:5511987654321:mensagem-1')).toBeUndefined();expect(telefoneCanalAgenda('5511999600306','telegram:5511999600306:mensagem-1')).toBeUndefined();});
});
describe('agenda por carteira',()=>{
 it('todas as reuniões duram 30 min',()=>expect(DURACAO_REUNIAO).toBe(30));
 it('novos só segunda a quinta e dentro de 09:00–17:30',()=>{for(const date of ['2026-10-26','2026-10-27','2026-10-28','2026-10-29'])expect(horarioPermitido(`${date}T17:00:00-03:00`,'novo')).toBe(true);for(const date of ['2026-10-23','2026-10-24','2026-10-25'])expect(horarioPermitido(`${date}T14:00:00-03:00`,'novo')).toBe(false);expect(horarioPermitido('2026-10-26T08:30:00-03:00','novo')).toBe(false);expect(horarioPermitido('2026-10-26T17:30:00-03:00','novo')).toBe(false);});
 it('cadastrados sexta 13:30–17:30, último início 17:00',()=>{expect(horarioPermitido('2026-10-23T13:30:00-03:00','cadastrado')).toBe(true);expect(horarioPermitido('2026-10-23T17:00:00-03:00','cadastrado')).toBe(true);for(const time of ['13:00','17:30','18:00','14:20'])expect(horarioPermitido(`2026-10-23T${time}:00-03:00`,'cadastrado')).toBe(false);for(const date of ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-24','2026-10-25'])expect(horarioPermitido(`${date}T14:00:00-03:00`,'cadastrado')).toBe(false);});
 it('feriados nacionais e bloqueios extras não podem ser oferecidos nem reservados',()=>{expect(horarioPermitido('2026-11-02T09:00:00-03:00','novo')).toBe(false);expect(horarioPermitido('2027-01-01T14:00:00-03:00','cadastrado')).toBe(false);expect(horarioPermitido('2026-10-26T09:00:00-03:00','novo',['2026-10-26'])).toBe(false);expect(gerarHorarios([],new Date('2026-10-30T21:00:00Z'),'novo')[0]).toBe('2026-11-03T12:00:00.000Z');});
 it('candidatos livres usam intervalos de 30 min e excluem ocupado',()=>{const slots=gerarHorarios([{start:'2026-10-23T16:30:00Z',end:'2026-10-23T17:00:00Z'}],new Date('2026-10-22T20:00:00Z'),'cadastrado');expect(slots).toEqual(['2026-10-23T17:00:00.000Z','2026-10-23T17:30:00.000Z','2026-10-23T18:00:00.000Z']);});
 it('oferta antiga fora da carteira não permite reserva',()=>expect(escolherReservaAna({texto:'23/10 às 9h',horarios:['2026-10-23T12:00:00Z'],real:true,teste:true,modo:'Automática',bloqueado:false,tipoCliente:'cadastrado',now:new Date('2026-10-22')})).toBeUndefined());
});
describe('coleta antes de agendar',()=>{
 const r:AnaResult={acao:'enviar',mensagem:'Informe seu CPF?',motivo_aprovacao:'',intencao:'agendamento',urgente:false,encaminhar_humano:false,dados_coletados:{nome:'',cpf:'12345678901',assunto:'',email:''},proximo_passo:''};
 it('não coleta CPF no agendamento e não oferece sem carteira nome telefone',()=>{const result=aplicarRegrasAna(r,'Automática','Quero marcar',[],{teste:true});expect(result.dados_coletados.cpf).toBe('');expect(result.proximo_passo).toContain('Coletar carteira, nome e telefone');});
 it('sem telefone ainda não oferece horários',()=>expect(aplicarRegrasAna(r,'Automática','Quero marcar',[],{teste:true,tipoCliente:'novo',nome:'Maria'}).proximo_passo).toContain('Coletar carteira'));
});