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
 if(data.service==='projuris')return {connected:false,message:'Falta confirmar a autenticação e o endereço de consulta do ProJuris ADV do escritório.',checkedAt:new Date().toISOString()};
 if(data.service==='ultramsg')return {connected:false,message:'A verificação aguarda confirmação de autenticação segura sem token no endereço da requisição.',checkedAt:new Date().toISOString()};
 const key=data.service==='zapsign'?process.env['ZAPSIGN_API_TOKEN']:process.env['MERCADOPAGO_ACCESS_TOKEN'];
 try{
  const response=await fetch(data.service==='zapsign'?'https://api.zapsign.com.br/api/v1/users/':'https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000),redirect:'error'});
  // Consume nothing from provider data; this checks authorization, not operations readiness.
  await response.body?.cancel();
  return {connected:response.ok,message:response.ok?'Acesso à conta verificado. Envios e operações continuam desativados.':response.status===401||response.status===403?'Credencial recusada pelo serviço.':'Serviço indisponível para verificação.',checkedAt:new Date().toISOString()};
 }catch{return {connected:false,message:'Não foi possível verificar a conexão. Tente novamente.',checkedAt:new Date().toISOString()};}
});