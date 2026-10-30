import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { OfficeState } from './office';
import type { Conversa } from './mock-data';
import { forbiddenTopics } from './atendimento';
export const atendimentoAI=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({casoId:z.string().uuid(),kind:z.enum(['resposta','resumo','andamento']),texto:z.string().max(16000).optional()})).handler(async({data,context})=>{
 const [caseRow,ws,checklist]=await Promise.all([context.supabase.from('casos').select('nome,dados').eq('id',data.casoId).single(),context.supabase.from('office_workspace').select('dados').eq('owner_id',context.userId).maybeSingle(),context.supabase.from('checklist_itens').select('nome,recebido').eq('caso_id',data.casoId)]);
 if(caseRow.error||ws.error||checklist.error)throw new Error('Caso indisponível.');
 const state=ws.data?.dados as unknown as OfficeState|undefined;const c=caseRow.data.dados as unknown as Conversa;
 const {defaultState}=await import('./office');const training=state?.training??defaultState.training;
 const {legalAI}=await import('./legal/ai.server');
 const task=data.kind==='resumo'?'Resuma somente: quem é, etapa, documentos faltantes e início da espera. Datas ausentes são desconhecidas.':data.kind==='andamento'?'Traduza o andamento para linguagem simples sem inventar datas, providências ou resultado. Não altere o sentido jurídico.':'Sugira uma resposta breve e acolhedora à última mensagem do cliente. Não invente horários, links ou fatos.';
 const r=await legalAI('training',JSON.stringify({tarefa:task,cliente:caseRow.data.nome,etapa:c.etapa,faltantes:checklist.data.filter(d=>!d.recebido).map(d=>d.nome),mensagens:(c.mensagens??[]).slice(-20),inicioEspera:c.mensagens?.at(-1)?.dataHora??'Não informado',texto:data.texto,exemplos:training.exemplos}),'Atendimento',`${training.instrucoes}\nTemas proibidos: ${training.proibidos.join(', ')}. Se a pergunta envolver esses temas, encaminhe para revisão humana.`);
 return {texto:r.texto,alertas:[...new Set([...forbiddenTopics(r.texto,training.proibidos),...forbiddenTopics(data.kind==='andamento'?data.texto??'':c.mensagens?.at(-1)?.texto??'',training.proibidos)])]};
});
export const sugerirResposta=atendimentoAI;
