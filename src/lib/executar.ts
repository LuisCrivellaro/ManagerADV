import { toast } from 'sonner';
import { recordAudit } from '@/services/integracoes';
export async function executar(label:string,fn:()=>Promise<unknown>,onOk?:()=>void){const id=toast.loading(`${label}…`);try{const result=await fn();recordAudit(label,'sucesso');toast.success(`${label}: concluído`,{id});onOk?.();return result;}catch(e){const message=e instanceof Error?e.message:'Não foi possível concluir.';recordAudit(label,'erro',message);toast.error(`${label}: falhou`,{id,description:message,action:{label:'Tentar novamente',onClick:()=>{void executar(label,fn,onOk);}}});return undefined;}}
