import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { canViewOffice } from '@/lib/approval-rules';
import { reviewReady, revisionHash, REVIEW_CATEGORIES, type OfficeState } from '@/lib/office';
export const officeDashboard = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const roles=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
 if(roles.error)throw new Error('Não foi possível conferir o acesso ao painel.');
 const entireOffice=canViewOffice((roles.data??[]).map(r=>r.role));
 const client=entireOffice?(await import('@/integrations/supabase/client.server')).supabaseAdmin:context.supabase;
 const [cases,workspaces,profiles,checklist]=await Promise.all([
  client.from('casos').select('id,owner_id,nome,etapa,dados,updated_at').order('updated_at',{ascending:false}),
  client.from('office_workspace').select('owner_id,dados,updated_at'),
  client.from('profiles').select('id,nome'),
  client.from('checklist_itens').select('caso_id,nome,recebido')
 ]);
  if(cases.error||workspaces.error||profiles.error||checklist.error)throw new Error('Não foi possível atualizar o painel.');
  const statuses=await Promise.all((cases.data??[]).map(c=>client.rpc('material_status',{p_case:c.id})));
  return {entireOffice,updatedAt:new Date().toISOString(),cases:(cases.data??[]).map((c,i)=>{
   const ws=workspaces.data?.find(w=>w.owner_id===c.owner_id);const work=(ws?.dados as unknown as OfficeState)?.casos?.[c.id]??{};
   const data=c.dados as unknown as import('./mock-data').Conversa;
   const status=statuses[i]?.data as {checklist?:boolean}|null;
   return {mensagens:data.mensagens??[],movements:work.movements??[],consultaAgendada:data.consultaAgendada,retornoAgendado:data.retornoAgendado,id:c.id,nome:c.nome,responsavel:profiles.data?.find(p=>p.id===c.owner_id)?.nome||'Equipe',mine:c.owner_id===context.userId,etapa:c.etapa,pipeline:data.etapaPipeline??0,fase:work.fase??'',area:work.area??'',atendimento:data.atendimento??'',checklistApproved:Boolean(status?.checklist),pendencias:[...(work.pendencias??[]),...(checklist.data??[]).filter(i=>i.caso_id===c.id&&!i.recebido).map(i=>`Documento: ${i.nome}`)],prazos:(work.movements??[]).filter(m=>!m.concluido&&m.prazo).map(m=>({data:m.prazo??'',texto:m.texto,fatal:m.fatal??false})),updatedAt:ws&&ws.updated_at>c.updated_at?ws.updated_at:c.updated_at};
  })};
});
export const runLegalAI=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({casoId:z.string().uuid(),kind:z.enum(['petition','audit','training']),question:z.string().max(8000).optional()})).handler(async({data,context})=>{
 const [workspace,caso]=await Promise.all([context.supabase.from('office_workspace').select('dados').eq('owner_id',context.userId).maybeSingle(),context.supabase.from('casos').select('nome,dados').eq('id',data.casoId).single()]);
 if(workspace.error||caso.error)throw new Error('Caso indisponível.');
 const state=workspace.data?.dados as unknown as OfficeState;const c=state?.casos?.[data.casoId]??{};
 if(data.kind==='petition'||data.kind==='audit'){const gate=await context.supabase.rpc('material_status',{p_case:data.casoId});const status=gate.data as {checklist?:boolean;draft?:boolean}|null;if(gate.error||!status?.checklist||(data.kind==='audit'&&!status.draft))throw new Error('Avanço bloqueado: aprovação jurídica pendente.');}
 const media: {nome:string;mime:string;bytes:Uint8Array}[]=[];const limitations:string[]=[];let total=0;
 if(data.kind!=='training')for(const f of c.arquivos??[]){
  if(!f.path.startsWith(`${context.userId}/${data.casoId}/`)){limitations.push(`${f.nome}: acesso indisponível`);continue;}
  if(f.bytes>10*1024*1024||total+f.bytes>30*1024*1024){limitations.push(`${f.nome}: não examinado nesta análise, limite de tamanho; revisão humana necessária`);continue;}
  const {data:blob,error}=await context.supabase.storage.from('case-documents').download(f.path);
  if(error||!blob){limitations.push(`${f.nome}: arquivo inacessível`);continue;}
  media.push({nome:f.nome,mime:f.mime,bytes:new Uint8Array(await blob.arrayBuffer())});total+=blob.size;
 }
 const {legalAI}=await import('@/lib/legal/ai.server');return legalAI(data.kind,JSON.stringify({cliente:caso.data.nome,dados:caso.data.dados,trabalho:c,categorias:REVIEW_CATEGORIES,pergunta:data.question,exemplos:state?.training.exemplos,arquivosFornecidos:media.map(f=>f.nome),limitacoes:limitations}),c.area??'Previdenciário',state?.training.instrucoes??'',media);
});
export const approveLegal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({casoId:z.string().uuid(),kind:z.enum(['audit','protocol','checklist','draft'])})).handler(async({data,context})=>{if(data.kind==='checklist'||data.kind==='draft'){const r=await context.supabase.rpc('approve_material',{p_case:data.casoId,p_kind:data.kind});if(r.error)throw new Error(r.error.message);return {ok:true};}const gate=await context.supabase.rpc('material_status',{p_case:data.casoId});const approved=gate.data as {checklist?:boolean;draft?:boolean}|null;if(gate.error||!approved?.checklist||!approved?.draft)throw new Error('Checklist e minuta exigem aprovação jurídica da versão atual.');const {data:roles,error}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);if(error)throw new Error('Não foi possível conferir o perfil.');const permitted=roles?.some(r=>data.kind==='protocol'?r.role==='advogada_senior':r.role==='advogado_junior'||r.role==='advogada_senior');if(!permitted)throw new Error(data.kind==='protocol'?'Confirmação reservada à Advogada Sênior.':'Validação reservada ao Advogado Júnior ou à Advogada Sênior.');const [w,caso]=await Promise.all([context.supabase.from('office_workspace').select('dados').eq('owner_id',context.userId).single(),context.supabase.from('casos').select('id').eq('id',data.casoId).single()]);if(w.error||caso.error)throw new Error('Caso indisponível.');const state=w.data.dados as unknown as OfficeState;const c=state.casos[data.casoId];if(!c||!reviewReady(c))throw new Error('Há documentos, verificações ou pendências que impedem a liberação.');const revision=await revisionHash(c);if(data.kind==='protocol'){const {data:previous}=await context.supabase.from('legal_approvals').select('id').eq('caso_id',data.casoId).eq('owner_id',context.userId).eq('kind','audit').eq('revision',revision);if(!previous?.length)throw new Error('A versão atual precisa de auditoria humana aprovada.');if(!c.cnj||!c.recibo||!c.protocoloData)throw new Error('Informe CNJ, data e recibo do protocolo externo.');}const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const result=await supabaseAdmin.from('legal_approvals').insert({owner_id:context.userId,caso_id:data.casoId,kind:data.kind,revision,approved_by:context.userId});if(result.error)throw new Error('Não foi possível salvar a validação.');return {ok:true};});
