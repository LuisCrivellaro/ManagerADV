import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Route as AuthRoute } from '@/routes/_authenticated/route';
import { listarCasos, salvarCaso } from '@/lib/casos';
import { loadOffice, saveOffice } from '@/lib/office-store';
import type { OfficeState, OfficeCase } from '@/lib/office';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
export function useOffice() { const {user}=AuthRoute.useRouteContext(); const qc=useQueryClient();const [busy,setBusy]=useState(false);const lock=useRef(false);const cases=useQuery({queryKey:['casos'],queryFn:listarCasos,refetchInterval:15000}); const workspace=useQuery({queryKey:['office',user.id],queryFn:()=>loadOffice(user.id)});
 const save=async(fn:(state:OfficeState)=>OfficeState)=>{ if(lock.current) throw new Error('Aguarde o salvamento atual.'); const old=qc.getQueryData<OfficeState>(['office',user.id]);if(!old) throw new Error('Dados ainda não carregados.'); lock.current=true;setBusy(true); try {const next=fn(old);await saveOffice(user.id,next);qc.setQueryData(['office',user.id],next);await qc.invalidateQueries({queryKey:['dashboard']});return next;} catch(e){toast.error('Não foi possível salvar.',{description:(e as Error).message});throw e;}finally{lock.current=false;setBusy(false);} };
 const patch=async(id:string,update:Partial<OfficeCase>)=>save(s=>{const old=s.casos[id]??{};const changed=Boolean(old.peticao && ((update.peticao!==undefined&&update.peticao!==old.peticao)||(update.memorial!==undefined&&update.memorial!==old.memorial)));const versoes=changed?[...(old.versoes??[]),{data:new Date().toISOString(),peticao:old.peticao??'',memorial:old.memorial??''}]:old.versoes??[];return {...s,casos:{...s.casos,[id]:{...old,...update,versoes}}};});
 const approvalStatus=useQuery({queryKey:['material-approvals',user.id,cases.data,workspace.data],enabled:!!cases.data,refetchInterval:15000,queryFn:async()=>{const entries=await Promise.all((cases.data??[]).map(async c=>{const r=await supabase.rpc('material_status',{p_case:c.id});if(r.error)throw r.error;return [c.id,r.data] as const;}));return Object.fromEntries(entries) as Record<string,{checklist:boolean;draft:boolean;canApprove:boolean}>;}});
 const refreshApprovals=()=>qc.invalidateQueries({queryKey:['material-approvals']});
 const setPipeline=async(id:string,etapaPipeline:number)=>{const c=cases.data?.find(c=>c.id===id);if(!c)return;await salvarCaso(c,{...c,etapaPipeline});await qc.invalidateQueries({queryKey:['casos']});};
 return {user,approvals:approvalStatus.data??{},refreshApprovals,cases:cases.data??[],state:workspace.data,loading:cases.isLoading||workspace.isLoading,error:cases.error||workspace.error,busy,save,patch,setPipeline,retry:()=>Promise.all([cases.refetch(),workspace.refetch()])}; }
