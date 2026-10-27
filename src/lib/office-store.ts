import { supabase } from '@/integrations/supabase/client';
import { defaultState, type OfficeState } from '@/lib/office';
import type { Json } from '@/integrations/supabase/types';
export async function loadOffice(owner: string): Promise<OfficeState> { const {data,error} = await supabase.from('office_workspace').select('dados').eq('owner_id',owner).maybeSingle(); if(error) throw error; const saved = data?.dados as unknown as Partial<OfficeState> | undefined; return { ...defaultState, ...saved, casos: saved?.casos ?? {}, training: {...defaultState.training, ...saved?.training} }; }
export async function saveOffice(owner: string, state: OfficeState) {
 for(let attempt=0;attempt<5;attempt++){
  const row=await supabase.from('office_workspace').select('dados,updated_at').eq('owner_id',owner).maybeSingle();
  if(row.error)throw row.error;
  const salvo=row.data?.dados as unknown as OfficeState|undefined;
  const pause=salvo?.anaPausa;
  // A entrada do WhatsApp é salva só pelo servidor (Canal e Agente); a tela nunca a sobrescreve.
  const {entradaWhatsApp:_ignorada,...estado}=state;
  const next={...estado,...(pause?.ativa?{anaPausa:pause}:{}),...(salvo?.entradaWhatsApp?{entradaWhatsApp:salvo.entradaWhatsApp}:{})};
  const r=row.data?await supabase.from('office_workspace').update({dados:next as unknown as Json,updated_at:new Date().toISOString()}).eq('owner_id',owner).eq('updated_at',row.data.updated_at).select('owner_id'):await supabase.from('office_workspace').insert({owner_id:owner,dados:next as unknown as Json}).select('owner_id');
  if(r.error)throw r.error;
  if(r.data?.length)return;
 }
 throw new Error('Área de trabalho alterada simultaneamente. Atualize e tente novamente.');
}
export async function saveFile(owner:string, caseId:string, file:File) { const bytes = await file.arrayBuffer(); const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''); const path=`${owner}/${caseId}/${crypto.randomUUID()}/${file.name}`; const {error}=await supabase.storage.from('case-documents').upload(path,file,{upsert:false,contentType:file.type}); if(error) throw error; return {hash,path}; }
export async function readFile(path:string) { const {data,error}=await supabase.storage.from('case-documents').download(path); if(error) throw error; return data; }
export async function fileBase64(blob:Blob):Promise<string> { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]??'');r.onerror=reject;r.readAsDataURL(blob);}); }
export function downloadBlob(blob:Blob,name:string) { const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
