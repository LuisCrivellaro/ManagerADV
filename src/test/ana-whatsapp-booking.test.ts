import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { processarAna } from '@/lib/atendimento/ana.server';
import { conversas } from '@/lib/mock-data';
import { defaultState } from '@/lib/office';
import type { Conversa } from '@/lib/mock-data';

const mocks = vi.hoisted(() => ({ gerar: vi.fn(), reservar: vi.fn(), enviar: vi.fn(), remarcar: vi.fn(), cancelar: vi.fn(), ocupados:vi.fn() }));
vi.mock('@/lib/atendimento/ana.functions', () => ({ gerarRespostaAna: mocks.gerar }));
vi.mock('@/lib/atendimento/google-calendar.server', () => ({ reservarGoogleCalendar: mocks.reservar, remarcarGoogleCalendar:mocks.remarcar,cancelarGoogleCalendar:mocks.cancelar,ocupadosGoogleCalendar:mocks.ocupados }));
vi.mock('@/lib/atendimento/envio.functions', () => ({ enviarMensagemSistema: mocks.enviar }));

describe('reserva WhatsApp com telefone do canal', () => {
  it.each(['ultramsg','telegram'] as const)('fluxos com canal %s e UltraMsg pausado no teste Telegram', async (canal) => {
  for (const cenario of ['reservar','perguntar','cancelar','remarcar','ofertar','inicio','nome','recusa','humano','especifico','aceite','tarde','numero'] as const) {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T04:06:00Z'));
    try {
      const fixture = conversas[0];
      if (!fixture) throw new Error('Fixture missing');
      const telefone = '5511999600306';
      const inicio = '2026-10-26T12:00:00.000Z';
      const externo = canal === 'telegram' ? '839854097' : telefone;
      const messageId = `${canal}:${externo}:escolha-1`;
      const anterior={id:'anavelho',inicio:'2026-10-27T12:00:00.000Z',fim:'2026-10-27T12:30:00.000Z'};
      const texto=cenario==='inicio'?'Olá':cenario==='nome'?'Maria Silva Souza':cenario==='recusa'?'Mas eu não quero agendar.':cenario==='humano'?'Poderia me passar para eu falar com alguém por favor':cenario==='especifico'?'tem segunda às 16h?':cenario==='aceite'?'sim':cenario==='tarde'?'e à tarde?':cenario==='numero'?'1':cenario==='cancelar'?'Quero cancelar minha consulta':cenario==='perguntar'?'Quero agendar uma consulta':cenario==='ofertar'?'Quero agendar uma consulta':'26/10 às 9h';
      let saved:Conversa = {
        ...fixture, consultaAgendada: undefined, modoIA: 'Automática', tipoClienteAgenda: 'novo',
        agenteAna: { apresentado: true, agendaReal: true, horariosTeste: [inicio], dados: { nome: 'Maria Teste', cpf: '', assunto: 'Consulta', email: '' } },
        ...(['perguntar','cancelar','remarcar'].includes(cenario)?{consultaAgendada:anterior.inicio,agenteAna:{apresentado:true,agendaReal:true,horariosTeste:[inicio],dados:{nome:'Maria Teste',cpf:'',assunto:'Consulta',email:''},reservaCalendar:anterior,...(cenario==='remarcar'?{alteracaoConsulta:'remarcar' as const,autorizacaoRemarcacao:{eventoId:anterior.id,inicio:anterior.inicio,contato:telefone,expira:'2026-10-23T05:06:00Z'}}:{})}}:{}),
        ...(['inicio','nome'].includes(cenario)?{etapa:'inicial' as const,agenteAna:{apresentado:cenario==='nome',dados:{nome:'',cpf:'',assunto:'',email:''}}}:{}),
        mensagens: [{ id: messageId, de: 'cliente', canal, texto, hora: '01:06' }],
      };
      if(cenario==='inicio'||cenario==='nome')delete saved.tipoClienteAgenda;
      if(cenario==='aceite')saved.agenteAna={...saved.agenteAna,horarioPendente:inicio,horarioPendenteDesde:'2026-10-23T04:00:00Z'};
      if(cenario==='tarde')saved.mensagens.unshift({id:'lista',de:'escritorio',canal,texto:'🗓️ Horários livres:',hora:'01:00'});
      const config = { agente_ativo: true, canal_ativo: canal, modo_teste: true };
      const contato = { contato_externo: externo, telefone_ficticio: telefone, status: 'liberado' };
      const db = {
        from(table: string) {
          let patch: { dados: typeof saved } | undefined;
          let updating = false;
          const result = () => {
            if (table === 'casos') {
              if (patch) saved = patch.dados;
              return { error: null, data: updating ? [{ id: 'caso-teste' }] : { owner_id: 'owner-teste', dados: saved, updated_at: 'revision' } };
            }
            return { error: null, data: table === 'checklist_itens' ? [] : table === 'office_workspace' ? { dados: defaultState } : table === 'atendimento_canal_config' ? config : contato };
          };
          const query = {
            select: () => query, eq: () => query,
            update: (value: { dados: typeof saved }) => { patch = value; updating = true; return query; },
            single: async () => result(), maybeSingle: async () => result(),
            then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
          };
          return query;
        },
        rpc: async () => ({ error: null }),
      };
      mocks.gerar.mockResolvedValue({ acao: 'enviar', mensagem: 'Sua solicitação ficou registrada como prioridade para a equipe, que retorna no próximo dia útil a partir das 8h.', motivo_aprovacao: '', intencao: 'outro', urgente: false, encaminhar_humano: true, dados_coletados: { nome: '', cpf: '', assunto: '', email: '' }, proximo_passo: '' });
      if(cenario==='nome')mocks.gerar.mockResolvedValue({acao:'enviar',mensagem:'Vou consultar os horários.',motivo_aprovacao:'',intencao:'agendamento',urgente:false,encaminhar_humano:false,dados_coletados:{nome:'Maria Silva Souza',cpf:'',assunto:'',email:''},proximo_passo:''});
      if(cenario==='inicio')mocks.gerar.mockResolvedValue({acao:'enviar',mensagem:'Olá! Sou a Ana, assistente virtual da CS Lawyers | Advocacia.\nComo posso te ajudar hoje?',motivo_aprovacao:'',intencao:'duvida_geral',urgente:false,encaminhar_humano:false,dados_coletados:{nome:'',cpf:'',assunto:'',email:''},proximo_passo:''});
      if(['especifico','aceite','tarde','numero'].includes(cenario))mocks.gerar.mockResolvedValue({acao:'enviar',mensagem:'Vou verificar.',motivo_aprovacao:'',intencao:'agendamento',urgente:false,encaminhar_humano:false,dados_coletados:{nome:'',cpf:'',assunto:'',email:''},proximo_passo:''});
      if(cenario==='recusa')mocks.gerar.mockResolvedValue({acao:'enviar',mensagem:'Sem problema! Como posso ajudar?',motivo_aprovacao:'',intencao:'duvida_geral',urgente:false,encaminhar_humano:false,dados_coletados:{nome:'',cpf:'',assunto:'',email:''},proximo_passo:''});
      mocks.reservar.mockResolvedValue({ id: 'evento-teste', inicio });
      mocks.remarcar.mockResolvedValue({id:'evento-teste',inicio});
      mocks.cancelar.mockResolvedValue(undefined);
      mocks.ocupados.mockResolvedValue([{start:inicio,end:'2026-10-26T12:30:00.000Z'}]);
      mocks.enviar.mockResolvedValue({ simulado: false, idExterno: 'envio-teste' });
      await processarAna(db as unknown as SupabaseClient<Database>, 'caso-teste', messageId, new Request('http://localhost:8080'));
      expect(mocks.gerar.mock.calls[0]?.[1].telefone_informado).toBe('5511999600306');
      if(cenario==='reservar') {expect(mocks.reservar).toHaveBeenCalledWith('caso-teste', inicio, expect.any(Date), { nome: 'Maria Teste', telefone: '5511999600306', tipo: 'novo' });expect(saved.consultaAgendada).toBe(inicio);}
      if(cenario==='perguntar'){expect(mocks.reservar).not.toHaveBeenCalled();expect(mocks.cancelar).not.toHaveBeenCalled();expect(saved.consultaAgendada).toBe(anterior.inicio);}
      if(cenario==='cancelar'){expect(mocks.cancelar).not.toHaveBeenCalled();expect(saved.consultaAgendada).toBe(anterior.inicio);expect(saved.agenteAna?.confirmacaoCancelamento?.eventoId).toBe(anterior.id);}
      if(cenario==='remarcar'){expect(mocks.remarcar).toHaveBeenCalledWith('caso-teste',anterior,inicio,true,expect.any(Date),{nome:'Maria Teste',telefone,tipo:'novo'});expect(saved.consultaAgendada).toBe(inicio);}
      if(cenario==='ofertar'||cenario==='nome'){expect(mocks.ocupados).toHaveBeenCalledOnce();expect(saved.agenteAna?.horariosTeste).not.toContain(inicio);expect(saved.agenteAna?.horariosTeste).toHaveLength(3);expect(mocks.reservar).not.toHaveBeenCalled();}
      if(cenario==='nome'){expect(saved.agenteAna?.dados?.nome).toBe('Maria Silva Souza');expect(saved.agenteAna?.agendaReal).toBe(true);expect(saved.agenteAna?.tipoCliente).toBe('novo');}
      if(cenario==='inicio'){expect(saved.agenteAna?.apresentado).toBe(true);expect(saved.agenteAna?.resultado?.intencao).toBe('duvida_geral');expect(saved.agenteAna?.dados?.nome).toBe('');expect(mocks.ocupados).not.toHaveBeenCalled();expect(mocks.reservar).not.toHaveBeenCalled();}
      if(cenario==='recusa'||cenario==='humano'){expect(mocks.ocupados).not.toHaveBeenCalled();expect(mocks.reservar).not.toHaveBeenCalled();expect(saved.agenteAna?.resultado?.intencao).not.toBe('agendamento');}
      if(cenario==='especifico'){expect(mocks.ocupados).toHaveBeenCalledOnce();expect(saved.agenteAna?.horarioPendente).toBe('2026-10-26T19:00:00.000Z');expect(mocks.reservar).not.toHaveBeenCalled();}
      if(cenario==='aceite'||cenario==='numero'){expect(mocks.reservar).toHaveBeenCalledOnce();expect(saved.consultaAgendada).toBe(inicio);}
      if(cenario==='tarde'){expect(mocks.ocupados).toHaveBeenCalledOnce();expect(saved.agenteAna?.horariosTeste?.every(s=>new Date(s).getUTCHours()>=16)).toBe(true);}
      expect(saved.agenteAna).toMatchObject({ humano: cenario==='humano' });
      expect(mocks.enviar).toHaveBeenCalledOnce();
      expect(saved.mensagens.at(-1)?.de).toBe('escritorio');
      expect(saved.mensagens.at(-1)?.canal).toBe(canal);
    } finally {
      vi.useRealTimers();
    }
  }
  });
});