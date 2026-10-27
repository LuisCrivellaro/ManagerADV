import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { AssessorCase } from '@/lib/assessor';
export function useOfficeNotifications(cases:AssessorCase[]|undefined){const seen=useRef<Set<string>|null>(null);useEffect(()=>{if(!cases)return;const ids=new Set<string>();for(const c of cases){for(const m of c.mensagens??[]){const key=`m:${c.id}:${m.id}`;ids.add(key);if(seen.current&&!seen.current.has(key)&&m.de==='cliente')toast.info(`Nova mensagem de ${c.nome}`,{duration:4000});}for(const m of c.movements??[]){const key=`e:${c.id}:${m.id}`;ids.add(key);if(seen.current&&!seen.current.has(key)&&m.nova)toast.info(`Nova movimentação no processo ${m.cnj}`,{duration:4000});}}seen.current=ids;},[cases]);}
