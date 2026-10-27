import {describe,it,expect,vi,beforeEach} from 'vitest';
import {conversas} from '@/lib/mock-data';
const mocks=vi.hoisted(()=>({cancelar:vi.fn(),busy:vi.fn(),send:vi.fn()}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{
 const builder={middleware:()=>builder,inputValidator:()=>builder,handler:(fn:unknown)=>fn};return builder;
}}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
vi.mock('@/lib/atendimento/google-calendar.server',()=>({cancelarGoogleCalendar:mocks.cancelar,ocupadosGoogleCalendar:mocks.busy}));
vi.mock('@/lib/atendimento/envio.functions',()=>({enviarMensagemSistema:mocks.send}));
import {alterarConsultaEquipe} from '@/lib/atendimento/appointment.functions';
const receipt={id:'ana123',inicio:'2026-10-26T12:00:00.000Z',fim:'2026-10-26T12:30:00.000Z'};
function fixture(allowed=true){
 const c=conversas[0];if(!c)throw new Error('Fixture missing');
 let saved={...c,consultaAgendada:receipt.inicio,tipoClienteAgenda:'novo',agenteAna:{reservaCalendar:receipt}};
 const db={from(table:string){
  let patch:typeof saved|undefined;let update=false;let scoped=false;
  const result=()=>{
   if(table==='casos'){if(scoped&&!allowed)return {error:{message:'forbidden'},data:null};if(patch)saved=patch;return {error:null,data:update?[{id:c.id}]:{dados:saved,updated_at:'rev'}};}
   return {error:null,data:table==='profiles'?{nome:'Atendente Teste'}:table==='atendimento_canal_config'?{canal_ativo:'ultramsg'}:{contato_externo:'5511999600306'}};
  };
  const q={select:()=>q,eq:(key:string)=>{if(key==='owner_id')scoped=true;return q;},update:(v:{dados:typeof saved})=>{patch=v.dados;update=true;return q;},single:async()=>result(),maybeSingle:async()=>result(),then:(resolve:(v:ReturnType<typeof result>)=>unknown)=>Promise.resolve(result()).then(resolve)};return q;
 },rpc:vi.fn().mockResolvedValue({error:null})};
 return {db,read:()=>saved,id:c.id};
}
beforeEach(()=>{vi.clearAllMocks();mocks.busy.mockResolvedValue([]);mocks.cancelar.mockResolvedValue(undefined);mocks.send.mockResolvedValue({simulado:false,idExterno:'receipt'});});
async function call(f:ReturnType<typeof fixture>,acao:'cancelar'|'reagendar'){
 const handler=alterarConsultaEquipe as unknown as (args:{data:{casoId:string;eventoId:string;acao:string};context:{supabase:unknown;userId:string}})=>Promise<{avisoEnviado:boolean}>;
 return handler({data:{casoId:f.id,eventoId:receipt.id,acao},context:{supabase:f.db,userId:'owner'}});
}
describe('alteração pelo atendente',()=>{
 it('atendente não altera consulta de outro proprietário',async()=>{const f=fixture(false);await expect(call(f,'cancelar')).rejects.toThrow('indisponível');expect(mocks.cancelar).not.toHaveBeenCalled();});
 it('reagendar cancela a original e oferece horários reais sem criar nova reserva',async()=>{const f=fixture();const result=await call(f,'reagendar');expect(mocks.busy).toHaveBeenCalledOnce();expect(mocks.cancelar).toHaveBeenCalledWith(f.id,receipt,true);expect(f.read().consultaAgendada).toBeUndefined();expect(f.read()).toMatchObject({agenteAna:{agendaReal:true}});expect(mocks.send.mock.calls[0]?.[0].horarios).toHaveLength(3);expect(result.avisoEnviado).toBe(true);});
 it('agenda indisponível preserva original antes de reagendar',async()=>{const f=fixture();mocks.busy.mockResolvedValue(null);await expect(call(f,'reagendar')).rejects.toThrow('preservada');expect(mocks.cancelar).not.toHaveBeenCalled();expect(f.read().consultaAgendada).toBe(receipt.inicio);});
 it('falha do aviso não desfaz cancelamento confirmado',async()=>{const f=fixture();mocks.send.mockRejectedValue(new Error('Falha de rede'));const result=await call(f,'cancelar');expect(result.avisoEnviado).toBe(false);expect(f.read().consultaAgendada).toBeUndefined();expect(f.read()).toHaveProperty('iaRetida');});
});