import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { connectionCatalog, connectionReadiness } from './integration-status';
import { z } from 'zod';
export const readConnectionStatus=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const roles=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
 if(roles.error)throw new Error('Não foi possível conferir o acesso.');
 const configured:Record<string,boolean>={};for(const c of connectionCatalog)for(const r of c.requirements)configured[r.key]=Boolean(process.env[r.key]?.trim());
 return {services:connectionReadiness(configured),canConnect:roles.data.some(r=>r.role==='admin'||r.role==='advogada_senior')};
});
export const checkConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({service:z.enum(['projuris','zapsign','mercadopago','ultramsg'])})).handler(async({context,data})=>{
 const roles=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
 if(roles.error||!roles.data.some(r=>r.role==='admin'||r.role==='advogada_senior'))throw new Error('Conexão reservada à sênior ou administração.');
 const service=connectionCatalog.find(c=>c.id===data.service);if(!service)throw new Error('Serviço indisponível.');
 const missing=service.requirements.filter(r=>!process.env[r.key]?.trim()).map(r=>r.label);
 if(missing.length)return {connected:false,message:`Credenciais não salvas: ${missing.join(', ')}.`,checkedAt:new Date().toISOString()};
 if(data.service==='projuris'){
  // Só autenticação (client_credentials): nenhum dado do ProJuris é consultado nesta verificação.
  const { projuris, ErroProjuris } = await import('./projuris/cliente.server');
  try{await projuris.verificarAutenticacao();return {connected:true,message:'Autenticação no ProJuris verificada. Nenhum dado foi consultado.',checkedAt:new Date().toISOString()};}
  catch(e){const tipo=e instanceof ErroProjuris?e.tipo:undefined;return {connected:false,message:tipo==='autenticacao'?'Credencial recusada pelo ProJuris.':tipo==='configuracao'?'Credenciais não salvas.':'Não foi possível verificar a conexão com o ProJuris. Tente novamente.',checkedAt:new Date().toISOString()};}
 }
 if(data.service==='ultramsg')return {connected:false,message:'A verificação aguarda confirmação de autenticação segura sem token no endereço da requisição.',checkedAt:new Date().toISOString()};
 const key=data.service==='zapsign'?process.env['ZAPSIGN_API_TOKEN']:process.env['MERCADOPAGO_ACCESS_TOKEN'];
 try{
  const response=await fetch(data.service==='zapsign'?'https://api.zapsign.com.br/api/v1/users/':'https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000),redirect:'error'});
  // Consume nothing from provider data; this checks authorization, not operations readiness.
  await response.body?.cancel();
  return {connected:response.ok,message:response.ok?'Acesso à conta verificado. Envios e operações continuam desativados.':response.status===401||response.status===403?'Credencial recusada pelo serviço.':'Serviço indisponível para verificação.',checkedAt:new Date().toISOString()};
 }catch{return {connected:false,message:'Não foi possível verificar a conexão. Tente novamente.',checkedAt:new Date().toISOString()};}
});
/** Teste de leitura do ProJuris (sênior/admin): token, 1 registro de pessoa.consulta e situação "Ativo". Devolve só nomes de campos; nada é gravado ou registrado. */
export const testProjurisRead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const roles=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
 if(roles.error||!roles.data.some(r=>r.role==='admin'||r.role==='advogada_senior'))throw new Error('Teste reservado à sênior ou administração.');
 const { projuris, ErroProjuris } = await import('./projuris/cliente.server');
 const { criarConsultasProjuris } = await import('./projuris/consultas.server');
 const falha=(e:unknown)=>e instanceof ErroProjuris?{tipo:e.tipo,status:e.status??null}:{tipo:'resposta',status:null};
 const out:{autenticacao:boolean;consulta:boolean;total:number|null;ativoEncontrado:boolean|null;campos:string[];erros:{etapa:string;tipo:string;status:number|null}[]}={autenticacao:false,consulta:false,total:null,ativoEncontrado:null,campos:[],erros:[]};
 try{await projuris.verificarAutenticacao();out.autenticacao=true;}catch(e){out.erros.push({etapa:'autenticacao',...falha(e)});return out;}
 try{
  const raw=await projuris.chamar<unknown>('pessoa.consulta',{consulta:{'quan-registros':1}});
  out.consulta=true;
  const nomes=new Set<string>();
  const visitar=(v:unknown,prefixo:string,prof:number)=>{if(prof>4||v===null||typeof v!=='object')return;if(Array.isArray(v)){if(v.length)visitar(v[0],prefixo+'[]',prof+1);return;}for(const [k,x] of Object.entries(v as Record<string,unknown>)){const n=prefixo?`${prefixo}.${k}`:k;nomes.add(n);visitar(x,n,prof+1);}};
  visitar(raw,'',0);out.campos=[...nomes].sort();
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){const t=(raw as Record<string,unknown>)['totalRegistros']??(raw as Record<string,unknown>)['total'];if(typeof t==='number')out.total=t;}
  if(out.total===null&&Array.isArray(raw))out.total=raw.length;
 }catch(e){out.erros.push({etapa:'pessoa.consulta',...falha(e)});}
 try{await criarConsultasProjuris().codigoSituacaoAtivo();out.ativoEncontrado=true;}catch(e){out.ativoEncontrado=false;out.erros.push({etapa:'situacao_ativo',...falha(e)});}
 return out;
});
