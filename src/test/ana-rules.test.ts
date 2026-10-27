import { describe,it,expect } from 'vitest';
import { priorizarAgendamentoAna } from '@/lib/atendimento/ana-rules';
import { aplicarRegrasAna, expedienteAna, mensagemSemResposta, aceitarRespostaAna, mensagemBreveAna, respostaAgendaTeste, horariosTesteAna, type AnaResult } from '@/lib/atendimento/ana-rules';
const response:AnaResult={acao:'enviar',mensagem:'Sou Ana, assistente virtual. Como posso ajudar?',motivo_aprovacao:'',intencao:'duvida_geral',urgente:false,encaminhar_humano:false,dados_coletados:{nome:'',cpf:'',assunto:'',email:''},proximo_passo:''};
describe('limites Ana',()=>{
 it('nova mensagem descarta a geração anterior',()=>{expect(aceitarRespostaAna('1','2',undefined)).toBe(false);expect(aceitarRespostaAna('2','2',undefined)).toBe(true);});
 it('tomada humana não pode ser revertida por geração em andamento',()=>expect(aceitarRespostaAna('1','1',{humano:true})).toBe(false));
 it('pausa bloqueia geração em andamento',()=>expect(aceitarRespostaAna('1','1',{pausa:true})).toBe(false));
 it('Desligada não produz mensagem ao cliente',()=>expect(aplicarRegrasAna(response,'Desligada','Olá',[]).mensagem).toBe(''));
 it('Sugerir sempre retém a resposta para a equipe',()=>expect(aplicarRegrasAna(response,'Sugerir','Olá',[]).acao).toBe('rascunho'));
 it('Automática libera dúvida geral',()=>expect(aplicarRegrasAna(response,'Automática','Qual o expediente?',[]).acao).toBe('enviar'));
 it('processo sempre vira rascunho',()=>expect(aplicarRegrasAna({...response,intencao:'processo'},'Automática','Como está meu processo?',[]).acao).toBe('rascunho'));
 it('agenda sem ferramenta de reserva nunca é confirmada automaticamente',()=>expect(aplicarRegrasAna({...response,intencao:'agendamento'},'Automática','Marque amanhã',[]).acao).toBe('rascunho'));
 it('tema delicado mantém acolhimento sem parecer jurídico ou parar a Ana',()=>{const r=aplicarRegrasAna({...response,mensagem:'Vai ganhar R$ 50.000.',encaminhar_humano:true},'Automática','Quanto vou ganhar?',[]);expect(r.acao).toBe('enviar');expect(r.encaminhar_humano).toBe(false);expect(r.mensagem).not.toContain('50.000');});
 it('não repete pergunta de nome seguida com palavras diferentes',()=>expect(mensagemBreveAna('Entendi. Pode me dizer seu nome completo?','Qual é seu nome?')).toBe('Entendi.'));
 it('mantém uma pergunta e mensagem breve',()=>{const r=mensagemBreveAna('Qual seu nome? Qual seu CPF? '+ 'Frase longa. '.repeat(100));expect((r.match(/\?/g)??[])).toHaveLength(1);expect(r.length).toBeLessThanOrEqual(420);});
 it('agenda fictícia só sai automaticamente em teste autorizado',()=>{const r={...response,intencao:'agendamento' as const};expect(aplicarRegrasAna(r,'Automática','Quero agendar',[],{teste:true,tipoCliente:'novo',nome:'Maria',telefone:'11987654321'}).acao).toBe('enviar');expect(aplicarRegrasAna(r,'Automática','Quero agendar',[],{teste:false}).acao).toBe('rascunho');});
 it('confirma horário de teste sem declarar reserva real',()=>{const slots=['2026-10-22T12:00:00Z','2026-10-23T12:00:00Z'];const r=respostaAgendaTeste('22/10 às 9h',slots);expect(r.selected).toBe(slots[0]);expect(r.mensagem).toContain('não há reserva real');});
 it('agenda de teste respeita Brasília independentemente do servidor',()=>expect(horariosTesteAna(new Date('2026-10-23T20:00:00Z'))).toEqual(['2026-10-26T12:00:00.000Z','2026-10-26T12:30:00.000Z','2026-10-26T13:00:00.000Z']));
 it('pedido humano encaminha sem insistir',()=>expect(aplicarRegrasAna(response,'Automática','Quero falar com uma pessoa',[]).encaminhar_humano).toBe(true));
 it('citação e risco pessoal são urgentes',()=>{expect(aplicarRegrasAna(response,'Automática','Chegou um oficial de justiça',[]).urgente).toBe(true);expect(aplicarRegrasAna(response,'Automática','Estou em perigo',[]).urgente).toBe(true);});
 it('perigo imediato informa o 190 mesmo se omitido pela IA',()=>expect(aplicarRegrasAna(response,'Automática','Estou em perigo',[]).mensagem).toContain('ligue 190'));
 it('CPF completo nunca aparece',()=>expect(aplicarRegrasAna({...response,mensagem:'CPF 123.456.789-01'},'Automática','Olá',[]).mensagem).toBe('CPF ••••••••901'));
 it('CPF de menos de 11 dígitos não é aceito',()=>expect(aplicarRegrasAna({...response,dados_coletados:{...response.dados_coletados,cpf:'123'}},'Automática','123',[]).dados_coletados.cpf).toBe(''));
 it('não responde ok nem obrigado',()=>{expect(mensagemSemResposta('ok')).toBe(true);expect(mensagemSemResposta('obrigado')).toBe(true);expect(mensagemSemResposta('ok',true)).toBe(false);});
 it('expediente é 8 às 18 em Brasília segunda a sexta',()=>{expect(expedienteAna(new Date('2026-10-21T11:00:00Z'))).toBe(true);expect(expedienteAna(new Date('2026-10-21T21:00:00Z'))).toBe(false);expect(expedienteAna(new Date('2026-10-24T14:00:00Z'))).toBe(false);expect(expedienteAna(new Date('2026-10-21T10:59:00Z'))).toBe(false);});
});import { horariosLivresAna } from '@/lib/atendimento/ana-rules';
describe('agenda real',()=>{
 it('pedido de consulta fora do expediente não depende da classificação de retorno humano da IA',()=>{
  const now=new Date('2026-10-23T04:12:00Z');
  expect(expedienteAna(now)).toBe(false);
  const raw={...response,intencao:'outro' as const,encaminhar_humano:true};
  const result=aplicarRegrasAna(priorizarAgendamentoAna(raw,'Quero agendar uma consulta'),'Automática','Quero agendar uma consulta',[],{now,teste:true,agendaReal:true,horarios:['2026-10-26T12:00:00.000Z'],tipoCliente:'novo',nome:'Maria',telefone:'5511999600306'});
  expect(result.intencao).toBe('agendamento');
  expect(result.acao).toBe('enviar');
  expect(result.encaminhar_humano).toBe(false);
  expect(result.motivo_aprovacao).toBe('');
 });
 it('novo caso não impõe agendamento sem interesse',()=>expect(priorizarAgendamentoAna({...response,intencao:'novo_caso'},'Fui demitido').intencao).toBe('novo_caso'));
 it('resposta de identificação continua agendamento em andamento',()=>expect(priorizarAgendamentoAna({...response,dados_coletados:{...response.dados_coletados,nome:'Maria Santos'}},'Maria Santos',true).intencao).toBe('agendamento'));
 it('consulta não ignora pedido explícito de pessoa',()=>{
  const texto='Quero agendar consulta e falar com uma pessoa';
  expect(aplicarRegrasAna(priorizarAgendamentoAna(response,texto),'Automática',texto,[],{teste:true}).encaminhar_humano).toBe(true);
 });
 it('processo não vira agendamento por continuidade',()=>expect(priorizarAgendamentoAna({...response,intencao:'processo'},'Como está meu processo?',true).intencao).toBe('processo'));
 it('pula horário ocupado no Google Calendar',()=>{const s=horariosLivresAna([{start:'2026-10-26T12:00:00Z',end:'2026-10-26T13:00:00Z'}],new Date('2026-10-23T20:00:00Z'));expect(s[0]).toBe('2026-10-26T13:00:00.000Z');expect(s).not.toContain('2026-10-26T12:00:00.000Z');});
 it('oferta real ainda não é confirmação de reserva',()=>{const r=respostaAgendaTeste('26/10 às 10h30',['2026-10-26T13:30:00.000Z'],new Date(),true);expect(r.selected).toBe('2026-10-26T13:30:00.000Z');});
});
